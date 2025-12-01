"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

type ExamResponse = {
  exam: {
    id: string;
    title: string;
    status: string;
    durationMin: number | null; // ✅ mismo nombre que en la BD
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

export default function TeacherExamPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code || "").toString();

  // ID real del examen en la base
  const [examId, setExamId] = React.useState<string | null>(null);
  const [publicCode, setPublicCode] = React.useState<string>("");

  // loading / error
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [savingMeta, setSavingMeta] = React.useState(false);
  const [savingExam, setSavingExam] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);

  // exam básico
  const [title, setTitle] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<
    number | "" | string
  >("");
  const [lives, setLives] = React.useState<number | "" | string>("");
  const [isOpen, setIsOpen] = React.useState(false);

  // meta docente/materia
  const [teacherName, setTeacherName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [gradingMode, setGradingMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [maxScore, setMaxScore] = React.useState<number | "" | string>("");
  const [openAt, setOpenAt] = React.useState("");

  // ========= carga inicial: buscar examen por código (dos endpoints posibles) =========
  React.useEffect(() => {
    if (!code) return;

    async function load() {
      setLoading(true);
      setErr(null);
      setInfo(null);

      try {
        const raw = code.trim();
        const codeVariants = Array.from(
          new Set([raw, raw.toUpperCase(), raw.toLowerCase()])
        ).filter(Boolean) as string[];

        let examData: ExamResponse | null = null;

        // Probamos distintas rutas hasta que alguna devuelva OK:
        // 1) /exams/:code
        // 2) /exams/by-code/:code
        for (const c of codeVariants) {
          // 1) /api/exams/:code
          let r = await fetch(`${API}/exams/${c}`, { cache: "no-store" });
          if (r.ok) {
            examData = (await r.json()) as ExamResponse;
            break;
          }

          // 2) /api/exams/by-code/:code
          r = await fetch(`${API}/exams/by-code/${c}`, {
            cache: "no-store",
          });
          if (r.ok) {
            const e = (await r.json()) as any;
            if (e.exam) {
              examData = e as ExamResponse;
            } else {
              examData = { exam: e } as ExamResponse;
            }
            break;
          }
        }

        if (!examData) {
          throw new Error(
            "No se encontró el examen para este código. Verificá el enlace o el código."
          );
        }

        const e = examData.exam;

        setExamId(e.id);
        setPublicCode(e.code || raw);
        setTitle(e.title || "");
        setIsOpen(String(e.status).toLowerCase() === "open");
        setDurationMinutes(
          typeof e.durationMin === "number" ? e.durationMin : ""
        );

        setLives(typeof e.lives === "number" ? e.lives : "");

        // Intentar cargar meta usando el ID del examen
        try {
          const metaRes = await fetch(`${API}/exams/${e.id}/meta`, {
            cache: "no-store",
          });
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
        } catch {
          // si falla meta, seguimos sin bloquear la página
        }
      } catch (e: any) {
        setErr(
          e?.message ||
            "No se pudo cargar el examen. Probá refrescar o revisar el código."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [code]);

  // ========= guardar meta docente (por ID) =========
  async function saveMeta() {
    if (!examId) {
      setErr("No se pudo identificar el examen (ID nulo).");
      return;
    }

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

      const r = await fetch(`${API}/exams/${examId}/meta`, {
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

  // ========= guardar configuración básica y abrir examen (por ID) =========
  async function saveAndOpenExam() {
    if (!examId) {
      setErr("No se pudo identificar el examen (ID nulo).");
      return;
    }

    setSavingExam(true);
    setErr(null);
    setInfo(null);

    try {
      const body: any = {
        isOpen: true,
      };

      if (title.trim()) body.title = title.trim();

      if (durationMinutes !== "") {
        body.durationMin = Number(durationMinutes) || 0;
      }

      if (lives !== "") {
        const v = Math.max(0, Math.floor(Number(lives) || 0));
        body.lives = v;
      }

      const r = await fetch(`${API}/exams/${examId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) throw new Error(await r.text());

      setIsOpen(true);
      setInfo("Configuración guardada y examen abierto.");

      // 👇 Después de abrir, vamos directo al armado de preguntas
      const nextCode = publicCode || code;
      if (nextCode) {
        router.push(`/t/${nextCode}/edit`);
      }
    } catch (e: any) {
      setErr(e?.message || "Error al guardar la configuración");
    } finally {
      setSavingExam(false);
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
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
        display: "grid",
        gap: 16,
      }}
    >
      {/* ENCABEZADO */}
      <header>
        <div style={{ marginBottom: 8 }}>
          <a href="/t" style={{ textDecoration: "none" }}>
            ← Volver al panel docente
          </a>
        </div>
        <h1 style={{ margin: 0 }}>
          Docente — {publicCode || code.toUpperCase()}{" "}
          {isOpen ? " (abierto)" : " (cerrado)"}
        </h1>
        <p style={{ color: "#555", marginTop: 4 }}>
          Armado de exámenes
          <br />
          Configurá los datos del examen, tus datos como docente y cómo se va a
          corregir.
        </p>
      </header>

      {loading && <div>Cargando configuración…</div>}

      {!loading && (
        <>
          {/* BLOQUE: Datos del docente y materia */}
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Datos del docente y materia</h2>

            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <label>Nombre del docente</label>
                <input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Ej: Prof. Gómez"
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div>
                <label>Materia</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Matemática I"
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Modo de corrección
                </div>
                <label style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="radio"
                    checked={gradingMode === "auto"}
                    onChange={() => setGradingMode("auto")}
                  />{" "}
                  Instantánea (automática)
                </label>
                <label style={{ display: "block" }}>
                  <input
                    type="radio"
                    checked={gradingMode === "manual"}
                    onChange={() => setGradingMode("manual")}
                  />{" "}
                  Manual
                </label>
              </div>

              <div>
                <label>Nota máxima del examen</label>
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
                    width: 120,
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div>
                <label>Hora de apertura (opcional)</label>
                <input
                  type="datetime-local"
                  value={openAt}
                  onChange={(e) => setOpenAt(e.target.value)}
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
                <p
                  style={{
                    fontSize: 12,
                    color: "#777",
                    marginTop: 4,
                    marginBottom: 0,
                  }}
                >
                  Si se completa, el examen queda con hora sugerida de apertura.
                  El cierre se produce cuando vence el tiempo del alumno.
                </p>
              </div>

              <div>
                <button
                  onClick={saveMeta}
                  disabled={savingMeta}
                  style={{ padding: "8px 12px" }}
                >
                  {savingMeta ? "Guardando…" : "Guardar datos del docente"}
                </button>
              </div>
            </div>
          </section>

          {/* BLOQUE: Configuración básica */}
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Configuración básica</h2>

            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <label>Título del examen</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Parcial 1 - Unidad 1"
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div>
                <label>Estado</label>
                <div>
                  <b>{isOpen ? "Abierto" : "Cerrado"}</b>{" "}
                  <span style={{ fontSize: 12, color: "#777" }}>
                    Se abrirá al guardar la configuración.
                  </span>
                </div>
              </div>

              <div>
                <label>Duración del examen (minutos)</label>
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
                    width: 160,
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div>
                <label>Vidas del examen (puede ser 0, 1, 3, 6…)</label>
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
                    width: 160,
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
                <p
                  style={{
                    fontSize: 12,
                    color: "#777",
                    marginTop: 4,
                    marginBottom: 0,
                  }}
                >
                  Cada vez que se detecta fraude, se pierde 1 vida. Al llegar a
                  0, el examen se cierra.
                </p>
              </div>

              <div>
                <button
                  onClick={saveAndOpenExam}
                  disabled={savingExam}
                  style={{ padding: "8px 12px" }}
                >
                  {savingExam ? "Guardando…" : "Guardar y abrir examen"}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {err && (
        <div
          style={{
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: 8,
            padding: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      )}

      {info && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: 8,
          }}
        >
          {info}
        </div>
      )}
    </main>
  );
}
