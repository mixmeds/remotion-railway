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
import { AudioLayer } from "./AudioLayer";

/* ------------ TIPAGEM DOS PROPS ------------ */

export type NoelCompProps = {
  name?: string;
  photoUrl?: string;
  audioSrc?: string;
};

/* ------------ MAPA DE FRAMES ------------ */

const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

/* ------------ FOTO SOBRE A CARTA ------------ */

const PhotoOnLetter: React.FC<{ photoUrl: string }> = ({ photoUrl }) => {
  const texture = staticFile("ink-texture.webp");

  return (
    <div
      style={{
        position: "absolute",
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
      <Img
        src={photoUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          mixBlendMode: "multiply",
          filter: "sepia(0.5) contrast(0.95) saturate(0.9)",
        }}
      />

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

/* ------------ NAME OVERLAY ------------ */

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

export const MyComp: React.FC<NoelCompProps> = ({
  name,
  photoUrl,
  audioSrc,
}) => {
  const safeName = (name ?? "").trim() || "Amigo(a)";
  const safePhoto =
    photoUrl && photoUrl.trim() !== ""
      ? photoUrl.trim()
      : staticFile("photo-placeholder.jpg");

  const safeAudio =
    audioSrc && audioSrc.trim() !== "" ? audioSrc.trim() : undefined;

  console.log("🎧 [REMOTION DEBUG] audioSrc recebido em MyComp:", audioSrc);
  console.log("🎧 [REMOTION DEBUG] safeAudio normalizado:", safeAudio);

  return (
    <AbsoluteFill>
      {/* vídeo base mutado */}
      <Video src={staticFile("videonoel-h264.mp4")} volume={0} />

      {/* trecho POV (nome, foto, áudio) */}
      <Sequence from={POV_LETTER_START} durationInFrames={POV_LETTER_DURATION}>
        {safeAudio && <AudioLayer src={safeAudio} />}

        <NameOverlay name={safeName} />
        <PhotoOnLetter photoUrl={safePhoto} />
      </Sequence>
    </AbsoluteFill>
  );
};
