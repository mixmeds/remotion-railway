import express from "express";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

const app = express();
app.use(express.json());

app.use(express.static(path.join(process.cwd(), "public")));

// Diretório para salvar os vídeos renderizados
const rendersDir = path.join(process.cwd(), "renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
  console.log("📁 Pasta 'renders' criada em:", rendersDir);
}

// Servir /renders/...
app.use("/renders", express.static(rendersDir));

// Bundle em memória para reaproveitar entre renders
let bundleLocationGlobal: string | null = null;

const getOrCreateBundle = async () => {
  if (bundleLocationGlobal && fs.existsSync(bundleLocationGlobal)) {
    return bundleLocationGlobal;
  }

  console.log("📦 (re)Gerando bundle Remotion...");
  const entry = path.resolve(process.cwd(), "remotion", "index.ts");

  bundleLocationGlobal = await bundle({
    entryPoint: entry,
    webpackOverride: (config) => config,
  });

  console.log("📦 Bundle pronto em:", bundleLocationGlobal);
  return bundleLocationGlobal;
};

// Endpoint: render do vídeo do Noel com NOME dinâmico
app.post("/render", async (req, res) => {
  try {
    console.log("🎬 Iniciando render do vídeo do Noel...");

    // Pega o nome do body e sanitiza um pouco
    const rawName = req.body?.name;
    let safeName = "Nome Custom";

    if (typeof rawName === "string") {
      safeName = rawName.trim();
      if (!safeName) safeName = "Nome Custom";
      if (safeName.length > 40) {
        safeName = safeName.slice(0, 40); // evita textos gigantes quebrando layout
      }
    }

    const inputProps = { name: safeName };
    console.log("📝 Nome usado na composição:", safeName);

    // 1) Garante o bundle (reaproveita se já existir)
    const bundleLocation = await getOrCreateBundle();

    // 2) Busca a composition correta (id definido no Root.tsx)
    const compositionId = "noel";
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

    // 3) Define o arquivo de saída
    const fileName = `noel-${Date.now()}.mp4`;
    const outputLocation = path.join(rendersDir, fileName);

    console.log("🎥 Renderizando vídeo em:", outputLocation);

    // 4) Renderiza o vídeo
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation,
      inputProps,
      // Pequenas otimizações
      concurrency: 8,   // usa bem seus 8 vCPUs
      logLevel: "error" // menos log, menos overhead
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
