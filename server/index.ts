import express from "express";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { createReadStream } from "fs";
import { randomUUID } from "crypto";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const app = express();
app.use(express.json());

// Servir /public (ink-texture.webp, photo-placeholder.jpg, etc.)
app.use(express.static(path.join(process.cwd(), "public")));

// Diretório para salvar os vídeos e áudios localmente (fallback)
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}
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
  console.warn("⚠️ SERVER_URL não definido. Defina ex: https://meuapp.railway.app");
}

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
  console.warn("⚠️ R2 não configurado completamente.");
}

const uploadToR2 = async (localFilePath: string, objectKey: string, mime: string) => {
  if (!r2Client || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    throw new Error("R2 não configurado corretamente.");
  }

  const fileStream = createReadStream(localFilePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    Body: fileStream,
    ContentType: mime,
  });

  await r2Client.send(command);

  return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;
};

/* -------------------------------------------------------------------------- */
/*                        BUNDLE REMOTION (CACHEADO)                           */
/* -------------------------------------------------------------------------- */

let bundledLocation: string | null = null;

const getBundledLocation = async () => {
  if (bundledLocation) return bundledLocation;

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

const generateNoelAudio = async (jobId: string, name: string): Promise<string> => {
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY não configurada.");
  if (!ELEVENLABS_VOICE_ID) throw new Error("ELEVENLABS_VOICE_ID não configurada.");

  const text = buildNoelLine(name);

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

  // salva local
  await fsPromises.writeFile(localAudioPath, mp3Buffer);

  // sobe pro R2
  const objectKey = `audios/${jobId}.mp3`;
  const audioUrl = await uploadToR2(localAudioPath, objectKey, "audio/mpeg");

  // remove local
  fs.unlink(localAudioPath, () => {});

  console.log(`🔊 Áudio enviado para R2: ${audioUrl}`);
  return audioUrl;
};

/* -------------------------------------------------------------------------- */
/*                             SISTEMA DE JOBS                                 */
/* -------------------------------------------------------------------------- */

type JobStatus = "queued" | "rendering" | "uploading" | "done" | "error";

type RenderJob = {
  id: string;
  name: string;
  photoUrl: string;
  status: JobStatus;
  videoUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
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

  try {
    console.log(`🎬 Processando job ${job.id}...`);
    await runRenderJob(job);
  } catch (err: any) {
    job.status = "error";
    job.error = err.message;
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

  const comps = await getCompositions(serveUrl, {
    inputProps: { name: job.name, photoUrl: job.photoUrl },
  });
  const composition = comps.find((c) => c.id === "noel");
  if (!composition) throw new Error("Composição 'noel' não encontrada.");

  // 🔊 gerar áudio
  const audioSrc = await generateNoelAudio(job.id, job.name);

  const tempOutput = path.join("/tmp", `${job.id}.mp4`);

  job.status = "rendering";
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: tempOutput,
    inputProps: {
      name: job.name,
      photoUrl: job.photoUrl,
      audioSrc, // 🔊 passa o áudio para o Remotion
    },
    crf: 24,
    jpegQuality: 70,
  });

  job.status = "uploading";
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  const objectKey = `renders/${job.id}.mp4`;
  const videoUrl = await uploadToR2(tempOutput, objectKey, "video/mp4");

  fs.unlink(tempOutput, () => {});

  job.status = "done";
  job.videoUrl = videoUrl;
  job.updatedAt = nowISO();
  jobs.set(job.id, job);
};

/* -------------------------------------------------------------------------- */
/*                                    ROTAS                                   */
/* -------------------------------------------------------------------------- */

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API funcionando." });
});

app.post("/render", (req, res) => {
  const { name, photoUrl } = req.body;

  if (!name || !photoUrl) {
    return res.status(400).json({ ok: false, error: "Envie name e photoUrl." });
  }

  const jobId = randomUUID();

  const job: RenderJob = {
    id: jobId,
    name: name.trim(),
    photoUrl: photoUrl.trim(),
    status: "queued",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  enqueueJob(job);

  res.json({ ok: true, jobId });
});

app.get("/job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: "Job não encontrado" });
  res.json(job);
});

/* -------------------------------------------------------------------------- */
/*                               START SERVER                                  */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`));
