import express from "express";
import path from "path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Import do Root diretamente (não usar require do bundle!)
import { RemotionRoot } from "../remotion/Root";

app.post("/render", async (req, res) => {
  try {
    console.log("➡️ Iniciando render...");

    const { name } = req.body;

    const inputProps = {
      name,
    };

    // 1. Criar bundle
    console.log("📦 Gerando bundle...");
    const entry = path.resolve(__dirname, "../remotion/index.ts");
    const bundleLocation = await bundle({
      entryPoint: entry,
      webpackOverride: (config) => config,
    });

    console.log("📦 Bundle final:", bundleLocation);

    // 2. Carregar comps
    const comps = await getCompositions(bundleLocation, {
      inputProps,
    });

    const composition = comps.find((c) => c.id === "TestComp");

    if (!composition) {
      throw new Error("❌ Composition 'TestComp' não encontrada!");
    }

    // 3. Renderizar
    const output = `/app/output-${Date.now()}.mp4`;

    console.log("🎬 Renderizando vídeo:", output);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      inputProps,
      outputLocation: output,
    });

    console.log("✅ Render finalizado!");

    res.json({
      ok: true,
      url: output,
    });
  } catch (err) {
    console.error("❌ Erro no /render:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

// Porta Railway
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Server rodando na porta ${port}`);
});
