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
} from "remotion";

import { DistressedNameCanvas } from "./DistressedTextCanvas";

export type NoelCompProps = {
  name?: string;
  photoUrl?: string;
};

/* ------------ TIPAGEM DOS PROPS ------------ */

export type NoelCompProps = {
  name: string;
  photoUrl?: string;
};

/* ------------ MAPA DE FRAMES ------------ */

// POV da carta (onde entra o nome e a foto)
const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

/* ------------ FOTO SOBRE A CARTA ------------ */

const PhotoOnLetter: React.FC<{ photoUrl: string }> = ({ photoUrl }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 360,
        left: "50%",
        transform: "translateX(-50%)",
        width: 1100,
        height: 520,
        borderRadius: 40,
        overflow: "hidden",
        background: "#1a0f07",
        boxShadow: "0 28px 80px rgba(0,0,0,0.8)",
      }}
    >
      <Img
        src={photoUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "brightness(0.5) contrast(1.1)",
        }}
      />
      {/* overlay âmbar leve por cima da foto */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 0%, rgba(255,230,180,0.22), transparent 60%)",
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
};

/* ------------ NAME OVERLAY (TEXTO + MAGIA) ------------ */

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

  const progress = interpolate(
    anticipation,
    [0, 1],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const opacity = interpolate(
    rawProgress,
    [0, 0.04],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <div
      style={{
        position: "absolute",
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

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

// pode ficar no topo do arquivo Composition.tsx
const SERVER_URL =
  process.env.SERVER_URL ?? "https://remotion-railway-production.up.railway.app";

export const MyComp: React.FC<NoelCompProps> = ({ name, photoUrl }) => {
  // 🔒 Fallbacks seguros
  const safeName = (name ?? "").trim() || "Amigo(a)";

  // Se vier photoUrl no body, usa ela.
  // Se NÃO vier, usa a do public: /public/photo-placeholder.jpg
  const safePhotoUrl =
    photoUrl && photoUrl.trim().length > 0
      ? photoUrl
      : `${SERVER_URL}/photo-placeholder.jpg`;

  return (
    <AbsoluteFill>
      {/* vídeo base com o POV da carta */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* parte em que a carta está em primeiro plano */}
      <Sequence
        from={POV_LETTER_START}
        durationInFrames={POV_LETTER_DURATION}
      >
        <NameOverlay name={safeName} />
        <PhotoOnLetter photoUrl={safePhotoUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
