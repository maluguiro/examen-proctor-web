"use client";

import * as React from "react";
import { use } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

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

export default function ConfigurePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  // loading / error
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [savingMeta, setSavingMeta] = React.useState(false);
  const [savingExam, setSavingExam] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);

  // exam básico
  const [examId, setExamId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<number | "">("");
  const [lives, setLives] = React.useState<number | "">("");
  const [isOpen, setIsOpen] = React.useState(false);

  // meta docente/materia
  const [teacherName, setTeacherName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [gradingMode, setGradingMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [maxScore, setMaxScore] = React.useState<number | "">("");
  const [openAt, setOpenAt] = React.useState<string>("");

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      setInfo(null);
      try {
        const [examRes, metaRes] = await Promise.all([
          fetch(`${API}/exams/${code}`, { cache: "no-store" }),
          fetch(`${API}/exams/${code}/meta`, { cache: "no-store" }),
        ]);

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

        if (!metaRes.ok) {
          // si falla meta, seguimos igual
        } else {
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
      } catch (e: any) {
        setErr(e?.message || "No se pudo cargar el examen");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [code]);

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
        // 🔴 antes: body.durationMin
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

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: 16,
        display: "grid",
        gap: 16,
      }}
    >
      {/* ENCABEZADO */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          Docente —{" "}
          <b>
            {code.toUpperCase()}
            {isOpen ? " (abierto)" : " (cerrado)"}
          </b>
        </div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Armado de exámenes</h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Configurá los datos del examen, tus datos como docente y cómo se va a
          corregir.
        </div>
      </div>

      {loading && <div>Cargando configuración…</div>}

      {!loading && (
        <>
          {/* BLOQUE: Datos del docente y materia */}
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>
              Datos del docente y materia
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Nombre del docente</label>
                <input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Ej: Prof. Gómez"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Materia</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Matemática I"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1.2fr 0.8fr",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Modo de corrección</label>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="radio"
                      checked={gradingMode === "auto"}
                      onChange={() => setGradingMode("auto")}
                    />
                    Instantánea (automática)
                  </label>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="radio"
                      checked={gradingMode === "manual"}
                      onChange={() => setGradingMode("manual")}
                    />
                    Manual
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Nota máxima del examen</label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={maxScore === "" ? "" : maxScore}
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
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "flex-end",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>
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
                  }}
                />
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Si se completa, el examen queda con hora sugerida de apertura.
                  El cierre se produce cuando vence el tiempo del alumno.
                </div>
              </div>
              <button
                onClick={saveMeta}
                disabled={savingMeta}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: savingMeta ? "#9ca3af" : "#111827",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                  height: 38,
                }}
              >
                {savingMeta ? "Guardando…" : "Guardar datos del docente"}
              </button>
            </div>
          </div>

          {/* BLOQUE: Configuración básica */}
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>
              Configuración básica
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Título del examen</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Parcial 1 - Unidad 1"
                  style={{
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Estado</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: isOpen ? "#dcfce7" : "#fee2e2",
                      color: isOpen ? "#166534" : "#991b1b",
                    }}
                  >
                    {isOpen ? "Abierto" : "Cerrado"}
                  </span>
                  <span style={{ opacity: 0.7, fontSize: 12 }}>
                    Se abrirá al guardar la configuración.
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>
                  Duración del examen (minutos)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={durationMinutes === "" ? "" : durationMinutes}
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
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 13 }}>
                  Vidas del examen (puede ser 0, 1, 3, 6…)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={lives === "" ? "" : lives}
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
                  }}
                />
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Cada vez que se detecta fraude, se pierde 1 vida. Al llegar a
                  0, el examen se cierra.
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={saveAndOpenExam}
                disabled={savingExam}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: savingExam ? "#9ca3af" : "#111827",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {savingExam ? "Guardando…" : "Guardar y abrir examen"}
              </button>
            </div>
          </div>
        </>
      )}

      {err && (
        <div
          style={{
            borderRadius: 8,
            padding: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
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
            padding: 8,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            fontSize: 13,
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}
