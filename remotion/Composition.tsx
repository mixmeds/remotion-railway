import React from "react";
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

/* ------------ FOTO SOBRE A CARTA (LAYOUT DO LOCAL) ------------ */

const PhotoOnLetter: React.FC<{ photoUrl: string }> = ({ photoUrl }) => {
  const texture = staticFile("ink-texture.webp");

  return (
    <div
      style={{
        position: "absolute",

        // 🔥 POSIÇÃO E DIMENSÕES COPIADAS DO LOCAL
        top: 500,
        left: "50%",
        transform: "translateX(-50%)",

        width: 520,
        height: 300,

        borderRadius: 18,
        overflow: "hidden",

        background: "#dec8a4",
        boxShadow: "0 0 0 2px rgba(80, 50, 20, 0.25)",
      }}
    >
      {/* FOTO COM FIT CORRETO */}
      <Img
        src={photoUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",

          // mescla igual ao local (visual old paper)
          mixBlendMode: "multiply",
          filter: "sepia(0.5) contrast(0.95) saturate(0.9)",
        }}
      />

      {/* TEXTURA DO PAPEL SOBRE A FOTO */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${texture})`,
          backgroundSize: "cover",
          mixBlendMode: "soft-light",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

/* ------------ NAME OVERLAY (LAYOUT DO LOCAL MANTIDO) ------------ */

const NameOverlay: React.FC<{ name: string }> = ({ name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rawProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 80, mass: 1.2 },
    durationInFrames: 70,
  });

  const anticipation = interpolate(
    rawProgress,
    [0, 0.08, 0.2, 1],
    [0, -0.03, 0.05, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const progress = interpolate(anticipation, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(rawProgress, [0, 0.04], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",

        // 🔥 POSIÇÃO PERFETA E COMPATÍVEL COM O LAYOUT LOCAL
        top: 260,
        left: "50%",
        transform: "translateX(-50%)",

        pointerEvents: "none",
        background: "transparent",
        zIndex: 10,
        opacity,
      }}
    >
      <DistressedNameCanvas
        text={name}
        progress={progress}
        width={900}
        height={300}
        fontSize={86}
        textColor="#301b05"
        glowColor="#f5e5b2"
        roughness={0.5}
        wobble={0.6}
        inkBleed={0.9}
      />
    </div>
  );
};

/* ------------ URL DO SERVIDOR PARA FALLBACK ------------ */

const SERVER_URL =
  process.env.SERVER_URL ??
  "https://remotion-railway-production.up.railway.app";

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

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

  return (
    <AbsoluteFill>
      {/* vídeo base */}
      <Video src={staticFile("videonoel-h264.mp4")} volume={0} />

      {/* trecho POV da carta: nome + foto + ÁUDIO */}
      <Sequence from={POV_LETTER_START} durationInFrames={POV_LETTER_DURATION}>
        {safeAudioSrc && <Audio src={safeAudioSrc} />} {/* 🔊 só aqui */}
        <NameOverlay name={safeName} />
        <PhotoOnLetter photoUrl={safePhotoUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
