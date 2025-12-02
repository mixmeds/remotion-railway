import { AbsoluteFill, Composition } from "remotion";

const TestComp: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#111", justifyContent: "center", alignItems: "center", display: "flex" }}>
      <h1 style={{ color: "white", fontSize: 80 }}>Teste OK</h1>
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TestComp"
        component={TestComp}
        durationInFrames={60} // 2 segundos
        fps={30}
        width={1280}
        height={720}
      />

      {/* sua comp grande continua aqui, não precisa apagar */}
      {/* <Composition id="QuizVideo" ... /> */}
    </>
  );
};
