import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DistressedNameCanvas } from "./DistressedTextCanvas";

/* ------------ MAPA DE FRAMES ------------ */

// POV da carta (onde entra o nome/foto)
const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

/* ------------ FOTO SOBRE A CARTA ------------ */

const PhotoOnLetter: React.FC<{ src: string }> = ({ src }) => {
  const texture = staticFile("ink-texture.webp");
  const frame = useCurrentFrame();

  // fade-in da foto
  const fadeIn = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // fade-out leve perto do fim da sequência
  const fadeOut = interpolate(
    frame,
    [POV_LETTER_DURATION - 20, POV_LETTER_DURATION - 5],
    [1, 0.85],
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
        top: 260,
        left: "50%",
        transform: "translateX(-50%)",
        width: 520,
        height: 300,
        pointerEvents: "none",
        background: "transparent",
        zIndex: 5,
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
        {/* FOTO DO USUÁRIO */}
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            mixBlendMode: "multiply",
            filter: "sepia(0.4) contrast(0.95) saturate(0.9)",
          }}
        />

        {/* textura do papel por cima da foto */}
        <Img
          src={texture}
          style={{
            position: "absolute",
            inset: 0,
            mixBlendMode: "multiply",
            opacity: 0.55,
            pointerEvents: "none",
          }}
        />

        {/* vinheta leve */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.35) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

/* ------------ NOME SOBRE A CARTA ------------ */

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

  const progress = interpolate(anticipation, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(rawProgress, [0, 0.04], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const safeName =
    (name || "Amigo(a)").toUpperCase().slice(0, 20); // segurança extra

  return (
    <div
      style={{
        position: "absolute",
        top: 195, // um pouco acima da foto
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

/* ------------ PROPS DA COMPOSIÇÃO ------------ */

export type NoelCompProps = {
  name?: string;
  photoUrl?: string;
};

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

export const MyComp: React.FC<NoelCompProps> = ({ name, photoUrl }) => {
  const defaultPhoto = staticFile("photo-placeholder.jpg");

  return (
    <AbsoluteFill>
      {/* vídeo base com o POV da carta */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* sequência em que a carta está em primeiro plano */}
      <Sequence
        from={POV_LETTER_START}
        durationInFrames={POV_LETTER_DURATION}
      >
        <NameOverlay name={name ?? "Amigo(a)"} />
        <PhotoOnLetter src={photoUrl || defaultPhoto} />
      </Sequence>
    </AbsoluteFill>
  );
};
