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

/**
 * Faz upload de um arquivo local para o R2 e retorna a URL pública.
 */
const uploadVideoToR2 = async (localFilePath: string, objectKey: string) => {
  if (!r2Client || !R2_BUCKET || !R2_ACCOUNT_ID) {
    throw new Error("R2 não está configurado.");
  }

  const fileStream = createReadStream(localFilePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    Body: fileStream,
    ContentType: "video/mp4",
  });

  await r2Client.send(command);

  const publicUrl = `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.dev/${objectKey}`;
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
    // Se o seu entry real for .tsx, use:
    // entryPoint: path.join(process.cwd(), "remotion", "index.tsx"),
    webpackOverride: (config) => config,
  });

  console.log("✅ Bundle do Remotion pronto:", bundledLocation);
  return bundledLocation;
};

/* -------------------------------------------------------------------------- */
/*                                  ROTAS                                     */
/* -------------------------------------------------------------------------- */

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Servidor Remotion + R2 ativo." });
});

app.post("/render", async (req, res) => {
  try {
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

    const serveUrl = await getBundledLocation();

    // Buscar a composição "noel"
    const comps = await getCompositions(serveUrl, {
      inputProps: { name, photoUrl },
    });
    const composition = comps.find((c) => c.id === "noel");

    if (!composition) {
      return res.status(500).json({
        ok: false,
        error: "Composição 'noel' não encontrada.",
      });
    }

    const jobId = randomUUID();

    // Caminho temporário para render local
    const tempOutputPath = path.join("/tmp", `${jobId}.mp4`);

    console.log(`🎬 Iniciando render do job ${jobId}...`);

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: tempOutputPath,
      inputProps: { name, photoUrl },
    });

    console.log(`✅ Render do job ${jobId} concluído. Subindo para R2...`);

    let videoUrl: string;

    if (r2Client && R2_BUCKET && R2_ACCOUNT_ID) {
      const objectKey = `renders/${jobId}.mp4`;
      videoUrl = await uploadVideoToR2(tempOutputPath, objectKey);

      // Remover arquivo temporário local
      await fsPromises.unlink(tempOutputPath).catch(() => {});
      console.log(`☁️ Vídeo do job ${jobId} enviado para R2.`);
    } else {
      // Fallback: mantém no disco local e serve via /renders
      const finalPath = path.join(rendersDir, `${jobId}.mp4`);
      await fsPromises.rename(tempOutputPath, finalPath);
      videoUrl = `/renders/${jobId}.mp4`;
      console.log(
        `⚠️ R2 não configurado. Vídeo do job ${jobId} salvo localmente em ${finalPath}.`
      );
    }

    return res.json({
      ok: true,
      jobId,
      videoUrl,
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
