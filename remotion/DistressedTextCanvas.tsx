// remotion/DistressedTextCanvas.tsx
import React, { useEffect, useRef } from "react";

type DistressedNameCanvasProps = {
  text: string;
  progress: number; // 0 → 1 (escrita)
  width?: number;
  height?: number;
  fontSize?: number;
  textColor?: string;
  glowColor?: string;
  roughness?: number; // quão "torta" fica a caligrafia
  wobble?: number; // intensidade da imperfeição
  inkBleed?: number; // intensidade da "mancha" de tinta
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

  // hash determinístico para tirar "random" bonito por letra
  const hash = (seed: number) => {
    let x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const safeProgressRaw = Number.isFinite(progress) ? progress : 0;
    const p = Math.min(Math.max(safeProgressRaw, 0), 1);

    // ✅ limpa tudo e deixa o fundo TRANSPARENTE
    ctx.clearRect(0, 0, width, height);

    // --- a partir daqui, só desenhamos texto + respingos ---

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${fontSize}px "Cinzel", "Times New Roman", serif`;

    // quantos caracteres já "apareceram"
    const eased = p < 0.0001 ? 0 : Math.pow(p, 0.85); // ease-out sutil
    const visibleLength =
      eased <= 0 ? 0 : Math.max(1, Math.floor(text.length * eased));
    const visibleText = text.slice(0, visibleLength);

    const globalAlpha = 0.7 + 0.3 * eased;

    const letters = visibleText.split("");
    const spacing = fontSize * 0.6;
    const totalWidth = Math.max(letters.length - 1, 0) * spacing;
    let startX = -totalWidth / 2;

    // glow geral
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;

    for (let i = 0; i < letters.length; i++) {
      const ch = letters[i];
      const baseSeed = i + text.length * 31;

      const offsetX =
        (hash(baseSeed) - 0.5) * wobble * 6 * roughness;
      const offsetY =
        (hash(baseSeed + 10) - 0.5) * wobble * 4 * roughness;
      const angle = (hash(baseSeed + 20) - 0.5) * 0.05 * roughness;
      const inkVariation =
        0.8 + hash(baseSeed + 30) * 0.4 * inkBleed;

      ctx.save();
      ctx.translate(startX + i * spacing + offsetX, offsetY);
      ctx.rotate(angle);

      // tinta principal
      ctx.globalAlpha = globalAlpha * inkVariation;
      ctx.fillStyle = textColor;
      ctx.fillText(ch, 0, 0);

      // highlight leve
      ctx.globalAlpha = globalAlpha * 0.35;
      const highlight = ctx.createLinearGradient(
        -fontSize * 0.3,
        -fontSize * 0.3,
        fontSize * 0.4,
        fontSize * 0.4
      );
      highlight.addColorStop(0, "rgba(255, 250, 240, 0.7)");
      highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = highlight;
      ctx.fillText(ch, 0, 0);

      ctx.restore();
    }

    ctx.restore();

    // respingos de tinta em volta do nome (também transparentes)
    ctx.save();
    ctx.translate(width / 2, height / 2);
    const blobs = 18;
    for (let i = 0; i < blobs; i++) {
      const t = i / blobs;
      const baseSeed = i + text.length * 101;
      const radius = 40 + 80 * t;
      const angle = t * Math.PI * 2;

      const jitterR = 1 + hash(baseSeed) * 0.7;
      const x =
        Math.cos(angle) * radius * (0.45 + wobble * 0.3) +
        (hash(baseSeed + 1) - 0.5) * 12;
      const y =
        Math.sin(angle * 1.2) * radius * 0.4 +
        (hash(baseSeed + 2) - 0.5) * 8;

      const alpha =
        (0.16 + hash(baseSeed + 3) * 0.25) *
        (0.5 + inkBleed * 0.5);
      const r = (1.1 + hash(baseSeed + 4) * 2) * jitterR;

      ctx.beginPath();
      ctx.fillStyle = `rgba(70, 42, 18, ${alpha})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
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
        background: "transparent", // 👈 garante transparência
      }}
    />
  );
};
