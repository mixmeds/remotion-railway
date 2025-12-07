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
/*                               SETUP BÁSICO                                  */
/* -------------------------------------------------------------------------- */

const app = express();
app.use(express.json());

const publicDir = path.join(process.cwd(), "public");
const rendersDir = path.join(process.cwd(), "renders");

if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

app.use(express.static(publicDir));
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

// URLs das partes estáticas do vídeo Noel (no R2)
const ENTRADA_VIDEO_URL =
  "https://pub-60278fada25346f1873f83649b338d98.r2.dev/assets/entrada-magica-h264.mp4";
const SAIDA_VIDEO_URL =
  "https://pub-60278fada25346f1873f83649b338d98.r2.dev/assets/saida-magica-h264.mp4";

if (!SERVER_URL) {
  console.warn("⚠️ SERVER_URL não definido. Ex: https://meuservidor.railway.app");
}

/* -------------------------------------------------------------------------- */
/*                               CLIENTE R2                                    */
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
  console.log("✅ R2 configurado.");
} else {
  console.warn("⚠️ R2 não configurado completamente, upload será ignorado.");
}

const uploadToR2 = async (
  filePath: string,
  objectKey: string,
  mime: string
): Promise<string> => {
  if (!r2Client || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    console.warn("⚠️ R2 indisponível, pulando upload.");
    return "";
  }

  const fileStream = createReadStream(filePath);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: objectKey,
      Body: fileStream,
      ContentType: mime,
    })
  );

  const base = R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${base}/${objectKey}`;
};

/* -------------------------------------------------------------------------- */
/*                        BUNDLE REMOTION (CACHEADO)                           */
/* -------------------------------------------------------------------------- */

let bundledLocation: string | null = null;

const getBundledLocation = async (): Promise<string> => {
  if (bundledLocation) return bundledLocation;

  console.log("📦 Gerando bundle Remotion...");
  bundledLocation = await bundle({
    entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
  });
  console.log("✅ Bundle pronto:", bundledLocation);

  return bundledLocation;
};

/* -------------------------------------------------------------------------- */
/*                       ELEVENLABS + FFMPEG (MP3 → WAV)                      */
/* -------------------------------------------------------------------------- */

const buildLine = (name: string): string => {
  const safe = name.trim() || "meu amigo";
  return `${safe}, você é alguém muito especial… mais do que imagina.`;
};

const convertMp3ToWav = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log("🎛️ Convertendo MP3 → WAV com ffmpeg...");
    const ff = spawn("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-acodec",
      "pcm_s16le",
      "-ar",
      "44100",
      outputPath,
    ]);

    ff.stderr.on("data", (d) => console.log("[ffmpeg]", d.toString()));

    ff.on("close", (code) => {
      console.log("🎛️ ffmpeg saiu com código:", code);
      if (code === 0) resolve();
      else reject(new Error("ffmpeg falhou com código " + code));
    });

    ff.on("error", (err) => {
      console.error("❌ Erro ao spawnar ffmpeg:", err);
      reject(err);
    });
  });
};

const concatNoelVideos = (
  jobId: string,
  dynamicPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const finalPath = path.join(rendersDir, `render-${jobId}.mp4`);

    console.log("🎬 Iniciando concatenação com ffmpeg...");
    const ff = spawn("ffmpeg", [
      "-y",
      "-i",
      ENTRADA_VIDEO_URL,
      "-i",
      dynamicPath,
      "-i",
      SAIDA_VIDEO_URL,
      "-filter_complex",
      "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[outv][outa]",
      "-map",
      "[outv]",
      "-map",
      "[outa]",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      finalPath,
    ]);

    ff.stderr.on("data", (d) => console.log("[ffmpeg concat]", d.toString()));

    ff.on("close", (code) => {
      console.log("🎬 ffmpeg concat saiu com código:", code);
      if (code === 0) resolve(finalPath);
      else reject(new Error("ffmpeg concat falhou com código " + code));
    });

    ff.on("error", (err) => {
      console.error("❌ Erro ao spawnar ffmpeg concat:", err);
      reject(err);
    });
  });
};


const generateNoelAudio = async (jobId: string, name: string): Promise<string> => {
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY não configurada.");
  if (!ELEVENLABS_VOICE_ID) throw new Error("ELEVENLABS_VOICE_ID não configurada.");

  const text = buildLine(name);
  console.log("📝 Texto enviado para ElevenLabs:", text);

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

  console.log("🌐 ElevenLabs status:", res.status, res.statusText);

  if (!res.ok) {
    const body = await res.text();
    console.error("❌ ElevenLabs erro:", body);
    throw new Error(body);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log("📥 MP3 recebido:", buffer.length, "bytes");

  const mp3Path = path.join(rendersDir, `audio-${jobId}.mp3`);
  const wavPath = path.join(rendersDir, `audio-${jobId}.wav`);

  await fsPromises.writeFile(mp3Path, buffer);
  console.log("💾 MP3 salvo em:", mp3Path);

  await convertMp3ToWav(mp3Path, wavPath);
  console.log("💾 WAV salvo em:", wavPath);

  // 🔥 Tentamos usar R2 primeiro
  let finalUrl: string | null = null;

  try {
    const key = `audios/${jobId}.wav`;
    const urlR2 = await uploadToR2(wavPath, key, "audio/wav");
    if (urlR2) {
      console.log("☁️ Áudio enviado pro R2:", urlR2);
      finalUrl = urlR2;
    } else {
      console.warn("⚠️ uploadToR2 não retornou URL, fallback para SERVER_URL.");
    }
  } catch (e) {
    console.warn("⚠️ Falha no upload do áudio pro R2, usando fallback local:", e);
  }

  if (!finalUrl) {
    if (!SERVER_URL) {
      throw new Error(
        "SERVER_URL não configurada e não foi possível usar URL do R2 para o áudio."
      );
    }
    finalUrl = `${SERVER_URL.replace(/\/$/, "")}/renders/audio-${jobId}.wav`;
  }

  console.log("🔗 URL final do áudio (usada no Remotion):", finalUrl);

  return finalUrl;
};

/* -------------------------------------------------------------------------- */
/*                              FILA / JOBS                                    */
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

const nowISO = (): string => new Date().toISOString();

/* -------------------------------------------------------------------------- */
/*                           EXECUÇÃO DO JOB                                   */
/* -------------------------------------------------------------------------- */

const runRenderJob = async (job: RenderJob): Promise<void> => {
  console.log(`🎬 [JOB ${job.id}] Iniciando runRenderJob...`);

  const serveUrl = await getBundledLocation();

  // 1) Gera o áudio dinâmico primeiro
  const audioSrc = await generateNoelAudio(job.id, job.name);

  // 2) inputProps finais que VÃO direto para o MyComp
  const inputProps = {
    name: job.name,
    photoUrl: job.photoUrl,
    audioSrc,
  };

  console.log(`📦 [JOB ${job.id}] inputProps finais para renderMedia:`, inputProps);

  // 3) Descobre a composição "noel" como objeto
  const comps = await getCompositions(serveUrl, {
    inputProps,
  });

  console.log(
    `📽️ [JOB ${job.id}] Composições disponíveis:`,
    comps.map((c) => c.id)
  );

  const composition = comps.find((c) => c.id === "noel");
  if (!composition) {
    throw new Error("Composição 'noel' não encontrada.");
  }

  console.log(
    `🎯 [JOB ${job.id}] Composição 'noel' selecionada. defaultProps:`,
    (composition as any).defaultProps
  );

  const dynamicOutPath = path.join(
    rendersDir,
    `render-dynamic-${job.id}.mp4`
  );
  console.log(`🎞️ [JOB ${job.id}] Render (apenas parte dinâmica) em:`, dynamicOutPath);

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: dynamicOutPath,
    inputProps,
    crf: 24,
    audioCodec: "aac",
    pixelFormat: "yuv420p",
    // defensivo: só mexe na concurrency se a env estiver válida
    concurrency: process.env.REMOTION_CONCURRENCY
      ? Number(process.env.REMOTION_CONCURRENCY)
      : undefined,
    // ⚠️ KEEP DISABLED FOR NOW:
    // ffmpegOverride: ({ type, args }) => {
    //   const preset = process.env.FFMPEG_PRESET ?? "fast";
    //   console.log("[FFMPEG OVERRIDE]", type, "args antes:", args.join(" "));
    //   return ["-preset", preset, ...args];
    // },
  });

  console.log(`✅ [JOB ${job.id}] Render dinâmico concluído.`);

  // Agora faz o sanduíche: entrada (R2) + dinâmico (local) + saída (R2)
  const finalOutPath = await concatNoelVideos(job.id, dynamicOutPath);
  console.log(`🎬 [JOB ${job.id}] Vídeo final concatenado em:`, finalOutPath);

  job.status = "uploading";
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  const key = `renders/${job.id}.mp4`;
  const videoUrl = await uploadToR2(finalOutPath, key, "video/mp4");

  // limpeza de arquivos temporários
  fs.unlink(dynamicOutPath, () => {});
  fs.unlink(finalOutPath, () => {});
  fs.unlink(path.join(rendersDir, `audio-${job.id}.mp3`), () => {});
  fs.unlink(path.join(rendersDir, `audio-${job.id}.wav`), () => {});

  job.status = "done";
  job.videoUrl = videoUrl;
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  console.log(`🎉 [JOB ${job.id}] Finalizado. Vídeo em: ${videoUrl}`);
};

const processQueue = async (): Promise<void> => {
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
    await runRenderJob(job);
  } catch (e: any) {
    console.error(`❌ [JOB ${job.id}] Erro:`, e);
    job.status = "error";
    job.error = e?.message ?? String(e);
    job.updatedAt = nowISO();
    jobs.set(job.id, job);
  } finally {
    isProcessing = false;
    if (queue.length > 0) {
      processQueue();
    }
  }
};

/* -------------------------------------------------------------------------- */
/*                                   ROTAS                                     */
/* -------------------------------------------------------------------------- */

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API rodando." });
});

app.post("/render", (req, res) => {
  const { name, photoUrl } = req.body as { name?: string; photoUrl?: string };

  if (!name || !photoUrl) {
    return res
      .status(400)
      .json({ ok: false, error: "Envie name e photoUrl." });
  }

  const id = randomUUID();
  const now = nowISO();

  const job: RenderJob = {
    id,
    name,
    photoUrl,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(id, job);
  queue.push(id);
  processQueue();

  res.json({ ok: true, jobId: id });
});

app.get("/jobs/:id", (req, res) => {
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
  console.log(`🚀 Server ouvindo na porta ${PORT}`);
});
