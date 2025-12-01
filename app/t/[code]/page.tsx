"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { API } from "@/lib/api"; // 👈 nuevo

type ExamResponse = {
  exam: {
    id: string;
    title: string;
    status: string;
    durationMinutes: number | null;
    lives?: number | null;
    code: string;
  };
};

type Meta = {
  examId: string;
  teacherName: string | null;
  subject: string | null;
  gradingMode: "auto" | "manual";
  maxScore: number;
  openAt: string | null;
};

type MetaResponse = {
  meta: Meta | null;
};

type AttemptsResponse = {
  exam: {
    id: string;
    code: string;
    isOpen: boolean;
  };
  attempts: {
    id: string;
    studentName: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    livesRemaining: number;
    paused: boolean;
    violations: string;
  }[];
};

export default function ConfigurePage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();

  // loading / error / info
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const [savingMeta, setSavingMeta] = React.useState(false);
  const [savingExam, setSavingExam] = React.useState(false);

  // exam básico
  const [examId, setExamId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<string | number>(
    ""
  );
  const [lives, setLives] = React.useState<string | number>("");
  const [isOpen, setIsOpen] = React.useState(false);

  // meta docente/materia
  const [teacherName, setTeacherName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [gradingMode, setGradingMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [maxScore, setMaxScore] = React.useState<string | number>("");
  const [openAt, setOpenAt] = React.useState(""); // datetime-local

  // tablero / intentos
  const [attempts, setAttempts] = React.useState<AttemptsResponse["attempts"]>(
    []
  );
  const [loadingAttempts, setLoadingAttempts] = React.useState(false);

  // ======================= CARGA INICIAL =======================

  async function loadExamAndMeta() {
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const [examRes, metaRes, attemptsRes] = await Promise.all([
        fetch(`${API}/exams/${code}`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/meta`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/attempts`, { cache: "no-store" }),
      ]);

      // EXAM
      if (!examRes.ok) {
        throw new Error(await examRes.text());
      }
      const examData: ExamResponse = await examRes.json();
      const e = examData.exam;

      setExamId(e.id);
      setTitle(e.title || "");
      setIsOpen(String(e.status).toLowerCase() === "open");
      setDurationMinutes(
        typeof e.durationMinutes === "number" ? e.durationMinutes : ""
      );
      setLives(typeof e.lives === "number" ? e.lives : "");

      // META
      if (metaRes.ok) {
        const metaData: MetaResponse = await metaRes.json();
        if (metaData.meta) {
          const m = metaData.meta;
          setTeacherName(m.teacherName || "");
          setSubject(m.subject || "");
          setGradingMode(
            (m.gradingMode || "auto").toLowerCase() === "manual"
              ? "manual"
              : "auto"
          );
          setMaxScore(
            typeof m.maxScore === "number" && !isNaN(m.maxScore)
              ? m.maxScore
              : ""
          );
          if (m.openAt) {
            const d = new Date(m.openAt);
            if (!isNaN(d.getTime())) {
              // datetime-local necesita yyyy-MM-ddTHH:mm
              const iso = d.toISOString().slice(0, 16);
              setOpenAt(iso);
            }
          }
        }
      }

      // ATTEMPTS (tablero)
      if (attemptsRes.ok) {
        const attemptsData: AttemptsResponse = await attemptsRes.json();
        setAttempts(attemptsData.attempts || []);
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "No se pudo cargar el examen");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!code) return;
    loadExamAndMeta();
  }, [code]);

  // ======================= GUARDAR META DOCENTE =======================

  async function saveMeta() {
    if (!examId) return;
    setSavingMeta(true);
    setErr(null);
    setInfo(null);

    try {
      const body: any = {
        teacherName: teacherName.trim() || null,
        subject: subject.trim() || null,
        gradingMode,
      };

      if (maxScore !== "") {
        body.maxScore = Number(maxScore);
      }

      if (openAt) {
        // enviamos ISO; el backend ya hace el parse
        body.openAt = new Date(openAt).toISOString();
      }

      const r = await fetch(`${API}/exams/${code}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) throw new Error(await r.text());
      setInfo("Datos del docente guardados.");
    } catch (e: any) {
      setErr(e?.message || "Error al guardar los datos del docente");
    } finally {
      setSavingMeta(false);
    }
  }

  // ======================= GUARDAR CONFIG EXAMEN =======================

  async function saveAndOpenExam() {
    if (!examId) return;
    setSavingExam(true);
    setErr(null);
    setInfo(null);

    try {
      const body: any = {
        isOpen: true,
      };

      if (title.trim()) body.title = title.trim();

      if (durationMinutes !== "") {
        body.durationMinutes = Number(durationMinutes) || 0;
      }

      if (lives !== "") {
        const v = Math.max(0, Math.floor(Number(lives) || 0));
        body.lives = v;
      }

      const r = await fetch(`${API}/exams/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) throw new Error(await r.text());

      setIsOpen(true);
      setInfo("Configuración guardada y examen abierto.");
    } catch (e: any) {
      setErr(e?.message || "Error al guardar la configuración");
    } finally {
      setSavingExam(false);
    }
  }

  // ======================= TABLERO: INTENTOS =======================

  async function reloadAttempts() {
    if (!code) return;
    setLoadingAttempts(true);
    try {
      const r = await fetch(`${API}/exams/${code}/attempts`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data: AttemptsResponse = await r.json();
      setAttempts(data.attempts || []);
    } catch (e) {
      console.error("LOAD_ATTEMPTS_ERROR", e);
    } finally {
      setLoadingAttempts(false);
    }
  }

  function formatDateTime(dt: string | null) {
    if (!dt) return "—";
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString();
    } catch {
      return "—";
    }
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 16,
        display: "grid",
        gap: 16,
      }}
    >
      {/* ENCABEZADO */}
      <header>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          Docente — {code.toUpperCase()} {isOpen ? " (abierto)" : " (cerrado)"}
        </h1>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Armado de exámenes · Configurá los datos del examen, tus datos como
          docente y revisá los intentos de los alumnos.
        </p>
      </header>

      {loading && (
        <div style={cardStyle}>
          <p>Cargando configuración…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* BLOQUE: Datos del docente y materia */}
          <section style={cardStyle}>
            <h2 style={{ marginBottom: 8 }}>Datos del docente y materia</h2>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Nombre del docente
                </label>
                <input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Ej: Prof. Gómez"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    width: "100%",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Materia
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Matemática I"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    width: "100%",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Modo de corrección
                </label>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <label style={{ fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={gradingMode === "auto"}
                      onChange={() => setGradingMode("auto")}
                    />{" "}
                    Instantánea (automática)
                  </label>
                  <label style={{ fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={gradingMode === "manual"}
                      onChange={() => setGradingMode("manual")}
                    />{" "}
                    Manual
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Nota máxima del examen
                </label>
                <input
                  type="number"
                  value={maxScore}
                  onChange={(e) =>
                    setMaxScore(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="Ej: 10"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    width: "100%",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Hora de apertura (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={openAt}
                  onChange={(e) => setOpenAt(e.target.value)}
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    width: "100%",
                  }}
                />
                <p style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                  Si se completa, el examen queda con hora sugerida de apertura.
                  El cierre final se produce cuando vence el tiempo de cada
                  alumno.
                </p>
              </div>

              <div>
                <button
                  onClick={saveMeta}
                  disabled={savingMeta}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: savingMeta ? "#9ca3af" : "#2563eb",
                    color: "white",
                    cursor: savingMeta ? "default" : "pointer",
                    fontSize: 14,
                  }}
                >
                  {savingMeta
                    ? "Guardando…"
                    : "Guardar datos del docente y materia"}
                </button>
              </div>
            </div>
          </section>

          {/* BLOQUE: Configuración básica */}
          <section style={cardStyle}>
            <h2 style={{ marginBottom: 8 }}>Configuración básica</h2>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Título del examen
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Parcial 1 - Unidad 1"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    width: "100%",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, display: "block" }}>Estado</label>
                <p style={{ marginTop: 4, fontSize: 14 }}>
                  <b>{isOpen ? "Abierto" : "Cerrado"}</b> · Se abrirá al guardar
                  la configuración.
                </p>
              </div>

              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Duración del examen (minutos)
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="Ej: 60"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    width: "100%",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, display: "block" }}>
                  Vidas del examen (puede ser 0, 1, 3, 6…)
                </label>
                <input
                  type="number"
                  value={lives}
                  onChange={(e) =>
                    setLives(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="Ej: 3"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    width: "100%",
                  }}
                />
                <p style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                  Cada vez que se detecta fraude, se pierde 1 vida. Al llegar a
                  0, el examen se cierra para ese alumno.
                </p>
              </div>

              <div>
                <button
                  onClick={saveAndOpenExam}
                  disabled={savingExam}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: savingExam ? "#9ca3af" : "#16a34a",
                    color: "white",
                    cursor: savingExam ? "default" : "pointer",
                    fontSize: 14,
                  }}
                >
                  {savingExam
                    ? "Guardando…"
                    : "Guardar configuración y abrir examen"}
                </button>
              </div>
            </div>
          </section>

          {/* BLOQUE: Tablero de participantes */}
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0 }}>Tablero de participantes</h2>
              <button
                onClick={reloadAttempts}
                disabled={loadingAttempts}
                style={{
                  marginLeft: "auto",
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  fontSize: 12,
                  cursor: loadingAttempts ? "default" : "pointer",
                }}
              >
                {loadingAttempts ? "Actualizando…" : "Refrescar"}
              </button>
            </div>

            {attempts.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                Todavía no hay intentos registrados para este examen.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    fontSize: 13,
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f3f4f6",
                        textAlign: "left",
                      }}
                    >
                      <th
                        style={{
                          padding: 6,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Alumno
                      </th>
                      <th
                        style={{
                          padding: 6,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Estado
                      </th>
                      <th
                        style={{
                          padding: 6,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Vidas restantes
                      </th>
                      <th
                        style={{
                          padding: 6,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Inicio
                      </th>
                      <th
                        style={{
                          padding: 6,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Fin
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a.id}>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {a.studentName}
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {a.status}
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {a.livesRemaining}
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {formatDateTime(a.startedAt)}
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {formatDateTime(a.finishedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {err && (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 8,
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      {info && (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid #bbf7d0",
            background: "#ecfdf5",
            padding: 8,
            fontSize: 13,
          }}
        >
          {info}
        </div>
      )}
    </main>
  );
}
