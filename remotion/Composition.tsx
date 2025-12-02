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
  name: string;
  photoUrl: string;
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
        top: 320,
        left: "50%",
        transform: "translateX(-50%)",
        width: 1180,
        height: 620,
        borderRadius: 40,
        overflow: "hidden",
        boxShadow: "0 40px 80px rgba(0,0,0,0.55)",
        backgroundColor: "#1a0d05",
      }}
    >
      {/* Foto dinâmica */}
      <Img
        src={photoUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(0.9) brightness(0.9)",
        }}
      />

      {/* Vignette/overlay mais leve */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.2), transparent 55%)," +
            "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.9))",
          mixBlendMode: "multiply",
        }}
      />

      {/* borda suave */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 40,
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.85)",
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
    config: { damping: 18, stiffness: 120, mass: 0.9 },
    durationInFrames: 50,
  });

  const progress = interpolate(rawProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(rawProgress, [0, 0.03], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 265,            // encaixa melhor na carta
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 20,
        opacity,
      }}
    >
      <DistressedNameCanvas
        text={name.toUpperCase()}
        progress={progress}
        width={820}          // menor pra não virar faixa gigante
        height={160}
        fontSize={80}
        textColor="#2b1603"
        glowColor="#f5e2b0"
        roughness={0.45}
        wobble={0.5}
        inkBleed={0.8}
        // usa a textura do public
        textureSrc={staticFile("ink-texture.webp")}
      />
    </div>
  );
};

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

export const MyComp: React.FC<NoelCompProps> = ({ name, photoUrl }) => {
  // resto do código igual
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
  <PhotoOnLetter photoUrl={photoUrl} />
  <NameOverlay name={name} />
</Sequence>

    </AbsoluteFill>
  );
};
