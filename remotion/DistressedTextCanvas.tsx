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

    ctx.clearRect(0, 0, width, height);

    // Fundo levemente texturizado (papel) – estático
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#fdf6e8");
    gradient.addColorStop(1, "#f4e1c2");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // leve ruído de papel (permanente, sem depender de frame)
    ctx.save();
    const noiseDensity = 0.13;
    ctx.fillStyle = "rgba(120, 90, 50, 0.06)";
    const step = 12;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const h = hash(x * 0.13 + y * 0.77);
        if (h < noiseDensity) {
          const r = 0.8 + hash(x + y * 2) * 1.2;
          ctx.beginPath();
          ctx.arc(
            x + hash(x * 3 + y) * step,
            y + hash(y * 5 + x) * step,
            r,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Configuração do texto
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${fontSize}px "Cinzel", "Times New Roman", serif`;

    // Calcula quantos caracteres já "apareceram"
    const eased = p < 0.0001 ? 0 : Math.pow(p, 0.85); // ease-out sutil
    const visibleLength =
      eased <= 0
        ? 0
        : Math.max(1, Math.floor(text.length * eased));
    const visibleText = text.slice(0, visibleLength);

    // Opacidade geral da tinta, de 0.7 → 1.0
    const globalAlpha = 0.7 + 0.3 * eased;

    // Desenha o texto letra por letra com pequenas variações fixas
    const letters = visibleText.split("");
    const spacing = fontSize * 0.6;
    const totalWidth = Math.max(letters.length - 1, 0) * spacing;
    let startX = -totalWidth / 2;

    // sombra/glow geral (estático)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;

    for (let i = 0; i < letters.length; i++) {
      const ch = letters[i];
      const baseSeed = i + text.length * 31;

      // variações fixas por letra (não dependem de frame)
      const offsetX =
        (hash(baseSeed) - 0.5) * wobble * 6 * roughness;
      const offsetY =
        (hash(baseSeed + 10) - 0.5) * wobble * 4 * roughness;
      const angle = (hash(baseSeed + 20) - 0.5) * 0.05 * roughness; // radianos
      const inkVariation =
        0.8 + hash(baseSeed + 30) * 0.4 * inkBleed;

      ctx.save();
      ctx.translate(startX + i * spacing + offsetX, offsetY);
      ctx.rotate(angle);

      // "bordas" mais escuras
      ctx.globalAlpha = globalAlpha * inkVariation;
      ctx.fillStyle = textColor;
      ctx.fillText(ch, 0, 0);

      // leve highlight interno
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

    // Pequenas manchas de tinta ao redor do texto (fixas)
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
        background: "transparent",
      }}
    />
  );
};
