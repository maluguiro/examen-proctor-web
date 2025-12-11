"use client";

import * as React from "react";
import type {
  ExamAttemptsResponse,
  AttemptSummary,
  ExamStatus,
} from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function BoardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = React.use(params);

  const [data, setData] = React.useState<ExamAttemptsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // ====== Cargar tablero ======
  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/exams/${code}/attempts?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const json: ExamAttemptsResponse = await r.json();
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar el tablero");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ====== Acciones del docente (pausa, perdonar vida, +tiempo) ======
  async function modAttempt(
    id: string,
    action: "pause" | "resume" | "forgive_life" | "add_time",
    seconds?: number
  ) {
    try {
      await fetch(`${API}/attempts/${id}/mod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "add_time"
            ? { action, seconds: seconds ?? 300 }
            : { action }
        ),
      });
      await load();
    } catch {
      // si falla, igual el próximo poll va a refrescar
    }
  }

  const [sortMode, setSortMode] = React.useState<"activity" | "name-asc">(
    "activity"
  );

  const attempts: AttemptSummary[] = data?.attempts ?? [];
  const total = attempts.length;
  const exam = data?.exam;

  function renderAttemptStatus(status: string, paused: boolean) {
    if (status === "submitted") return "Enviado";
    if (paused) return "Pausado";
    return "En curso";
  }

  function mapStatusLabel(status?: ExamStatus | string) {
    switch (status) {
      case "DRAFT":
        return "Borrador";
      case "OPEN":
      case "open":
        return "Abierto";
      case "CLOSED":
      case "closed":
        return "Cerrado";
      default:
        return status || "";
    }
  }

  const sortedAttempts = React.useMemo(() => {
    const list = [...attempts];
    if (sortMode === "name-asc") {
      list.sort((a, b) =>
        (a.studentName || "").localeCompare(b.studentName || "")
      );
    } else {
      // activity
      list.sort((a, b) => {
        // 1. Prioridad absoluta: tiene actividad reciente vs no tiene
        const hasA = !!a.lastActivityAt;
        const hasB = !!b.lastActivityAt;

        if (hasA && hasB) {
          // Ambos tienen actividad -> el más reciente gana
          const tA = new Date(a.lastActivityAt!).getTime();
          const tB = new Date(b.lastActivityAt!).getTime();
          if (!isNaN(tA) && !isNaN(tB) && tA !== tB) {
            return tB - tA;
          }
        }

        if (hasA && !hasB) return -1; // A tiene actividad, B no -> A va primero
        if (!hasA && hasB) return 1; // B tiene actividad, A no -> B va primero

        // --- Si llegamos acá, EMPATE en lastActivityAt (ambos null o mismo ts) ---

        // 2. Fallback: fecha de fin (los más recientes arriba)
        const fA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
        const fB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
        if (fA !== fB) return fB - fA;

        // 3. Fallback: fecha de inicio (los más recientes arriba)
        const sA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const sB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        if (sA !== sB) return sB - sA;

        // 4. Fallback: Violations desc
        const vA = a.violationsCount || 0;
        const vB = b.violationsCount || 0;
        if (vA !== vB) return vB - vA;

        return 0;
      });
    }
    return list;
  }, [attempts, sortMode]);

  function toggleSort() {
    setSortMode((prev) => (prev === "activity" ? "name-asc" : "activity"));
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <a href={`/t/${code}`} style={{ textDecoration: "none" }}>
          ← Volver
        </a>
      </div>

      <h1 style={{ marginTop: 0 }}>Tablero — {code}</h1>

      {exam && (
        <p style={{ color: "#555" }}>
          Examen: <b>{exam.title}</b>{" "}
          {typeof exam.lives === "number" && (
            <>
              · Vidas por alumno: <b>{exam.lives}</b>
            </>
          )}{" "}
          · Estado: <b>{mapStatusLabel(exam.status)}</b>
        </p>
      )}

      <div
        style={{
          margin: "12px 0 16px",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #eee",
          background: "#fafafa",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          Participantes: <b>{total}</b>
        </div>
        {/* Futuro: exportar tablero / chat como PDF */}
        {/* <button>⬇ Exportar tablero (PDF)</button> */}
      </div>

      {err && (
        <div style={{ color: "crimson", marginBottom: 12 }}>Error: {err}</div>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #ddd",
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={toggleSort}
              title="Click para cambiar criterio de orden"
            >
              Alumno{" "}
              <span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>
                {sortMode === "activity" ? "(Actividad ⚡)" : "(A-Z ▲)"}
              </span>
            </th>
            <th
              style={{
                textAlign: "center",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Vidas
            </th>
            <th
              style={{
                textAlign: "center",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Puntaje
            </th>
            <th
              style={{
                textAlign: "center",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Acciones
            </th>
            <th
              style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Estado
            </th>
            <th
              style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Fraude
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && attempts.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 12 }}>
                Cargando…
              </td>
            </tr>
          )}

          {!loading && attempts.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 12 }}>
                Aún no hay alumnos conectados.
              </td>
            </tr>
          )}

          {sortedAttempts.map((a) => {
            const examLives = exam?.lives ?? 0;
            const livesRemaining =
              examLives > 0 ? Math.max(0, examLives - (a.livesUsed ?? 0)) : 0;
            const lastEvent = a.events?.[0];

            return (
              <tr key={a.id}>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {a.studentName || (
                    <span style={{ color: "#999" }}>(sin nombre)</span>
                  )}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f0f0f0",
                    textAlign: "center",
                  }}
                >
                  {examLives ? `${livesRemaining}/${examLives}` : "—"}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f0f0f0",
                    textAlign: "center",
                  }}
                >
                  {typeof a.score === "number" ? a.score : "—"}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f0f0f0",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      onClick={() => modAttempt(a.id, "forgive_life")}
                      style={{ padding: "4px 8px", fontSize: 12 }}
                    >
                      Perdonar vida
                    </button>
                    <button
                      onClick={() => modAttempt(a.id, "add_time", 300)}
                      style={{ padding: "4px 8px", fontSize: 12 }}
                    >
                      +5 min
                    </button>
                    {a.paused ? (
                      <button
                        onClick={() => modAttempt(a.id, "resume")}
                        style={{ padding: "4px 8px", fontSize: 12 }}
                      >
                        ▶ Reanudar
                      </button>
                    ) : (
                      <button
                        onClick={() => modAttempt(a.id, "pause")}
                        style={{ padding: "4px 8px", fontSize: 12 }}
                      >
                        ⏸ Pausar
                      </button>
                    )}
                  </div>
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {renderAttemptStatus(a.status, a.paused)}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: 12,
                    color: "#666",
                  }}
                >
                  {a.violationsCount && a.violationsCount > 0 ? (
                    <div
                      title={
                        a.violationTypes
                          ?.map((v) => `${v.type} x${v.count}`)
                          .join(", ") || ""
                      }
                      style={{ cursor: "help" }}
                    >
                      <span style={{ color: "#d32f2f", fontWeight: 500 }}>
                        {a.violationsCount} violaciones
                      </span>
                      {a.lastViolationReason && (
                        <span style={{ marginLeft: 6, color: "#888" }}>
                          · {a.lastViolationReason}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: "#aaa" }}>Sin incidencias</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TODO (futuro):
          - Chat docente centralizado
          - Exportar tablero y chat como PDF
          - Buscador / orden alfabético por alumno
      */}
    </main>
  );
}
