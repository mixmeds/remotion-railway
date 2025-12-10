// remotion/DistressedTextCanvas.tsx
import React, { useEffect, useRef } from "react";

type Props = {
  text: string;
  progress: number; // 0 → 1
  width?: number;
  height?: number;
  fontSize?: number;
};

export const DistressedNameCanvas: React.FC<Props> = ({
  text,
  progress,
  width = 900,
  height = 200,
  fontSize = 110,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // 🔥 FONTE LINDA (troque para a que você quiser)
    ctx.font = `${fontSize}px "Great Vibes", "Allura", "Playfair Display", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // texto pronto (nenhuma animação na forma -> SEM FLICKER)
    ctx.fillStyle = "#2b1a0a";
    ctx.shadowColor = "rgba(255,235,180,0.4)";
    ctx.shadowBlur = 12;
    ctx.fillText(text, width / 2, height / 2);

    // 🔥 Máscara suave estilo "escrita"
    const revealWidth = width * progress;

    ctx.save();
    ctx.globalCompositeOperation = "destination-in";

    const fade = ctx.createLinearGradient(0, 0, revealWidth, 0);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(0.88, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, revealWidth, height);
    ctx.restore();

    // 🔥 Respingo estático e elegante (SEM MOVIMENTO)
    ctx.save();
    ctx.globalAlpha = 0.25;

    for (let i = 0; i < 14; i++) {
      const seed = i * 97 + text.length * 13;
      const rand = Math.sin(seed) * 43758.5453;
      const x = (rand % 1) * width * 0.8 + width * 0.1;
      const y =
        (Math.sin(seed * 2) % 1) * height * 0.6 + height * 0.2;
      const r = ((Math.sin(seed * 3) % 1) * 2 + 1) * 1.6;

      ctx.beginPath();
      ctx.fillStyle = "rgba(40, 25, 10, 0.45)";
      ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [text, progress, width, height, fontSize]);

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
