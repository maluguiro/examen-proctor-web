"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GradingMode, ReviewMode } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function ConfigureExamPage() {
  const p = useParams();
  const code = (p?.code as string) || "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [examId, setExamId] = useState<string>("");
  const [title, setTitle] = useState<string>("");

  // configuraciones
  const [lives, setLives] = useState<number>(3);
  const [durationMins, setDurationMins] = useState<number>(60);
  const [gradingMode, setGradingMode] = useState<GradingMode>("auto");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("immediate");

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      // Endpoint actual: by-code (lo dejamos igual por ahora)
      const res = await fetch(`${API}/exams/by-code/${code}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const e = await res.json();

      setExamId(e.id);
      setTitle(e.title ?? "");
      setLives(Number(e.lives ?? 3));
      setDurationMins(Number(e.durationMins ?? 60));
      setGradingMode((e.gradingMode as GradingMode) ?? "auto");
      setReviewMode((e.reviewMode as ReviewMode) ?? "immediate");
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (code) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function save() {
    setErr(null);
    const res = await fetch(`${API}/exams/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lives, durationMins, gradingMode, reviewMode }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function onSave() {
    try {
      await save();
      alert("Configuración guardada.");
    } catch (e: any) {
      setErr(e?.message || "No se pudo guardar");
    }
  }

  async function onSaveAndOpen() {
    try {
      await save();
      const r = await fetch(`${API}/exams/${examId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      if (!r.ok) throw new Error(await r.text());
      router.push(`/t/${code}`); // tablero
    } catch (e: any) {
      setErr(
        e?.message || "La configuración se guardó, pero no pude abrir el examen"
      );
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (err)
    return <div style={{ padding: 24, color: "crimson" }}>Error: {err}</div>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <a href={`/t/${code}`} style={{ textDecoration: "none" }}>
        ← Volver
      </a>
      <h1>Configurar examen</h1>
      <div style={{ color: "#666", marginBottom: 12 }}>{title}</div>

      <div
        style={{
          display: "grid",
          gap: 12,
          border: "1px solid #eee",
          padding: 16,
          borderRadius: 10,
        }}
      >
        <div>
          <label>Vidas por alumno</label>
          <input
            type="number"
            min={1}
            value={lives}
            onChange={(e) => setLives(Number(e.target.value))}
            style={{ width: 120, padding: 8, marginLeft: 8 }}
          />
        </div>

        <div>
          <label>Duración (minutos)</label>
          <input
            type="number"
            min={0}
            value={durationMins}
            onChange={(e) => setDurationMins(Number(e.target.value))}
            style={{ width: 160, padding: 8, marginLeft: 8 }}
          />
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Calificación</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="grading"
              value="auto"
              checked={gradingMode === "auto"}
              onChange={() => setGradingMode("auto")}
            />
            Nota instantánea (MCQ/VF autocorregible)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="grading"
              value="manual"
              checked={gradingMode === "manual"}
              onChange={() => setGradingMode("manual")}
            />
            La nota la pone el docente (tras leer respuestas)
          </label>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Revisión del alumno
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="review"
              value="immediate"
              checked={reviewMode === "immediate"}
              onChange={() => setReviewMode("immediate")}
            />
            Habilitar revisión inmediata
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="review"
              value="after_manual"
              checked={reviewMode === "after_manual"}
              onChange={() => setReviewMode("after_manual")}
            />
            Habilitar revisión luego de que el docente califique
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={onSave}>💾 Guardar</button>
          <button onClick={onSaveAndOpen}>✅ Guardar y abrir examen</button>
          <a
            href={`/t/${code}/edit`}
            style={{ textDecoration: "none", marginLeft: "auto" }}
          >
            <button>Volver al editor</button>
          </a>
        </div>
      </div>
    </main>
  );
}
