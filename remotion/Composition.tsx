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

const PhotoOnLetter: React.FC<{ src: string }> = ({ src }) => {
  const texture = staticFile("ink-texture.webp");
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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

  const subtleMoveX = interpolate(
    frame,
    [0, POV_LETTER_DURATION],
    [-8, 8],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const subtleMoveY = interpolate(
    frame,
    [0, POV_LETTER_DURATION],
    [4, -4],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const subtleRotation = interpolate(
    frame,
    [0, POV_LETTER_DURATION],
    [-1.4, -1.0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const subtleScale = interpolate(
    frame,
    [0, POV_LETTER_DURATION],
    [1.01, 1.03],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        left: 340,
        width: 1240,
        height: 720,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translate(${subtleMoveX}px, ${subtleMoveY}px) rotate(${subtleRotation}deg) scale(${subtleScale})`,
        transformOrigin: "center center",
        filter: "drop-shadow(0px 18px 40px rgba(0,0,0,0.55))",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: "#1a0f08",
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            mixBlendMode: "multiply",
            filter: "sepia(0.45) contrast(0.98) saturate(0.9)",
          }}
        />

        {/* textura de papel por cima da foto */}
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

  const safeName = (name ?? "").trim() || "Seu nome aqui";

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
        text={safeName}
        progress={progress}
        textureSrc={staticFile("ink-texture.webp")}
        frame={frame}
        fps={fps}
      />
    </div>
  );
};

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

export const MyComp: React.FC<NoelCompProps> = ({ name, photoUrl }) => {
  const finalName = (name ?? "").trim() || "Seu nome aqui";

  // placeholder local (pasta /public)
  const fallbackPhoto = staticFile("photo-placeholder.jpg");
  const finalPhoto = (photoUrl ?? "").trim() || fallbackPhoto;

  return (
    <AbsoluteFill>
      {/* vídeo base com o POV da carta */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* parte em que a carta está em primeiro plano */}
      <Sequence
        from={POV_LETTER_START}
        durationInFrames={POV_LETTER_DURATION}
      >
        <NameOverlay name={finalName} />
        <PhotoOnLetter src={finalPhoto} />
      </Sequence>
    </AbsoluteFill>
  );
};
