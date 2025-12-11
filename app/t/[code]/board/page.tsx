"use client";

import * as React from "react";

export default function BoardPage({ params }: { params: { code: string } }) {
  const { code } = params;

  React.useEffect(() => {
    window.location.replace(`/t/${code}`);
  }, [code]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        paddingTop: 50,
        fontFamily: "sans-serif",
      }}
    >
      <p>Redirigiendo al tablero principal...</p>
    </div>
  );
}
