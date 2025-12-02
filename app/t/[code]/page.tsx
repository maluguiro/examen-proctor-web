"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { API, patchAttemptLives } from "@/lib/api";
import { loadTeacherProfile, type TeacherProfile } from "@/lib/teacherProfile";
import ExamChat from "@/components/ExamChat";

// ================= Tipos del examen / meta / intentos =================

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

// ================= Tipos y helpers de preguntas =================

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

// Extrae respuestas [entre corchetes] del texto del docente
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

// Convierte texto del docente con [respuestas] al stem que ve el alumno ([[1]], [[2]]…)
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

// ================= Componente principal =================

type Step = 1 | 2 | 3 | 4;

export default function TeacherExamPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  // Perfil local
  const [profile, setProfile] = React.useState<TeacherProfile | null>(null);

  // Estado general
  const [step, setStep] = React.useState<Step>(1);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [examNotFound, setExamNotFound] = React.useState(false);

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
  const [updatingAttemptId, setUpdatingAttemptId] = React.useState<
    string | null
  >(null);

  // preguntas (editor inline)
  const [questionsLoading, setQuestionsLoading] = React.useState(false);
  const [questionsError, setQuestionsError] = React.useState<string | null>(
    null
  );
  const [items, setItems] = React.useState<QuestionLite[]>([]);

  // Formulario de nueva / edit pregunta
  const [kind, setKind] = React.useState<QuestionKind>("MCQ");
  const [stem, setStem] = React.useState(""); // texto del docente
  const [mcqChoices, setMcqChoices] = React.useState<string[]>([
    "Opción 1",
    "Opción 2",
  ]);
  const [mcqCorrect, setMcqCorrect] = React.useState(0);
  const [tfCorrect, setTfCorrect] = React.useState(true);
  const [shortAnswer, setShortAnswer] = React.useState("");
  const [points, setPoints] = React.useState(1);
  const [fillDistractors, setFillDistractors] = React.useState("");
  const [savingQuestion, setSavingQuestion] = React.useState(false);
  const [editingQuestion, setEditingQuestion] =
    React.useState<QuestionLite | null>(null);

  // ====================== Helpers UI ======================

  const containerStyle: React.CSSProperties = {
    maxWidth: 960,
    margin: "0 auto",
    padding: 16,
    display: "grid",
    gap: 16,
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

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

  function studentLink() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/s/${code}`;
  }

  function formatViolations(v: string | null | undefined) {
    if (!v) return "—";
    // De momento mostramos el string tal cual, es un resumen del backend.
    return v;
  }

  // ====================== Carga inicial ======================

  React.useEffect(() => {
    // perfil local (para prellenar docente/materia)
    const p = loadTeacherProfile();
    setProfile(p);
  }, []);

  async function loadExamAndMeta() {
    if (!code) return;
    setLoading(true);
    setErr(null);
    setInfo(null);
    setExamNotFound(false);

    try {
      const [examRes, metaRes, attemptsRes, questionsRes] = await Promise.all([
        fetch(`${API}/exams/${code}`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/meta`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/attempts`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/questions`, { cache: "no-store" }),
      ]);

      // EXAM
      if (!examRes.ok) {
        const txt = await examRes.text();
        if (txt.includes("EXAM_NOT_FOUND")) {
          setExamNotFound(true);
          setErr(null);
          setLoading(false);
          return;
        }
        throw new Error(txt || "No se pudo cargar el examen");
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
              const iso = d.toISOString().slice(0, 16);
              setOpenAt(iso);
            }
          }
        }
      }

      // Si no había teacherName/subject y tenemos perfil, prellenamos
      if (!teacherName || !subject) {
        const p = loadTeacherProfile();
        if (p) {
          if (!teacherName && p.name) setTeacherName(p.name);
          if (!subject && p.subject) setSubject(p.subject);
        }
      }

      // ATTEMPTS (tablero)
      if (attemptsRes.ok) {
        const attemptsData: AttemptsResponse = await attemptsRes.json();
        setAttempts(attemptsData.attempts || []);
      }

      // QUESTIONS
      if (questionsRes.ok) {
        const qData = await questionsRes.json();
        setItems(qData.items ?? []);
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "No se pudo cargar el examen");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadExamAndMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ====================== Guardar META docente (Paso 1) ======================

  async function saveMeta(goNext?: boolean) {
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
      setInfo("Datos del docente guardados.");
      if (goNext) setStep(2);
    } catch (e: any) {
      setErr(e?.message || "Error al guardar los datos del docente");
    } finally {
      setSavingMeta(false);
    }
  }

  // ====================== Guardar config examen (Paso 2) ======================

  async function saveAndOpenExam(goNext?: boolean) {
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
      if (goNext) setStep(3);
    } catch (e: any) {
      setErr(e?.message || "Error al guardar la configuración");
    } finally {
      setSavingExam(false);
    }
  }

  // ====================== Tablero / intentos (Paso 4) ======================

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

  async function adjustLives(attemptId: string, op: "increment" | "decrement") {
    try {
      setUpdatingAttemptId(attemptId);
      const res: any = await patchAttemptLives(attemptId, op, "docente");
      // el backend puede devolver varios formatos, intentamos leer alguno razonable
      const newLives =
        typeof res?.livesRemaining === "number"
          ? res.livesRemaining
          : typeof res?.remaining === "number"
          ? res.remaining
          : null;

      if (typeof newLives === "number") {
        setAttempts((prev) =>
          prev.map((a) =>
            a.id === attemptId ? { ...a, livesRemaining: newLives } : a
          )
        );
      } else {
        // si no sabemos, forzamos recarga del tablero
        await reloadAttempts();
      }
    } catch (e) {
      console.error("PATCH_LIVES_ERROR", e);
      alert("No se pudo actualizar las vidas de este alumno.");
    } finally {
      setUpdatingAttemptId(null);
    }
  }

  // ====================== Preguntas (Paso 3) ======================

  async function loadQuestions() {
    if (!code) return;
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const r = await fetch(`${API}/exams/${code}/questions`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setItems(data.items ?? []);
    } catch (e: any) {
      console.error(e);
      setQuestionsError("No se pudieron cargar las preguntas.");
    } finally {
      setQuestionsLoading(false);
    }
  }

  React.useEffect(() => {
    if (step === 3) {
      loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function resetQuestionForm() {
    setStem("");
    setPoints(1);
    setMcqChoices(["Opción 1", "Opción 2"]);
    setMcqCorrect(0);
    setTfCorrect(true);
    setShortAnswer("");
    setFillDistractors("");
    setEditingQuestion(null);
  }

  function addMcqChoice() {
    setMcqChoices((prev) => [...prev, `Opción ${prev.length + 1}`]);
  }

  function removeMcqChoice(idx: number) {
    setMcqChoices((prev) => prev.filter((_, i) => i !== idx));
    setMcqCorrect((prev) => {
      const newLen = mcqChoices.length - 1;
      if (prev >= newLen) return Math.max(0, newLen - 1);
      return prev;
    });
  }

  function updateMcqChoice(idx: number, val: string) {
    setMcqChoices((prev) => prev.map((c, i) => (i === idx ? val : c)));
  }

  async function saveQuestion() {
    setSavingQuestion(true);
    setQuestionsError(null);

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

        const distractors = fillDistractors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const allOptions = [...answers, ...distractors];

        body.stem = studentStem; // ve el alumno ([[1]], [[2]]…)
        body.answer = { answers }; // para corrección
        body.choices = allOptions; // banco que ve el alumno
      }

      if (!editingQuestion) {
        // Crear
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
        // Editar
        const r = await fetch(`${API}/questions/${editingQuestion.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || "No se pudo editar la pregunta.");
        }
      }

      resetQuestionForm();
      await loadQuestions();
    } catch (e: any) {
      console.error(e);
      const msg = e.message || String(e);
      setQuestionsError(msg);
    } finally {
      setSavingQuestion(false);
    }
  }

  function startEditQuestion(q: QuestionLite) {
    setEditingQuestion(q);
    setKind(q.kind);
    setPoints(q.points ?? 1);

    if (q.kind === "MCQ") {
      setStem(q.stem);
      setMcqChoices(Array.isArray(q.choices) ? q.choices : []);
      setMcqCorrect(typeof q.answer === "number" ? q.answer : 0);
      setTfCorrect(true);
      setShortAnswer("");
      setFillDistractors("");
    } else if (q.kind === "TRUE_FALSE") {
      setStem(q.stem);
      setTfCorrect(Boolean(q.answer));
      setMcqChoices(["Opción 1", "Opción 2"]);
      setMcqCorrect(0);
      setShortAnswer("");
      setFillDistractors("");
    } else if (q.kind === "SHORT_TEXT") {
      setStem(q.stem);
      setShortAnswer(
        typeof q.answer === "string" ? q.answer : q.answer?.expected || ""
      );
      setMcqChoices(["Opción 1", "Opción 2"]);
      setMcqCorrect(0);
      setTfCorrect(true);
      setFillDistractors("");
    } else if (q.kind === "FILL_IN") {
      setStem(q.stem);
      const bank = Array.isArray(q.choices) ? q.choices : [];
      setFillDistractors("");
      setMcqChoices(["Opción 1", "Opción 2"]);
      setMcqCorrect(0);
      setTfCorrect(true);
      setShortAnswer("");
      if (bank.length) {
        console.log("Banco actual:", bank);
      }
    }
  }

  const fillAnswersPreview =
    kind === "FILL_IN" ? extractFillAnswersFromStem(stem) : [];

  // ====================== Render pasos ======================

  const Header = (
    <header>
      <h1 style={{ margin: 0, fontSize: 24 }}>
        Crear / configurar examen — {code}
      </h1>
      <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>
        Paso {step} de 4 · 1) Docente y materia · 2) Configuración básica · 3)
        Preguntas · 4) Tablero y chat.
      </p>
    </header>
  );

  if (examNotFound) {
    return (
      <main style={containerStyle}>
        <h1>Examen no encontrado</h1>
        <p style={{ fontSize: 14 }}>
          No encontré un examen con el código <b>{code}</b>. Es posible que haya
          sido eliminado o que el código sea incorrecto.
        </p>
        <a
          href="/t"
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #d4d4d8",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Volver al panel docente
        </a>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      {Header}

      {loading && (
        <section style={cardStyle}>
          <p>Cargando configuración…</p>
        </section>
      )}

      {!loading && (
        <>
          {/* Mensajes globales */}
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

          {/* Paso 1: Docente y materia */}
          {step === 1 && (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>
                Paso 1 — Datos del docente y materia
              </h2>

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
                  <p
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      marginTop: 4,
                    }}
                  >
                    Si se completa, el examen queda con hora sugerida de
                    apertura. El cierre final se produce cuando vence el tiempo
                    de cada alumno.
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => saveMeta(true)}
                    disabled={savingMeta}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
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

          {/* Paso 2: Configuración básica */}
          {step === 2 && (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Paso 2 — Configuración básica</h2>

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
                    Estado
                  </label>
                  <p style={{ marginTop: 4, fontSize: 14 }}>
                    <b>{isOpen ? "Abierto" : "Cerrado"}</b> · Se abrirá al
                    guardar la configuración.
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
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    ← Volver al paso 1
                  </button>
                  <button
                    onClick={() => saveAndOpenExam(true)}
                    disabled={savingExam}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "none",
                      background: savingExam ? "#9ca3af" : "#16a34a",
                      color: "white",
                      cursor: savingExam ? "default" : "pointer",
                      fontSize: 14,
                    }}
                  >
                    {savingExam
                      ? "Guardando…"
                      : "Guardar configuración y continuar"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Paso 3: Preguntas */}
          {step === 3 && (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Paso 3 — Preguntas del examen</h2>

              <p style={{ fontSize: 13, opacity: 0.75, marginTop: 0 }}>
                Armá las consignas y sus opciones de respuesta. Podés crear
                nuevas preguntas o editar las existentes.
              </p>

              {/* Formulario nueva / editar */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  display: "grid",
                  gap: 10,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {editingQuestion ? "Editar pregunta" : "Nueva pregunta"}
                </h3>

                <div>
                  <label>Tipo de pregunta:</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as QuestionKind)}
                    style={{ marginLeft: 8, padding: 4 }}
                    disabled={!!editingQuestion}
                  >
                    <option value="MCQ">Opción múltiple</option>
                    <option value="TRUE_FALSE">Verdadero / Falso</option>
                    <option value="SHORT_TEXT">Texto breve</option>
                    <option value="FILL_IN">Relleno de casilleros</option>
                  </select>
                  {editingQuestion && (
                    <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>
                      (el tipo no se puede cambiar en edición)
                    </span>
                  )}
                </div>

                <div>
                  <label>Enunciado / consigna</label>
                  <textarea
                    value={stem}
                    onChange={(e) => setStem(e.target.value)}
                    rows={3}
                    placeholder={
                      kind === "FILL_IN"
                        ? "Ej: ¿Por qué juegan los niños? Por [placer], para [expresar la agresión], para controlar la [ansiedad]..."
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

                {/* Campos por tipo */}
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
                        onClick={addMcqChoice}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
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
                          onChange={(e) => updateMcqChoice(idx, e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => removeMcqChoice(idx)}
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
                    <label>
                      Palabras distractoras (separadas por coma, opcional)
                    </label>
                    <input
                      value={fillDistractors}
                      onChange={(e) => setFillDistractors(e.target.value)}
                      placeholder="Ej: insecto, peludo, rudo"
                    />
                    <p
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                      }}
                    >
                      Estas palabras se mezclarán con las respuestas correctas
                      en el banco que ve el alumno para arrastrar a los
                      casilleros.
                    </p>
                  </div>
                )}

                {/* Puntos + botones */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    marginTop: 4,
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
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {editingQuestion && (
                      <button
                        type="button"
                        onClick={resetQuestionForm}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Cancelar edición
                      </button>
                    )}
                    <button
                      disabled={savingQuestion || !stem.trim()}
                      onClick={saveQuestion}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "none",
                        background: savingQuestion ? "#9ca3af" : "#2563eb",
                        color: "white",
                        cursor: savingQuestion ? "default" : "pointer",
                        fontSize: 13,
                      }}
                    >
                      {savingQuestion
                        ? "Guardando..."
                        : editingQuestion
                        ? "Guardar cambios"
                        : "Guardar pregunta"}
                    </button>
                  </div>
                </div>

                {questionsError && (
                  <div
                    style={{
                      background: "#fee",
                      border: "1px solid #fcc",
                      borderRadius: 8,
                      padding: 8,
                      whiteSpace: "pre-wrap",
                      marginTop: 8,
                      fontSize: 12,
                    }}
                  >
                    Error: {questionsError}
                  </div>
                )}
              </div>

              {/* Lista de preguntas */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <h3 style={{ marginTop: 0, fontSize: 16 }}>
                  Preguntas ({items.length})
                </h3>
                {questionsLoading && (
                  <p style={{ fontSize: 13 }}>Cargando preguntas…</p>
                )}
                {!questionsLoading && items.length === 0 && (
                  <p style={{ fontSize: 13, opacity: 0.7 }}>
                    Todavía no hay preguntas.
                  </p>
                )}
                {!questionsLoading && items.length > 0 && (
                  <ol>
                    {items.map((q, idx) => (
                      <li key={q.id} style={{ marginBottom: 10 }}>
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
                          <button
                            type="button"
                            onClick={() => startEditQuestion(q)}
                            style={{
                              marginLeft: 8,
                              padding: "2px 6px",
                              borderRadius: 999,
                              border: "1px solid #e5e7eb",
                              background: "#f9fafb",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Editar
                          </button>
                        </div>
                        {Array.isArray(q.choices) && q.choices.length > 0 && (
                          <ul style={{ marginTop: 4 }}>
                            {q.choices.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ← Volver al paso 2
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Ir al tablero y chat →
                </button>
              </div>
            </section>
          )}

          {/* Paso 4: Tablero + chat */}
          {step === 4 && (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Paso 4 — Tablero y chat</h2>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 12,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ← Volver a preguntas
                </button>

                <button
                  type="button"
                  onClick={reloadAttempts}
                  disabled={loadingAttempts}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    fontSize: 13,
                    cursor: loadingAttempts ? "default" : "pointer",
                  }}
                >
                  {loadingAttempts ? "Actualizando…" : "Refrescar tablero"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const link = studentLink();
                    if (!link) return;
                    navigator.clipboard
                      .writeText(link)
                      .then(() =>
                        alert(
                          "Link copiado para enviar a los alumnos:\n" + link
                        )
                      )
                      .catch(() =>
                        alert("No pude copiar automáticamente. Link:\n" + link)
                      );
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #22c55e",
                    background: "#dcfce7",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Copiar link para alumnos
                </button>
              </div>

              {attempts.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.7 }}>
                  Todavía no hay intentos registrados para este examen.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
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
                          Vidas
                        </th>
                        <th
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Fraudes / eventos
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
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span
                              style={{
                                marginRight: 6,
                                color:
                                  a.livesRemaining <= 0 ? "#b91c1c" : undefined,
                              }}
                            >
                              {a.livesRemaining}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjustLives(a.id, "increment")}
                              disabled={updatingAttemptId === a.id}
                              title="Sumar 1 vida"
                              style={{
                                padding: "0 6px",
                                borderRadius: 999,
                                border: "1px solid #d4d4d8",
                                background: "#f9fafb",
                                fontSize: 11,
                                cursor:
                                  updatingAttemptId === a.id
                                    ? "default"
                                    : "pointer",
                                marginRight: 2,
                              }}
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustLives(a.id, "decrement")}
                              disabled={updatingAttemptId === a.id}
                              title="Restar 1 vida"
                              style={{
                                padding: "0 6px",
                                borderRadius: 999,
                                border: "1px solid #d4d4d8",
                                background: "#f9fafb",
                                fontSize: 11,
                                cursor:
                                  updatingAttemptId === a.id
                                    ? "default"
                                    : "pointer",
                              }}
                            >
                              −1
                            </button>
                          </td>
                          <td
                            style={{
                              padding: 6,
                              borderBottom: "1px solid #f3f4f6",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={a.violations}
                          >
                            {formatViolations(a.violations)}
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

              {/* Chat docente flotante */}
              <div style={{ marginTop: 16 }}>
                <p
                  style={{
                    fontSize: 12,
                    opacity: 0.75,
                    marginBottom: 4,
                  }}
                >
                  El chat del examen está disponible en la esquina inferior
                  derecha. Como docente vas a poder enviar mensajes a todos los
                  alumnos o responder consultas.
                </p>
              </div>

              <ExamChat
                code={code}
                role="teacher"
                defaultName={teacherName || profile?.name || "Docente"}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
