import { bundle } from "@remotion/bundler";
import { renderMedia } from "@remotion/renderer";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

dotenv.config();

const { PORT = 3000, REMOTION_SERVE_URL } = process.env;

async function main() {
  const app = express();
  app.use(express.json());

  // Garante que a pasta de renders exista
  const rendersDir = path.resolve("renders");
  if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(rendersDir, { recursive: true });
  }

  // Faz o bundle do projeto Remotion uma vez só na inicialização
  const remotionBundleUrl =
    REMOTION_SERVE_URL ??
    (await bundle({
      entryPoint: path.resolve("remotion/index.ts"),
      onProgress(progress) {
        console.info(`Bundling Remotion project: ${progress}%`);
      },
    }));

  console.log("Remotion project bundled.");

  // Rota de saúde só pra testar rápido
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * POST /render
   * Body esperado (por enquanto tudo opcional):
   * {
   *   "name": "Marcos",
   *   "photoUrl": "https://.../foto.jpg",
   *   "audioUrl": "https://.../audio.mp3"
   * }
   */
  app.post("/render", async (req, res) => {
    try {
      const { name, photoUrl, audioUrl } = req.body ?? {};

      // Por enquanto, se não mandar nada, usamos defaults só pra testar
      const safeName = typeof name === "string" && name.trim() ? name.trim() : "Nome Custom";
      const safePhotoUrl =
        typeof photoUrl === "string" && photoUrl.trim()
          ? photoUrl.trim()
          : null; // se for null, a comp pode usar um placeholder interno
      const safeAudioUrl =
        typeof audioUrl === "string" && audioUrl.trim()
          ? audioUrl.trim()
          : null;

      const jobId = randomUUID();
      const outputLocation = path.join(rendersDir, `${jobId}.mp4`);

      console.log(`Iniciando render do vídeo. jobId=${jobId}`);

      await renderMedia({
        serveUrl: remotionBundleUrl,
        composition: "TestComp", // id da composição no RemotionRoot
        codec: "h264",
        outputLocation,
        inputProps: {
          name: safeName,
          photoUrl: safePhotoUrl,
          audioUrl: safeAudioUrl,
        },
      });

      console.log(`Render finalizado. Arquivo salvo em ${outputLocation}`);

      // Aqui ainda estamos só salvando localmente no container.
      // Depois você pode subir isso para Supabase Storage / R2 e devolver a URL pública.
      res.status(201).json({
        success: true,
        jobId,
        filePath: outputLocation,
        message: "Vídeo renderizado com sucesso (salvo localmente no servidor).",
      });
    } catch (err: any) {
      console.error("Erro ao renderizar vídeo:", err);
      res.status(500).json({
        success: false,
        message: "Falha ao renderizar vídeo",
        error: err?.message ?? String(err),
      });
    }
  });

  app.listen(PORT, () => {
    console.info(`Server is running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
});
