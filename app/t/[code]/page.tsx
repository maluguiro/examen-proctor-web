"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { API } from "@/lib/api";
import ExamChat from "@/components/ExamChat";

// ================== Tipos ==================

type GradingMode = "auto" | "manual";

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
  gradingMode: GradingMode;
  maxScore: number;
  openAt: string | null;
};

type MetaResponse = {
  meta: Meta | null;
};

type AttemptRow = {
  id: string;
  studentName: string;
  startedAt: string;
  livesRemaining: number;
  paused: boolean;
  violations: string;
};

type AttemptsResponse = {
  attempts: AttemptRow[];
};

type QuestionKind = "MCQ" | "TRUE_FALSE" | "SHORT_TEXT" | "FILL_IN";

type QuestionLite = {
  id: string;
  examId: string;
  kind: QuestionKind;
  stem: string;
  choices: string[] | null;
  answer: any;
  points: number;
};

// ================== Helpers FILL_IN ==================

// Extrae las respuestas entre [corchetes] del texto original del docente
function extractFillAnswersFromStem(raw: string): string[] {
  if (!raw) return [];
  const regex = /\[(.+?)\]/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

// Convierte el texto del docente (con [respuestas]) en el stem que ve el alumno (con [[1]], [[2]]…)
function buildStudentStemFromRaw(raw: string): {
  stem: string;
  answers: string[];
} {
  const answers: string[] = [];
  const regex = /\[(.+?)\]/g;
  let last = 0;
  let result = "";
  let boxIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(raw)) !== null) {
    if (m.index > last) {
      result += raw.slice(last, m.index);
    }
    const ans = m[1].trim();
    answers.push(ans);
    boxIndex++;
    result += `[[${boxIndex}]]`;
    last = m.index + m[0].length;
  }

  if (last < raw.length) {
    result += raw.slice(last);
  }

  return { stem: result, answers };
}

// Reconstruye el texto con [respuestas] a partir del stem con [[1]] y answer.answers
function rawFromStudentStem(stem: string, answer: any): string {
  if (!stem) return "";
  const answers: string[] = Array.isArray(answer?.answers)
    ? answer.answers.map((s: any) => String(s))
    : Array.isArray(answer)
    ? answer.map((s: any) => String(s))
    : [];

  return stem.replace(/\[\[(\d+)\]\]/g, (_match, numStr) => {
    const idx = Number(numStr) - 1;
    const val = answers[idx] ?? "";
    return val ? `[${val}]` : "[]";
  });
}

// ================== Componente principal ==================

