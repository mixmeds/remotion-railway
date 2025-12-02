import { bundle } from "@remotion/bundler";
import { renderMedia } from "@remotion/renderer";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

dotenv.config();

const { PORT = 3000, REMOTION_SERVE_URL } = process.env;

// Estrutura simples em memória para acompanhar jobs
type JobStatus = "queued" | "rendering" | "done" | "error";

type Job = {
  status: JobStatus;
  filePath?: string;
  errorMessage?: string;
};

const jobs: Record<string, Job> = {};

async function main() {
  const app = express();
  app.use(express.json());

  // Pasta para salvar os renders dentro do container
  const rendersDir = path.resolve("renders");
  if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(rendersDir, { recursive: true });
  }

  // Bundle do projeto Remotion (uma vez por deploy)
  const remotionBundleUrl =
    REMOTION_SERVE_URL ??
    (await bundle({
      entryPoint: path.resolve("remotion/index.ts"),
      onProgress(progress) {
        console.info(`Bundling Remotion project: ${progress}%`);
      },
    }));

  console.log("Remotion project bundled.");

  // Healthcheck
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * Cria um job de renderização ASSÍNCRONO
   * Body esperado (por enquanto tudo opcional):
   * {
   *   "name": "Marcos",
   *   "photoUrl": "https://.../foto.jpg",
   *   "audioUrl": "https://.../audio.mp3"
   * }
   */
  app.post("/render", async (req, res) => {
    const { name, photoUrl, audioUrl } = req.body ?? {};

    const safeName =
      typeof name === "string" && name.trim() ? name.trim() : "Nome Custom";

    const safePhotoUrl =
      typeof photoUrl === "string" && photoUrl.trim()
        ? photoUrl.trim()
        : null;

    const safeAudioUrl =
      typeof audioUrl === "string" && audioUrl.trim()
        ? audioUrl.trim()
        : null;

    const jobId = randomUUID();
    const outputLocation = path.join(rendersDir, `${jobId}.mp4`);

    // Marca como enfileirado
    jobs[jobId] = {
      status: "queued",
    };

    console.log(`Job criado. jobId=${jobId}`);

    // Dispara o render em background, sem bloquear a resposta HTTP
    (async () => {
      try {
        console.log(`Iniciando render do vídeo. jobId=${jobId}`);
        jobs[jobId].status = "rendering";

        await renderMedia({
          serveUrl: remotionBundleUrl,
          composition: "TestComp", // ou "TestComp", se estiver testando a comp curta
          codec: "h264",
          outputLocation,
          inputProps: {
            name: safeName,
            photoUrl: safePhotoUrl,
            audioUrl: safeAudioUrl,
          },
        });

        console.log(`Render finalizado. jobId=${jobId}`);
        jobs[jobId].status = "done";
        jobs[jobId].filePath = outputLocation;
      } catch (err: any) {
        console.error(`Erro ao renderizar vídeo. jobId=${jobId}`, err);
        jobs[jobId].status = "error";
        jobs[jobId].errorMessage = err?.message ?? String(err);
      }
    })();

    // Responde imediatamente com o jobId
    res.status(202).json({
      success: true,
      jobId,
      status: "queued",
      message:
        "Render solicitado. Consulte /render/{jobId} para acompanhar o status.",
    });
  });

  // Endpoint para consultar status do job
  app.get("/render/:id", (req, res) => {
    const { id } = req.params;
    const job = jobs[id];

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job não encontrado",
      });
    }

    res.json({
      success: true,
      jobId: id,
      status: job.status,
      filePath: job.filePath,
      error: job.errorMessage,
    });
  });

  app.listen(PORT, () => {
    console.info(`Server is running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
});
