import express from "express";
import path from "path";
import fs from "fs";
import {
  renderMedia,
  getCompositions,
  selectComposition,
} from "@remotion/renderer";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;

// Entry file do Remotion v4
const entry = path.join(process.cwd(), "remotion", "index.ts");

// Pasta onde os vídeos serão salvos
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Render (usando TestComp por padrão)
app.post("/render", async (req, res) => {
  try {
    const { compositionId = "TestComp", name = "Teste rápido" } = req.body ?? {};

    // Aqui NÃO tem bundle() no Remotion v4
    // O entry direto funciona como serveUrl
    const serveUrl = entry;

    const comps = await getCompositions(serveUrl);
    const composition = selectComposition(comps, compositionId);

    if (!composition) {
      return res.status(400).json({
        ok: false,
        error: `Composition "${compositionId}" não encontrada.`,
      });
    }

    const fileName = `${compositionId}-${Date.now()}.mp4`;
    const outputLocation = path.join(rendersDir, fileName);

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation,
      inputProps: {
        name,
      },
      // para Railway (Chrome headless)
      chromiumOptions: {
        disableWebSecurity: true,
        ignoreCertificateErrors: true,
      },
    });

    return res.json({
      ok: true,
      file: fileName,
      url: `/renders/${fileName}`,
    });

  } catch (err) {
    console.error("Erro no /render:", err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    });
  }
});

// Servir arquivos gerados
app.use("/renders", express.static(rendersDir));

app.listen(PORT, () => {
  console.log(`🚀 Server rodando em http://localhost:${PORT}`);
});
