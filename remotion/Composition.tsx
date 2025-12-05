import React from "react";
import {
  AbsoluteFill,
  Video,
  staticFile,
  Sequence,
  useVideoConfig,
  Audio,
} from "remotion";

/* ------------ MAPA DE FRAMES ------------ */

const POV_LETTER_START = 700;
const POV_LETTER_END = 940;
const POV_LETTER_DURATION = POV_LETTER_END - POV_LETTER_START + 1;

const PHOTO_ON_LETTER_START = POV_LETTER_START + 5;
const PHOTO_ON_LETTER_END = POV_LETTER_END - 10;

const AUDIO_START_FRAME = POV_LETTER_START + 10;

/* ------------ TIPOS ------------ */

export type NoelCompProps = {
  name: string;
  photoUrl?: string;
  hasPhoto?: boolean;
  audioSrc?: string; // data:audio/mpeg;base64,...
};

/* ------------ OVERLAYS ------------ */

const LetterOverlayName: React.FC<{ name: string }> = ({ name }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "54%",
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 64,
        fontFamily: "Great Vibes, cursive",
        color: "#2b1408",
        textShadow: "0 2px 3px rgba(0,0,0,0.3)",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </div>
  );
};

const LetterOverlayPhoto: React.FC<{ photoUrl: string }> = ({ photoUrl }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 380,
        height: 380,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        border: "6px solid rgba(255,255,255,0.8)",
        backgroundColor: "#1a1a1a",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt="Foto da criança"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
};

/* ------------ COMPOSIÇÃO PRINCIPAL ------------ */

export const MyComp: React.FC<NoelCompProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();

  // Normalização simples, SEM frescura
  const safeName =
    typeof props.name === "string" && props.name.trim().length > 0
      ? props.name.trim()
      : "Amigo Especial";

  const safePhotoUrl =
    typeof props.photoUrl === "string" && props.photoUrl.trim().length > 0
      ? props.photoUrl.trim()
      : undefined;

  const safeAudioSrc =
    typeof props.audioSrc === "string" && props.audioSrc.trim().length > 0
      ? props.audioSrc.trim()
      : undefined;

  if (typeof window === "undefined") {
    console.log("[MyComp] props recebidos:", {
      name: safeName,
      hasPhoto: !!safePhotoUrl,
      photoUrlSnippet: safePhotoUrl
        ? safePhotoUrl.substring(0, 60) + "..."
        : null,
      hasAudioSrc: !!safeAudioSrc,
      audioSrcIsDataUri: safeAudioSrc?.startsWith("data:audio") ?? false,
      fps,
      durationInFrames,
    });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Vídeo base (SEM áudio próprio) */}
      <Video
        src={staticFile("videonoel-h264.mp4")}
        startFrom={0}
        endAt={durationInFrames}
        muted // importantíssimo: só o áudio dinâmico toca
        style={{ width: "100%", height: "100%" }}
      />

      {/* Nome na carta */}
      <Sequence from={POV_LETTER_START} durationInFrames={POV_LETTER_DURATION}>
        <LetterOverlayName name={safeName} />
      </Sequence>

      {/* Foto em cima da carta */}
      {safePhotoUrl && (
        <Sequence
          from={PHOTO_ON_LETTER_START}
          durationInFrames={PHOTO_ON_LETTER_END - PHOTO_ON_LETTER_START}
        >
          <LetterOverlayPhoto photoUrl={safePhotoUrl} />
        </Sequence>
      )}

      {/* Áudio dinâmico */}
      {safeAudioSrc && (
        <Sequence from={AUDIO_START_FRAME}>
          <Audio src={safeAudioSrc} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

/* ------------ ROOT REMOTION ------------ */

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <AbsoluteFill>
        {/* apenas pra registrar a composição */}
      </AbsoluteFill>
    </>
  );
};
