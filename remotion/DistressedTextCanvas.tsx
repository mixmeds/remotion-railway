import React, { useEffect, useRef } from "react";

type Props = {
  text: string;
  progress: number; // 0 → 1
  textureSrc?: string; // mantido, se quiser usar depois
  frame: number;
  fps: number;
};

export const DistressedNameCanvas: React.FC<Props> = ({
  text,
  progress,
  textureSrc, // não estou usando por enquanto pra simplificar
  frame,
  fps,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ---------- SANITIZAÇÃO DOS VALORES ----------
    const safeProgressRaw = Number.isFinite(progress) ? progress : 0;
    const safeProgress = Math.min(1, Math.max(0, safeProgressRaw));

    const safeFrame = Number.isFinite(frame) ? frame : 0;
    const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;

    const t = safeFrame / safeFps;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // ---------- BACKGROUND TRANSPARENTE ----------
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, width, height);

    // ---------- CONFIG TEXTO ----------
    const fontSize = 90;
    ctx.font = `700 ${fontSize}px "Cinzel", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textX = width / 2;
    const textY = height / 2;

    const upperText = (text || "").toUpperCase();

    // ---------- TEXTO BASE / SOMBRA ----------
    ctx.save();
    ctx.fillStyle = "#f5e0b5";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;
    ctx.fillText(upperText, textX, textY);
    ctx.restore();

    // ---------- MÁSCARA DE REVEAL (ESCRITA) ----------
    const revealWidth = width * safeProgress;

    ctx.save();
    ctx.beginPath();
    ctx.rect(textX - width / 2, 0, revealWidth, height);
    ctx.clip();

    // contorno interno / “distressed” básico
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(120,60,10,0.9)";
    ctx.strokeText(upperText, textX, textY);

    ctx.restore();

    // ---------- BRILHO NO FRONT DA ESCRITA ----------
    const glowX = textX - width / 2 + revealWidth;
    const glowRadius = 70;

    if (
      Number.isFinite(glowX) &&
      Number.isFinite(textY) &&
      Number.isFinite(glowRadius) &&
      glowRadius > 0
    ) {
      const grad = ctx.createRadialGradient(
        glowX,
        textY,
        0,
        glowX,
        textY,
        glowRadius
      );
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.3, "rgba(255,230,140,0.9)");
      grad.addColorStop(0.7, "rgba(255,200,60,0.4)");
      grad.addColorStop(1, "rgba(255,180,0,0)");

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = grad;
      ctx.fillRect(
        glowX - glowRadius * 1.5,
        textY - glowRadius * 1.5,
        glowRadius * 3,
        glowRadius * 3
      );
      ctx.restore();
    }

    // ---------- SPARKLES / PARTICULAS LEVES ----------
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const sparkleCount = 12;
    for (let i = 0; i < sparkleCount; i++) {
      const angle =
        (i / sparkleCount) * Math.PI * 2 +
        t * 1.5 +
        Math.sin(t * 2 + i * 0.7) * 0.4;

      const baseR = 20 + 10 * Math.sin(t * 2 + i);
      const r = baseR + safeProgress * 40;

      const sx = glowX + Math.cos(angle) * r;
      const sy = textY + Math.sin(angle) * r * 0.5;

      if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
        continue;
      }

      const size = 2 + safeProgress * 4;
      if (!Number.isFinite(size) || size <= 0) {
        continue;
      }

      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, size);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [text, progress, textureSrc, frame, fps]);

  return (
    <canvas
      ref={canvasRef}
      // IMPORTANTE: width/height no elemento, não só no style
      width={900}
      height={180}
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
