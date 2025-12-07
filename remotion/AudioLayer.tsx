import React, { useEffect, useRef } from "react";
import { Audio as RemotionAudio, delayRender, continueRender } from "remotion";

type Props = {
  src: string;
};

export const AudioLayer: React.FC<Props> = ({ src }) => {
  const handleRef = useRef<number | null>(delayRender("Carregando áudio dinâmico"));

  useEffect(() => {
    const handle = handleRef.current;
    if (handle === null) return;

    if (!src) {
      console.warn("⚠ [AudioLayer] Nenhum src recebido.");
      continueRender(handle);
      return;
    }

    console.log("🎧 [AudioLayer] Tentando carregar áudio:", src);

    const audioTest = new window.Audio(src);

    const onCanPlay = () => {
      console.log("✅ [AudioLayer] Áudio carregado (canplaythrough):", src);
      continueRender(handle);
    };

    const onError = (err: any) => {
      console.error("❌ [AudioLayer] Erro ao carregar áudio:", src, err);
      continueRender(handle);
    };

    audioTest.addEventListener("canplaythrough", onCanPlay);
    audioTest.addEventListener("error", onError);

    return () => {
      audioTest.removeEventListener("canplaythrough", onCanPlay);
      audioTest.removeEventListener("error", onError);
      audioTest.pause();
    };
  }, [src]);

  return <RemotionAudio src={src} />;
};
