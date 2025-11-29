"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

export default function ExamAliasPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  React.useEffect(() => {
    const code = (params?.code || "").toString();
    if (!code) return;
    // Redirigimos al motor real del examen
    router.replace(`/s/${code}`);
  }, [params, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p>Preparando tu examen…</p>
      </div>
    </main>
  );
}
