import express from "express";
import path from "path";
import fs from "fs";
import {
  bundle,
  getCompositions,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;

// Entry do Remotion (conforme seu projeto)
const entryFile = path.join(process.cwd(), "remotion", "index.ts");

// Pasta onde os vídeos serão salvos
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

// Cache do bundle para não recompilar toda hora
let bundledServeUrl: string | null = null;

async function getServeUrl() {
  if (bundledServeUrl) return bundledServeUrl;

  bundledServeUrl = await bundle({
    entryPoint: entryFile,
    outDir: path.join(process.cwd(), "remotion-bundle"),
    webpackOverride: (config) => config,
  });

  return bundledServeUrl;
}

// Healthcheck simples
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Endpoint único de render
app.post("/render", async (req, res) => {
  try {
    const { name, compositionId } = (req.body || {}) as {
      name?: string;
      compositionId?: string;
    };

    const serveUrl = await getServeUrl();

    const comps = await getCompositions(serveUrl, {
      inputProps: {},
    });

    // Por padrão, usamos a TestComp (rápida)
    const targetId = compositionId ?? "TestComp";

    const composition = selectComposition(comps, targetId);

    if (!composition) {
      return res.status(400).json({
        ok: false,
        error: `Composition "${targetId}" não encontrada. Verifique se o id está registrado no RemotionRoot.`,
      });
    }

    const fileName = `${targetId}-${Date.now()}.mp4`;
    const outputLocation = path.join(rendersDir, fileName);

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation,
      inputProps: {
        // props que sua comp receber, por enquanto só "name"
        name: name ?? "Teste rápido",
      },
      // Caso dê problema de Chrome no Railway, depois podemos ajustar chromiumOptions aqui
      // chromiumOptions: { disableWebSecurity: true },
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
      error: err instanceof Error ? err.message : "Erro desconhecido ao renderizar",
    });
  }
});

// Servir os vídeos gerados
app.use(
  "/renders",
  express.static(rendersDir, {
    maxAge: 0,
  }),
);

app.listen(PORT, () => {
  console.log(`🚀 Server rodando em http://localhost:${PORT}`);
});
