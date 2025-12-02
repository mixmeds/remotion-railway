import express from "express";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import {
  getCompositions,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;

// Entry do Remotion (remotion/index.ts)
const entryFile = path.join(process.cwd(), "remotion", "index.ts");

// Pasta onde os vídeos serão salvos
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

// Cache do bundle para não recompilar toda hora
let cachedServeUrl: string | null = null;

async function getServeUrl() {
  if (cachedServeUrl) {
    return cachedServeUrl;
  }

  const outDir = path.join(process.cwd(), "remotion-bundle");

  const serveUrl = await bundle({
    entryPoint: entryFile,
    outDir,
    // se tiver alguma customização de webpack, coloca aqui
    webpackOverride: (config) => config,
    // publicDir: path.join(process.cwd(), "public"), // se precisar
  });

  cachedServeUrl = serveUrl;
  console.log("✅ Bundle gerado em:", serveUrl);
  return serveUrl;
}

// Healthcheck
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Render - usa TestComp por padrão
app.post("/render", async (req, res) => {
  try {
    const { compositionId, name } = (req.body || {}) as {
      compositionId?: string;
      name?: string;
    };

    const serveUrl = await getServeUrl();

    const comps = await getCompositions(serveUrl, {
      inputProps: {},
    });

    const targetId = compositionId ?? "TestComp";
    const composition = selectComposition(comps, targetId);

    if (!composition) {
      return res.status(400).json({
        ok: false,
        error: `Composition "${targetId}" não encontrada. Comps disponíveis: ${comps
          .map((c) => c.id)
          .join(", ")}`,
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
        name: name ?? "Teste rápido",
      },
      chromiumOptions: {
        // esses flags costumam ajudar em ambiente cloud
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
      error: err instanceof Error ? err.message : "Erro desconhecido ao renderizar",
    });
  }
});

// Servir vídeos gerados
app.use(
  "/renders",
  express.static(rendersDir, {
    maxAge: 0,
  }),
);

app.listen(PORT, () => {
  console.log(`🚀 Server rodando em http://localhost:${PORT}`);
});
