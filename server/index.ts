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

// Diretório para salvar os vídeos renderizados (fallback/local)
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}
app.use("/renders", express.static(rendersDir));

/* -------------------------------------------------------------------------- */
/*                             CONFIG R2 (Cloudflare)                          */
/* -------------------------------------------------------------------------- */

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_ACCOUNT_ID,
  R2_PUBLIC_BASE_URL,
} = process.env;

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
  console.warn(
    "⚠️ R2 não configurado completamente. Verifique R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_ACCOUNT_ID."
  );
}

const uploadVideoToR2 = async (localFilePath: string, objectKey: string) => {
  if (!r2Client || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    throw new Error(
      "R2 não está configurado corretamente (verifique R2_BUCKET e R2_PUBLIC_BASE_URL)."
    );
  }

  const fileStream = createReadStream(localFilePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    Body: fileStream,
    ContentType: "video/mp4",
  });

  await r2Client.send(command);

  // Usa a Public Bucket URL que o painel da Cloudflare mostra (ex.: https://pub-xxxxx.r2.dev)
  const base = R2_PUBLIC_BASE_URL.replace(/\/+$/, ""); // remove barra final se tiver
  const publicUrl = `${base}/${objectKey}`;

  return publicUrl;
};

/* -------------------------------------------------------------------------- */
/*                       BUNDLE DO REMOTION (CACHEADO)                        */
/* -------------------------------------------------------------------------- */

let bundledLocation: string | null = null;

const getBundledLocation = async () => {
  if (bundledLocation) return bundledLocation;

  console.log("📦 Gerando bundle do Remotion pela primeira vez...");
  bundledLocation = await bundle({
    entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
    // Se seu entry real for .tsx, troque para index.tsx
    webpackOverride: (config) => config,
  });

  console.log("✅ Bundle do Remotion pronto:", bundledLocation);
  return bundledLocation;
};

/* -------------------------------------------------------------------------- */
/*                            SISTEMA DE JOBS (FILA)                          */
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
  processQueue().catch((err) =>
    console.error("Erro ao processar fila:", err)
  );
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
    console.log(`✅ Job ${job.id} finalizado com sucesso.`);
  } catch (err: any) {
    console.error(`❌ Erro no job ${job.id}:`, err);
    job.status = "error";
    job.error = err?.message ?? "Erro desconhecido";
    job.updatedAt = nowISO();
    jobs.set(job.id, job);
  } finally {
    isProcessing = false;
    if (queue.length > 0) {
      // processa o próximo
      processQueue().catch((err) =>
        console.error("Erro ao processar fila:", err)
      );
    }
  }
};

const runRenderJob = async (job: RenderJob) => {
  const serveUrl = await getBundledLocation();

  // pega a composição 'noel'
  const comps = await getCompositions(serveUrl, {
    inputProps: { name: job.name, photoUrl: job.photoUrl },
  });
  const composition = comps.find((c) => c.id === "noel");

  if (!composition) {
    throw new Error("Composição 'noel' não encontrada.");
  }

  const tempOutputPath = path.join("/tmp", `${job.id}.mp4`);

  job.status = "rendering";
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  console.log(`🎥 Renderizando job ${job.id}...`);

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: tempOutputPath,
    inputProps: { name: job.name, photoUrl: job.photoUrl },

    // 🔻 CONTROLE DE QUALIDADE / TAMANHO
    crf: 24,          // 18 = muito pesado, 24 ainda é bonito e bem menor
    jpegQuality: 70,  // default é ~80 – 70 já ajuda a reduzir um pouco
  });


  console.log(`📤 Upload do job ${job.id}...`);
  job.status = "uploading";
  job.updatedAt = nowISO();
  jobs.set(job.id, job);

  let videoUrl: string;

  if (r2Client && R2_BUCKET && R2_ACCOUNT_ID && R2_PUBLIC_BASE_URL) {
    const objectKey = `renders/${job.id}.mp4`;
    videoUrl = await uploadVideoToR2(tempOutputPath, objectKey);
    await fsPromises.unlink(tempOutputPath).catch(() => {});
    console.log(`☁️ Vídeo do job ${job.id} enviado para R2.`);
  } else {
    const finalPath = path.join(rendersDir, `${job.id}.mp4`);
    await fsPromises.rename(tempOutputPath, finalPath);
    videoUrl = `/renders/${job.id}.mp4`;
    console.log(
      `⚠️ R2 não configurado. Vídeo do job ${job.id} salvo localmente em ${finalPath}.`
    );
  }

  job.status = "done";
  job.videoUrl = videoUrl;
  job.updatedAt = nowISO();
  jobs.set(job.id, job);
};

/* -------------------------------------------------------------------------- */
/*                                  ROTAS                                     */
/* -------------------------------------------------------------------------- */

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Servidor Remotion + Jobs + R2 ativo." });
});

// Cria um job de render (não espera o vídeo ficar pronto)
app.post("/render", (req, res) => {
  const { name, photoUrl } = req.body as {
    name?: string;
    photoUrl?: string;
  };

  if (!name || !photoUrl) {
    return res.status(400).json({
      ok: false,
      error: "Envie 'name' e 'photoUrl' no body.",
    });
  }

  const jobId = randomUUID();
  const safeName = name.trim();
  const safePhotoUrl = photoUrl.trim();

  const job: RenderJob = {
    id: jobId,
    name: safeName,
    photoUrl: safePhotoUrl,
    status: "queued",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  enqueueJob(job);

  return res.json({
    ok: true,
    jobId,
    status: job.status,
  });
});

// Consulta status de um job
app.get("/job/:id", (req, res) => {
  const id = req.params.id;
  const job = jobs.get(id);

  if (!job) {
    return res.status(404).json({
      ok: false,
      error: "Job não encontrado.",
    });
  }

  return res.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    videoUrl: job.videoUrl ?? null,
    error: job.error ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

// Porta do Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});
