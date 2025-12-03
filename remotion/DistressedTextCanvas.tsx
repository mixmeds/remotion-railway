// remotion/DistressedTextCanvas.tsx
import React, { useEffect, useRef } from "react";

type DistressedNameCanvasProps = {
  text: string;
  progress: number; // 0 → 1
  width?: number;
  height?: number;
  fontSize?: number;
  textColor?: string;
  glowColor?: string;
  roughness?: number;
  wobble?: number;
  inkBleed?: number;
};

export const DistressedNameCanvas: React.FC<DistressedNameCanvasProps> = ({
  text,
  progress,
  width = 900,
  height = 220,
  fontSize = 86,
  textColor = "#301b05",
  glowColor = "#f5e5b2",
  roughness = 0.5,
  wobble = 0.6,
  inkBleed = 0.9,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 🔒 Garante que nunca vai NaN / infinito
    const safeProgressRaw = Number.isFinite(progress) ? progress : 0;
    const p = Math.min(Math.max(safeProgressRaw, 0), 1);

    ctx.clearRect(0, 0, width, height);

    // Centraliza
    ctx.save();
    ctx.translate(width / 2, height / 2);

    const visibleLength =
      p <= 0 ? 0 : Math.max(1, Math.floor(text.length * p));
    const visibleText = text.slice(0, visibleLength);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${fontSize}px "Cinzel", "Times New Roman", serif`;

    // Pequena “tremida” de caligrafia
    const jitterX =
      (Math.sin(p * 10) + Math.cos(p * 4)) * roughness * 4;
    const jitterY = Math.cos(p * 7) * roughness * 3;

    const blurAmount = (1 - p) * 4 * inkBleed;

    // ✨ Glow suave
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18 * (0.4 + p);
    ctx.fillStyle = textColor;
    ctx.filter = `blur(${blurAmount}px)`;
    ctx.fillText(visibleText, jitterX, jitterY);
    ctx.restore();

    // Texto principal
    ctx.fillStyle = textColor;
    ctx.filter = "none";
    ctx.fillText(visibleText, jitterX, jitterY);

    // 🔢 Função pseudo-random determinística (sem flicker)
    const rand = (seed: number) => {
      const x = Math.sin(seed * 43758.5453) * 10000;
      return x - Math.floor(x);
    };

    // Pequenas manchas / respingos (fixos, só “aparecem” com o progresso)
    const dotsCount = 18;
    for (let i = 0; i < dotsCount; i++) {
      const t = i / dotsCount;
      const angle = t * Math.PI * 2;
      const radius = 40 + 60 * t;

      const dotX = Math.cos(angle) * radius * (0.4 + wobble);
      const dotY = Math.sin(angle * 1.3) * radius * 0.4;

      const baseSeed = i + text.length * 17;
      const alphaRand = rand(baseSeed);
      const sizeRand = rand(baseSeed + 100);

      const alpha = (0.25 + alphaRand * 0.35) * p;
      const radiusDot = 1.5 + sizeRand * 1.8;

      ctx.fillStyle = `rgba(64, 40, 15, ${alpha})`;
      ctx.beginPath();
      ctx.arc(dotX, dotY, radiusDot, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [
    text,
    progress,
    width,
    height,
    fontSize,
    textColor,
    glowColor,
    roughness,
    wobble,
    inkBleed,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        background: "transparent",
      }}
    />
  );
};
