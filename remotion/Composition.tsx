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
  language?: string; // "pt-BR" | "es" | "es-ES" etc
};

/* ------------ CONFIGURAÇÃO DO VÍDEO DINÂMICO (R2) ------------ */

const DINAMICO_URLS = {
  pt: "https://pub-60278fada25346f1873f83649b338d98.r2.dev/assets/video-base-dinamico-h264.mp4",
  es: "https://pub-60278fada25346f1873f83649b338d98.r2.dev/assets/video-base-dinamico-es-h264.mp4",
} as const;

const normalizeLang = (l?: string) =>
  (l ?? "pt-BR").toLowerCase().startsWith("es") ? "es" : "pt";
/**
 * Mapa de frames original (vídeo completo):
 *
 * - Entrada mágica: 0 até 689  (690 frames)
 * - Parte dinâmica: 690 até 1150 (461 frames)
 * - Saída mágica: 1151 até 1841 (691 frames)
 *
 * Trecho da carta em POV (onde aparecem nome/foto) no vídeo original:
 *   POV_LETTER_START_GLOBAL = 700
 *   POV_LETTER_END_GLOBAL   = 940
 *
 * Agora a composição do Remotion renderiza APENAS a parte dinâmica
 * (461 frames), ou seja, refazemos o mapeamento desses frames
 * para o novo intervalo 0..460 (local).
 */

const ENTRADA_FRAMES = 690;
const DINAMICO_FRAMES = 461;
// const SAIDA_FRAMES = 691; // usado apenas para referência/documentação

const POV_LETTER_START_GLOBAL = 700;
const POV_LETTER_END_GLOBAL = 940;

// Converte o range global (do vídeo completo) para o range local
// (apenas a parte dinâmica). Ex.: 700 - 690 = frame 10 do trecho dinâmico.
const POV_LETTER_START = POV_LETTER_START_GLOBAL - ENTRADA_FRAMES; // 10
const POV_LETTER_END = POV_LETTER_END_GLOBAL - ENTRADA_FRAMES; // 250
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1; // 241

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
};

const NameOverlay: React.FC<NameOverlayProps> = ({ name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rawProgress = spring({
    frame,
    fps,
    config: {
      damping: 15,
      mass: 0.4,
      stiffness: 90,
    },
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

/* ------------ COMPOSIÇÃO PRINCIPAL (APENAS PARTE DINÂMICA) ------------ */

export const MyComp: React.FC<NoelCompProps> = ({
  name,
  photoUrl,
  audioSrc,
  language,
}) => {
  const { durationInFrames } = useVideoConfig();

  // Log defensivo para garantir que a duração do Composition
  // (definida em RemotionRoot) bate com o trecho dinâmico esperado.
  if (durationInFrames !== DINAMICO_FRAMES) {
    console.warn(
      "[NOEL] durationInFrames não bate com DINAMICO_FRAMES.",
      "durationInFrames=",
      durationInFrames,
      "DINAMICO_FRAMES=",
      DINAMICO_FRAMES
    );
  }

  const safeName = (name ?? "").trim() || "Amigo(a)";
  const safePhoto =
    photoUrl && photoUrl.trim() !== ""
      ? photoUrl.trim()
      : staticFile("photo-placeholder.jpg");

  const safeAudio =
    audioSrc && audioSrc.trim() !== "" ? audioSrc.trim() : undefined;

  const lang = normalizeLang(language);
  const dinamicoUrl = DINAMICO_URLS[lang];

  console.log("🎧 [REMOTION DEBUG] audioSrc recebido em MyComp:", audioSrc);
  console.log("🎧 [REMOTION DEBUG] safeAudio normalizado:", safeAudio);

  return (
    <AbsoluteFill>
      {/* VÍDEO BASE DINÂMICO (sem entrada/saída) */}
      <Video src={dinamicoUrl} />

      {/* NOME + FOTO APENAS NO TRECHO DA CARTA EM POV */}
      <Sequence
        from={POV_LETTER_START}
        durationInFrames={POV_LETTER_DURATION}
      >
        <NameOverlay name={safeName} />
        <PhotoOnLetter photoUrl={safePhoto} />
      </Sequence>

      {/* ÁUDIO DINÂMICO - INICIA JUNTO COM O POV DA CARTA
          (ajuste o "from" se quiser alinhar com outro momento)
      */}
      {safeAudio && (
        <Sequence from={POV_LETTER_START}>
          <AudioLayer src={safeAudio} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
