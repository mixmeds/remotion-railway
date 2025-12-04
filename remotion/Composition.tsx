import React, { useEffect } from "react";
import {
  AbsoluteFill,
  Video,
  staticFile,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  Audio, // 🔊 import do áudio
} from "remotion";

import { DistressedNameCanvas } from "./DistressedTextCanvas";

/* ------------ TIPAGEM DOS PROPS ------------ */

export type NoelCompProps = {
  name?: string;
  photoUrl?: string;
  audioSrc?: string; // 🔊 áudio dinâmico (ElevenLabs)
};

/* ------------ MAPA DE FRAMES ------------ */

// POV da carta (onde aparece nome e foto)
const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

/* ------------ OVERLAY DE NOME (CANVAS) ------------ */

const NameOverlay: React.FC<{ name: string }> = ({ name }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Canvas com o texto estilizado */}
      <DistressedNameCanvas text={name} />
    </AbsoluteFill>
  );
};

/* ------------ FOTO EM CIMA DA CARTA ------------ */

const PhotoOnLetter: React.FC<{ photoUrl: string }> = ({ photoUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // animação simples de fade/scale na entrada
  const appear = spring({
    frame: frame - POV_LETTER_START,
    fps,
    config: {
      damping: 12,
      mass: 0.8,
      stiffness: 90,
    },
  });

  const opacity = interpolate(appear, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(appear, [0, 1], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // posição aproximada da carta na tela (ajuste fino visual)
  const translateY = interpolate(appear, [0, 1], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          height: 260,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow:
            "0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.9)",
          transform: `translateY(${translateY}px) scale(${scale})`,
          opacity,
          backgroundColor: "#111",
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

/* ------------ COMPONENTE PRINCIPAL ------------ */

const SERVER_URL = process.env.SERVER_URL ?? "";

export const MyComp: React.FC<NoelCompProps> = ({
  name,
  photoUrl,
  audioSrc,
}) => {
  const safeName = (name ?? "").trim() || "Amigo(a)";

  const safePhotoUrl =
    photoUrl && photoUrl.trim() !== ""
      ? photoUrl
      : `${SERVER_URL}/photo-placeholder.jpg`;

  const safeAudioSrc =
    audioSrc && audioSrc.trim() !== "" ? audioSrc.trim() : undefined;

  // 🔍 DEBUG: logar o que chega dentro do Remotion (Chromium)
  useEffect(() => {
    console.log(
      "🎧 MyComp audioSrc prop:",
      audioSrc,
      "safeAudioSrc:",
      safeAudioSrc
    );
  }, [audioSrc, safeAudioSrc]);

  return (
    <AbsoluteFill>
      {/* vídeo base */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* trecho POV da carta: nome + foto + ÁUDIO */}
      <Sequence from={POV_LETTER_START} durationInFrames={POV_LETTER_DURATION}>
        {safeAudioSrc && <Audio src={safeAudioSrc} />} {/* 🔊 só aqui */}
        <NameOverlay name={safeName} />
        <PhotoOnLetter photoUrl={safePhotoUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
