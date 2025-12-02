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

// POV da carta (onde entra o nome e a foto)
const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

/* ------------ PLACEHOLDER DA FOTO IMPRESSA ------------ */

const PhotoOnLetter: React.FC<{ src: string }> = ({ src }) => {
  const texture = staticFile("ink-texture.webp");
  const frame = useCurrentFrame();

  // fade-in da foto
  const fadeIn = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // fade-out no fim da sequência
  const fadeOut = interpolate(
    frame,
    [POV_LETTER_DURATION - 20, POV_LETTER_DURATION - 5],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const opacity = fadeIn * fadeOut;

  return (
    <div
      style={{
        position: "absolute",
        top: 500,
        left: "50%",
        transform: "translateX(-50%)",
        width: 520,
        height: 300,
        pointerEvents: "none",
        background: "transparent",
        zIndex: 5, // abaixo do nome
        opacity,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 18,
          backgroundColor: "#dec8a4",
          boxShadow: "0 0 0 2px rgba(80, 50, 20, 0.25)",
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

  const progress = Math.max(0, Math.min(anticipation, 1));

  // fade-out do texto no final da sequência
  const fadeOut = interpolate(
    frame,
    [POV_LETTER_DURATION - 20, POV_LETTER_DURATION - 5],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const opacity = fadeOut;

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
        textureSrc={staticFile("ink-texture.webp")}
        frame={frame}
        fps={fps}
      />
    </div>
  );
};

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

export const MyComp: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* vídeo base com o POV da carta */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* sequência em que a carta está em primeiro plano */}
      <Sequence
        from={POV_LETTER_START}
        durationInFrames={POV_LETTER_DURATION}
      >
        <NameOverlay name="Nome Custom" />
        <PhotoOnLetter src={staticFile("photo-placeholder.jpg")} />
        {/* depois você troca esse src pela foto dinâmica do usuário */}
      </Sequence>
    </AbsoluteFill>
  );
};