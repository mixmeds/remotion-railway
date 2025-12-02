import React from "react";
import { AbsoluteFill } from "remotion";

type TestCompProps = {
  name?: string;
};

export const TestComp: React.FC<TestCompProps> = ({ name = "Teste OK" }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#111",
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
      }}
    >
      <h1 style={{ color: "white", fontSize: 80 }}>{name}</h1>
    </AbsoluteFill>
  );
};
