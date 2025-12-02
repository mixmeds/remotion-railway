import React, { useEffect, useRef } from "react";

type Props = {
  text: string;
  progress: number; // 0 → 1
  textureSrc?: string;
  frame: number;
  fps: number;
};

export const DistressedNameCanvas: React.FC<Props> = ({
  text,
  progress,
  textureSrc,
  frame,
  fps,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // tamanho fixo do canvas (não depende do DOM → evita NaN)
    const width = (canvas.width = 900);
    const height = (canvas.height = 180);

    ctx.clearRect(0, 0, width, height);

    // garante valor finito entre 0 e 1
    const p = Math.max(0, Math.min(progress, 1));
    if (p <= 0) return;

    // ---------- CONFIG BÁSICA DO TEXTO ----------
    ctx.font = "600 80px Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;

    const paddingX = 40;
    const x = paddingX;
    const y = height / 2;

    // “escrita” da esquerda para a direita
    const visibleWidth = textWidth * p;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 10, 0, visibleWidth + 20, height);
    ctx.clip();

    // cor base do texto
    const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
    baseGradient.addColorStop(0, "#f8e2b2");
    baseGradient.addColorStop(1, "#f7d58a");

    ctx.fillStyle = baseGradient;
    ctx.fillText(text, x, y);

    // contorno mais escuro para ficar legível
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#3a220c";
    ctx.strokeText(text, x, y);

    ctx.restore();

    // ---------- TEXTURA / “FALHAS” ----------
    if (textureSrc) {
      const img = new Image();
      img.src = textureSrc;
      img.onload = () => {
        const jitterX = Math.sin(frame / fps) * 6;
        const jitterY = Math.cos(frame / fps) * 4;

        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.6;
        ctx.drawImage(img, jitterX * 0.6, jitterY * 0.4, width, height);
        ctx.restore();

        // pequenas falhas de tinta nas bordas
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 0.22;

        for (let i = 0; i < 60; i++) {
          const rx = x - 15 + Math.random() * (textWidth + 30);
          const ry = y - 50 + Math.random() * 100;
          const r = 1 + Math.random() * 4;
          ctx.beginPath();
          ctx.arc(rx, ry, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      };
    }
  }, [text, progress, textureSrc, frame, fps]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 900,
        height: 180,
        display: "block",
      }}
    />
  );
};