export default function TeacherExamPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  // Paso UI:
  // 1 = docente/materia
  // 2 = config básica
  // 3 = preguntas
  // 4 = tablero + chat
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // Exam básico
  const [examId, setExamId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<string | number>(
    ""
  );
  const [lives, setLives] = React.useState<string | number>("");
  const [isOpen, setIsOpen] = React.useState(false);

  // Meta docente/materia
  const [teacherName, setTeacherName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [gradingMode, setGradingMode] = React.useState<GradingMode>("auto");
  const [maxScore, setMaxScore] = React.useState<string | number>("");
  const [openAt, setOpenAt] = React.useState(""); // datetime-local

  const [savingStep1, setSavingStep1] = React.useState(false);
  const [savingStep2, setSavingStep2] = React.useState(false);

  // Tablero / intentos
  const [attempts, setAttempts] = React.useState<AttemptRow[]>([]);
  const [loadingAttempts, setLoadingAttempts] = React.useState(false);

  // Preguntas
  const [questions, setQuestions] = React.useState<QuestionLite[]>([]);
  const [loadingQuestions, setLoadingQuestions] = React.useState(false);
  const [questionError, setQuestionError] = React.useState<string | null>(null);

  // Form pregunta (crear / editar)
  const [kind, setKind] = React.useState<QuestionKind>("MCQ");
  const [stem, setStem] = React.useState(""); // texto que escribe el docente
  const [points, setPoints] = React.useState(1);

  // MCQ
  const [mcqChoices, setMcqChoices] = React.useState<string[]>([
    "Opción 1",
    "Opción 2",
  ]);
  const [mcqCorrect, setMcqCorrect] = React.useState(0);

  // TRUE/FALSE
  const [tfCorrect, setTfCorrect] = React.useState(true);

  // SHORT_TEXT
  const [shortAnswer, setShortAnswer] = React.useState("");

  // FILL_IN
  const [fillDistractors, setFillDistractors] = React.useState("");

  // Edición
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [savingQuestion, setSavingQuestion] = React.useState(false);

  // =============== CARGA INICIAL ===============

  async function loadAll() {
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const [examRes, metaRes, attemptsRes, questionsRes] = await Promise.all([
        fetch(`${API}/exams/${code}`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/meta`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/attempts`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/questions`, { cache: "no-store" }),
      ]);

      // EXAM
      if (!examRes.ok) {
        throw new Error(await examRes.text());
      }
      const examData: ExamResponse = await examRes.json();
      const e = examData.exam;
      setExamId(e.id);
      setTitle(e.title || "");
      setDurationMinutes(
        typeof e.durationMinutes === "number" ? e.durationMinutes : ""
      );
      setLives(typeof e.lives === "number" ? e.lives : "");
      setIsOpen(String(e.status).toLowerCase() === "open");

      // META
      if (metaRes.ok) {
        const metaData: MetaResponse = await metaRes.json();
        if (metaData.meta) {
          const m = metaData.meta;
          setTeacherName(m.teacherName || "");
          setSubject(m.subject || "");
          setGradingMode(m.gradingMode || "auto");
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

      // ATTEMPTS
      if (attemptsRes.ok) {
        const data: AttemptsResponse = await attemptsRes.json();
        setAttempts(data.attempts || []);
      }

      // QUESTIONS
      if (questionsRes.ok) {
        const data = await questionsRes.json();
        setQuestions(data.items ?? []);
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
    loadAll();
  }, [code]);

  // =============== STEP 1: docente + materia ===============

  async function handleSaveStep1() {
    if (!examId) return;
    setSavingStep1(true);
    setErr(null);
    setInfo(null);
    try {
      const body: any = {
        teacherName: teacherName.trim() || null,
        subject: subject.trim() || null,
      };

      const r = await fetch(`${API}/exams/${code}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) throw new Error(await r.text());
      setInfo("Datos del docente y materia guardados.");
      setStep(2);
    } catch (e: any) {
      setErr(e?.message || "Error al guardar los datos del docente y materia");
    } finally {
      setSavingStep1(false);
    }
  }

  // =============== STEP 2: config básica ===============

  async function handleSaveStep2AndContinue() {
    if (!examId) return;
    setSavingStep2(true);
    setErr(null);
    setInfo(null);

    try {
      // 1) Meta (modo de corrección, nota máxima, openAt)
      const metaBody: any = {
        gradingMode,
      };

      if (maxScore !== "") {
        metaBody.maxScore = Number(maxScore);
      }

      if (openAt) {
        metaBody.openAt = new Date(openAt).toISOString();
      }

      await fetch(`${API}/exams/${code}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaBody),
      });

      // 2) Config del examen (título, duración, vidas, abrir)
      const examBody: any = {
        isOpen: true, // abrimos el examen
      };

      if (title.trim()) examBody.title = title.trim();

      if (durationMinutes !== "") {
        examBody.durationMinutes = Number(durationMinutes) || 0;
      }

      if (lives !== "") {
        const v = Math.max(0, Math.floor(Number(lives) || 0));
        examBody.lives = v;
      }

      const r = await fetch(`${API}/exams/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(examBody),
      });

      if (!r.ok) throw new Error(await r.text());

      setIsOpen(true);
      setInfo("Configuración guardada y examen abierto.");
      setStep(3);
    } catch (e: any) {
      setErr(e?.message || "Error al guardar la configuración básica");
    } finally {
      setSavingStep2(false);
    }
  }

  // =============== Tablero (attempts) ===============

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

  async function handleCopyLink() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/s/${code}`
        : `/s/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setInfo("Link copiado al portapapeles.");
    } catch {
      window.prompt("Copiá este link para compartirlo:", url);
    }
  }

  // =============== Preguntas: cargar / reset / editar / borrar ===============

  async function loadQuestions() {
    setLoadingQuestions(true);
    setQuestionError(null);
    try {
      const r = await fetch(`${API}/exams/${code}/questions`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setQuestions(data.items ?? []);
    } catch (e: any) {
      console.error(e);
      setQuestionError("No se pudieron cargar las preguntas.");
    } finally {
      setLoadingQuestions(false);
    }
  }

  function resetQuestionForm() {
    setKind("MCQ");
    setStem("");
    setPoints(1);
    setMcqChoices(["Opción 1", "Opción 2"]);
    setMcqCorrect(0);
    setTfCorrect(true);
    setShortAnswer("");
    setFillDistractors("");
  }

  function startEditQuestion(q: QuestionLite) {
    setEditingId(q.id);
    setKind(q.kind);
    setPoints(q.points ?? 1);

    if (q.kind === "MCQ") {
      setStem(q.stem);
      setMcqChoices(Array.isArray(q.choices) ? q.choices : []);
      const idx =
        typeof q.answer === "number"
          ? q.answer
          : Array.isArray(q.answer)
          ? q.answer[0] ?? 0
          : 0;
      setMcqCorrect(idx);
      setFillDistractors("");
    } else if (q.kind === "TRUE_FALSE") {
      setStem(q.stem);
      setTfCorrect(Boolean(q.answer));
      setFillDistractors("");
    } else if (q.kind === "SHORT_TEXT") {
      setStem(q.stem);
      setShortAnswer(
        typeof q.answer === "string" ? q.answer : q.answer?.toString?.() ?? ""
      );
      setFillDistractors("");
    } else if (q.kind === "FILL_IN") {
      const raw = rawFromStudentStem(q.stem, q.answer);
      setStem(raw);

      const answersArr: string[] = Array.isArray(q.answer?.answers)
        ? q.answer.answers.map((s: any) => String(s))
        : [];
      const choicesArr: string[] = Array.isArray(q.choices)
        ? q.choices.map((s: any) => String(s))
        : [];
      const distractors = choicesArr.filter(
        (w) => !answersArr.includes(String(w))
      );
      setFillDistractors(distractors.join(", "));
    }
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm("¿Eliminar esta pregunta?")) return;
    setQuestionError(null);
    try {
      const r = await fetch(`${API}/questions/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(await r.text());
      if (editingId === id) {
        setEditingId(null);
        resetQuestionForm();
      }
      await loadQuestions();
    } catch (e: any) {
      console.error(e);
      setQuestionError(e?.message || "No se pudo borrar la pregunta.");
    }
  }

  // =============== Guardar pregunta (crear o editar) ===============

  async function saveQuestion() {
    setSavingQuestion(true);
    setQuestionError(null);

    try {
      if (!stem.trim()) {
        throw new Error("Falta el enunciado / consigna.");
      }

      let body: any = {
        kind,
        stem: stem.trim(),
        points: Number(points) || 1,
      };

      if (kind === "MCQ") {
        const choices = mcqChoices.map((s) => s.trim()).filter(Boolean);
        if (choices.length < 2) {
          throw new Error("Opción múltiple requiere al menos 2 opciones.");
        }
        if (mcqCorrect < 0 || mcqCorrect >= choices.length) {
          throw new Error("La opción correcta está fuera de rango.");
        }
        body.choices = choices;
        body.answer = mcqCorrect;
      } else if (kind === "TRUE_FALSE") {
        body.answer = Boolean(tfCorrect);
      } else if (kind === "SHORT_TEXT") {
        body.answer = shortAnswer.trim() || null;
      } else if (kind === "FILL_IN") {
        const raw = stem.trim();
        const { stem: studentStem, answers } = buildStudentStemFromRaw(raw);

        if (!answers.length) {
          throw new Error(
            "Para los casilleros, escribí el texto completo y colocá cada respuesta correcta entre corchetes. Ej: El perro es un [animal] doméstico."
          );
        }

        const distractores = fillDistractors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const bank = [...answers, ...distractores];

        body.stem = studentStem;
        body.answer = { answers };
        body.choices = bank;
      }

      if (!editingId) {
        // CREAR
        const r = await fetch(`${API}/exams/${code}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || "No se pudo crear la pregunta.");
        }
      } else {
        // EDITAR
        const r = await fetch(`${API}/questions/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || "No se pudo actualizar la pregunta.");
        }
      }

      resetQuestionForm();
      setEditingId(null);
      await loadQuestions();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || String(e);
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) setQuestionError(parsed.error);
        else setQuestionError(msg);
      } catch {
        setQuestionError(msg);
      }
    } finally {
      setSavingQuestion(false);
    }
  }

  // =============== UI ===============

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  const fillAnswersPreview =
    kind === "FILL_IN" ? extractFillAnswersFromStem(stem) : [];

  function StepBadge() {
    return (
      <p style={{ fontSize: 14, opacity: 0.8 }}>
        Paso {step} de 4 · 1) Docente y materia · 2) Configuración básica · 3)
        Preguntas · 4) Tablero y chat.
      </p>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 16,
        display: "grid",
        gap: 16,
      }}
    >
      <header>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          Crear / configurar examen — {code}
        </h1>
        <StepBadge />
      </header>

      {loading && (
        <div style={cardStyle}>
          <p>Cargando configuración…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* STEP 1: Docente + materia */}
          {step === 1 && (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>
                Paso 1 — Datos del docente y materia
              </h2>

              <div style={{ display: "grid", gap: 12 }}>
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

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleSaveStep1}
                    disabled={savingStep1}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: savingStep1 ? "#9ca3af" : "#2563eb",
                      color: "white",
                      cursor: savingStep1 ? "default" : "pointer",
                      fontSize: 14,
                    }}
                  >
                    {savingStep1 ? "Guardando…" : "Guardar y continuar"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 2: Config básica */}
          {step === 2 && (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>
                Paso 2 — Configuración básica del examen
              </h2>

              <div style={{ display: "grid", gap: 12 }}>
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
                    Vidas del examen (0, 1, 3, 6…)
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
                  <p
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      marginTop: 4,
                    }}
                  >
                    Cada vez que se detecta fraude, se pierde 1 vida. Al llegar
                    a 0, el examen se cierra para ese alumno.
                  </p>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #eee",
                    paddingTop: 8,
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Calificación
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      checked={gradingMode === "auto"}
                      onChange={() => setGradingMode("auto")}
                    />{" "}
                    Instantánea (automática)
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      checked={gradingMode === "manual"}
                      onChange={() => setGradingMode("manual")}
                    />{" "}
                    Manual
                  </label>
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
                  <p
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      marginTop: 4,
                    }}
                  >
                    Si se completa, el examen queda con hora sugerida de
                    apertura. Cada alumno tiene su propio tiempo desde que
                    empieza.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setStep(1)}>
                    ← Volver al paso 1
                  </button>
                  <button
                    onClick={handleSaveStep2AndContinue}
                    disabled={savingStep2}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: savingStep2 ? "#9ca3af" : "#16a34a",
                      color: "white",
                      cursor: savingStep2 ? "default" : "pointer",
                      fontSize: 14,
                      marginLeft: "auto",
                    }}
                  >
                    {savingStep2
                      ? "Guardando…"
                      : "Guardar y continuar al armado del examen"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 3: Preguntas */}
          {step === 3 && (
            <>
              <section style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>
                  Paso 3 — Configuración del examen (preguntas)
                </h2>
                <p style={{ fontSize: 13, opacity: 0.8 }}>
                  Acá armás las consignas y opciones. Podés agregar, editar y
                  borrar preguntas.
                </p>

                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label>Tipo de pregunta:</label>
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as QuestionKind)}
                      style={{ marginLeft: 8, padding: 4 }}
                    >
                      <option value="MCQ">Opción múltiple</option>
                      <option value="TRUE_FALSE">Verdadero / Falso</option>
                      <option value="SHORT_TEXT">Texto breve</option>
                      <option value="FILL_IN">Relleno de casilleros</option>
                    </select>
                  </div>

                  <div>
                    <label>Enunciado / consigna</label>
                    <textarea
                      value={stem}
                      onChange={(e) => setStem(e.target.value)}
                      rows={3}
                      placeholder={
                        kind === "FILL_IN"
                          ? "Ej: El perro es un [animal] doméstico y muy [fiel]..."
                          : "Escribí la consigna de la pregunta…"
                      }
                      style={{
                        width: "100%",
                        marginTop: 4,
                      }}
                    />
                    {kind === "FILL_IN" && (
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.8,
                          marginTop: 4,
                        }}
                      >
                        Escribí el texto completo con las respuestas correctas
                        entre corchetes. Ejemplo:{" "}
                        <code>
                          El perro es un [animal] doméstico que suele ser muy
                          [fiel].
                        </code>
                        <br />
                        Detectamos <b>{fillAnswersPreview.length}</b>{" "}
                        casillero(s):{" "}
                        {fillAnswersPreview.length > 0 &&
                          fillAnswersPreview.join(" · ")}
                      </div>
                    )}
                  </div>

                  {/* Campos según tipo */}
                  {kind === "MCQ" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <b>Opciones</b>
                        <button
                          type="button"
                          onClick={() =>
                            setMcqChoices((prev) => [
                              ...prev,
                              `Opción ${prev.length + 1}`,
                            ])
                          }
                        >
                          + Agregar opción
                        </button>
                      </div>
                      {mcqChoices.map((c, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="radio"
                            name="mcqCorrect"
                            checked={mcqCorrect === idx}
                            onChange={() => setMcqCorrect(idx)}
                            title="Correcta"
                          />
                          <input
                            value={c}
                            onChange={(e) =>
                              setMcqChoices((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? e.target.value : p
                                )
                              )
                            }
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setMcqChoices((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            disabled={mcqChoices.length <= 2}
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {kind === "TRUE_FALSE" && (
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <label>Respuesta correcta:</label>
                      <label>
                        <input
                          type="radio"
                          name="tf"
                          checked={tfCorrect === true}
                          onChange={() => setTfCorrect(true)}
                        />{" "}
                        Verdadero
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="tf"
                          checked={tfCorrect === false}
                          onChange={() => setTfCorrect(false)}
                        />{" "}
                        Falso
                      </label>
                    </div>
                  )}

                  {kind === "SHORT_TEXT" && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <label>Respuesta de referencia (opcional)</label>
                      <input
                        value={shortAnswer}
                        onChange={(e) => setShortAnswer(e.target.value)}
                        placeholder="Respuesta esperada (opcional)"
                      />
                    </div>
                  )}

                  {kind === "FILL_IN" && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <label>Palabras distractoras</label>
                      <input
                        value={fillDistractors}
                        onChange={(e) => setFillDistractors(e.target.value)}
                        placeholder="Ej: insecto, juguetón, peludo"
                      />
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.8,
                        }}
                      >
                        Estas palabras se mezclarán con las respuestas correctas
                        en el banco que ve el alumno para completar los
                        casilleros.
                      </div>
                    </div>
                  )}

                  {/* Puntos + botones */}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <label>Puntos</label>
                    <input
                      type="number"
                      value={points}
                      onChange={(e) =>
                        setPoints(parseInt(e.target.value, 10) || 1)
                      }
                      style={{ width: 120 }}
                    />
                    <div
                      style={{ marginLeft: "auto", display: "flex", gap: 8 }}
                    >
                      {editingId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            resetQuestionForm();
                          }}
                        >
                          Cancelar edición
                        </button>
                      )}
                      <button
                        disabled={savingQuestion || !stem.trim()}
                        onClick={saveQuestion}
                      >
                        {savingQuestion
                          ? "Guardando..."
                          : editingId
                          ? "Guardar cambios"
                          : "Guardar pregunta"}
                      </button>
                    </div>
                  </div>

                  {questionError && (
                    <div
                      style={{
                        background: "#fee",
                        border: "1px solid #fcc",
                        borderRadius: 8,
                        padding: 8,
                        whiteSpace: "pre-wrap",
                        marginTop: 8,
                      }}
                    >
                      Error: {questionError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => setStep(2)}>
                      ← Volver al paso 2
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      style={{ marginLeft: "auto" }}
                    >
                      Ir al tablero (paso 4)
                    </button>
                  </div>
                </div>
              </section>

              {/* Lista de preguntas */}
              <section style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>Preguntas ({questions.length})</h2>
                {loadingQuestions && <p>Cargando preguntas…</p>}
                {!loadingQuestions && !questions.length && (
                  <p>No hay preguntas todavía.</p>
                )}
                <ol>
                  {questions.map((q, idx) => (
                    <li key={q.id} style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "baseline",
                        }}
                      >
                        <b
                          style={{
                            fontSize: 12,
                            background: "#eef",
                            padding: "2px 6px",
                            borderRadius: 6,
                          }}
                        >
                          {q.kind}
                        </b>
                        <span style={{ fontWeight: 600 }}>{idx + 1}.</span>
                        <span>{q.stem}</span>
                        {typeof q.points === "number" && (
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: 12,
                              opacity: 0.7,
                            }}
                          >
                            Puntos: {q.points}
                          </span>
                        )}
                      </div>
                      {Array.isArray(q.choices) && q.choices.length > 0 && (
                        <ul style={{ marginTop: 6 }}>
                          {q.choices.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      )}
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 4,
                          fontSize: 12,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => startEditQuestion(q)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(q.id)}
                        >
                          🗑 Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {/* STEP 4: Tablero + chat */}
          {step === 4 && (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Paso 4 — Tablero y chat</h2>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 12,
                  flexWrap: "wrap",
                }}
              >
                <button type="button" onClick={() => setStep(3)}>
                  ← Volver a preguntas
                </button>
                <button type="button" onClick={handleCopyLink}>
                  🔗 Copiar link para alumnos
                </button>
                <button type="button" disabled>
                  📄 Descargar actividad en PDF (próximamente)
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>Tablero de participantes</h3>
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
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
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
                          Observaciones antifraude
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
                              maxWidth: 260,
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            }}
                          >
                            {a.violations}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Chat con alumnos</h3>
                <ExamChat
                  code={code}
                  role="teacher"
                  defaultName={teacherName || "Docente"}
                />
              </div>
            </section>
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
