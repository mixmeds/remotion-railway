import express from "express";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

const app = express();
app.use(express.json({ limit: "20mb" }));

// Diretório público para salvar e servir os vídeos
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
  console.log("📁 Pasta 'renders' criada em:", rendersDir);
}

// Servir os arquivos gerados em /renders/...
app.use("/renders", express.static(rendersDir));

// Endpoint de render do vídeo do Noel (MyComp)
app.post("/render", async (req, res) => {
  try {
    console.log("🎬 Iniciando render do vídeo do Noel...");

    // Por enquanto, o MyComp NÃO usa props
    // (quando for usar nome/foto dinâmico, a gente preenche isso aqui)
    const inputProps = {};

    // 1) Entry do Remotion (remotion/index.ts)
    const entry = path.resolve(process.cwd(), "remotion", "index.ts");

    // 2) Gerar bundle
    console.log("📦 Gerando bundle...");
    const bundleLocation = await bundle({
      entryPoint: entry,
      webpackOverride: (config) => config,
    });
    console.log("📦 Bundle final:", bundleLocation);

    // 3) Pegar a composition registrada no Root.tsx
    const compositionId = "QuizVideo"; // é o ID, mas o componente é o MyComp (NOEL)
    const comps = await getCompositions(bundleLocation, { inputProps });

    const composition = comps.find((c) => c.id === compositionId);

    if (!composition) {
      console.error(
        "❌ Composition não encontrada. Disponíveis:",
        comps.map((c) => c.id),
      );

      return res.status(400).json({
        ok: false,
        error: `Composition "${compositionId}" não encontrada. Comps disponíveis: ${comps
          .map((c) => c.id)
          .join(", ")}`,
      });
    }

    // 4) Arquivo de saída
    const fileName = `noel-${Date.now()}.mp4`;
    const outputLocation = path.join(rendersDir, fileName);

    console.log("🎥 Renderizando vídeo em:", outputLocation);

    // 5) Renderizar
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation,
      inputProps,
    });

    console.log("✅ Render do Noel finalizado!");

    const publicUrl = `/renders/${fileName}`;
    return res.json({
      ok: true,
      url: publicUrl,
    });
  } catch (err: any) {
    console.error("❌ Erro no /render:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Erro desconhecido ao renderizar",
    });
  }
});

// Porta do Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});
