import express from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "20mb" }));

// ---- Pasta pública para acessar os vídeos ---- //
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

// ---- Servir os vídeos diretamente ---- //
app.use("/renders", express.static(rendersDir));

app.post("/render", async (req, res) => {
  try {
    console.log("🎬 Iniciando render...");

    const entry = path.join(process.cwd(), "remotion", "index.ts");

    // 1) Gerar o bundle
    console.log("📦 Gerando bundle...");
    const bundlerOutput = await bundle({
      entryPoint: entry,
      // IMPORTANTE: usar a porta 3000 pq remotion exige
      port: 3000,
    });

    // 2) Definir arquivo final na pasta pública
    const fileName = `video-${Date.now()}.mp4`;
    const finalOutput = path.join(rendersDir, fileName);

    // 3) Renderizar o vídeo
    console.log("🎥 Renderizando vídeo...");
    await renderMedia({
      composition: {
        id: "QuizVideo", // seu ID lá no RemotionRoot
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 1830,
      },
      serveUrl: bundlerOutput,
      codec: "h264",
      outputLocation: finalOutput,
    });

    console.log("✅ Render finalizado!");

    // 4) Retornar link acessível via HTTP
    const publicUrl = `/renders/${fileName}`;
    return res.json({
      ok: true,
      url: publicUrl,
    });
  } catch (err: any) {
    console.error("❌ Erro no /render:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

// Porta do Railway (IMPORTANTE)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});
