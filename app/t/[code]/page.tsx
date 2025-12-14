"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API } from "@/lib/api";
import { ExamMeta } from "@/lib/types";
import ExamChat from "@/components/ExamChat";
import { BoardClient } from "./board/BoardClient";
import {
  loadTeacherProfile,
  type TeacherProfile,
  type Institution,
} from "@/lib/teacherProfile";

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

  const [linkCopied, setLinkCopied] = React.useState(false);
  // TODO: reconstruir lógica real de casilleros FILL_IN.
  // Por ahora evitamos que explote el render si no está implementado.
  const fillAnswersPreview: string[] = [];

  // Perfil Docente (para selects)
  const [profile, setProfile] = React.useState<TeacherProfile | null>(null);
  const [selectedUniName, setSelectedUniName] = React.useState("");
  const [manualSubjectMode, setManualSubjectMode] = React.useState(false);

  // ----------------- carga inicial -----------------

  const loadExamAndMeta = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const [examRes, metaRes, questionsRes] = await Promise.all([
        fetch(`${API}/exams/${code}`, { cache: "no-store" }),
        fetch(`${API}/exams/${code}/meta`, { cache: "no-store" }),
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
        const m: ExamMeta = await metaRes.json();

        setTeacherName(m.teacherName || "");
        setSubject(m.subject || "");
        setGradingMode(
          (m.gradingMode || "auto").toLowerCase() === "manual"
            ? "manual"
            : "auto"
        );
        setMaxScore(
          typeof m.maxScore === "number" && !isNaN(m.maxScore) ? m.maxScore : ""
        );
        if (m.openAt) {
          const d = new Date(m.openAt);
          if (!isNaN(d.getTime())) {
            const iso = d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
            setOpenAt(iso);
          }
        }
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
    // Cargar perfil
    const p = loadTeacherProfile();
    setProfile(p);
  }, [code, loadExamAndMeta]);

  // Intentar deducir la universidad si ya hay materia seleccionada
  React.useEffect(() => {
    if (profile?.institutions && subject && !selectedUniName) {
      // Buscar si alguna universidad tiene esta materia
      const found = profile.institutions.find((inst) =>
        inst.subjects.some((s) => s.name === subject)
      );
      if (found) {
        setSelectedUniName(found.name);
      } else if (profile.institutions.length > 0) {
        // Default a la primera si no la encontramos? Dejar que usuario elija
      }
    }
  }, [profile, subject, selectedUniName]);

  // ----------------- helpers UI -----------------

  const steps: { id: Step; label: string }[] = [
    { id: 1, label: "Docente y materia" },
    { id: 2, label: "Configuración básica" },
    { id: 3, label: "Preguntas" },
    { id: 4, label: "Tablero y chat" },
  ];

  const cardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: "20px",
    padding: "32px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.02)",
    border: "none",
  };

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

        body.stem = studentStem;
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

  function copyStudentLink() {
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${base}/s/${code}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } else {
        window.prompt("Copiá el link:", link);
      }
    } catch (e) {
      console.error("COPY_LINK_ERROR", e);
    }
  }

  // ----------------- render -----------------
  const styles = {
    wrapper: {
      maxWidth: 1000,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column" as const,
      gap: 32,
    },
    header: {
      background: "rgba(255, 255, 255, 0.4)",
      backdropFilter: "blur(12px)",
      borderRadius: 20,
      padding: "16px 24px",
      border: "1px solid rgba(255,255,255,0.6)",
      display: "flex",
      alignItems: "center",
      gap: 16,
    },
    nav: {
      width: 240,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column" as const,
      gap: 8,
    },
    navItem: (active: boolean) => ({
      padding: "12px 16px",
      borderRadius: 12,
      textAlign: "left" as const,
      border: active ? "1px solid rgba(255,255,255,0.8)" : "1px solid transparent",
      background: active ? "rgba(255,255,255,0.8)" : "transparent",
      color: active ? "#1e1b4b" : "#4b5563",
      fontSize: 14,
      fontWeight: active ? 700 : 500,
      cursor: "pointer",
      transition: "all 0.2s",
      boxShadow: active ? "0 4px 12px rgba(0,0,0,0.03)" : "none",
    }),
  };

  return (
    <div className="bg-noise animate-superbloom min-h-screen p-10 overflow-x-hidden font-sans"
      style={{
        background: "linear-gradient(-45deg, #ff9a9e, #fad0c4, #fad0c4, #a18cd1, #fbc2eb)",
        backgroundSize: "400% 400%"
      }}>
      <div style={styles.wrapper}>
        {/* ENCABEZADO */}
        {/* ENCABEZADO DE RETORNO */}
        <div
          style={styles.header}
        >
          <Link
            href="/t"
            style={{
              textDecoration: "none",
              color: "#6b7280",
              fontWeight: 500,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.2s",
            }}
          >
            <span style={{ fontSize: 16 }}>←</span> Volver al panel
          </Link>

          <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#1f2937",
                fontFamily: "var(--font-festive), sans-serif",
              }}
            >
              {title || "Configuración de Examen"}
            </h1>
            <div
              style={{
                fontSize: 11,
                color: "#9ca3af",
                fontWeight: 600,
                marginTop: 2,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Código: {code}
            </div>
          </div>
        </div>

        {loading && (
          <div className="glass-card p-8">
            <p>Cargando configuración…</p>
          </div>
        )}

        {!loading && (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* SIDEBAR NAVIGATION */}
            <nav
              style={styles.nav}
            >
              {steps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  disabled={loading}
                  style={styles.navItem(step === s.id)}
                >
                  <span style={{ marginRight: 8, opacity: 0.7 }}>{s.id}.</span>
                  {s.label}
                </button>
              ))}
            </nav>

            <div style={{ flex: 1 }}>
              {/* PASO 1: Docente y materia */}
              {step === 1 && (
                <section className="glass-card p-8">
                  <h2
                    style={{
                      marginBottom: 16,
                      fontSize: 18,
                      borderBottom: "1px solid #f3f4f6",
                      paddingBottom: 12,
                      fontFamily: "var(--font-festive), sans-serif",
                    }}
                  >
                    Docente y materia
                  </h2>

                  <div style={{ display: "grid", gap: 16 }} className="animate-stagger-container">
                    <div>
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Nombre del docente
                      </label>
                      <input
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="Ej: Prof. Gómez"
                        style={{
                          padding: "10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          width: "100%",
                          fontSize: 14,
                        }}
                      />
                    </div>

                    {/* LOGIC FOR SUBJECT SELECTION */}
                    <div>
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        Asignatura
                      </label>

                      {/* MODE 1: SELECTS (If institutions exist AND not manual mode) */}
                      {profile?.institutions &&
                        profile.institutions.length > 0 &&
                        !manualSubjectMode ? (
                        <div
                          style={{
                            background: "#f9fafb",
                            padding: 16,
                            borderRadius: 12,
                          }}
                        >
                          {/* Uni Select */}
                          <div style={{ marginBottom: 12 }}>
                            <label
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              Universidad / Institución
                            </label>
                            <select
                              value={selectedUniName}
                              onChange={(e) => {
                                setSelectedUniName(e.target.value);
                                setSubject("");
                              }}
                              style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: 8,
                                border: "1px solid #d1d5db",
                                fontSize: 14,
                              }}
                            >
                              <option value="">-- Seleccionar --</option>
                              {profile.institutions.map((inst) => (
                                <option key={inst.id} value={inst.name}>
                                  {inst.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Subject Select */}
                          <div>
                            <label
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              Materia
                            </label>
                            <select
                              value={subject}
                              onChange={(e) => setSubject(e.target.value)}
                              disabled={!selectedUniName}
                              style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: 8,
                                border: "1px solid #d1d5db",
                                fontSize: 14,
                                opacity: selectedUniName ? 1 : 0.6,
                              }}
                            >
                              <option value="">-- Seleccionar materia --</option>
                              {profile.institutions
                                .find((i) => i.name === selectedUniName)
                                ?.subjects.map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <button
                            onClick={() => setManualSubjectMode(true)}
                            style={{
                              marginTop: 12,
                              background: "none",
                              border: "none",
                              color: "#6b7280",
                              fontSize: 12,
                              textDecoration: "underline",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            ¿No encuentras tu materia? Escribir manualmente
                          </button>
                        </div>
                      ) : (
                        /* MODE 2: MANUAL INPUT */
                        <div
                          style={{
                            background: "#f9fafb",
                            padding: 16,
                            borderRadius: 12,
                          }}
                        >
                          <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Ej: Matemática I"
                            style={{
                              width: "100%",
                              padding: "10px",
                              border: "1px solid #d1d5db",
                              borderRadius: 8,
                              fontSize: 14,
                            }}
                          />
                          {profile?.institutions &&
                            profile.institutions.length > 0 && (
                              <button
                                onClick={() => setManualSubjectMode(false)}
                                style={{
                                  marginTop: 8,
                                  background: "none",
                                  border: "none",
                                  color: "#2563eb",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                ← Volver a seleccionar de mis listas
                              </button>
                            )}
                        </div>
                      )}
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
                          padding: "10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          width: "100%",
                          fontSize: 14,
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
                          padding: "10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          width: "100%",
                          fontSize: 14,
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
                <section className="glass-card p-8">
                  <h2 style={{ marginBottom: 16, fontSize: 18, fontFamily: "var(--font-festive), sans-serif" }}>
                    Configuración básica
                  </h2>

                  <div style={{ display: "grid", gap: 16 }} className="animate-stagger">
                    <div>
                      <label style={{ fontSize: 13, display: "block" }}>
                        Título del examen
                      </label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Parcial 1 - Unidad 1"
                        style={{
                          padding: "10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          width: "100%",
                          fontSize: 14,
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
                          padding: "10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          width: "100%",
                          fontSize: 14,
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
                          padding: "10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          width: "100%",
                          fontSize: 14,
                        }}
                      />
                      <p
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                          marginTop: 4,
                        }}
                      >
                        Cada vez que se detecta fraude, se pierde 1 vida. Al
                        llegar a 0, el examen se cierra para ese alumno.
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

              <div style={{ paddingBottom: 20 }}></div>

              {/* PASO 3: Preguntas */}
              {step === 3 && (
                <section className="glass-card p-8">
                  <h2 style={{ marginBottom: 8, fontSize: 18, fontFamily: "var(--font-festive), sans-serif" }}>Preguntas</h2>
                  <p style={{ fontSize: 13, color: "#555" }}>
                    Armá las consignas y sus opciones. Para los casilleros,
                    escribí las respuestas correctas entre corchetes y las
                    palabras distractoras separadas por comas.
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
                        style={{ width: "100%", marginTop: 4, padding: 8 }}
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
                              style={{ flex: 1, padding: 4 }}
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
                          style={{ padding: 4 }}
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
                          style={{ padding: 4 }}
                        />
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.8,
                          }}
                        >
                          Estas palabras se mezclarán con las respuestas correctas
                          en el banco que ve el alumno. Separalas con <b>comas</b>
                          .
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
                        style={{ width: 120, padding: 4 }}
                      />
                      <div
                        style={{ marginLeft: "auto", display: "flex", gap: 8 }}
                      >
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
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "#2563eb",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                          }}
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
                              style={{ fontSize: 12, cursor: "pointer" }}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteQuestion(q.id)}
                              style={{
                                fontSize: 12,
                                color: "#b91c1c",
                                cursor: "pointer",
                              }}
                            >
                              🗑 Eliminar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>

                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Continuar al tablero →{" "}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {step === 4 && (
                <section className="glass-card p-8">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: 18 }}>Tablero y chat</h2>
                  </div>

                  {/* link para alumnos */}
                  <div
                    style={{
                      fontSize: 13,
                      marginBottom: 10,
                      padding: 8,
                      background: "#f9fafb",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ marginBottom: 0 }}>Link para alumnos:</div>
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
                    <button
                      onClick={copyStudentLink}
                      style={{
                        marginLeft: "auto",
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        background: linkCopied ? "#dcfce7" : "white",
                        color: linkCopied ? "#166534" : "#374151",
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {linkCopied ? "¡Copiado!" : "Copiar"}
                    </button>
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
                      Incluye intentos, antifraude y chat (según lo que definamos
                      en el backend).
                    </div>
                  </div>

                  <BoardClient code={code} />

                  <div style={{ marginTop: 16 }}>
                    <ExamChat
                      code={code}
                      role="teacher"
                      defaultName={teacherName || "Docente"}
                    />
                  </div>
                </section>
              )}
            </div>
          </div >
        )
        }

        {
          err && (
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
          )
        }

        {
          info && (
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
          )
        }
      </div >
    </div >
  );
}
