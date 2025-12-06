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
/*                       LOGS INICIAIS DO SERVIDOR                            */
/* -------------------------------------------------------------------------- */

console.log("⏳ Inicializando servidor...");

const app = express();
app.use(express.json());

console.log("📂 Diretório atual:", process.cwd());

/* -------------------------------------------------------------------------- */
/*                        PASTAS DE ARQUIVOS ESTÁTICOS                         */
/* -------------------------------------------------------------------------- */

const publicDir = path.join(process.cwd(), "public");
console.log("📁 publicDir:", publicDir);
app.use(express.static(publicDir));

const rendersDir = path.join(process.cwd(), "renders");
console.log("📁 rendersDir:", rendersDir);

if (!fs.existsSync(rendersDir)) {
  console.log("📁 Pasta /renders não existe. Criando...");
  fs.mkdirSync(rendersDir, { recursive: true });
}

app.use("/renders", express.static(rendersDir));

/* -------------------------------------------------------------------------- */
/*                           VARIÁVEIS DE AMBIENTE                             */
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

console.log("🔧 ENV CHECK:");
console.log({
  R2_ACCESS_KEY_ID: !!R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: !!R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_ACCOUNT_ID,
  R2_PUBLIC_BASE_URL,
  SERVER_URL,
  ELEVENLABS_API_KEY: !!ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
});

/* -------------------------------------------------------------------------- */
/*                                   R2 SETUP                                  */
/* -------------------------------------------------------------------------- */

let r2Client: S3Client | null = null;

if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_ACCOUNT_ID) {
  console.log("☁️ Conectando ao R2...");
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
  console.warn("⚠️ R2 NÃO configurado completamente.");
}

/* -------------------------------------------------------------------------- */
/*                           UPLOAD PARA O R2                                  */
/* -------------------------------------------------------------------------- */

const uploadToR2 = async (filePath: string, objectKey: string, mime: string) => {
  console.log("📤 uploadToR2:", { filePath, objectKey, mime });

  if (!r2Client || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    console.warn("⚠️ R2 não configurado, ignorando upload.");
    return "";
  }

  try {
    const stat = await fsPromises.stat(filePath);
    console.log("📏 Tamanho do arquivo para upload:", stat.size);

    const fileStream = createReadStream(filePath);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: objectKey,
        Body: fileStream,
        ContentType: mime,
      })
    );

    const url = `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;
    console.log("☁️ Upload concluído:", url);

    return url;
  } catch (err) {
    console.error("❌ Erro no upload R2:", err);
    return "";
  }
};

/* -------------------------------------------------------------------------- */
/*                        REMOTION BUNDLE CACHEADO                             */
/* -------------------------------------------------------------------------- */

let bundledLocation: string | null = null;

async function getBundledLocation() {
  if (bundledLocation) {
    console.log("📦 Bundle já existe:", bundledLocation);
    return bundledLocation;
  }

  console.log("📦 Gerando bundle Remotion...");
  bundledLocation = await bundle({
    entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
  });

  console.log("✅ Bundle pronto:", bundledLocation);
  return bundledLocation;
}

/* -------------------------------------------------------------------------- */
/*                    ELEVENLABS + FFMPEG (MP3 → WAV)                          */
/* -------------------------------------------------------------------------- */

function buildLine(name: string) {
  const final = `${name}, você é alguém muito especial… mais do que imagina.`;
  console.log("📝 Texto gerado:", final);
  return final;
}

function convertMP3toWAV(inputPath: string, outputPath: string) {
  console.log("🎛️ Convertendo MP3 → WAV...");
  console.log("📄 Arquivo de entrada:", inputPath);
  console.log("📄 Arquivo de saída:", outputPath);

  return new Promise<void>((resolve, reject) => {
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
      console.log("🎛️ ffmpeg finalizado com código:", code);
      code === 0 ? resolve() : reject(new Error("FFMPEG falhou: " + code));
    });

    ff.on("error", (err) => {
      console.error("❌ Erro ffmpeg spawn:", err);
      reject(err);
    });
  });
}

async function generateAudio(jobId: string, name: string) {
  const line = buildLine(name);

  console.log("🎙️ Chamando ElevenLabs...");

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: line,
      model_id: "eleven_multilingual_v2",
    }),
  });

  console.log("🌐 ElevenLabs status:", res.status, res.statusText);

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ ElevenLabs erro:", err);
    throw new Error(err);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  console.log("📥 MP3 recebido:", buffer.length, "bytes");

  const mp3 = path.join(rendersDir, `audio-${jobId}.mp3`);
  const wav = path.join(rendersDir, `audio-${jobId}.wav`);

  await fsPromises.writeFile(mp3, buffer);

  console.log("💾 MP3 salvo:", mp3);

  await convertMP3toWAV(mp3, wav);

  console.log("💾 WAV salvo:", wav);

  const url = `${SERVER_URL}/renders/audio-${jobId}.wav`;
  console.log("🔗 URL final do áudio:", url);

  return url;
}

/* -------------------------------------------------------------------------- */
/*                              FILA DE RENDER                                 */
/* -------------------------------------------------------------------------- */

const jobs = new Map();

async function processJob(job: any) {
  console.log("🚀 processJob iniciado:", job);

  const serveUrl = await getBundledLocation();

  console.log("🎯 serveUrl:", serveUrl);

  const comps = await getCompositions(serveUrl, {
    inputProps: { name: job.name, photoUrl: job.photoUrl },
  });

  console.log("📽️ Composições encontradas:", comps.map((c) => c.id));

  const comp = comps.find((c) => c.id === "noel");

  if (!comp) throw new Error("Composição 'noel' não encontrada.");

  console.log("🎧 Gerando áudio...");

  const audioSrc = await generateAudio(job.id, job.name);

  const out = path.join(rendersDir, `video-${job.id}.mp4`);

  console.log("📦 Render iniciando com props:");
  console.log({ name: job.name, photoUrl: job.photoUrl, audioSrc });

  await renderMedia({
    serveUrl,
    composition: comp,
    codec: "h264",
    outputLocation: out,
    inputProps: {
      name: job.name,
      photoUrl: job.photoUrl,
      audioSrc,
    },
  });

  console.log("🎉 Render finalizado:", out);

  const key = `noel/${job.id}.mp4`;
  const videoUrl = await uploadToR2(out, key, "video/mp4");

  console.log("☁️ Vídeo enviado para:", videoUrl);

  job.status = "done";
  job.videoUrl = videoUrl;

  return job;
}

/* -------------------------------------------------------------------------- */
/*                                   ROTAS                                     */
/* -------------------------------------------------------------------------- */

app.post("/render", async (req, res) => {
  console.log("📩 /render BODY:", req.body);

  const id = randomUUID();

  const job = {
    id,
    name: req.body.name,
    photoUrl: req.body.photoUrl,
    status: "processing",
  };

  jobs.set(id, job);

  processJob(job).catch((err) => {
    console.error("❌ ERRO PROCESSJOB:", err);
    job.status = "error";
    job.error = String(err);
  });

  res.json({ ok: true, jobId: id });
});

app.get("/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  console.log("🔎 /jobs:", job);
  return res.json(job || { error: "Job not found" });
});

/* -------------------------------------------------------------------------- */
/*                           INICIAR SERVIDOR                                  */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("🚀 Server ON PORT:", PORT);
});
