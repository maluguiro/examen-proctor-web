"use client";

import * as React from "react";
import { API } from "@/lib/api";
import ExamChat from "@/components/ExamChat";
import FloatingChatShell from "@/components/FloatingChatShell";
import NatureCaustics from "@/components/NatureCaustics";

type QKind = "MCQ" | "TRUE_FALSE" | "SHORT" | "FIB";

type PaperQuestion = {
  id: string;
  kind: QKind;
  stem: string;
  choices: string[] | null;
  points: number;
};

type Step = "name" | "exam" | "submitting" | "submitted" | "review";

type SubmitResponse = {
  ok: boolean;
  gradingMode: "auto" | "manual";
  score: number | null;
  maxScore: number | null;
};

// Normaliza el kind que viene del backend al que usamos en el front
function mapKind(raw: string): QKind {
  const k = String(raw || "").toUpperCase();
  if (k === "TRUE_FALSE") return "TRUE_FALSE";
  if (k === "MCQ") return "MCQ";
  if (k === "FIB" || k === "FILL_IN") return "FIB";
  return "SHORT";
}

// Divide el enunciado de FIB en partes: texto y huecos.
function fibParseToParts(stem: string) {
  const parts: Array<{ type: "text" | "box"; idx?: number; text?: string }> =
    [];
  const re = /\[\[(.*?)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let box = 0;

  while ((m = re.exec(stem)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", text: stem.slice(last, m.index) });
    }
    parts.push({ type: "box", idx: box++ });
    last = m.index + m[0].length;
  }

  if (last < stem.length) {
    parts.push({ type: "text", text: stem.slice(last) });
  }

  if (!parts.length) {
    parts.push({ type: "text", text: stem });
  }

  return parts;
}

function shuffleArrayWithSeed<T>(items: T[], seedString: string): T[] {
  const arr = [...items];

  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
  }

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export default function StudentPage({ params }: { params: { code: string } }) {
  const { code } = params;

  const [step, setStep] = React.useState<Step>("name");
  const [studentName, setStudentName] = React.useState("");
  const [attemptId, setAttemptId] = React.useState<string | null>(null);

  const [exam, setExam] = React.useState<{
    title: string;
    code: string;
    openAt?: string | null;
  } | null>(null);

  const [questions, setQuestions] = React.useState<PaperQuestion[]>([]);
  const [loadingPaper, setLoadingPaper] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [lives, setLives] = React.useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  const [flash, setFlash] = React.useState(false);

  const [showFullscreenWarning, setShowFullscreenWarning] =
    React.useState(false);
  const [lastViolationType, setLastViolationType] = React.useState<
    string | null
  >(null);
  const [fullscreenHint, setFullscreenHint] = React.useState<string | null>(
    null
  );

  const [reviewModal, setReviewModal] = React.useState<{
    title: string;
    body: string;
  } | null>(null);

  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  const [gradingMode, setGradingMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [score, setScore] = React.useState<number | null>(null);
  const [maxScore, setMaxScore] = React.useState<number | null>(null);

  function logDevError(label: string, detail?: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error(label, detail);
    }
  }

  function setFriendlyError(detail?: any) {
    setErr("Hubo un error. Reintentá.");
    logDevError("STUDENT_ERROR_DETAIL", detail);
  }

  const retryLoad = React.useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const handleReturnToExam = React.useCallback(() => {
    const target = document.documentElement;

    if (!document.fullscreenElement) {
      if (!target.requestFullscreen) {
        console.warn("Fullscreen no disponible en este navegador.");
        setFullscreenHint("Hacé click otra vez para reactivar pantalla completa.");
        return;
      }

      const request = target.requestFullscreen();
      setFullscreenHint(null);

      if (request && typeof request.then === "function") {
        request
          .then(() => {
            setShowFullscreenWarning(false);
            setFullscreenHint(null);
          })
          .catch((e) => {
            console.warn("No se pudo reactivar pantalla completa:", e);
            setFullscreenHint(
              "Hacé click otra vez para reactivar pantalla completa."
            );
          });
        return;
      }
    }

    setShowFullscreenWarning(false);
    setFullscreenHint(null);
  }, []);

  // IMPORTANT: apaga el fondo global viejo SOLO en esta ruta (alumno)
  React.useEffect(() => {
    document.body.classList.add("student-shell");
    return () => document.body.classList.remove("student-shell");
  }, []);

  const canViewReview = React.useMemo(() => {
    const hasScore =
      gradingMode === "auto" || (gradingMode === "manual" && score !== null);
    const openAtTime = exam?.openAt ? new Date(exam.openAt).getTime() : 0;
    const isTimeReached = openAtTime === 0 || Date.now() >= openAtTime;
    return hasScore && isTimeReached;
  }, [gradingMode, score, exam?.openAt]);

  React.useEffect(() => {
    if (step === "review" && !canViewReview) {
      setStep("submitted");
    }
  }, [step, canViewReview]);

  function formatReviewDate(openAt?: string | null) {
    if (!openAt) return "Próximamente";
    const d = new Date(openAt);
    return (
      d
        .toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .replace(",", " · ") + " hs"
    );
  }

  const Header = (
    <div
      className="glass-panel"
      style={{
        padding: "16px 24px",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 1,
          opacity: 0.6,
        }}
      >
        Alumno · Modo examen
      </div>
      <div
        className="font-festive text-gradient-aurora"
        style={{
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {exam?.title || "Examen"}
      </div>
      <div style={{ fontSize: 13, opacity: 0.6 }}>
        Código: <b>{exam?.code}</b>
      </div>
    </div>
  );

  // Cargar paper/meta
  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoadingPaper(true);

        const [paperRes, metaRes] = await Promise.all([
          fetch(`${API}/exams/${code}/paper`),
          fetch(`${API}/exams/${code}/meta`),
        ]);

        if (!paperRes.ok) {
          throw new Error(`Error al cargar examen (${paperRes.status})`);
        }

        const data = await paperRes.json();
        const meta = metaRes.ok ? await metaRes.json() : {};
        if (cancelled) return;

        const rawQs: any[] = Array.isArray(data.questions)
          ? data.questions
          : [];

        setExam({
          title: data.exam?.title || "Examen",
          code: data.exam?.code || code,
          openAt: meta.openAt || null,
        });

        setQuestions(
          rawQs.map((q) => ({
            id: String(q.id),
            kind: mapKind(q.kind),
            stem: String(q.stem ?? ""),
            choices: Array.isArray(q.choices)
              ? q.choices.map((x: any) => String(x ?? ""))
              : null,
            points: Number(q.points ?? 1) || 1,
          }))
        );
      } catch (e: any) {
        logDevError("PAPER_LOAD_ERROR", e);
        if (!cancelled) setFriendlyError(e);
      } finally {
        if (!cancelled) setLoadingPaper(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, reloadKey]);

  // Summary (vidas/time)
  const refreshSummary = React.useCallback(async () => {
    if (!attemptId) return;
    try {
      const r = await fetch(`${API}/attempts/${attemptId}/summary`);
      if (!r.ok) return;
      const data = await r.json();
      if (typeof data.remaining === "number") setLives(data.remaining);
      if (typeof data.secondsLeft === "number")
        setSecondsLeft(data.secondsLeft);
    } catch (e) {
      console.error("SUMMARY_ERROR", e);
    }
  }, [attemptId]);

  React.useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await refreshSummary();
      if (!cancelled) setTimeout(tick, 5000);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [attemptId, refreshSummary]);

  const startAttempt = React.useCallback(async () => {
    if (!studentName.trim()) {
      setErr("Ingresá tu nombre antes de comenzar.");
      return;
    }
    setErr(null);

    try {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        console.warn("No se pudo entrar en fullscreen:", e);
      }

      const r = await fetch(`${API}/exams/${code}/attempts/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: studentName.trim() }),
      });

      if (!r.ok) {
        throw new Error(`No se pudo iniciar el intento (${r.status})`);
      }

      const data = await r.json();
      const at = data.attempt;

      setAttemptId(at.id);
      setStep("exam");
      await refreshSummary();
    } catch (e: any) {
      logDevError("START_ATTEMPT_ERROR", e);
      setFriendlyError(e);
    }
  }, [code, studentName, refreshSummary]);

  const handleRetry = React.useCallback(() => {
    if (step === "name") {
      startAttempt();
      return;
    }
    retryLoad();
  }, [retryLoad, startAttempt, step]);

  const submitAttempt = React.useCallback(
    async (reason: "manual" | "time" | "lives") => {
      if (!attemptId) return;
      setErr(null);
      setStep("submitting");

      try {
        const payload = {
          answers: questions.map((q) => {
            const v = answers[q.id];
            if (q.kind === "FIB") {
              const parts = fibParseToParts(q.stem || "");
              const boxCount = parts.filter((p) => p.type === "box").length;

              const rawArray = Array.isArray(v) ? v : [];
              const cleanArray = [];

              for (let i = 0; i < boxCount; i++) {
                const val = rawArray[i];
                cleanArray.push(val ? String(val) : "");
              }

              return { questionId: q.id, value: cleanArray };
            }
            return { questionId: q.id, value: v };
          }),
          reason,
        };

        const r = await fetch(`${API}/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || "Error al enviar el intento");
        }

        const data: SubmitResponse = await r.json();

        setGradingMode(data.gradingMode);
        setScore(data.score ?? null);
        setMaxScore(data.maxScore ?? null);
        setStep("submitted");
      } catch (e: any) {
        logDevError("SUBMIT_ATTEMPT_ERROR", e);
        setFriendlyError(e);
        setStep("exam");
      }
    },
    [attemptId, answers, questions]
  );

  const handleOpenReview = React.useCallback(() => {
    if (!attemptId) return;
    const url = `${API}/attempts/${attemptId}/review.print`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [attemptId]);

  const reportViolation = React.useCallback(
    async (type: string, meta?: any) => {
      if (!attemptId) return;
      try {
        const r = await fetch(`${API}/attempts/${attemptId}/antifraud`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, meta }),
        });

        if (!r.ok) {
          console.error("ANTIFRAUD_HTTP_ERROR", r.status);
          return;
        }

        const data = await r.json();

        if (typeof data.remaining === "number") {
          setLives(data.remaining);
          if (data.remaining <= 0) {
            await submitAttempt("lives");
            return;
          }
        }

        setFlash(true);
        setTimeout(() => setFlash(false), 400);

        setLastViolationType(type);
        setShowFullscreenWarning(true);

        await refreshSummary();
      } catch (err) {
        console.error("Antifraude error", err);
      }
    },
    [attemptId, refreshSummary, submitAttempt]
  );

  React.useEffect(() => {
    if (!attemptId || step !== "exam") return;

    const onBlur = () => reportViolation("blur");
    const onVisibility = () => {
      if (document.visibilityState === "hidden")
        reportViolation("visibility-hidden");
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) reportViolation("fullscreen-exit");
    };
    const onClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(e.type);
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onClipboard);
    document.addEventListener("cut", onClipboard);
    document.addEventListener("paste", onClipboard);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onClipboard);
      document.removeEventListener("cut", onClipboard);
      document.removeEventListener("paste", onClipboard);
    };
  }, [attemptId, reportViolation, step]);

  function renderQuestion(q: PaperQuestion, idx: number) {
    const commonBox = "glass-panel p-6 mb-4 rounded-2xl animate-slide-up";
    const kind = mapKind(q.kind as string);

    if (kind === "TRUE_FALSE") {
      const v = String(answers[q.id] ?? "");
      return (
        <div
          key={q.id}
          className={commonBox}
          style={{ animationDelay: `${idx * 0.1}s` }}
        >
          <div style={{ marginBottom: 12 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`tf-${q.id}`}
                checked={v === "true"}
                onChange={() =>
                  setAnswers((prev) => ({ ...prev, [q.id]: "true" }))
                }
                className="accent-emerald-500 w-4 h-4"
              />
              Verdadero
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`tf-${q.id}`}
                checked={v === "false"}
                onChange={() =>
                  setAnswers((prev) => ({ ...prev, [q.id]: "false" }))
                }
                className="accent-emerald-500 w-4 h-4"
              />
              Falso
            </label>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    if (kind === "MCQ") {
      const v = Number(answers[q.id]);
      return (
        <div
          key={q.id}
          className={commonBox}
          style={{ animationDelay: `${idx * 0.1}s` }}
        >
          <div style={{ marginBottom: 12 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>
          <div className="flex flex-col gap-2">
            {(q.choices || []).map((c, i) => (
              <label
                key={i}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/30 transition-colors"
              >
                <input
                  type="radio"
                  name={`mcq-${q.id}`}
                  checked={v === i}
                  onChange={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: i }))
                  }
                  className="accent-emerald-500 w-4 h-4"
                />
                {c}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    if (kind === "SHORT") {
      return (
        <div
          key={q.id}
          className={commonBox}
          style={{ animationDelay: `${idx * 0.1}s` }}
        >
          <div style={{ marginBottom: 12 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>
          <textarea
            value={String(answers[q.id] ?? "")}
            onChange={(e) => {
              const val = e.target.value;
              setAnswers((prev) => ({ ...prev, [q.id]: val }));
            }}
            placeholder="Escribe tu respuesta…"
            rows={4}
            maxLength={2000}
            className="input-aurora w-full p-4 rounded-2xl resize-y"
          />
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    if (kind === "FIB") {
      const parts = fibParseToParts(q.stem || "");
      const vArr: string[] = Array.isArray(answers[q.id])
        ? (answers[q.id] as string[])
        : [];

      const setAt = (ix: number, val: string) => {
        setAnswers((prev) => {
          const raw = prev[q.id];
          const next = Array.isArray(raw) ? [...raw] : [];
          next[ix] = val;
          return { ...prev, [q.id]: next };
        });
      };

      const rawChoices = Array.isArray(q.choices)
        ? q.choices.filter((w) => typeof w === "string" && w.trim().length > 0)
        : [];

      const unique = Array.from(new Set(rawChoices));
      const bank = shuffleArrayWithSeed(unique, q.id);

      return (
        <div
          key={q.id}
          className={commonBox}
          style={{ animationDelay: `${idx * 0.1}s` }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{idx + 1}.</div>
          <div className="flex flex-wrap gap-2 items-center">
            {parts.map((p, i) =>
              p.type === "text" ? (
                <span key={i}>{p.text}</span>
              ) : (
                <input
                  key={i}
                  placeholder={`Casillero ${p.idx! + 1}`}
                  value={vArr[p.idx!] || ""}
                  onChange={(e) => setAt(p.idx!, e.target.value)}
                  className="input-aurora w-40 p-2 rounded-xl text-center"
                />
              )
            )}
          </div>

          {bank.length > 0 && (
            <div className="mt-4 p-3 glass-panel rounded-xl">
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                Banco de palabras:
              </div>
              <div className="flex flex-wrap gap-2">
                {bank.map((word, i) => (
                  <span
                    key={i}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", word)
                    }
                    onClick={() => {
                      const boxCount = parts.filter(
                        (p) => p.type === "box"
                      ).length;
                      let targetIndex = 0;
                      for (let k = 0; k < boxCount; k++) {
                        if (!vArr[k]) {
                          targetIndex = k;
                          break;
                        }
                      }
                      setAt(targetIndex, word);
                    }}
                    className="px-3 py-1 rounded-full bg-white/50 border border-white/60 cursor-pointer hover:bg-white hover:scale-105 transition-all text-sm"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        color: "#1a1a1a",
      }}
    >
      {/* INICIO (name): FOTO ÚNICA */}
      <div
        className="bg-student-layer bg-student-welcome"
        data-visible={step === "name" ? "true" : "false"}
        aria-hidden="true"
      />

      {/* EXAMEN (exam/submitting): PASTEL */}
      <div
        className="bg-student-layer bg-student-exam"
        data-visible={
          step === "exam" || step === "submitting" ? "true" : "false"
        }
        data-mode="static"
        aria-hidden="true"
      />

      {/* FINAL (submitted): MISMA FOTO ÚNICA */}
      <div
        className="bg-student-layer bg-student-welcome"
        data-visible={step === "submitted" ? "true" : "false"}
        aria-hidden="true"
      />

      {/* Caústicas solo durante el examen */}
      {step === "exam" && <NatureCaustics variant="subtle" />}

      <div className="relative z-10 w-full min-h-screen flex justify-center p-6 md:p-10">
        <div className="w-full max-w-4xl">
          {step === "name" && (
            <div className="glass-panel p-10 rounded-3xl text-center max-w-lg mx-auto mt-20 animate-slide-up">
              <h1 className="font-festive text-gradient-aurora text-5xl mb-4">
                {exam?.title || "Examen"}
              </h1>
              <p className="opacity-70 mb-8">
                Bienvenido. Por favor ingresá tu nombre completo para comenzar.
              </p>
              <input
                className="input-aurora w-full p-4 mb-6 rounded-2xl text-center text-lg shadow-sm"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Tu nombre aquí..."
              />
              <button
                onClick={startAttempt}
                className="btn-aurora-primary py-4 px-10 rounded-full text-lg w-full font-bold tracking-wide"
              >
                ¡Comenzar Aventura!
              </button>
              {err && (
                <div className="mt-4 text-red-500 bg-red-50 p-2 rounded-lg text-sm">
                  {err}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="btn-aurora px-4 py-2 rounded-lg text-xs font-bold"
                    >
                      Reintentar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "exam" && (
            <div className="animate-slide-up space-y-4">
              {Header}

              <div
                className={`glass-panel p-3 rounded-2xl flex items-center justify-between transition-colors ${flash ? "bg-red-100/50" : ""
                  }`}
              >
                <div className="flex gap-4 px-2">
                  <div>
                    👤 <b>{studentName}</b>
                  </div>
                </div>
                <div className="flex gap-6 px-2">
                  <div className="text-emerald-600 font-bold">
                    ❤️ {lives ?? "—"}
                  </div>
                  <div className="font-mono text-lg">
                    ⏳{" "}
                    {secondsLeft != null
                      ? `${Math.floor(secondsLeft / 60)}:${String(
                        secondsLeft % 60
                      ).padStart(2, "0")}`
                      : "—"}
                  </div>
                </div>
              </div>

              {loadingPaper && (
                <div className="text-center p-10">Cargando preguntas...</div>
              )}

              <div className="mt-6">
                {!loadingPaper && questions.map((q, i) => renderQuestion(q, i))}
              </div>

              {!loadingPaper && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => submitAttempt("manual")}
                    className="btn-aurora-primary py-3 px-12 rounded-full text-lg shadow-lg hover:shadow-xl transform transition-all"
                  >
                    Entregar Examen
                  </button>
                </div>
              )}

              {err && (
                <div className="text-center text-red-500 mt-4 bg-white/50 p-2 rounded">
                  {err}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="btn-aurora px-4 py-2 rounded-lg text-xs font-bold"
                    >
                      Reintentar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "submitting" && (
            <div className="glass-panel p-10 rounded-3xl text-center max-w-md mx-auto mt-20">
              <h2 className="text-2xl font-bold mb-4">
                Enviando respuestas...
              </h2>
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {step === "submitted" && (
            <div className="glass-panel p-10 rounded-3xl text-center max-w-md mx-auto mt-20 animate-slide-up">
              <div className="text-6xl mb-4">🧠</div>
              <h2 className="text-3xl font-bold mb-2 text-gradient-aurora">
                ¡Examen Enviado!
              </h2>
              <p className="opacity-70 mb-8">
                Tus respuestas han sido registradas exitosamente.
              </p>

              {canViewReview ? (
                <>
                  {gradingMode === "auto" ? (
                    <div className="bg-white/40 p-6 rounded-2xl mb-6">
                      <div className="text-sm uppercase tracking-wider opacity-60">
                        Tu Calificación
                      </div>
                      <div className="text-5xl font-bold mt-2 text-gray-800">
                        {score}{" "}
                        <span className="text-2xl text-gray-500">
                          / {maxScore}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/40 p-6 rounded-2xl mb-6">
                      <p>El docente revisará tu examen pronto.</p>
                    </div>
                  )}

                  <button
                    onClick={handleOpenReview}
                    className="
    w-full md:w-auto
    px-6 py-3
    rounded-full
    text-sm font-bold
    shadow-md hover:shadow-lg transition-all
    bg-gradient-to-r from-lime-300 via-amber-300 to-orange-300
    text-[#1f2933]
    border border-white/60
  "
                  >
                    Ver revisión detallada (PDF)
                  </button>
                </>
              ) : (
                <div className="bg-white/40 p-6 rounded-2xl mb-6 border border-white/50">
                  <p className="text-sm opacity-80 mb-1">Revisión programada</p>
                  <p className="font-semibold text-lg">
                    La revisión detallada estará disponible el: <br />
                    {formatReviewDate(exam?.openAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showFullscreenWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="glass-panel proctor-alert rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
              <div className="text-5xl mb-4">🛡️</div>
              <h2 className="proctor-alert-title text-2xl mb-4">
                🚫 Acción no permitida
              </h2>
              <p className="proctor-alert-text mb-6 leading-relaxed text-sm">
                Detectamos una acción no autorizada durante el examen. Para
                continuar, volvé a pantalla completa y mantené esta pestaña
                activa.
              </p>
              <div className="proctor-alert-hint inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                ❤️ Se descontó 1 vida.
              </div>
              <button
                onClick={handleReturnToExam}
                className="proctor-alert-btn w-full py-3 rounded-xl font-bold hover:brightness-110 hover:shadow-lg transition-all"
              >
                🔙 Volver al examen
              </button>
              {fullscreenHint && (
                <p className="mt-3 text-xs text-emerald-100/90">
                  {fullscreenHint}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-panel bg-white/90 text-gray-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-2">{reviewModal.title}</h3>
            <p className="opacity-70 mb-6">{reviewModal.body}</p>
            <button
              onClick={() => setReviewModal(null)}
              className="btn-aurora w-full py-2 rounded-xl"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <FloatingChatShell label="Chat">
        <ExamChat
          code={code}
          role="student"
          defaultName={studentName || "Alumno"}
        />
      </FloatingChatShell>
    </div>
  );
}
