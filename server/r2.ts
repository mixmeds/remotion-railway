import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import path from "path";

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_ACCOUNT_ID,
} = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_ACCOUNT_ID) {
  console.warn(
    "[R2] Variáveis de ambiente ausentes. Verifique R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ACCOUNT_ID."
  );
}

const r2Client =
  R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ACCOUNT_ID
    ? new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

/**
 * Faz upload de um arquivo de vídeo local para o R2 e
 * retorna a URL pública (via <bucket>.<account>.r2.dev).
 */
export const uploadVideoToR2 = async (options: {
  localFilePath: string;
  objectKey: string; // exemplo: "renders/1234.mp4"
}): Promise<string> => {
  if (!r2Client || !R2_BUCKET || !R2_ACCOUNT_ID) {
    throw new Error("[R2] Cliente não configurado corretamente.");
  }

  const { localFilePath, objectKey } = options;

  const fileStream = createReadStream(localFilePath);

  const putCommand = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    Body: fileStream,
    ContentType: "video/mp4",
  });

  await r2Client.send(putCommand);

  // URL pública usando o domínio r2.dev
  const publicUrl = `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.dev/${objectKey}`;

  return publicUrl;
};
