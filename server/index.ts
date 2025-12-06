import express from "express";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { createReadStream } from "fs";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
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

// Servir os arquivos locais (áudio temporário, vídeo temporário se quiser testar)
app.use("/renders", express.static(rendersDir));

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
  console.warn("⚠️ SERVER_URL não definido. Ex: https://meuapp.railway.app");
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
  console.warn("⚠️ R2 não configurado. Upload para R2 será ignorado.");
}

const uploadToR2 = async (filePath: string, objectKey: string, mime: string) => {
  if (!r2Client || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    console.warn("⚠️ uploadToR2 chamado, mas R2 não está totalmente configurado.");
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
/*                       ELEVENLABS + FFMPEG (MP3 → WAV)                      */
/* -------------------------------------------------------------------------- */

// Frase dinâmica
const buildNoelLine = (name: string) => {
  const safeName = name.trim() || "meu amigo";
  return `${safeName}, você é alguém muito especial… mais do que imagina.`;
};

// Converte um MP3 para WAV usando ffmpeg
const convertMp3ToWav = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log("🎛️ Convertendo MP3 para WAV com ffmpeg...");
    const ff = spawn("ffmpeg", [
      "-y", // sobrescreve se existir
      "-i",
      inputPath,
      "-acodec",
      "pcm_s16le",
      "-ar",
      "44100",
      outputPath,
    ]);

    ff.stderr.on("data", (data) => {
      // log de debug (ffmpeg escreve em stderr normalmente)
      console.log("[ffmpeg]", data.toString());
    });

    ff.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Conversão MP3 → WAV concluída.");
        resolve();
      } else {
        reject(new Error(`ffmpeg encerrou com código ${code}`));
      }
    });

    ff.on("error", (err) => {
      reject(err);
    });
  });
};

const generateNoelAudio = async (jobId: string, name: string): Promise<string> => {
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY não configurada.");
  if (!ELEVENLABS_VOICE_ID) throw new Error("ELEVENLABS_VOICE_ID não configurada.");
  if (!SERVER_URL) throw new Error("SERVER_URL não configurada.");

  const text = buildNoelLine(name);
  console.log(`🗣️ Gerando áudio ElevenLabs para "${name}"...`);

  // ElevenLabs devolve MP3 (permitido no plano atual)
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;

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

  const audioBuffer = Buffer.from(await res.arrayBuffer());

  // Caminhos locais
  const localMp3Path = path.join(rendersDir, `audio-${jobId}.mp3`);
  const localWavPath = path.join(rendersDir, `audio-${jobId}.wav`);

  // Salva MP3
  await fsPromises.writeFile(localMp3Path, audioBuffer);

  // Converte MP3 → WAV
  await convertMp3ToWav(localMp3Path, localWavPath);

  // URL local servida pelo Express (é essa que o Remotion usa)
  const baseServer = SERVER_URL.replace(/\/$/, "");
  const localAudioUrl = `${baseServer}/renders/audio-${jobId}.wav`;

  // Upload opcional do WAV para R2
  try {
    const objectKey = `audios/${jobId}.wav`;
    const audioUrlR2 = await uploadToR2(localWavPath, objectKey, "audio/wav");
    if (audioUrlR2) {
      console.log(`🔊 Áudio (WAV) enviado para R2: ${audioUrlR2}`);
    }
  } catch (err) {
    console.error("⚠️ Falha ao enviar áudio para R2 (seguindo só com o local):", err);
  }

  console.log(`🎧 Áudio local para render (WAV): ${localAudioUrl}`);
  return localAudioUrl;
};

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
    console.log(`🎬 Processando job ${job.id}...`);
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

  // Primeiro só pra ler a composição
  const comps = await getCompositions(serveUrl, {
    inputProps: { name: job.name, photoUrl: job.photoUrl },
  });

  const composition = comps.find((c) => c.id === "noel");
  if (!composition) {
    throw new Error("Composição 'noel' não encontrada.");
  }

  // Gera áudio dinâmico (URL local de WAV)
  const audioSrc = await generateNoelAudio(job.id, job.name);

  const tempOutput = path.join(rendersDir, `render-${job.id}.mp4`);

  console.log("🎞️ Iniciando render do Remotion...");
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: tempOutput,
    inputProps: {
      name: job.name,
      photoUrl: job.photoUrl,
      audioSrc, // passa a URL do WAV para o <Audio /> no Remotion
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

  // limpa áudios locais (wav + mp3)
  const localWavPath = path.join(rendersDir, `audio-${job.id}.wav`);
  const localMp3Path = path.join(rendersDir, `audio-${job.id}.mp3`);
  fs.unlink(localWavPath, () => {});
  fs.unlink(localMp3Path, () => {});

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
    return res.status(400).json({ ok: false, error: "Envie name e photoUrl." });
  }

  const jobId = randomUUID();
  const now = nowISO();

  const job: RenderJob = {
    id: jobId,
    name,
    photoUrl,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(jobId, job);
  queue.push(jobId);
  processQueue();

  res.json({ ok: true, jobId });
});

app.get("/jobs/:id", (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);
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
