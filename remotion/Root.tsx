import React from "react";
import { Composition } from "remotion";

// SUA COMP PRINCIPAL DO PROJETO
import { MyComp } from "./Composition";

// SUA COMP DE TESTE RÁPIDA
import { TestComp } from "./TestComp";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* DEBUG - TESTE RÁPIDO */}
      <Composition
        id="TestComp"
        component={TestComp}
        durationInFrames={60}  // 2s
        fps={30}
        width={1280}
        height={720}
      />

      {/* SUA COMP PESADA ORIGINAL */}
      <Composition
        id="QuizVideo"
        component={MyComp}
        durationInFrames={1830}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
