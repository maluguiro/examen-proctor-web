"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { API, patchAttemptLives } from "@/lib/api";
import ExamChat from "@/components/ExamChat";

// ---------- tipos básicos ----------

type Step = 1 | 2 | 3 | 4;

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

// ---------- tipos preguntas ----------

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

// ---------- helpers FILL_IN ----------

// extrae [respuestas] del texto raw del docente
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

// docente escribe con [respuestas], alumno verá [[1]], [[2]]...
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

// inverso: del stem alumno ([[1]]...) + answers => texto con [respuestas]
function buildRawFromStudentStem(stem: string, answers: string[]): string {
  let out = stem || "";
  answers.forEach((ans, idx) => {
    const token = `[[${idx + 1}]]`;
    out = out.split(token).join(`[${ans}]`);
  });
  return out;
}

// ---------- componente principal ----------

export default function TeacherExamPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  const [step, setStep] = React.useState<Step>(1);

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

  // preguntas
  const [questions, setQuestions] = React.useState<QuestionLite[]>([]);
  const [loadingQuestions, setLoadingQuestions] = React.useState(false);
  const [savingQuestion, setSavingQuestion] = React.useState(false);
  const [questionErr, setQuestionErr] = React.useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = React.useState<
    string | null
  >(null);

  const [qKind, setQKind] = React.useState<QuestionKind>("MCQ");
  const [qStem, setQStem] = React.useState(""); // texto raw con [respuestas]
  const [qPoints, setQPoints] = React.useState(1);

  const [mcqChoices, setMcqChoices] = React.useState<string[]>([
    "Opción 1",
    "Opción 2",
  ]);
  const [mcqCorrect, setMcqCorrect] = React.useState(0);

  const [tfCorrect, setTfCorrect] = React.useState(true);
  const [shortAnswer, setShortAnswer] = React.useState("");

  // palabras distractoras de FILL_IN (texto, separadas por coma)
  const [fillDistractorsText, setFillDistractorsText] = React.useState("");

  // ----------------- carga inicial -----------------

  const loadExamAndMeta = React.useCallback(async () => {
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

      // QUESTIONS
      if (questionsRes.ok) {
        const qData = await questionsRes.json();
        setQuestions(qData.items ?? []);
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "No se pudo cargar el examen");
    } finally {
      setLoading(false);
    }
  }, [code]);

  React.useEffect(() => {
    if (!code) return;
    loadExamAndMeta();
  }, [code, loadExamAndMeta]);

  // ----------------- helpers UI -----------------

  const steps: { id: Step; label: string }[] = [
    { id: 1, label: "Docente y materia" },
    { id: 2, label: "Configuración básica" },
    { id: 3, label: "Preguntas" },
    { id: 4, label: "Tablero y chat" },
  ];

  function formatDateTime(dt: string | null) {
    if (!dt) return "—";
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return "—";
      // Hora cortita: 18:23
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  }

  // Estado "lindo" del intento para el tablero
  function prettyAttemptStatus(a: AttemptsResponse["attempts"][number]): {
    label: string;
    bg: string;
    color: string;
  } {
    const raw = String(a.status || "").toUpperCase();

    // Intento en curso (sin fecha de fin)
    if (!a.finishedAt) {
      return {
        label: "En curso",
        bg: "#dcfce7", // verde clarito
        color: "#166534",
      };
    }

    // Algunos nombres posibles que podamos usar en el backend
    if (raw.includes("FRAUD") || raw.includes("LIVES")) {
      return {
        label: "Cerrado por fraude",
        bg: "#fee2e2", // rojo clarito
        color: "#b91c1c",
      };
    }

    if (raw.includes("TIME")) {
      return {
        label: "Cerrado por tiempo",
        bg: "#fef9c3", // amarillo clarito
        color: "#854d0e",
      };
    }

    if (
      raw.includes("SUBMIT") ||
      raw.includes("FINISH") ||
      raw.includes("DONE")
    ) {
      return {
        label: "Finalizado",
        bg: "#e5e7eb", // gris
        color: "#374151",
      };
    }

    // Fallback
    return {
      label: raw || "Desconocido",
      bg: "#e5e7eb",
      color: "#374151",
    };
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };
  function summarizeViolations(raw: string | null | undefined): string {
    if (!raw) return "";
    let arr: string[] = [];
    const trimmed = String(raw).trim();

    try {
      // Si viene como JSON: ["DOCENTE_TABLERO","COPY",...]
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          arr = parsed.map((x) => String(x));
        } else {
          arr = [trimmed];
        }
      } else {
        // Si viene como texto plano separado por comas/espacios
        arr = trimmed.split(/[,\s]+/).filter(Boolean);
      }
    } catch {
      arr = [trimmed];
    }

    if (!arr.length) return "";

    const counts = new Map<string, number>();
    for (const v of arr) {
      const key = v.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const labelFor = (key: string): string => {
      if (key === "COPY") return "Copiar";
      if (key === "PASTE") return "Pegar";
      if (key === "CUT") return "Cortar";
      if (key === "BLUR" || key === "BLUR_TAB" || key === "BLUR_WINDOW")
        return "Fuera del examen";
      if (key === "PRINT" || key === "PRINTSCREEN") return "Imprimir / captura";
      if (key === "FULLSCREEN_EXIT") return "Fullscreen Salida";
      if (key === "DOCENTE_TABLERO" || key === "DOCENTE")
        return "Acción del docente";
      return key;
    };

    const parts: string[] = [];
    for (const [key, count] of counts) {
      const label = labelFor(key);
      parts.push(count > 1 ? `${label} ×${count}` : label);
    }

    return parts.join(" · ");
  }
  // ----------------- guardar META -----------------

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
      setInfo("Datos del docente guardados.");
    } catch (e: any) {
      setErr(e?.message || "Error al guardar los datos del docente");
    } finally {
      setSavingMeta(false);
    }
  }

  async function onSaveMeta(goNext: boolean) {
    await saveMeta();
    if (goNext) setStep(2);
  }

  // ----------------- guardar CONFIG EXAMEN -----------------

  async function saveAndOpenExam(goNext: boolean) {
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

  // ----------------- preguntas: cargar / guardar / editar -----------------

  async function reloadQuestions() {
    try {
      setLoadingQuestions(true);
      const r = await fetch(`${API}/exams/${code}/questions`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await r.json();
      setQuestions(data.items ?? []);
    } catch (e) {
      console.error("LOAD_QUESTIONS_ERROR", e);
    } finally {
      setLoadingQuestions(false);
    }
  }

  function resetQuestionForm() {
    setEditingQuestionId(null);
    setQKind("MCQ");
    setQStem("");
    setQPoints(1);
    setMcqChoices(["Opción 1", "Opción 2"]);
    setMcqCorrect(0);
    setTfCorrect(true);
    setShortAnswer("");
    setFillDistractorsText("");
    setQuestionErr(null);
  }

  async function saveQuestion() {
    setSavingQuestion(true);
    setQuestionErr(null);

    try {
      const stemRaw = qStem.trim();
      if (!stemRaw) {
        throw new Error("Falta el enunciado / consigna.");
      }

      let body: any = {
        kind: qKind,
        stem: stemRaw,
        points: Number(qPoints) || 1,
      };

      if (qKind === "MCQ") {
        const choices = mcqChoices.map((s) => s.trim()).filter(Boolean);
        if (choices.length < 2) {
          throw new Error("Opción múltiple requiere al menos 2 opciones.");
        }
        if (mcqCorrect < 0 || mcqCorrect >= choices.length) {
          throw new Error("La opción correcta está fuera de rango.");
        }
        body.choices = choices;
        body.answer = mcqCorrect;
      } else if (qKind === "TRUE_FALSE") {
        body.answer = Boolean(tfCorrect);
        // choices fijos los arma el backend
      } else if (qKind === "SHORT_TEXT") {
        body.answer = shortAnswer.trim() || null;
      } else if (qKind === "FILL_IN") {
        const { stem: studentStem, answers } = buildStudentStemFromRaw(stemRaw);
        if (!answers.length) {
          throw new Error(
            "Para los casilleros, escribí el texto completo y colocá cada respuesta correcta entre corchetes. Ej: El perro es un [animal] doméstico."
          );
        }

        const distractors = fillDistractorsText
          .split(/[,\n;]/)
          .map((s) => s.trim())
          .filter(Boolean);

        const bank = [...answers, ...distractors];

        body.stem = studentStem; // lo que verá el alumno ([[1]], [[2]]…)
        body.answer = { answers, blanks: answers.length };
        body.choices = bank;
      }

      const url = editingQuestionId
        ? `${API}/questions/${editingQuestionId}`
        : `${API}/exams/${code}/questions`;
      const method = editingQuestionId ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "No se pudo guardar la pregunta.");
      }

      await reloadQuestions();
      resetQuestionForm();
      setInfo(editingQuestionId ? "Pregunta actualizada." : "Pregunta creada.");
    } catch (e: any) {
      console.error(e);
      const msg = e.message || String(e);
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) setQuestionErr(parsed.error);
        else setQuestionErr(msg);
      } catch {
        setQuestionErr(msg);
      }
    } finally {
      setSavingQuestion(false);
    }
  }

  function startEditQuestion(q: QuestionLite) {
    setEditingQuestionId(q.id);
    setQKind(q.kind);
    setQPoints(q.points ?? 1);

    if (q.kind === "MCQ") {
      setMcqChoices(q.choices ?? []);
      const ansIdx =
        typeof q.answer === "number" ? q.answer : Number(q.answer ?? 0) || 0;
      setMcqCorrect(ansIdx);
      setQStem(q.stem);
    } else if (q.kind === "TRUE_FALSE") {
      setTfCorrect(Boolean(q.answer));
      setQStem(q.stem);
    } else if (q.kind === "SHORT_TEXT") {
      setShortAnswer(q.answer != null ? String(q.answer ?? "").trim() : "");
      setQStem(q.stem);
    } else if (q.kind === "FILL_IN") {
      let answers: string[] = [];
      if (q.answer && Array.isArray(q.answer.answers)) {
        answers = q.answer.answers.map((x: any) => String(x ?? ""));
      }
      const raw = buildRawFromStudentStem(q.stem, answers);
      setQStem(raw);

      const bank = Array.isArray(q.choices) ? q.choices : [];
      const distractors = bank.filter((w) => !answers.includes(w));
      setFillDistractorsText(distractors.join(", "));
    }

    setStep(3);
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm("¿Eliminar esta pregunta?")) return;
    try {
      await fetch(`${API}/questions/${id}`, { method: "DELETE" });
      await reloadQuestions();
      if (editingQuestionId === id) resetQuestionForm();
    } catch (e) {
      console.error("DELETE_QUESTION_ERROR", e);
    }
  }

  const fillAnswersPreview =
    qKind === "FILL_IN" ? extractFillAnswersFromStem(qStem) : [];

  // ----------------- TABLERO: intentos + vidas -----------------

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
  // Auto-refresh del tablero mientras estoy en el Paso 4 (Tablero y chat)
  React.useEffect(() => {
    if (step !== 4) return; // solo cuando estoy en el tablero

    // refresco inicial apenas entro al paso 4
    reloadAttempts();

    // luego refresco cada 5 segundos
    const id = window.setInterval(() => {
      reloadAttempts();
    }, 3000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function changeLives(
    attempt: AttemptsResponse["attempts"][number],
    op: "increment" | "decrement"
  ) {
    try {
      await patchAttemptLives(attempt.id, op, "DOCENTE_TABLERO");
      await reloadAttempts();

      const deltaText = op === "increment" ? "+1 vida" : "-1 vida";
      const name = attempt.studentName || "este alumno";

      setInfo(`Se aplicó ${deltaText} a ${name}.`);
    } catch (e) {
      console.error("PATCH_LIVES_ERROR", e);
      alert("No se pudo actualizar las vidas de este alumno.");
    }
  }
  function copyStudentLink() {
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${base}/s/${code}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link);
        setInfo("Link del examen copiado al portapapeles.");
      } else {
        window.prompt("Copiá el link:", link);
      }
    } catch (e) {
      console.error("COPY_LINK_ERROR", e);
    }
  }

  // ----------------- render -----------------

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: 16,
        display: "grid",
        gap: 16,
      }}
    >
      {/* ENCABEZADO */}
      <header>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>
          Crear / configurar examen — {code.toUpperCase()}
        </h1>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Paso {step} de 4 · 1) Docente y materia · 2) Configuración básica · 3)
          Preguntas · 4) Tablero y chat.
        </p>
      </header>

      {/* STEPPER */}
      <nav
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            disabled={loading}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: step === s.id ? "1px solid #2563eb" : "1px solid #e5e7eb",
              background: step === s.id ? "#2563eb" : "#f9fafb",
              color: step === s.id ? "white" : "#111827",
              fontSize: 12,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </nav>

      {loading && (
        <div style={cardStyle}>
          <p>Cargando configuración…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* PASO 1: Docente y materia */}
          {step === 1 && (
            <section style={cardStyle}>
              <h2 style={{ marginBottom: 8 }}>Paso 1 — Docente y materia</h2>

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
                    Hora programada para la revisión (opcional)
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
                    Define desde cuándo los alumnos pueden ver la revisión. Si
                    está vacío, se habilita al terminar el examen.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => onSaveMeta(false)}
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
                    {savingMeta ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    onClick={() => onSaveMeta(true)}
                    disabled={savingMeta}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: savingMeta ? "#9ca3af" : "#16a34a",
                      color: "white",
                      cursor: savingMeta ? "default" : "pointer",
                      fontSize: 14,
                    }}
                  >
                    {savingMeta ? "Guardando…" : "Guardar y continuar →"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* PASO 2: Configuración básica */}
          {step === 2 && (
            <section style={cardStyle}>
              <h2 style={{ marginBottom: 8 }}>Paso 2 — Configuración básica</h2>

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

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => saveAndOpenExam(false)}
                    disabled={savingExam}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: savingExam ? "#9ca3af" : "#2563eb",
                      color: "white",
                      cursor: savingExam ? "default" : "pointer",
                      fontSize: 14,
                    }}
                  >
                    {savingExam ? "Guardando…" : "Guardar configuración"}
                  </button>
                  <button
                    onClick={() => saveAndOpenExam(true)}
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
                      : "Guardar y continuar a preguntas →"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* PASO 3: Preguntas */}
          {step === 3 && (
            <section style={cardStyle}>
              <h2 style={{ marginBottom: 8 }}>Paso 3 — Preguntas</h2>
              <p style={{ fontSize: 13, color: "#555" }}>
                Armá las consignas y sus opciones. Para los casilleros, escribí
                las respuestas correctas entre corchetes y las palabras
                distractoras separadas por comas.
              </p>

              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                {/* Tipo */}
                <div>
                  <label>Tipo de pregunta:</label>
                  <select
                    value={qKind}
                    onChange={(e) => setQKind(e.target.value as QuestionKind)}
                    style={{ marginLeft: 8, padding: 4 }}
                  >
                    <option value="MCQ">Opción múltiple</option>
                    <option value="TRUE_FALSE">Verdadero / Falso</option>
                    <option value="SHORT_TEXT">Texto breve</option>
                    <option value="FILL_IN">Relleno de casilleros</option>
                  </select>
                  {editingQuestionId && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: "#2563eb",
                      }}
                    >
                      Editando pregunta existente
                    </span>
                  )}
                </div>

                {/* Enunciado */}
                <div>
                  <label>Enunciado / consigna</label>
                  <textarea
                    value={qStem}
                    onChange={(e) => setQStem(e.target.value)}
                    rows={3}
                    placeholder={
                      qKind === "FILL_IN"
                        ? "Ej: El perro es un [animal] doméstico y muy [fiel]."
                        : "Escribí la consigna de la pregunta…"
                    }
                    style={{ width: "100%", marginTop: 4 }}
                  />
                  {qKind === "FILL_IN" && (
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
                {qKind === "MCQ" && (
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
                              prev.map((cc, i) =>
                                i === idx ? e.target.value : cc
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

                {qKind === "TRUE_FALSE" && (
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

                {qKind === "SHORT_TEXT" && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <label>Respuesta de referencia (opcional)</label>
                    <input
                      value={shortAnswer}
                      onChange={(e) => setShortAnswer(e.target.value)}
                      placeholder="Respuesta esperada (opcional)"
                    />
                  </div>
                )}

                {qKind === "FILL_IN" && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <label>Palabras distractoras</label>
                    <input
                      value={fillDistractorsText}
                      onChange={(e) => setFillDistractorsText(e.target.value)}
                      placeholder="insecto, peludo, rudo"
                    />
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.8,
                      }}
                    >
                      Estas palabras se mezclarán con las respuestas correctas
                      en el banco que ve el alumno. Separalas con <b>comas</b>.
                    </div>
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
                    value={qPoints}
                    onChange={(e) =>
                      setQPoints(parseInt(e.target.value, 10) || 1)
                    }
                    style={{ width: 120 }}
                  />
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {editingQuestionId && (
                      <button
                        type="button"
                        onClick={resetQuestionForm}
                        disabled={savingQuestion}
                      >
                        Cancelar edición
                      </button>
                    )}
                    <button
                      disabled={savingQuestion || !qStem.trim()}
                      onClick={saveQuestion}
                    >
                      {savingQuestion
                        ? "Guardando..."
                        : editingQuestionId
                        ? "Guardar cambios"
                        : "Guardar pregunta"}
                    </button>
                  </div>
                </div>

                {questionErr && (
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
                    Error: {questionErr}
                  </div>
                )}
              </div>

              {/* LISTA DE PREGUNTAS */}
              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  marginTop: 12,
                  paddingTop: 12,
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Preguntas creadas ({questions.length})
                </h3>
                {loadingQuestions && <p>Cargando preguntas…</p>}
                {!loadingQuestions && !questions.length && (
                  <p style={{ fontSize: 13, opacity: 0.7 }}>
                    No hay preguntas todavía.
                  </p>
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
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => startEditQuestion(q)}
                          style={{ fontSize: 12 }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(q.id)}
                          style={{ fontSize: 12, color: "#b91c1c" }}
                        >
                          🗑 Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>

                <div style={{ marginTop: 12 }}>
                  <button type="button" onClick={() => setStep(4)}>
                    Continuar al tablero →{" "}
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <h2 style={{ margin: 0 }}>Paso 4 — Tablero y chat</h2>
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

              <p
                style={{
                  fontSize: 11,
                  opacity: 0.65,
                  marginTop: -4,
                  marginBottom: 8,
                }}
              >
                El tablero se actualiza automáticamente cada 5 segundos mientras
                estés en este paso.
              </p>

              {/* link para alumnos */}
              <div
                style={{
                  fontSize: 13,
                  marginBottom: 10,
                  padding: 8,
                  background: "#f9fafb",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ marginBottom: 4 }}>Link para alumnos:</div>
                <code
                  style={{
                    fontSize: 12,
                    padding: "4px 6px",
                    background: "white",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/s/${code}`
                    : `/s/${code}`}
                </code>
              </div>
              {/* descarga de registro en PDF */}
              <div
                style={{
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                <a
                  href={`${API}/exams/${code}/activity.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <button
                    type="button"
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#eef2ff",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    ⬇️ Descargar registro del examen (PDF)
                  </button>
                </a>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.6,
                    marginTop: 4,
                  }}
                >
                  Incluye intentos, antifraude y chat (según lo que definamos en
                  el backend).
                </div>
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
                          Vidas
                        </th>
                        <th
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Antifraude
                        </th>
                        <th
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Tiempo (inicio / fin)
                        </th>
                        <th
                          style={{
                            padding: 6,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map((a) => {
                        const st = prettyAttemptStatus(a);

                        return (
                          <tr key={a.id}>
                            {/* Alumno */}
                            <td
                              style={{
                                padding: 6,
                                borderBottom: "1px solid #f3f4f6",
                              }}
                            >
                              {a.studentName || "—"}
                            </td>

                            {/* Estado */}
                            <td
                              style={{
                                padding: 6,
                                borderBottom: "1px solid #f3f4f6",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: st.bg,
                                  color: st.color,
                                  fontSize: 11,
                                }}
                              >
                                {st.label}
                              </span>
                            </td>

                            {/* Vidas */}
                            <td
                              style={{
                                padding: 6,
                                borderBottom: "1px solid #f3f4f6",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  color:
                                    a.livesRemaining <= 0
                                      ? "#b91c1c"
                                      : a.livesRemaining === 1
                                      ? "#f97316"
                                      : "#16a34a",
                                }}
                              >
                                {a.livesRemaining}
                              </span>
                            </td>

                            {/* Antifraude resumido */}
                            <td
                              style={{
                                padding: 6,
                                borderBottom: "1px solid #f3f4f6",
                                fontSize: 11,
                                maxWidth: 220,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {(() => {
                                const vText = summarizeViolations(
                                  a.violations as any
                                );
                                if (!vText) {
                                  return (
                                    <span style={{ opacity: 0.6 }}>—</span>
                                  );
                                }
                                return (
                                  <span
                                    style={{
                                      color: "#b91c1c",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {vText}
                                  </span>
                                );
                              })()}
                            </td>

                            {/* Tiempo */}
                            <td
                              style={{
                                padding: 6,
                                borderBottom: "1px solid #f3f4f6",
                                fontSize: 12,
                              }}
                            >
                              <div>Inicio: {formatDateTime(a.startedAt)}</div>
                              <div>Fin: {formatDateTime(a.finishedAt)}</div>
                            </td>

                            {/* Acciones */}
                            <td
                              style={{
                                padding: 6,
                                borderBottom: "1px solid #f3f4f6",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => changeLives(a, "increment")}
                                  style={{
                                    fontSize: 12,
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                  }}
                                >
                                  +1 vida
                                </button>
                                <button
                                  type="button"
                                  onClick={() => changeLives(a, "decrement")}
                                  style={{
                                    fontSize: 12,
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                  }}
                                >
                                  -1 vida
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Chat sigue igual debajo, si lo tenías aquí */}
              <div style={{ marginTop: 16 }}>
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
