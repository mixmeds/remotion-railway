// remotion/Composition.tsx
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
  Audio,
} from "remotion";
import { DistressedNameCanvas } from "./DistressedTextCanvas";

/* ------------ TIPAGEM DOS PROPS ------------ */

export type NoelCompProps = {
  name: string;
  photoUrl?: string;
  audioSrc?: string;
  jobId?: string;
};

/* ------------ CONSTANTES DE ANIMAÇÃO ------------ */

const NAME_APPEAR_FRAME = 740;

const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

/* ------------ COMPONENTE DA FOTO SOBRE A CARTA ------------ */

const PhotoOnLetter: React.FC<{ photoUrl: string }> = ({ photoUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    frame,
    fps,
    config: {
      damping: 20,
      mass: 0.6,
      stiffness: 120,
    },
  });

  const scale = interpolate(appear, [0, 1], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(appear, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rotation = interpolate(appear, [0, 1], [-6, -3], {
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
          position: "absolute",
          top: 250,
          left: "63%",
          transform: `translateX(-50%) scale(${scale}) rotate(${rotation}deg)`,
          opacity,
          width: 420,
          height: 420,
          borderRadius: 26,
          overflow: "hidden",
          boxShadow:
            "0 26px 60px rgba(0,0,0,0.75), 0 0 30px rgba(0,0,0,0.55)",
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

/* ------------ COMPONENTE DO NOME ESCRITO NA CARTA ------------ */

const NameOverlay: React.FC<{ name: string }> = ({ name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rawProgress = spring({
    frame: frame - (NAME_APPEAR_FRAME - 10),
    fps,
    config: {
      damping: 18,
      mass: 0.6,
      stiffness: 120,
    },
  });

  const anticipation = interpolate(rawProgress, [0, 0.15, 1], [0, 0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        width: 900,
        height: 300,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        pointerEvents: "none",
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

/* ------------ URL DO SERVIDOR PARA FALLBACK DA FOTO ------------ */

const SERVER_URL =
  typeof window === "undefined"
    ? process.env.REMOTION_SERVER_URL ?? "http://127.0.0.1:8080"
    : window.location.origin;

/* ------------ COMPONENTE PRINCIPAL ------------ */

export const MyComp: React.FC<NoelCompProps> = (props) => {
  const { name, photoUrl, audioSrc, jobId } = props;

  const safeName = (name ?? "").trim() || "meu amigo";

  const safePhotoUrl =
    (photoUrl && photoUrl.trim().length > 0 ? photoUrl.trim() : undefined) ??
    `${SERVER_URL}/static/fallback-photo.png`;

  // 🔊 Normalização do áudio: aceita string, array de string ou vazio
  let resolvedAudioSrc: string | undefined;
  let audioSrcType: string = typeof audioSrc;

  if (typeof audioSrc === "string") {
    const trimmed = audioSrc.trim();
    resolvedAudioSrc = trimmed.length > 0 ? trimmed : undefined;
  } else if (Array.isArray(audioSrc)) {
    const first = audioSrc[0];
    if (typeof first === "string" && first.trim().length > 0) {
      resolvedAudioSrc = first.trim();
      audioSrcType = "string[]";
    }
  }

  const hasAudioSrc = !!resolvedAudioSrc;
  const safeAudioSrcSnippet =
    resolvedAudioSrc && resolvedAudioSrc.length > 80
      ? `${resolvedAudioSrc.slice(0, 77)}...`
      : resolvedAudioSrc ?? null;

  if (typeof window === "undefined") {
    // Loga SOMENTE no render do servidor
    console.log(
      "[Tab ?, remotion/Composition.tsx] 🎧 [MyComp] props normalizados:",
      JSON.stringify(
        {
          jobId,
          name: safeName,
          hasPhoto: !!safePhotoUrl,
          photoUrl: safePhotoUrl,
          audioSrcType,
          hasAudioSrc,
          safeAudioSrcSnippet,
        },
        null,
        2
      )
    );
  }

  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Pequeno zoom-in na carta enquanto o nome é escrito
  const letterOpacity = interpolate(
    frame,
    [POV_LETTER_START - 10, POV_LETTER_START + 15],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const letterScale = interpolate(
    frame,
    [POV_LETTER_START - 10, POV_LETTER_START + 30],
    [1.08, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* 🎥 Vídeo base do Papai Noel */}
      <Video src={staticFile("videonoel-h264.mp4")} />

      {/* ✉️ Janela POV da carta com nome + foto */}
      <Sequence
        from={POV_LETTER_START}
        durationInFrames={POV_LETTER_DURATION}
      >
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: letterOpacity,
            transform: `scale(${letterScale})`,
          }}
        >
          <NameOverlay name={safeName} />
          {safePhotoUrl && <PhotoOnLetter photoUrl={safePhotoUrl} />}
        </AbsoluteFill>
      </Sequence>

      {/* 🔊 Áudio dinâmico vindo da URL do R2 */}
      {hasAudioSrc && resolvedAudioSrc ? <Audio src={resolvedAudioSrc} /> : null}
    </AbsoluteFill>
  );
};
