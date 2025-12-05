// remotion/Composition.tsx
import React from "react";
import {
  AbsoluteFill,
  Video,
  staticFile,
  Sequence,
  Img,
  Audio,
} from "remotion";

export type NoelCompProps = {
  name?: string;
  photoUrl?: string;
  audioSrc?: string;
};

// Janela em que o POV da carta aparece no vídeo base
const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

// Overlay simples do nome
const NameOverlay: React.FC<{ name: string }> = ({ name }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "serif",
          fontSize: 70,
          color: "#3b2a1a",
          textShadow: "0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        {name}
      </div>
    </AbsoluteFill>
  );
};

// Overlay simples da foto
const PhotoOnLetter: React.FC<{ photoUrl: string }> = ({ photoUrl }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 420,
          height: 420,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
      >
        <Img
          src={photoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const MyComp: React.FC<NoelCompProps> = (props) => {
  const { name, photoUrl, audioSrc } = props;

  const safeName = (name ?? "").trim() || "Amigo(a)";

  const safePhotoUrl =
    photoUrl && photoUrl.trim() !== ""
      ? photoUrl.trim()
      : staticFile("photo-placeholder.png");

  // 🔊 NÃO FAZ NENHUMA MÁGICA AQUI: se veio string, usa.
  const safeAudioSrc =
    typeof audioSrc === "string" && audioSrc.trim() !== ""
      ? audioSrc.trim()
      : undefined;

  console.log(
    "🎧 [MyComp] props:",
    JSON.stringify(
      {
        name: safeName,
        hasPhoto: !!photoUrl,
        photoUrl: safePhotoUrl,
        audioSrcType: typeof audioSrc,
        hasAudioSrc: !!safeAudioSrc,
        audioSrcSnippet:
          typeof audioSrc === "string"
            ? audioSrc.slice(0, 80) + "..."
            : audioSrc,
      },
      null,
      2
    )
  );

  return (
    <AbsoluteFill>
      {/* vídeo base com a música de fundo já embutida */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* trecho onde o nome/foto/áudio aparecem */}
      <Sequence from={POV_LETTER_START} durationInFrames={POV_LETTER_DURATION}>
        {safeAudioSrc && <Audio src={safeAudioSrc} />}
        <NameOverlay name={safeName} />
        <PhotoOnLetter photoUrl={safePhotoUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
