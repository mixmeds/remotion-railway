import express from "express";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { createReadStream } from "fs";
import { randomUUID } from "crypto";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/* -------------------------------------------------------------------------- */
/*                               APP EXPRESS                                  */
/* -------------------------------------------------------------------------- */

const app = express();
app.use(express.json());

// /public → ink-texture.webp, photo-placeholder.jpg etc.
app.use(express.static(path.join(process.cwd(), "public")));

// Diretório para salvar vídeos/áudios localmente
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

// Servir arquivos estáticos em /renders (útil para debug)
app.use("/renders", express.static(rendersDir));

/* -------------------------------------------------------------------------- */
/*                         VARIÁVEIS DE AMBIENTE                               */
/* -------------------------------------------------------------------------- */

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_ACCOUNT_ID,
  R2_PUBLIC_BASE_URL,
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  SERVER_URL,
} = process.env;

if (!SERVER_URL) {
  console.warn(
    "⚠️ SERVER_URL não definido. Ex: https://meuapp.railway.app"
  );
}

const SERVER_BASE = (SERVER_URL ?? "").replace(/\/$/, "");

/* -------------------------------------------------------------------------- */
/*                               CONFIG R2                                     */
/* -------------------------------------------------------------------------- */

let r2Client: S3Client | null = null;

if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_ACCOUNT_ID) {
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log("✅ R2 configurado com sucesso.");
} else {
  console.warn("⚠️ R2 não configurado. Upload para R2 será ignorado.");
}

