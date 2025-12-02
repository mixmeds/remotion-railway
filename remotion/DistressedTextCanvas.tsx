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

    const width = (canvas.width = 900);
    const height = (canvas.height = 180);

    ctx.clearRect(0, 0, width, height);

    const p = Math.max(0, Math.min(progress, 1));
    if (p <= 0) return;

    // ---------- CONFIG BÁSICA DO TEXTO ----------
    ctx.font = "600 80px Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textX = (width - textWidth) / 2; // centraliza
    const textY = height / 2;

    const revealWidth = textWidth * p;
    const revealX = textX + revealWidth; // ponta da caneta

    const drawText = (texture?: HTMLImageElement) => {
      ctx.save();

      // recorte acompanhando a escrita
      ctx.beginPath();
      ctx.rect(textX, 0, revealWidth, height);
      ctx.clip();

      // gradiente da tinta
      const gradient = ctx.createLinearGradient(
        textX,
        0,
        textX + textWidth,
        height
      );
      gradient.addColorStop(0, "#5a3b22");
      gradient.addColorStop(0.5, "#3b2614");
      gradient.addColorStop(1, "#2a1a10");

      ctx.fillStyle = gradient;
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;

      ctx.globalAlpha = 0.95;
      ctx.fillText(text, textX, textY);

      // “ghost” leve
      ctx.globalAlpha = 0.12;
      ctx.fillText(text, textX + 1, textY - 1);
      ctx.fillText(text, textX - 1, textY + 1);
      ctx.globalAlpha = 1;

      // textura dentro das letras
      if (texture) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = 0.4;
        ctx.drawImage(texture, textX, 0, textWidth, height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.restore();
    };

    // carrega textura se tiver
    if (textureSrc) {
      const texture = new Image();
      texture.src = textureSrc;

      if (texture.complete) {
        drawText(texture);
      } else {
        texture.onload = () => drawText(texture);
        texture.onerror = () => drawText();
      }
    } else {
      drawText();
    }

    // ---------- BRILHO + SPARKLES COM FADE NO FIM ----------
    if (p > 0) {
      const textYBase = textY - 5;
      const glowRadius = 45;

      // fade-out nos últimos 10% da animação
      const fade = p < 0.9 ? 1 : 1 - (p - 0.9) * 10;
      if (fade <= 0) return;

      // brilho principal
      const grad = ctx.createRadialGradient(
        revealX,
        textYBase,
        0,
        revealX,
        textYBase,
        glowRadius
      );
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.3, "rgba(255,230,120,0.95)");
      grad.addColorStop(0.6, "rgba(255,210,80,0.5)");
      grad.addColorStop(1, "rgba(255,200,0,0)");

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = fade;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(revealX, textYBase, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // sparkles
      const t = frame / fps;

      for (let i = 0; i < 10; i++) {
        const angleDeg =
          i * 36 + t * 120 + Math.sin(t * 3 + i * 1.3) * 25;
        const angle = (angleDeg * Math.PI) / 180;

        const baseDist = 20 + Math.sin(t * 2 + i) * 8;
        const dist = baseDist + (Math.sin(t * 4 + i * 2) + 1) * 8;

        const sx = revealX + Math.cos(angle) * dist;
        const sy = textYBase + Math.sin(angle) * dist;

        const life = (Math.sin(t * 5 + i) + 1) / 2; // 0 → 1
        const size = 4 + life * 6;
        const opacity = (0.3 + life * 0.7) * fade;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = opacity;

        const sparkGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, size);
        sparkGrad.addColorStop(0, "rgba(255,255,255,1)");
        sparkGrad.addColorStop(0.5, "rgba(255,240,150,0.9)");
        sparkGrad.addColorStop(1, "rgba(255,220,100,0)");

        ctx.fillStyle = sparkGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [text, progress, textureSrc, frame, fps]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 900,
        height: 180,
        display: "block",
        backgroundColor: "transparent",
        mixBlendMode: "multiply",
        opacity: 0.97,
      }}
    />
  );
};