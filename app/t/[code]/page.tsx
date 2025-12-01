"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { API } from "@/lib/api";
import ExamChat from "@/components/ExamChat";

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

type Step = "teacher" | "basic" | "questions" | "board";

export default function TeacherExamPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();

  // loading / error / info
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const [savingMeta, setSavingMeta] = React.useState(false);
  const [savingExam, setSavingExam] = React.useState(false);

  // wizard step: SIEMPRE arranca en Paso 1
  const [step, setStep] = React.useState<Step>("teacher");

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
              const iso = d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        body.openAt = new Date(openAt).toISOString();
      }

      const r = await fetch(`${API}/exams/${code}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) throw new Error(await r.text());
      setInfo("Datos del docente y materia guardados.");
    } catch (e: any) {
      setErr(e?.message || "Error al guardar los datos del docente");
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveMetaAndNext() {
    await saveMeta();
    setStep("basic");
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

  async function saveConfigAndNext() {
    await saveAndOpenExam();
    setStep("questions");
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

  // Copiar link del alumno
  async function copyStudentLink() {
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/s/${code}`
          : `/s/${code}`;
      await navigator.clipboard.writeText(url);
      setInfo(`Link copiado al portapapeles: ${url}`);
    } catch (e) {
      console.error("COPY_LINK_ERROR", e);
      setErr(
        "No se pudo copiar el link. Podés copiarlo manualmente: /s/" + code
      );
    }
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  const stepBadge = (label: string, active: boolean, index: number) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        opacity: active ? 1 : 0.5,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "999px",
          border: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: active ? "#2563eb" : "#f3f4f6",
          color: active ? "#fff" : "#111827",
          fontSize: 12,
        }}
      >
        {index}
      </div>
      <span>{label}</span>
    </div>
  );

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
          Flujo guiado · Completá tus datos, configurá el examen, cargá las
          preguntas y después usá el tablero en vivo.
        </p>

        {/* Stepper */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            marginTop: 8,
            fontSize: 13,
          }}
        >
          {stepBadge("Docente y materia", step === "teacher", 1)}
          <span style={{ opacity: 0.4 }}>—</span>
          {stepBadge("Config. básica", step === "basic", 2)}
          <span style={{ opacity: 0.4 }}>—</span>
          {stepBadge("Preguntas", step === "questions", 3)}
          <span style={{ opacity: 0.4 }}>—</span>
          {stepBadge("Tablero", step === "board", 4)}
        </div>
      </header>

      {loading && (
        <div style={cardStyle}>
          <p>Cargando configuración…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* PASO 1: Datos del docente y materia */}
          {step === "teacher" && (
            <section style={cardStyle}>
              <h2 style={{ marginBottom: 8 }}>Paso 1 · Datos del docente</h2>

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

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={saveMeta}
                    disabled={savingMeta}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: savingMeta ? "#9ca3af" : "#6b7280",
                      color: "white",
                      cursor: savingMeta ? "default" : "pointer",
                      fontSize: 14,
                    }}
                  >
                    {savingMeta ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    onClick={saveMetaAndNext}
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
                    {savingMeta ? "Guardando…" : "Guardar y continuar"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* PASO 2: Configuración básica */}
          {step === "basic" && (
            <section style={cardStyle}>
              <h2 style={{ marginBottom: 8 }}>
                Paso 2 · Configuraciones básicas
              </h2>

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
                    Cada vez que se detecta fraude, se pierde 1 vida. Al llegar
                    a 0, el examen se cierra para ese alumno.
                  </p>
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
                    Si se completa, el examen queda con hora sugerida de
                    apertura. El examen se abrirá al guardar.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => setStep("teacher")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    ← Volver a datos del docente
                  </button>

                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                      onClick={saveAndOpenExam}
                      disabled={savingExam}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: savingExam ? "#9ca3af" : "#6b7280",
                        color: "white",
                        cursor: savingExam ? "default" : "pointer",
                        fontSize: 14,
                      }}
                    >
                      {savingExam ? "Guardando…" : "Guardar configuración"}
                    </button>
                    <button
                      onClick={saveConfigAndNext}
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
                        : "Guardar, abrir y continuar a preguntas"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* PASO 3: Configuración del examen (preguntas) */}
          {step === "questions" && (
            <section style={cardStyle}>
              <h2 style={{ marginBottom: 8 }}>
                Paso 3 · Configuración del examen (preguntas)
              </h2>
              <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
                En este paso vas a crear y editar las consignas del examen
                (Verdadero/Falso, múltiple choice, texto breve y relleno de
                casilleros). Usá el editor y, cuando termines, volvé acá para
                continuar al tablero.
              </p>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <a
                  href={`/t/${code}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <button
                    type="button"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    ✏️ Abrir editor de preguntas (nueva pestaña)
                  </button>
                </a>
              </div>

              <p style={{ fontSize: 12, opacity: 0.7 }}>
                Podés revisar las preguntas actualizadas refrescando la página
                del editor. Cuando ya estés conforme con el examen, continuá al
                tablero.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 16,
                  justifyContent: "space-between",
                }}
              >
                <button
                  onClick={() => setStep("basic")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ← Volver a configuraciones básicas
                </button>

                <button
                  onClick={() => setStep("board")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Guardar y continuar al tablero
                </button>
              </div>
            </section>
          )}

          {/* PASO 4: Tablero de participantes */}
          {step === "board" && (
            <>
              <section style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <h2 style={{ margin: 0 }}>
                    Paso 4 · Tablero de participantes
                  </h2>
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

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={copyStudentLink}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    📎 Copiar link para alumnos
                  </button>

                  <a
                    href={`/t/${code}/edit`}
                    style={{ textDecoration: "none" }}
                  >
                    <button
                      type="button"
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      ✏️ Crear / editar preguntas
                    </button>
                  </a>

                  <a
                    href={`${API}/exams/${code}/activity.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <button
                      type="button"
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      📄 Descargar actividad del examen (PDF)
                    </button>
                  </a>
                </div>

                {attempts.length === 0 ? (
                  <p style={{ fontSize: 13, opacity: 0.7 }}>
                    Todavía no hay intentos registrados para este examen.
                  </p>
                ) : (
                  <div
                    style={{
                      overflowX: "auto",
                      marginBottom: 16,
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

                {/* Chat del docente */}
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                    Chat en vivo con alumnos
                  </h3>
                  <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                    Usá este chat para comunicarte con los alumnos mientras
                    rinden el examen.
                  </p>
                  <ExamChat
                    code={code}
                    role="teacher"
                    defaultName={teacherName || "Docente"}
                  />
                </div>
              </section>
            </>
          )}
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
