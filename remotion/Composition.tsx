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

/* ------------ CONFIGURAÇÃO DAS CENAS (R2) ------------ */

const ENTRADA_URL =
  "https://pub-60278fada25346f1873f83649b338d98.r2.dev/assets/entrada-magica-h264.mp4";
const DINAMICO_URL =
  "https://pub-60278fada25346f1873f83649b338d98.r2.dev/assets/video-base-dinamico-h264.mp4";
const SAIDA_URL =
  "https://pub-60278fada25346f1873f83649b338d98.r2.dev/assets/saida-magica-h264.mp4";

// Durações em segundos (conforme informado)
const ENTRADA_SECONDS = 23;
const DINAMICO_SECONDS = 15;
const SAIDA_SECONDS = 23;

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

type NameOverlayProps = {
  name: string;
  /**
   * Frame global em que a animação do nome deve começar.
   * Usamos isso para alinhar com o início da parte dinâmica
   * (após a entrada mágica).
   */
  startFrame?: number;
};

const NameOverlay: React.FC<NameOverlayProps> = ({ name, startFrame }) => {
  const globalFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Frame local relativo ao início da animação
  const frame =
    typeof startFrame === "number"
      ? Math.max(0, globalFrame - startFrame)
      : globalFrame;

  const rawProgress = spring({
    frame,
    fps,
    config: {
      damping: 15,
      mass: 0.4,
      stiffness: 90,
    },
  });

  // pequeno "anticipation" na entrada
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
  const { fps } = useVideoConfig();

  const entradaDuration = Math.round(ENTRADA_SECONDS * fps);
  const dinamicoDuration = Math.round(DINAMICO_SECONDS * fps);
  const saidaDuration = Math.round(SAIDA_SECONDS * fps);

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
      {/* ENTRADA MÁGICA PRÉ-RENDERIZADA (R2) */}
      <Sequence from={0} durationInFrames={entradaDuration}>
        <Video src={ENTRADA_URL} />
      </Sequence>

      {/* PARTE DINÂMICA - VÍDEO BASE + NOME + FOTO + ÁUDIO */}
      <Sequence from={entradaDuration} durationInFrames={dinamicoDuration}>
        <AbsoluteFill>
          {/* vídeo base dinâmico (sem entrada/saída) */}
          <Video src={DINAMICO_URL} />

          {/* camada de áudio dinâmico */}
          {safeAudio && <AudioLayer src={safeAudio} />}

          {/* nome e foto sobre a carta */}
          <NameOverlay name={safeName} startFrame={entradaDuration} />
          <PhotoOnLetter photoUrl={safePhoto} />
        </AbsoluteFill>
      </Sequence>

      {/* SAÍDA FINAL PRÉ-RENDERIZADA (R2) */}
      <Sequence
        from={entradaDuration + dinamicoDuration}
        durationInFrames={saidaDuration}
      >
        <Video src={SAIDA_URL} />
      </Sequence>
    </AbsoluteFill>
  );
};