const uploadToR2 = async (
  filePath: string,
  objectKey: string,
  mime: string
): Promise<string> => {
  if (!r2Client || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    console.warn(
      "⚠️ uploadToR2 chamado, mas R2 não está totalmente configurado."
    );
    return "";
  }

  const fileStream = createReadStream(filePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    Body: fileStream,
    ContentType: mime,
  });

  await r2Client.send(command);

  const base = R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${base}/${objectKey}`;
};

/* -------------------------------------------------------------------------- */
/*                        BUNDLE REMOTION (CACHEADO)                           */
/* -------------------------------------------------------------------------- */

let bundledLocation: string | null = null;

const getBundledLocation = async () => {
  if (bundledLocation) {
    return bundledLocation;
  }

  console.log("📦 Gerando bundle do Remotion...");
  bundledLocation = await bundle({
    entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
    webpackOverride: (config) => config,
  });
  console.log("✅ Bundle pronto");
  return bundledLocation;
};

/* -------------------------------------------------------------------------- */
/*                       ELEVENLABS — ÁUDIO DINÂMICO                           */
/* -------------------------------------------------------------------------- */

const buildNoelLine = (name: string) => {
  const safeName = name?.trim() || "meu amigo";
  return `${safeName}, você é alguém muito especial… mais do que imagina.`;
};

const generateNoelAudio = async (
  jobId: string,
  name: string
): Promise<string> => {
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY não configurada.");
  if (!ELEVENLABS_VOICE_ID) throw new Error("ELEVENLABS_VOICE_ID não configurada.");
  if (!SERVER_BASE) throw new Error("SERVER_URL/SERVER_BASE não configurado.");

  const text = buildNoelLine(name);
  console.log(`🗣️ Gerando áudio ElevenLabs para "${name}"...`);

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
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
  const localAudioPath = path.join(rendersDir, `audio-${jobId}.mp3`);

  // salva local (usado pelo Remotion via rota /audio/:id)
  await fsPromises.writeFile(localAudioPath, mp3Buffer);

  // rota interna que o Chromium do Remotion vai consumir
  const localAudioUrl = `${SERVER_BASE}/audio/${jobId}`;

  // upload para R2 apenas para persistência (não usado pelo render)
  try {
    const objectKey = `audios/${jobId}.mp3`;
    const audioUrlR2 = await uploadToR2(localAudioPath, objectKey, "audio/mpeg");
    if (audioUrlR2) {
      console.log(`🔊 Áudio enviado para R2: ${audioUrlR2}`);
    }
  } catch (err) {
    console.error(
      "⚠️ Falha ao enviar áudio para R2 (seguindo só com o local):",
      err
    );
  }

  console.log(
    `🎧 Áudio local para render (rota interna /audio): ${localAudioUrl}`
  );

  return localAudioUrl; // <- ESSA URL vai para o <Audio src={audioSrc}>
};

/* -------------------------------------------------------------------------- */
/*                              ROTA /audio/:id                                */
/*   Stream de áudio local com Accept-Ranges (ideal para Chromium/Remotion)   */
/* -------------------------------------------------------------------------- */

app.get("/audio/:id", (req, res) => {
  const jobId = req.params.id;
  const audioPath = path.join(rendersDir, `audio-${jobId}.mp3`);

  if (!fs.existsSync(audioPath)) {
    return res.status(404).send("Audio not found");
  }

  const stat = fs.statSync(audioPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", "audio/mpeg");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const file = fs.createReadStream(audioPath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "audio/mpeg",
    });
    file.pipe(res);
  } else {
    res.setHeader("Content-Length", fileSize.toString());
    fs.createReadStream(audioPath).pipe(res);
  }
});

/* -------------------------------------------------------------------------- */
/*                              FILA DE RENDER                                 */
/* -------------------------------------------------------------------------- */

type RenderStatus = "queued" | "processing" | "uploading" | "done" | "error";

type RenderJob = {
  id: string;
  name: string;
  photoUrl: string;
  status: RenderStatus;
  createdAt: string;
  updatedAt: string;
  videoUrl?: string;
  error?: string;
};

const jobs = new Map<string, RenderJob>();
const queue: string[] = [];
let isProcessing = false;

const nowISO = () => new Date().toISOString();

const enqueueJob = (job: RenderJob) => {
  jobs.set(job.id, job);
  queue.push(job.id);
  processQueue();
};

const processQueue = async () => {
  if (isProcessing) return;
  const nextId = queue.shift();
  if (!nextId) return;

  const job = jobs.get(nextId);
  if (!job) return;

  isProcessing = true;
  job.status = "processing";
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  try {
    console.log(`🎬 Processando job ${job.id} (name="${job.name}")...`);
    await runRenderJob(job);
  } catch (err: any) {
    console.error("❌ Erro ao processar job:", err);
    job.status = "error";
    job.error = err?.message ?? String(err);
  } finally {
    job.updatedAt = nowISO();
    jobs.set(job.id, job);

    isProcessing = false;
    if (queue.length > 0) processQueue();
  }
};

/* -------------------------------------------------------------------------- */
/*                                RENDER JOB                                   */
/* -------------------------------------------------------------------------- */

const runRenderJob = async (job: RenderJob) => {
  const serveUrl = await getBundledLocation();

  console.log("🔁 Lendo composições Remotion...");
  const comps = await getCompositions(serveUrl, {
    inputProps: { name: job.name, photoUrl: job.photoUrl },
  });

  const composition = comps.find((c) => c.id === "noel");
  if (!composition) {
    throw new Error("Composição 'noel' não encontrada.");
  }

  console.log("🎧 Gerando áudio dinâmico para o render...");
  const audioSrc = await generateNoelAudio(job.id, job.name);

  const tempOutput = path.join(rendersDir, `render-${job.id}.mp4`);

  console.log("🎞️ Iniciando render do Remotion...", {
    serveUrl,
    compId: composition.id,
    jobId: job.id,
    name: job.name,
    photoUrl: job.photoUrl,
    audioSrc,
  });

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    audioCodec: "aac",
    outputLocation: tempOutput,
    inputProps: {
      name: job.name,
      photoUrl: job.photoUrl,
      audioSrc, // 🔊 passa URL /audio/:id para o Remotion
    },
    crf: 24,
    jpegQuality: 70,
  });

  console.log("✅ Render Remotion finalizado, iniciando upload do vídeo...");

  job.status = "uploading";
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  const objectKey = `renders/${job.id}.mp4`;
  const videoUrl = await uploadToR2(tempOutput, objectKey, "video/mp4");

  // limpa arquivo de vídeo local
  fs.unlink(tempOutput, () => {});

  // mantém o áudio local até ter certeza que não vai precisar re-renderizar
  // (se quiser apagar aqui, pode descomentar:)
  // const localAudioPath = path.join(rendersDir, `audio-${job.id}.mp3`);
  // fs.unlink(localAudioPath, () => {});

  job.status = "done";
  job.videoUrl = videoUrl;
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  console.log(`🎉 Job ${job.id} finalizado. Vídeo em: ${videoUrl}`);
};

/* -------------------------------------------------------------------------- */
/*                                    ROTAS                                   */
/* -------------------------------------------------------------------------- */

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API funcionando." });
});

app.post("/render", (req, res) => {
  const { name, photoUrl } = req.body as { name?: string; photoUrl?: string };

  if (!name || !photoUrl) {
    return res
      .status(400)
      .json({ ok: false, error: "Envie name e photoUrl." });
  }

  const jobId = randomUUID();
  const now = nowISO();

  const job: RenderJob = {
    id: jobId,
    name: name.trim(),
    photoUrl: photoUrl.trim(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };

  console.log(`🧾 Novo job enfileirado: ${jobId} (name="${job.name}")`);
  enqueueJob(job);

  res.json({ ok: true, jobId });
});

app.get("/job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Job não encontrado" });
  }
  res.json(job);
});

/* -------------------------------------------------------------------------- */
/*                               START SERVER                                  */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
