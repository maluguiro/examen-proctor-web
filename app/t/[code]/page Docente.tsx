"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useParams } from "next/navigation";

type Attempt = {
  id: string;
  studentId: string;
  status: string;
  livesUsed: number;
  events: { id: string; type: string; reason: string | null; ts: string }[];
};

export default function TeacherBoard() {
  const params = useParams<{ code: string }>();
  const code = params.code as string;

  const [data, setData] = useState<{
    exam: { title: string; lives: number };
    attempts: Attempt[];
  } | null>(null);

  // Polling sin caché + reset al cambiar de código
  useEffect(() => {
    let timer: any;
    let cancelled = false;

    const tick = async () => {
      try {
        const url = `${API}/exams/${code}/attempts?t=${Date.now()}`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        /* ignore demo */
      }
    };

    setData(null);
    tick();
    timer = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code]);

  if (!data) return <p style={{ padding: 24 }}>Cargando tablero...</p>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h2>
        {data.exam.title} — Vidas totales: {data.exam.lives}
      </h2>

      <button
        onClick={() => {
          fetch(`${API}/exams/${code}/attempts?t=${Date.now()}`, {
            cache: "no-store",
          })
            .then((r) => r.json())
            .then(setData)
            .catch(() => {});
        }}
        style={{ padding: 8, margin: "8px 0" }}
      >
        Refrescar ahora
      </button>

      <table
        style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Alumno
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Estado
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Vidas usadas
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Últimos eventos
            </th>
          </tr>
        </thead>
        <tbody>
          {data.attempts.map((a) => (
            <tr key={a.id}>
              <td style={{ padding: 8 }}>{a.studentId}</td>
              <td style={{ padding: 8 }}>{a.status}</td>
              <td
                style={{
                  padding: 8,
                  color:
                    (a.livesUsed ?? 0) >= data.exam.lives
                      ? "crimson"
                      : "inherit",
                }}
              >
                {Math.min(a.livesUsed ?? 0, data.exam.lives)} /{" "}
                {data.exam.lives}
              </td>
              <td style={{ padding: 8, fontSize: 12 }}>
                {a.events
                  .map(
                    (e) =>
                      `${new Date(e.ts).toLocaleTimeString()} ${e.type}${
                        e.reason ? `(${e.reason})` : ""
                      }`
                  )
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Se actualiza cada 2s (demo).
      </p>
    </main>
  );
}
