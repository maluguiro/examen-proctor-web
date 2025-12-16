"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API } from "@/lib/api";
import { ExamMeta } from "@/lib/types";
import { loadTeacherProfile, type TeacherProfile } from "@/lib/teacherProfile";
import { BoardClient } from "./board/BoardClient";
import FloatingChatShell from "@/components/FloatingChatShell";
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
  const [openAt, setOpenAt] = React.useState("");

  // preguntas
  const [questions, setQuestions] = React.useState<QuestionLite[]>([]);
  const [loadingQuestions, setLoadingQuestions] = React.useState(false);
  const [savingQuestion, setSavingQuestion] = React.useState(false);
  const [questionErr, setQuestionErr] = React.useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = React.useState<
    string | null
  >(null);

  const [qKind, setQKind] = React.useState<QuestionKind>("MCQ");
  const [qStem, setQStem] = React.useState("");
  const [qPoints, setQPoints] = React.useState(1);

  const [mcqChoices, setMcqChoices] = React.useState<string[]>([
    "Opción 1",
    "Opción 2",
  ]);
  const [mcqCorrect, setMcqCorrect] = React.useState(0);

  const [tfCorrect, setTfCorrect] = React.useState(true);
  const [shortAnswer, setShortAnswer] = React.useState("");

  // palabras distractoras de FILL_IN
  const [fillDistractorsText, setFillDistractorsText] = React.useState("");

  const [linkCopied, setLinkCopied] = React.useState(false);

  // Perfil Docente
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
            // Construimos manualmente el string local para datetime-local
            // evitando conversiones automáticas de zona horaria
            const pad = (n: number) => n.toString().padStart(2, "0");
            const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            setOpenAt(localIso);
          }
        }
      }

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
    const p = loadTeacherProfile();
    setProfile(p);
  }, [code, loadExamAndMeta]);

  React.useEffect(() => {
    if (profile?.institutions && subject && !selectedUniName) {
      const found = profile.institutions.find((inst) =>
        inst.subjects.some((s) => s.name === subject)
      );
      if (found) {
        setSelectedUniName(found.name);
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

        // Estrategia: Combinar respuestas + distractores en un Set para eliminar duplicados de texto.
        // El backend guardará el banco completo en 'choices'.
        const combined = [...answers, ...distractors];
        const uniqueBank = Array.from(new Set(combined));

        body.stem = studentStem;
        body.answer = { answers, blanks: answers.length };
        body.choices = uniqueBank;
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
      setQuestionErr(msg);
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
  return (
    <div
      className="min-h-screen p-10 overflow-x-hidden font-sans"
      style={{ background: "transparent" }}
    >
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* ENCABEZADO DE RETORNO (Glass Panel) */}
        <div
          className="glass-panel"
          style={{
            borderRadius: 20,
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
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

          <div style={{ width: 1, height: 24, background: "#cbd5e1" }} />

          <div>
            <h1
              className="text-gradient-aurora font-festive"
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {title || "Configuración de Examen"}
            </h1>
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                fontWeight: 600,
                marginTop: 2,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Código: {code}
            </div>
          </div>

          <div style={{ marginLeft: "auto" }}>
            {!loading &&
              (isOpen ? (
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "Esta acción se conectará al backend para cerrar el examen (bloquear nuevos intentos)."
                    )
                  }
                  className="glass-panel"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(254, 226, 226, 0.5)",
                    color: "#b91c1c",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "1px solid rgba(252, 165, 165, 0.5)",
                  }}
                >
                  Cerrar examen
                </button>
              ) : (
                <div
                  className="glass-panel"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    color: "#6b7280",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Examen cerrado
                </div>
              ))}
          </div>
        </div>

        {loading && (
          <div className="glass-panel p-8 rounded-3xl text-center">
            <p className="text-gray-500">Cargando configuración…</p>
          </div>
        )}

        {!loading && (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* SIDEBAR NAVIGATION */}
            <nav
              style={{
                width: 240,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {steps.map((s) => {
                const active = step === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    disabled={loading}
                    className={active ? "glass-panel" : ""}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      textAlign: "left",
                      border: active
                        ? "1px solid rgba(255,255,255,0.8)"
                        : "1px solid transparent",
                      background: active
                        ? "rgba(255,255,255,0.6)"
                        : "transparent",
                      color: active ? "#1e1b4b" : "#4b5563",
                      fontSize: 14,
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ marginRight: 8, opacity: 0.7 }}>
                      {s.id}.
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </nav>

            <div style={{ flex: 1 }}>
              {/* PASO 1: Docente y materia */}
              {step === 1 && (
                <section className="glass-panel p-8 rounded-3xl animate-slide-up">
                  <h2 className="font-festive text-gradient-aurora text-2xl mb-6">
                    Examen
                  </h2>

                  <div style={{ display: "grid", gap: 20 }}>
                    <div>
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                          color: "#4b5563",
                        }}
                      >
                        Nombre del docente
                      </label>
                      <input
                        className="input-aurora w-full p-3 rounded-xl"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="Ej: Prof. Gómez"
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                          color: "#4b5563",
                        }}
                      >
                        Asignatura
                      </label>

                      {profile?.institutions &&
                        profile.institutions.length > 0 &&
                        !manualSubjectMode ? (
                        <div className="bg-white/40 p-4 rounded-xl border border-white/50">
                          <div style={{ marginBottom: 12 }}>
                            <label className="text-xs text-gray-500 mb-1 block">
                              Universidad
                            </label>
                            <select
                              value={selectedUniName}
                              onChange={(e) => {
                                setSelectedUniName(e.target.value);
                                setSubject("");
                              }}
                              className="input-aurora w-full p-2 rounded-lg"
                            >
                              <option value="">-- Seleccionar --</option>
                              {profile.institutions.map((inst) => (
                                <option key={inst.id} value={inst.name}>
                                  {inst.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">
                              Materia
                            </label>
                            <select
                              value={subject}
                              onChange={(e) => setSubject(e.target.value)}
                              className="input-aurora w-full p-2 rounded-lg"
                            >
                              <option value="">-- Seleccionar --</option>
                              {profile.institutions
                                .find((i) => i.name === selectedUniName)
                                ?.subjects.map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="text-right mt-2">
                            <button
                              onClick={() => setManualSubjectMode(true)}
                              className="text-xs text-blue-600 underline"
                            >
                              No encuentro mi materia
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            className="input-aurora w-full p-3 rounded-xl"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Ej: Introducción a la Física"
                          />
                          {profile?.institutions?.length ? (
                            <button
                              onClick={() => setManualSubjectMode(false)}
                              className="text-xs text-blue-600 underline whitespace-nowrap"
                            >
                              Volver a lista
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                          color: "#4b5563",
                        }}
                      >
                        Modo de corrección
                      </label>
                      <select
                        className="input-aurora w-full p-3 rounded-xl"
                        value={gradingMode}
                        onChange={(e) => setGradingMode(e.target.value as any)}
                      >
                        <option value="auto">
                          Automático (Feedback inmediato)
                        </option>
                        <option value="manual">
                          Manual (Requiere revisión)
                        </option>
                      </select>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 13,
                            display: "block",
                            marginBottom: 6,
                            fontWeight: 500,
                            color: "#4b5563",
                          }}
                        >
                          Puntaje Máximo (opcional)
                        </label>
                        <input
                          type="number"
                          className="input-aurora w-full p-3 rounded-xl"
                          value={maxScore}
                          onChange={(e) => setMaxScore(e.target.value)}
                          placeholder="Ej: 100"
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 13,
                            display: "block",
                            marginBottom: 6,
                            fontWeight: 500,
                            color: "#4b5563",
                          }}
                        >
                          Apertura de revisión (opcional)
                        </label>
                        <input
                          type="datetime-local"
                          className="input-aurora w-full p-3 rounded-xl"
                          value={openAt}
                          onChange={(e) => setOpenAt(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => onSaveMeta(true)}
                        disabled={savingMeta}
                        className="btn-aurora-primary py-3 px-8 rounded-xl font-bold"
                      >
                        {savingMeta ? "Guardando..." : "Guardar y Continuar →"}
                      </button>
                    </div>
                    {info && (
                      <div className="text-green-600 bg-green-50 p-3 rounded-lg text-sm text-center">
                        {info}
                      </div>
                    )}
                    {err && (
                      <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm text-center">
                        {err}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* PASO 2: Config básica */}
              {step === 2 && (
                <section className="glass-panel p-8 rounded-3xl animate-slide-up">
                  <h2 className="font-festive text-gradient-aurora text-2xl mb-6">
                    Reglas del Juego
                  </h2>
                  <div style={{ display: "grid", gap: 20 }}>
                    <div>
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                          color: "#4b5563",
                        }}
                      >
                        Título del examen
                      </label>
                      <input
                        className="input-aurora w-full p-3 rounded-xl"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Final de Historia 2024"
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 13,
                            display: "block",
                            marginBottom: 6,
                            fontWeight: 500,
                            color: "#4b5563",
                          }}
                        >
                          Duración (minutos)
                        </label>
                        <input
                          type="number"
                          className="input-aurora w-full p-3 rounded-xl"
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(e.target.value)}
                          placeholder="Ej: 60"
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 13,
                            display: "block",
                            marginBottom: 6,
                            fontWeight: 500,
                            color: "#4b5563",
                          }}
                        >
                          Vidas (opcional)
                        </label>
                        <input
                          type="number"
                          className="input-aurora w-full p-3 rounded-xl"
                          value={lives}
                          onChange={(e) => setLives(e.target.value)}
                          placeholder="Ej: 3"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => saveAndOpenExam(true)}
                        disabled={savingExam}
                        className="btn-aurora-primary py-3 px-8 rounded-xl font-bold"
                      >
                        {savingExam
                          ? "Guardando..."
                          : "Guardar y Abrir Examen →"}
                      </button>
                    </div>
                    {info && (
                      <div className="text-green-600 bg-green-50 p-3 rounded-lg text-sm text-center">
                        {info}
                      </div>
                    )}
                    {err && (
                      <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm text-center">
                        {err}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* PASO 3: Preguntas */}
              {step === 3 && (
                <div className="animate-slide-up space-y-6">
                  {/* Formulario de Pregunta */}
                  <section className="glass-panel p-8 rounded-3xl border-2 border-white/50">
                    <h2 className="font-festive text-gradient-aurora text-2xl mb-6">
                      {editingQuestionId ? "Editar Desafío" : "Nuevo Desafío"}
                    </h2>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <select
                          className="input-aurora p-3 rounded-xl flex-1"
                          value={qKind}
                          onChange={(e) =>
                            setQKind(e.target.value as QuestionKind)
                          }
                        >
                          <option value="MCQ">Opción Múltiple</option>
                          <option value="TRUE_FALSE">Verdadero / Falso</option>
                          <option value="SHORT_TEXT">Texto Corto</option>
                          <option value="FILL_IN">Completar Espacios</option>
                        </select>
                        <input
                          type="number"
                          className="input-aurora p-3 rounded-xl w-24 text-center"
                          placeholder="Pts"
                          value={qPoints}
                          onChange={(e) => setQPoints(Number(e.target.value))}
                        />
                      </div>

                      <textarea
                        className="input-aurora w-full p-4 rounded-xl"
                        rows={3}
                        placeholder={
                          qKind === "FILL_IN"
                            ? "El [cielo] es azul."
                            : "Escribe la consigna aquí..."
                        }
                        value={qStem}
                        onChange={(e) => setQStem(e.target.value)}
                      />

                      {/* Lógica específica por tipo */}
                      {qKind === "MCQ" && (
                        <div className="space-y-2 pl-4 border-l-2 border-purple-200">
                          <label className="text-xs font-bold text-purple-600 uppercase">
                            Opciones (marca la correcta)
                          </label>
                          {mcqChoices.map((c, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <input
                                type="radio"
                                name="mcq_correct"
                                checked={mcqCorrect === i}
                                onChange={() => setMcqCorrect(i)}
                                className="accent-pink-600 w-5 h-5"
                              />
                              <input
                                className="input-aurora flex-1 p-2 rounded-lg"
                                value={c}
                                onChange={(e) => {
                                  const copy = [...mcqChoices];
                                  copy[i] = e.target.value;
                                  setMcqChoices(copy);
                                }}
                                placeholder={`Opción ${i + 1}`}
                              />
                              <button
                                onClick={() => {
                                  const copy = mcqChoices.filter(
                                    (_, idx) => idx !== i
                                  );
                                  setMcqChoices(copy);
                                  if (mcqCorrect >= copy.length)
                                    setMcqCorrect(Math.max(0, copy.length - 1));
                                }}
                                className="text-red-400 hover:text-red-600 p-1"
                              >
                                ✖
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setMcqChoices([...mcqChoices, ""])}
                            className="text-sm text-purple-600 font-bold hover:underline mt-2"
                          >
                            + Agregar opción
                          </button>
                        </div>
                      )}

                      {qKind === "TRUE_FALSE" && (
                        <div className="flex gap-4 pl-4">
                          <label
                            className={`cursor-pointer px-4 py-2 rounded-lg border transition-all ${tfCorrect
                              ? "bg-green-100 border-green-300 text-green-700"
                              : "bg-white border-gray-200"
                              }`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={tfCorrect}
                              onChange={() => setTfCorrect(true)}
                            />
                            Verdadero
                          </label>
                          <label
                            className={`cursor-pointer px-4 py-2 rounded-lg border transition-all ${!tfCorrect
                              ? "bg-red-100 border-red-300 text-red-700"
                              : "bg-white border-gray-200"
                              }`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={!tfCorrect}
                              onChange={() => setTfCorrect(false)}
                            />
                            Falso
                          </label>
                        </div>
                      )}

                      {qKind === "FILL_IN" && (
                        <div className="pl-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Palabras Distractoras (Opcional)
                          </label>
                          <input
                            className="input-aurora w-full p-3 rounded-lg"
                            placeholder="Ej: rojo, verde, mar"
                            value={fillDistractorsText}
                            onChange={(e) =>
                              setFillDistractorsText(e.target.value)
                            }
                          />
                          <p className="text-xs text-gray-400 mt-2">
                            En el enunciado escribí las respuestas correctas entre [corchetes].
                            <br />
                            En esta lista agregá SOLO palabras distractoras; el sistema va a sumar automáticamente las respuestas correctas.
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 mt-6 border-t pt-4 border-white/20">
                        {editingQuestionId && (
                          <button
                            onClick={resetQuestionForm}
                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={saveQuestion}
                          disabled={savingQuestion}
                          className="btn-aurora-primary py-2 px-6 rounded-lg font-bold shadow-lg"
                        >
                          {savingQuestion
                            ? "Guardando..."
                            : editingQuestionId
                              ? "Actualizar Pregunta"
                              : "Agregar Pregunta"}
                        </button>
                      </div>
                      {questionErr && (
                        <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                          {questionErr}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Listado de Preguntas */}
                  <section>
                    <h3 className="text-lg font-bold text-gray-700 mb-4 pl-2">
                      Preguntas Cargadas ({questions.length})
                    </h3>
                    {loadingQuestions ? (
                      <div className="glass-panel p-4 text-center">
                        Cargando...
                      </div>
                    ) : questions.length === 0 ? (
                      <div className="text-gray-400 italic pl-2">
                        Aún no hay preguntas. ¡Agregá la primera arriba!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {questions.map((q, i) => (
                          <div
                            key={q.id}
                            className="glass-panel p-4 rounded-xl flex justify-between items-start hover:bg-white/40 transition-colors"
                          >
                            <div>
                              <div className="text-xs font-bold text-purple-600 mb-1">
                                {i + 1}. {q.kind} ({q.points} pts)
                              </div>
                              <div className="text-gray-800 font-medium">
                                {q.stem}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditQuestion(q)}
                                className="p-2 hover:bg-blue-100 rounded-full text-blue-600"
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteQuestion(q.id)}
                                className="p-2 hover:bg-red-100 rounded-full text-red-600"
                                title="Borrar"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="border-t border-white/30 pt-4 flex justify-end">
                    <button
                      onClick={() => setStep(4)}
                      className="btn-aurora px-6 py-3 rounded-xl"
                    >
                      Ir al Tablero →
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 4: Tablero */}
              {step === 4 && (
                <>
                  <div className="animate-slide-up space-y-6">
                    <div className="glass-panel p-0 rounded-3xl overflow-hidden flex flex-col min-h-[600px]">
                      <div className="p-4 bg-white/40 font-bold text-gray-700 border-b border-white/20">
                        Monitoreo en Vivo
                      </div>
                      <div className="flex-1 overflow-auto bg-white/30">
                        <BoardClient code={code} />
                      </div>
                    </div>
                  </div>

                  {/* Floating Exam Link - Top Right (Moved outside animation) */}
                  <button
                    onClick={copyStudentLink}
                    style={{
                      position: "fixed",
                      top: 96,
                      right: 24,
                      zIndex: 9999,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 12px",
                      borderRadius: 999,
                      cursor: "pointer",
                      background: "rgba(255, 255, 255, 0.75)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(255,255,255,0.8)",
                      boxShadow: "0 4px 16px rgba(31, 38, 135, 0.1)",
                      transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                      transform: linkCopied ? "scale(1.05)" : "scale(1)"
                    }}
                    onMouseEnter={(e) => {
                      if (!linkCopied) e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.75)";
                    }}
                  >
                    <span className="text-lg">{linkCopied ? "✅" : "🔗"}</span>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">
                        Link Examen
                      </span>
                      <span className={`text-xs font-mono font-bold text-[#1e1b4b] transition-colors ${linkCopied ? "text-green-600" : ""}`}>
                        {linkCopied ? "¡Copiado!" : code}
                      </span>
                    </div>
                  </button>

                  {/* Move outside of animate-slide-up to avoid transform trapping position:fixed */}
                  <FloatingChatShell label="Chat">
                    <ExamChat
                      code={code}
                      role="teacher"
                      defaultName="Docente"
                    />
                  </FloatingChatShell>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
