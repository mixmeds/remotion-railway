import React from "react";
import { Composition } from "remotion";
import { MyComp, NoelCompProps } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<NoelCompProps>
        id="noel"
        component={MyComp}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={461}
        defaultProps={{
          // Só pra ter algo legal no preview / fallback
          name: "Amigo(a)",
          // string vazia => cai no fallback do MyComp (photo-placeholder)
          photoUrl: "",
          audioSrc: "",
          language: "pt-BR",
        }}
      />
    </>
  );
};