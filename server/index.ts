import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { bundle } from "@remotion/bundler";
import { RenderMediaOnLambdaInput, renderMedia } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import fetch from "node-fetch";

// -------------------- CONFIG BÁSICA --------------------

const PORT = process.env.PORT || 8080;
const ENTRY = path.join(process.cwd(), "remotion", "index.ts");
const OUT_DIR = path.join(os.tmpdir(), "renders");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// -------------------- R2 CONFIG --------------------

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

const r2Client =
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

async function uploadToR2(
  filePath: string,
  objectKey: string,
  contentType: string
): Promise<string | null> {
  if (!r2Client || !R2_BUCKET_NAME || !R2_PUBLIC_BASE_URL) {
    console.warn("⚠️ R2 não configurado, pulando upload:", {
      hasClient: !!r2Client,
      bucket: R2_BUCKET_NAME,
      publicBase: R2_PUBLIC_BASE_URL,
    });
    return null;
  }

  const fileBuffer = await fs.promises.readFile(filePath);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  const publicUrl = `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;
  console.log("✅ Upload R2 concluído:", publicUrl);
  return publicUrl;
}

// -------------------- ELEVENLABS TTS --------------------

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Gera o áudio dinâmico EM MEMÓRIA e devolve um data:audio/mpeg;base64,...
// (sem depender de rede na hora do render)
async function generateNoelAudio(jobId: string, name: string): Promise<string> {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    throw new Error("ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID não configurados");
  }

  const texto = `${name}, você é alguém muito especial... mais do que imagina.`;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

  console.log(`🗣️ [TTS] Gerando áudio ElevenLabs para "${name}"...`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    } as any,
    body: JSON.stringify({
      text: texto,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0.4,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Erro ElevenLabs: ${await res.text()}`);
  }

  const mp3Buffer = Buffer.from(await res.arrayBuffer());

  // 1) Data URL para o Remotion (garantido, sem CORS)
  const base64 = mp3Buffer.toString("base64");
  const dataUrl = `data:audio/mpeg;base64,${base64}`;

  // 2) Opcional: salvar + enviar pro R2 só pra histórico / debug
  try {
    const localAudioPath = path.join(OUT_DIR, `${jobId}.mp3`);
    await fs.promises.writeFile(localAudioPath, mp3Buffer);
    const objectKey = `audios/${jobId}.mp3`;
    const audioUrlR2 = await uploadToR2(localAudioPath, objectKey, "audio/mpeg");
    if (audioUrlR2) {
      console.log(`🔊 Áudio enviado para R2: ${audioUrlR2}`);
    }
  } catch (err) {
    console.error("⚠️ Falha ao salvar/enviar áudio para R2:", err);
  }

  console.log(
    `🎧 Áudio dinâmico gerado (data:audio/mpeg;base64,...) para o job ${jobId}`
  );

  return dataUrl;
}

// -------------------- TIPOS --------------------

type NoelRenderRequest = {
  name: string;
  photoUrl?: string;
};

type NoelJob = {
  id: string;
  status: "queued" | "rendering" | "done" | "error";
  error?: string;
  name: string;
  photoUrl?: string;
  outputUrl?: string;
};

const jobQueue: NoelJob[] = [];

// -------------------- BUNDLE REMOTION --------------------

let bundled = false;
let serveUrlGlobal: string | null = null;

async function ensureBundle() {
  if (bundled && serveUrlGlobal) return serveUrlGlobal;

  console.log("📦 Gerando bundle Remotion...");
  serveUrlGlobal = await bundle(ENTRY, () => undefined, {
    enableCaching: true,
    webpackOverride: (config) => config,
  });
  bundled = true;
  console.log("✅ Bundle Remotion pronto:", serveUrlGlobal);
  return serveUrlGlobal;
}

// -------------------- RENDER --------------------

async function runRenderJob(job: NoelJob) {
  try {
    job.status = "rendering";

    const serveUrl = await ensureBundle();

    // Gera áudio dinâmico (data URL)
    const audioSrc = await generateNoelAudio(job.id, job.name);

    console.log("🎧 [SERVER] inputProps enviados pro Remotion:", {
      name: job.name,
      photoUrl: job.photoUrl,
      hasPhoto: !!job.photoUrl,
      audioSrcSnippet: audioSrc.substring(0, 50) + "...",
    });

    const compositionId = "noel";

    const outputPath = path.join(OUT_DIR, `${job.id}.mp4`);

    const inputProps = {
      name: job.name,
      photoUrl: job.photoUrl,
      hasPhoto: !!job.photoUrl,
      audioSrc,
    };

    const options: RenderMediaOnLambdaInput = {
      composition: compositionId,
      serveUrl,
      inputProps,
      codec: "h264",
      audioCodec: "aac",
      outName: `${job.id}.mp4`,
      outputLocation: outputPath,
      chromiumOptions: {
        disableWebSecurity: true,
      },
    };

    console.log("🎞️ Iniciando render do Remotion...", {
      jobId: job.id,
      name: job.name,
      photoUrl: job.photoUrl,
    });

    await renderMedia(options);

    console.log("✅ Render Remotion finalizado, iniciando upload do vídeo...");

    const objectKey = `renders/${job.id}.mp4`;
    const videoUrl = await uploadToR2(outputPath, objectKey, "video/mp4");

    job.status = "done";
    job.outputUrl = videoUrl || null || undefined;

    console.log(`🎉 Job ${job.id} finalizado. Vídeo em: ${job.outputUrl}`);
  } catch (err: any) {
    console.error("❌ Erro ao processar job:", err);
    job.status = "error";
    job.error = String(err?.message || err);
  }
}

function processQueue() {
  const next = jobQueue.find((j) => j.status === "queued");
  if (!next) return;
  runRenderJob(next).catch((err) => {
    console.error("Erro ao processar job:", err);
  });
}

setInterval(processQueue, 2000);

// -------------------- EXPRESS --------------------

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/render", async (req, res) => {
  try {
    const { name, photoUrl } = req.body as NoelRenderRequest;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name é obrigatório" });
    }

    const id = Date.now().toString();

    const job: NoelJob = {
      id,
      status: "queued",
      name,
      photoUrl,
    };

    jobQueue.push(job);

    console.log(`🧾 Novo job enfileirado: ${id} (name="${name}")`);

    res.json({ jobId: id });
  } catch (err: any) {
    console.error("Erro /render:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get("/job/:id", (req, res) => {
  const job = jobQueue.find((j) => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job não encontrado" });
  }
  res.json(job);
});

app.listen(PORT, () => {
  console.log("✅ R2 configurado com sucesso.");
  console.log(`🚀 Rodando na porta ${PORT}`);
});
