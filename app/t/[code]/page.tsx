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
  // Temporary FE only field for editing
  // ...
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
            const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
              d.getDate()
            )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      if (step !== 1) return;
      setProfile(loadTeacherProfile());
    }, [step]);

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
          university: selectedUniName.trim() || null,
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
  async function closeExam() {
    if (!examId) return;
    setSavingExam(true);
    setErr(null);
    setInfo(null);

    try {
      const body: any = {
        isOpen: false,
      };

      // Mandamos también la config básica, igual que cuando abrimos
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

      setIsOpen(false);
      setInfo("Examen cerrado.");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Error al cerrar el examen");
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-xl font-festive text-gradient-aurora animate-pulse gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-indigo-400 animate-spin" />
        Cargando examen...
      </div>
    );
  }

  if (err)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
        <div className="glass-panel p-8 rounded-3xl text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-500 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{err}</p>
          <button
            onClick={() => (window.location.href = "/t")}
            className="btn-aurora w-full py-3 rounded-xl font-bold"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );

  return (
    <div className="relative z-10 w-full min-h-screen flex flex-col md:flex-row p-4 md:p-6 gap-6">
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-72 glass-panel p-6 rounded-3xl h-[calc(100vh-3rem)] sticky top-6">
        <div className="mb-8">
          <Link
            href="/t"
            className="text-xs font-bold text-gray-500 hover:text-indigo-600 mb-3 transition-colors flex items-center gap-1 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>{" "}
            Volver
          </Link>

          <h1
            className="font-festive text-gradient-aurora 
             text-2xl md:text-2,5xl 
             font-bold 
             leading-tight 
             mt-4 
             text-center 
             w-full px-2,5"
          >
            Configuración
          </h1>

          {/* ID del examen oculto a pedido del usuario */}
        </div>

        <nav className="flex flex-col gap-2">
          {steps.map((s) => {
            const isActive = step === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-3 ${
                  isActive
                    ? "btn-aurora shadow-sm"
                    : "text-gray-500 hover:bg-white/20 hover:text-gray-700 hover:pl-5"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isActive ? "bg-indigo-500" : "bg-gray-300"
                  }`}
                />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-200/50">
          <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
            Estado del Examen
          </div>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold
    ${
      isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
    }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOpen ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {isOpen ? "Abierto" : "Cerrado"}
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden glass-panel p-4 rounded-2xl flex items-center justify-between sticky top-0 z-50">
        <span className="font-festive text-xl font-bold text-gradient-aurora">
          Configuración
        </span>
        <button
          onClick={() => (window.location.href = "/t")}
          className="btn-aurora text-xs font-bold px-3 py-1.5 rounded-lg"
        >
          Salir
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-5xl mx-auto h-[calc(100vh-3rem)] overflow-y-auto scrollbar-hide pb-20 md:pb-0">
        <div className="glass-panel p-6 md:p-10 rounded-3xl min-h-full animate-slide-up">
          {/* ERROR / INFO TOASTS */}
          {(info || err) && (
            <div
              className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-center gap-3 shadow-sm ${
                err
                  ? "bg-red-50 text-red-600 border border-red-100"
                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
              }`}
            >
              <span>{err ? "⚠️" : "✅"}</span>
              {err || info}
            </div>
          )}

          {/* STEP 1: DOCENTE Y MATERIA */}
          {step === 1 && (
            <div className="space-y-8 max-w-2xl">
              <div>
                <h2 className="font-festive text-4xl text-gradient-aurora mb-2">
                  Docente y Materia
                </h2>
                <p className="text-gray-500 font-medium">
                  Información institucional básica.
                </p>
              </div>

              <div className="space-y-5">
                {selectedUniName && (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-indigo-800 text-sm font-medium flex items-center gap-2">
                    🏛️ <span className="font-bold">Institución:</span>{" "}
                    {selectedUniName}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">
                    Nombre del Docente
                  </label>
                  <input
                    className="input-aurora w-full p-4 rounded-2xl"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="Tu nombre completo"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">
                    Materia / Asignatura
                  </label>

                  {profile?.institutions &&
                  profile.institutions.length > 0 &&
                  !manualSubjectMode ? (
                    <div className="bg-white/50 p-4 rounded-2xl border border-white/60 space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-black-500 ml-1">
                          Universidad
                        </label>
                        <select
                          className="input-aurora w-full p-3 rounded-xl text-sm"
                          value={selectedUniName}
                          onChange={(e) => {
                            setSelectedUniName(e.target.value);
                            setSubject("");
                          }}
                        >
                          <option value="">-- Seleccionar --</option>
                          {profile.institutions.map((i) => (
                            <option key={i.id} value={i.name}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-black-500 ml-1">
                          Materia
                        </label>
                        <select
                          className="input-aurora w-full p-3 rounded-xl text-sm"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
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
                      <button
                        onClick={() => setManualSubjectMode(true)}
                        className="text-xs text-black-500 font-bold hover:underline pl-1"
                      >
                        No encuentro mi materia (Ingresar manual)
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        className="input-aurora w-full p-4 rounded-2xl"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ej: Matemática II"
                      />
                      {profile?.institutions && (
                        <button
                          onClick={() => setManualSubjectMode(false)}
                          className="btn-aurora w-12 flex items-center justify-center rounded-2xl text-lg backdrop-blur-md"
                          title="Volver a la lista"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">
                      Modo de Corrección
                    </label>
                    <select
                      className="input-aurora w-full p-4 rounded-2xl"
                      value={gradingMode}
                      onChange={(e) =>
                        setGradingMode(e.target.value as "auto" | "manual")
                      }
                    >
                      <option value="auto">
                        Automático (Feedback inmediato)
                      </option>
                      <option value="manual">Manual (Requiere revisión)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">
                      Puntaje Máximo
                    </label>
                    <input
                      type="number"
                      className="input-aurora w-full p-4 rounded-2xl"
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">
                    Fecha de Apertura (Opcional)
                  </label>
                  <input
                    type="datetime-local"
                    className="input-aurora w-full p-4 rounded-2xl text-gray-600"
                    value={openAt}
                    onChange={(e) => setOpenAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-8 flex justify-end">
                <button
                  onClick={() => onSaveMeta(true)}
                  className="btn-aurora-primary px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all"
                >
                  Guardar y Continuar →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CONFIGURACIÓN BÁSICA */}
          {step === 2 && (
            <div className="space-y-8 max-w-2xl">
              <div>
                <h2 className="font-festive text-4xl text-gradient-aurora mb-2">
                  Configuración Básica
                </h2>
                <p className="text-gray-500 font-medium">
                  Define las reglas del examen.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">
                    Título del Examen
                  </label>
                  <input
                    className="input-aurora w-full p-4 rounded-2xl"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Primer Parcial"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">
                      Duración (minutos)
                    </label>
                    <input
                      type="number"
                      className="input-aurora w-full p-4 rounded-2xl"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="Ej: 60"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">
                      Vidas / Intentos
                    </label>
                    <input
                      type="number"
                      className="input-aurora w-full p-4 rounded-2xl"
                      value={lives}
                      onChange={(e) => setLives(e.target.value)}
                      placeholder="0 = ilimitado"
                    />
                  </div>
                </div>

                <div className="bg-white/40 p-5 rounded-2xl border border-white/60 mt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isOpen ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                    />
                    <span className="font-bold text-gray-800">
                      Estado del examen: {isOpen ? "Abierto" : "Cerrado"}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-4 px-1">
                    Cuando el examen está abierto, los alumnos pueden ingresar
                    con el código.
                  </p>

                  <div className="flex gap-3">
                    {isOpen ? (
                      <button
                        type="button"
                        onClick={closeExam}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-200 transition-colors disabled:opacity-60"
                        disabled={savingExam}
                      >
                        Cerrar examen
                      </button>
                    ) : (
                      <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg inline-block">
                        Actualmente cerrado. Se abrirá cuando guardes con
                        “Guardar y Siguiente”.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 flex justify-end gap-4">
                  <button
                    onClick={() => saveAndOpenExam(false)}
                    className="btn-aurora px-6 py-3 rounded-xl font-bold text-sm text-gray-600"
                  >
                    Solo Guardar
                  </button>
                  <button
                    onClick={() => saveAndOpenExam(true)}
                    className="btn-aurora-primary px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all"
                  >
                    Guardar y Siguiente →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREGUNTAS */}
          {step === 3 && (
            <div className="h-full flex flex-col">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-100/50 pb-6 mb-6 gap-4">
                <div>
                  <h2 className="font-festive text-4xl text-gradient-aurora mb-2">
                    Preguntas
                  </h2>
                  <p className="text-gray-500 font-medium">
                    Carga las preguntas y respuestas correctas.
                  </p>
                  <button
                    onClick={reloadQuestions}
                    className="text-xs text-gray-500 font-bold hover:underline mt-1 bg-transparent border-none p-0 cursor-pointer"
                  >
                    🔄 Recargar lista
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* LISTA DE PREGUNTAS */}
                <div className="lg:col-span-4 flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-2">
                  {questions.length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 text-sm font-medium">
                      No hay preguntas cargadas.
                    </div>
                  )}
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      onClick={() => startEditQuestion(q)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
                        editingQuestionId === q.id
                          ? "bg-indigo-50 border-indigo-200 shadow-sm"
                          : "bg-white/40 border-white/60 hover:bg-white/60 hover:border-indigo-100"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md mb-2 inline-block ${
                            editingQuestionId === q.id
                              ? "bg-indigo-200 text-indigo-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {q.kind} • {q.points} pt
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteQuestion(q.id);
                          }}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 font-bold"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-xs text-gray-700 font-medium line-clamp-2">
                        {idx + 1}. {q.stem}
                      </p>
                    </div>
                  ))}

                <button
                  onClick={resetQuestionForm}
                  className="btn-aurora w-full py-3 rounded-xl font-bold text-sm mt-2 border-dashed border-2 transition-colors"
                >
                  + Nueva Pregunta
                </button>
                </div>

                {/* FORMULARIO DE EDICIÓN */}
                <div className="lg:col-span-8 bg-white/30 p-6 rounded-3xl border border-white/50">
                  <h3 className="text-lg font-extrabold text-indigo-950 mb-4 flex items-center gap-2">
                    {editingQuestionId
                      ? "✏️ Editando Pregunta"
                      : "✨ Nueva Pregunta"}
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 ml-1">
                          Tipo
                        </label>
                        <select
                          className="input-aurora w-full p-2.5 rounded-xl text-sm"
                          value={qKind}
                          onChange={(e) =>
                            setQKind(e.target.value as QuestionKind)
                          }
                        >
                          <option value="MCQ">Opción Múltiple</option>
                          <option value="TRUE_FALSE">Verdadero / Falso</option>
                          <option value="SHORT_TEXT">Texto Corto</option>
                          <option value="FILL_IN">Completar (Fill in)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 ml-1">
                          Puntos
                        </label>
                        <input
                          type="number"
                          className="input-aurora w-full p-2.5 rounded-xl text-sm"
                          value={qPoints}
                          onChange={(e) => setQPoints(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-600 ml-1">
                        Enunciado / Consigna
                      </label>
                      <textarea
                        className="input-aurora w-full p-3 rounded-xl text-sm font-medium min-h-[80px]"
                        value={qStem}
                        onChange={(e) => setQStem(e.target.value)}
                        placeholder="Escribe la pregunta aquí..."
                      />
                      {qKind === "FILL_IN" && (
                        <p className="text-[10px] text-indigo-600 pl-1 mt-1">
                          Usa [corchetes] para las respuestas a completar. Ej:
                          La capital de Francia es [París].
                        </p>
                      )}
                    </div>

                    {/* Renderizado condicional segun tipo */}
                    {qKind === "MCQ" && (
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-bold text-gray-600 ml-1">
                          Opciones
                        </label>
                        {mcqChoices.map((choice, idx) => (
                          <div key={idx} className="flex gap-2">
                            <button
                              onClick={() => setMcqCorrect(idx)}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg transition-all ${
                                mcqCorrect === idx
                                  ? "btn-aurora-primary"
                                  : "btn-aurora"
                              }`}
                              title="Marcar como correcta"
                            >
                              {mcqCorrect === idx ? "✓" : idx + 1}
                            </button>
                            <input
                              className={`input-aurora flex-1 p-2 rounded-xl text-sm ${
                                mcqCorrect === idx
                                  ? "font-semibold text-emerald-900 bg-emerald-50/50"
                                  : ""
                              }`}
                              value={choice}
                              onChange={(e) => {
                                const n = [...mcqChoices];
                                n[idx] = e.target.value;
                                setMcqChoices(n);
                              }}
                              placeholder={`Opción ${idx + 1}`}
                            />
                            <button
                              onClick={() => {
                                const n = [...mcqChoices];
                                n.splice(idx, 1);
                                setMcqChoices(n);
                              }}
                              className="w-10 h-10 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-xl font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setMcqChoices([...mcqChoices, ""])}
                          className="text-xs font-bold text-gray-600 hover:underline pl-1 cursor-pointer"
                        >
                          + Agregar opción
                        </button>
                      </div>
                    )}

                    {qKind === "TRUE_FALSE" && (
                      <div className="flex gap-4 pt-2">
                        <button
                          onClick={() => setTfCorrect(true)}
                          className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                            tfCorrect
                              ? "btn-aurora-primary"
                              : "btn-aurora"
                          }`}
                        >
                          Verdadero
                        </button>
                        <button
                          onClick={() => setTfCorrect(false)}
                          className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                            !tfCorrect
                              ? "btn-aurora-primary"
                              : "btn-aurora"
                          }`}
                        >
                          Falso
                        </button>
                      </div>
                    )}

                    {qKind === "SHORT_TEXT" && (
                      <div className="pt-2">
                        <label className="text-xs font-bold text-gray-600 ml-1">
                          Respuesta Correcta (Exacta)
                        </label>
                        <input
                          className="input-aurora w-full p-3 rounded-xl mt-1"
                          value={shortAnswer}
                          onChange={(e) => setShortAnswer(e.target.value)}
                          placeholder="Respuesta"
                        />
                      </div>
                    )}

                    {qKind === "FILL_IN" && (
                      <div className="pt-2">
                        <label className="text-xs font-bold text-gray-600 ml-1">
                          Palabras distractoras (Separadas por comas)
                        </label>
                        <textarea
                          className="input-aurora w-full p-3 rounded-xl mt-1 text-sm h-20"
                          value={fillDistractorsText}
                          onChange={(e) =>
                            setFillDistractorsText(e.target.value)
                          }
                          placeholder="Ej: blanco, azul, grande..."
                        />
                      </div>
                    )}

                    {/* ERRORES DEL FORM */}
                    {questionErr && (
                      <div className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg text-center">
                        {questionErr}
                      </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                      {editingQuestionId && (
                        <button
                          onClick={resetQuestionForm}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={saveQuestion}
                        disabled={savingQuestion}
                        className="btn-aurora-primary px-6 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {savingQuestion
                          ? "Guardando..."
                          : editingQuestionId
                          ? "Actualizar"
                          : "Guardar Pregunta"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200/50 flex justify-end">
                <button
                  onClick={() => setStep(4)}
                  className="btn-aurora flex items-center gap-2 px-6 py-3 rounded-xl overflow-hidden group"
                >
                  Ir al Tablero{" "}
                  <span className="group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: TABLERO / CHAT */}
          {step === 4 && (
            <div className="h-full flex flex-col">
              <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                  <h2 className="font-festive text-4xl text-gradient-aurora mb-2">
                    Tablero de Control
                  </h2>
                  <p className="text-gray-500 font-medium">
                    Monitorea a los alumnos en tiempo real.
                  </p>
                </div>
                <button
                  onClick={copyStudentLink}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
                    linkCopied ? "btn-aurora-primary" : "btn-aurora"
                  }`}
                >
                  <span className="text-lg">{linkCopied ? "✅" : "🔗"}</span>
                  {linkCopied ? "¡Link Copiado!" : "Copiar Link Examen"}
                </button>
              </div>

              <div className="flex-1 glass-panel p-0 rounded-3xl overflow-hidden flex flex-col border border-white/50">
                <div className="p-3 bg-white/40 border-b border-white/20 text-xs font-bold text-gray-700 uppercase tracking-wider flex justify-between items-center px-6">
                  <span>Vista en vivo</span>
                  <span
                    className="w-2 h-2 rounded-full bg-red-500 animate-pulse"
                    title="Live"
                  />
                </div>
                <div className="flex-1 bg-white/20 relative">
                  <BoardClient code={code} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* CHAT FLOTANTE: SOLO EN STEP 4 */}
      {step === 4 && (
        <div className="fixed bottom-6 right-6 z-[120]">
          <FloatingChatShell label="Chat">
            <ExamChat
              code={code}
              role="teacher"
              defaultName={teacherName || "Docente"}
            />
          </FloatingChatShell>
        </div>
      )}
    </div>
  );
}
