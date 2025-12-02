import React from "react";
import { Composition } from "remotion";
import { MyComp } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="QuizVideo"          // mantém o id esperado pelo template
        component={MyComp}      // sua carta com nome + foto
        durationInFrames={1830} // mesmo tamanho do vídeo base
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};