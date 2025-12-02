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

/* ------------ MAPA DE FRAMES ------------ */

// POV da carta (onde entra o nome)
const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

/* ------------ NAME OVERLAY (TEXTO + MAGIA) ------------ */

const NameOverlay: React.FC<{ name: string }> = ({ name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // animação principal da escrita
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
        top: 260, // texto perto do topo da carta
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        background: "transparent",
        zIndex: 10, // acima da foto
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

/* ------------ FOTO NA CARTA ------------ */

const PhotoOnLetter: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // entra um pouquinho depois que o texto começa
  const appear = spring({
    frame: frame - 12,
    fps,
    config: { damping: 18, stiffness: 110, mass: 1.1 },
    durationInFrames: 50,
  });

  const scale = interpolate(
    appear,
    [0, 0.7, 1],
    [0.8, 1.04, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const rotate = interpolate(
    appear,
    [0, 1],
    [-6, -3],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const y = interpolate(
    appear,
    [0, 1],
    [40, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const texture = staticFile("paper-texture.jpg");

  return (
    <div
      style={{
        position: "absolute",
        top: 290,
        left: "50%",
        transform: `translateX(-50%) translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`,
        width: 540,
        height: 360,
        boxShadow:
          "0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.35)",
        borderRadius: 18,
        overflow: "hidden",
        opacity: appear,
        backgroundColor: "#2b1a0d",
      }}
    >
      {/* foto */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            mixBlendMode: "multiply",
            filter: "sepia(0.5) contrast(0.95) saturate(0.9)",
          }}
        />

        {/* textura do papel por cima da foto */}
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
    </div>
  );
};

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

export const MyComp: React.FC<{ name: string }> = ({ name }) => {
  return (
    <AbsoluteFill>
      {/* vídeo base com o POV da carta */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* sequência em que a carta está em primeiro plano */}
      <Sequence
        from={POV_LETTER_START}
        durationInFrames={POV_LETTER_DURATION}
      >
        <NameOverlay name={name} />
        <PhotoOnLetter src={staticFile("photo-placeholder.jpg")} />
        {/* depois você troca esse src pela foto dinâmica do usuário */}
      </Sequence>
    </AbsoluteFill>
  );
};
