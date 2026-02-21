"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API, clearAuthToken, getAuthToken } from "@/lib/api";

type QuestionItem = {
  id: string;
  stem?: string | null;
  points?: number | null;
  choices?: string[] | null;
  studentAnswer?: any;
  answer?: any;
};

type GradingResponse = {
  attempt?: {
    id: string;
    studentName?: string | null;
    status?: string | null;
    overallFeedback?: string | null;
  } | null;
  questions?: QuestionItem[];
  items?: QuestionItem[];
  perQuestion?: Array<{ questionId: string; score?: number | null; feedback?: string | null }>;
  overallFeedback?: string | null;
  grading?: {
    perQuestion?: Array<{ questionId: string; score?: number | null; feedback?: string | null }>;
    overallFeedback?: string | null;
  };
};

type ReviewResponse = {
  exam?: {
    title?: string | null;
    code?: string | null;
  };
  attempt?: {
    id?: string | null;
    studentName?: string | null;
  };
  questions?: Array<{
    id: string;
    kind?: string | null;
    stem?: string | null;
    choices?: string[] | null;
    points?: number | null;
    correct?: any;
    given?: any;
    score?: number | null;
  }>;
};

type LocalGrade = {
  score: string;
  feedback: string;
};

type ReviewQuestion = NonNullable<ReviewResponse["questions"]>[number];

type FibData = {
  parts: string[];
  blanks: number;
  correctAnswers: string[];
  studentAnswers: string[];
};

export default function GradingDetailPage() {
  const params = useParams<{ code: string; attemptId: string }>();
  const router = useRouter();
  const code = (params?.code || "").toString().toUpperCase();
  const attemptId = (params?.attemptId || "").toString();

  const [loading, setLoading] = React.useState(true);
  const [reviewLoading, setReviewLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [attempt, setAttempt] = React.useState<GradingResponse["attempt"] | null>(null);
  const [questions, setQuestions] = React.useState<QuestionItem[]>([]);
  const [reviewData, setReviewData] = React.useState<ReviewResponse | null>(null);
  const [localGrades, setLocalGrades] = React.useState<Record<string, LocalGrade>>({});
  const [openCommentId, setOpenCommentId] = React.useState<string | null>(null);
  const [commentSavedId, setCommentSavedId] = React.useState<string | null>(null);
  const [overallFeedback, setOverallFeedback] = React.useState("");
  const [overallSaved, setOverallSaved] = React.useState(false);

  const infoTimerRef = React.useRef<number | null>(null);

  function logDevError(label: string, detail?: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error(label, detail);
    }
  }

  const handleUnauthorized = React.useCallback(
    (message: string) => {
      clearAuthToken();
      setError(message);
      router.replace("/t");
    },
    [router]
  );

  const handleForbidden = React.useCallback(
    (message: string) => {
      setError(message);
      router.replace(`/t/exams/${code}/grading`);
    },
    [code, router]
  );

  React.useEffect(() => {
    if (!info) return;
    if (infoTimerRef.current !== null) {
      window.clearTimeout(infoTimerRef.current);
    }
    infoTimerRef.current = window.setTimeout(() => {
      setInfo(null);
      infoTimerRef.current = null;
    }, 2500);
    return () => {
      if (infoTimerRef.current !== null) {
        window.clearTimeout(infoTimerRef.current);
        infoTimerRef.current = null;
      }
    };
  }, [info]);

  const handleRetry = React.useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  React.useEffect(() => {
    if (!code || !attemptId) return;
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setReviewLoading(true);
        setError(null);
        setReviewError(null);
        const token = getAuthToken();
        if (!token) {
          handleUnauthorized("Sesion expirada. Inicia sesion nuevamente.");
          return;
        }

        const [gradingRes, reviewRes] = await Promise.all([
          fetch(`${API}/exams/${code}/attempts/${attemptId}/grading`, {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API}/attempts/${attemptId}/review`, {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (!gradingRes.ok) {
          if (gradingRes.status === 401) {
            handleUnauthorized("Sesion expirada. Inicia sesion nuevamente.");
          } else if (gradingRes.status === 403) {
            handleForbidden("No tenes permisos para ver este intento.");
          } else {
            setError("Hubo un error. Reintenta.");
          }
          const text = await gradingRes.text().catch(() => "");
          logDevError("GRADING_LOAD_ERROR", text || gradingRes.status);
          return;
        }

        if (reviewRes.status === 401) {
          handleUnauthorized("Sesion expirada. Inicia sesion nuevamente.");
          return;
        }

        const data = (await gradingRes.json()) as GradingResponse;
        const qList = Array.isArray(data?.questions)
          ? data.questions
          : Array.isArray(data?.items)
          ? data.items
          : [];

        let review: ReviewResponse | null = null;
        if (reviewRes.ok) {
          review = (await reviewRes.json()) as ReviewResponse;
        } else if (reviewRes.status === 403) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("review forbidden; continuing with grading data");
          }
          review = {
            attempt: { id: attemptId },
            questions: qList.map((q) => ({
              id: q.id,
              kind: null,
              stem: q.stem ?? null,
              choices: q.choices ?? null,
              points: q.points ?? null,
              correct: null,
              given: null,
              score: null,
            })),
          };
        } else {
          setReviewError("Hubo un error. Reintenta.");
          const text = await reviewRes.text().catch(() => "");
          logDevError("REVIEW_LOAD_ERROR", text || reviewRes.status);
        }
        if (cancelled) return;

        setAttempt(data.attempt ?? null);
        setQuestions(qList);
        setReviewData(review);
        setOverallFeedback(
          String(
            data?.overallFeedback ??
              data?.grading?.overallFeedback ??
              data?.attempt?.overallFeedback ??
              ""
          )
        );
        setOverallSaved(false);

        const incoming =
          data?.perQuestion ?? data?.grading?.perQuestion ?? [];
        const nextGrades: Record<string, LocalGrade> = {};
        const reviewQuestions = Array.isArray(review?.questions)
          ? review.questions
          : [];
        reviewQuestions.forEach((q) => {
          const found = incoming.find((g) => g.questionId === q.id);
          nextGrades[q.id] = {
            score:
              typeof found?.score === "number" && !isNaN(found.score)
                ? String(found.score)
                : "",
            feedback: found?.feedback ? String(found.feedback) : "",
          };
        });
        setLocalGrades(nextGrades);
      } catch (e) {
        logDevError("GRADING_LOAD_ERROR", e);
        if (!cancelled) setError("Hubo un error. Reintenta.");
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) setReviewLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, attemptId, reloadKey]);

  const maxScore = React.useMemo(() => {
    const reviewQuestions = Array.isArray(reviewData?.questions)
      ? reviewData.questions
      : [];
    return reviewQuestions.reduce((acc, q) => {
      const pts = typeof q.points === "number" ? q.points : 0;
      return acc + pts;
    }, 0);
  }, [reviewData]);

  const totalScore = React.useMemo(() => {
    const reviewQuestions = Array.isArray(reviewData?.questions)
      ? reviewData.questions
      : [];
    return reviewQuestions.reduce((acc, q) => {
      const raw = localGrades[q.id]?.score;
      const val = Number(raw);
      if (raw === "" || Number.isNaN(val)) return acc;
      return acc + val;
    }, 0);
  }, [localGrades, reviewData]);

  const hasMissingScores = React.useMemo(() => {
    const reviewQuestions = Array.isArray(reviewData?.questions)
      ? reviewData.questions
      : [];
    return reviewQuestions.some((q) => {
      const raw = localGrades[q.id]?.score;
      if (raw === "" || raw == null) return true;
      return Number.isNaN(Number(raw));
    });
  }, [localGrades, reviewData]);

  const hasOverMax = totalScore > maxScore;
  const isFinalized = React.useMemo(() => {
    const status = String(attempt?.status || "").toLowerCase();
    return status === "graded" || status === "corrected";
  }, [attempt?.status]);

  function parseJSONSafe(value: any) {
    if (value == null) return null;
    if (Array.isArray(value) || typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function norm(value: any) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function normBoolish(value: any) {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return String(value);
    return norm(value);
  }

  function asArray(value: any) {
    const parsed = parseJSONSafe(value);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(value)) return value;
    return [];
  }

  function normalizeAnswerList(value: any): string[] {
    const arr = asArray(value);
    if (arr.length) return arr.map((v) => String(v ?? ""));
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  }

  function formatIndexAnswers(items: string[]) {
    if (!items.length) return "\u2014";
    return items.map((val, idx) => `${idx + 1}:${val || "\u2014"}`).join(" \u00B7 ");
  }

  function getFibData(q: ReviewQuestion): FibData | null {
    const normalized = (q as any).fibNormalized || (q as any).fib || null;
    if (normalized && Array.isArray(normalized.parts)) {
      const parts = normalized.parts;
      const blanks =
        typeof normalized.blanks === "number" ? normalized.blanks : parts.length - 1;
      const correctAnswers = Array.isArray(normalized.correctAnswers)
        ? normalized.correctAnswers.map((v: any) => String(v ?? ""))
        : normalizeAnswerList(q.correct);
      const studentAnswers = Array.isArray(normalized.studentAnswers)
        ? normalized.studentAnswers.map((v: any) => String(v ?? ""))
        : normalizeAnswerList(q.given);
      return { parts, blanks, correctAnswers, studentAnswers };
    }

    const stem = q.stem || "";
    const placeholders = stem.match(/\[\[\d+\]\]/g) ?? [];
    if (placeholders.length > 0) {
      const parts = stem.split(/\[\[\d+\]\]/g);
      const correctParsed = parseJSONSafe(q.correct) as any;
      const correctAnswers = Array.isArray(correctParsed?.answers)
        ? correctParsed.answers.map((v: any) => String(v ?? ""))
        : normalizeAnswerList(q.correct);
      const studentAnswers = normalizeAnswerList(q.given);
      const blanks =
        placeholders.length ||
        studentAnswers.length ||
        correctAnswers.length ||
        parts.length - 1;
      return { parts, blanks, correctAnswers, studentAnswers };
    }

    return null;
  }

  function isEqualAnswer(student: any, correct: any) {
    const sArr = asArray(student);
    const cArr = asArray(correct);
    if (sArr.length || cArr.length) {
      if (sArr.length !== cArr.length) return false;
      return sArr.every((val, idx) => norm(val) === norm(cArr[idx]));
    }
    const s = normBoolish(student);
    const c = normBoolish(correct);
    if (!s || !c) return false;
    return s === c;
  }

  const optionLetters = ["a", "b", "c", "d", "e", "f", "g", "h"];

  function tfIndex(value: any) {
    if (value === true || value === "true") return 0;
    if (value === false || value === "false") return 1;
    const raw = normBoolish(value);
    if (raw === "true" || raw === "verdadero") return 0;
    if (raw === "false" || raw === "falso") return 1;
    return null;
  }

  function toIndex(answer: any, options: string[]) {
    if (!options.length || answer == null) return null;
    if (options.length === 2) {
      const first = norm(options[0]);
      const second = norm(options[1]);
      const isTF =
        (first === "verdadero" || first === "true") &&
        (second === "falso" || second === "false");
      if (isTF) {
        const idx = tfIndex(answer);
        if (idx != null) return idx;
      }
    }
    if (typeof answer === "number" && Number.isFinite(answer)) {
      if (answer >= 0 && answer < options.length) return answer;
      if (answer >= 1 && answer <= options.length) return answer - 1;
    }
    const raw = norm(answer);
    if (!raw) return null;
    const letterIndex = optionLetters.indexOf(raw);
    if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;
    const asNum = Number(raw);
    if (!Number.isNaN(asNum)) {
      if (asNum >= 0 && asNum < options.length) return asNum;
      if (asNum >= 1 && asNum <= options.length) return asNum - 1;
    }
    const byText = options.findIndex((opt) => norm(opt) === raw);
    return byText >= 0 ? byText : null;
  }

  function stringifyAnswer(ans: any) {
    if (ans == null) return "\u2014";
    if (Array.isArray(ans)) return ans.map((v) => String(v ?? "")).join(" \u00B7 ");
    if (typeof ans === "object") {
      const parsed = parseJSONSafe(ans);
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).answers)) {
        return (parsed as any).answers.map((v: any) => String(v ?? "")).join(" \u00B7 ");
      }
      return "\u2014";
    }
    return String(ans);
  }

  function formatDateTime(raw?: string | null) {
    if (!raw) return "\u2014";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "\u2014";
    return d.toLocaleString("es-AR");
  }

  function formatDuration(start?: string | null, end?: string | null) {
    if (!start || !end) return "\u2014";
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
      const diff = Math.floor((e - s) / 1000);
      const hours = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      if (hours > 0) {
        return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      return `${mins}:${String(secs).padStart(2, "0")}`;
    }
    return "\u2014";
  }

  function formatPercent(total: number, max: number) {
    if (!max || Number.isNaN(max) || max <= 0) return "\u2014";
    const pct = Math.round((total / max) * 100);
    return `${pct}%`;
  }

  function resolveCorrectIndex(correct: any, choices: string[]) {
    if (!choices.length) return -1;
    if (typeof correct === "number" && Number.isFinite(correct)) {
      return correct >= 0 && correct < choices.length ? correct : -1;
    }
    if (typeof correct === "string") {
      const idx = choices.findIndex((c) => c === correct);
      return idx;
    }
    return -1;
  }

  async function saveGrading(finalize: boolean) {
    if (!code || !attemptId) return;
    const token = getAuthToken();
    if (!token) {
      handleUnauthorized("Sesion expirada. Inicia sesion nuevamente.");
      return;
    }
    if (finalize && !window.confirm("\u00BFFinalizar y publicar la correcci\u00F3n?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const reviewQuestions = Array.isArray(reviewData?.questions)
        ? reviewData.questions
        : [];
      const perQuestion = reviewQuestions
        .map((q) => {
          const raw = localGrades[q.id]?.score;
          const scoreVal = raw === "" ? null : Number(raw);
          return {
            questionId: q.id,
            score: Number.isNaN(scoreVal as number) ? null : scoreVal,
            feedback: localGrades[q.id]?.feedback ?? "",
          };
        })
        .filter((item) => finalize || item.score !== null);

      const res = await fetch(
        `${API}/exams/${code}/attempts/${attemptId}/grading`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            perQuestion,
            finalize,
            overallFeedback: overallFeedback.trim() ? overallFeedback.trim() : null,
          }),
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized("Sesion expirada. Inicia sesion nuevamente.");
        } else if (res.status === 403) {
          handleForbidden("No tenes permisos para corregir este intento.");
        } else {
          setError("Hubo un error. Reintenta.");
        }
        const text = await res.text().catch(() => "");
        logDevError("GRADING_SAVE_ERROR", text || res.status);
        return;
      }

      setOverallSaved(true);
      if (finalize) {
        router.replace(`/t/exams/${code}/grading?updated=1`);
        return;
      }
      setInfo("Guardado.");
    } catch (e) {
      logDevError("GRADING_SAVE_ERROR", e);
      setError("Hubo un error. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-festive text-3xl text-gradient-aurora">
                {"Correcci\u00F3n manual \u2014 "}{reviewData?.exam?.title || code}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/t/exams/${code}/grading`}
                className="btn-aurora px-4 py-2 rounded-xl text-xs font-bold"
              >
                Volver a bandeja
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="glass-panel p-4 rounded-2xl text-xs text-gray-600">
              <div className="font-bold text-gray-700 mb-1">Alumno</div>
              <div>
                {attempt?.studentName ||
                  (reviewData as any)?.attempt?.studentName ||
                  "\u2014"}
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl text-xs text-gray-600">
              <div className="font-bold text-gray-700 mb-1">Comenzado</div>
              <div>
                {formatDateTime(
                  (attempt as any)?.startedAt ||
                    (reviewData as any)?.attempt?.startedAt
                )}
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl text-xs text-gray-600">
              <div className="font-bold text-gray-700 mb-1">Finalizado</div>
              <div>
                {formatDateTime(
                  (attempt as any)?.endAt ||
                    (attempt as any)?.submittedAt ||
                    (reviewData as any)?.attempt?.endAt ||
                    (reviewData as any)?.attempt?.submittedAt
                )}
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl text-xs text-gray-600">
              <div className="font-bold text-gray-700 mb-1">Tiempo empleado</div>
              <div>
                {formatDuration(
                  (attempt as any)?.startedAt ||
                    (reviewData as any)?.attempt?.startedAt,
                  (attempt as any)?.endAt ||
                    (attempt as any)?.submittedAt ||
                    (reviewData as any)?.attempt?.endAt ||
                    (reviewData as any)?.attempt?.submittedAt
                )}
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl text-xs text-gray-600">
              <div className="font-bold text-gray-700 mb-1">Estado</div>
              <div>{isFinalized ? "Corregido" : "Pendiente"}</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl text-xs text-gray-600">
              <div className="font-bold text-gray-700 mb-1">
                {"Calificaci\u00F3n"}
              </div>
              <div>
                {totalScore} / {maxScore}{" "}
                <span className="text-gray-400">
                  ({formatPercent(totalScore, maxScore)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm font-semibold flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="btn-aurora px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              Reintentar
            </button>
          </div>
        )}

        {info && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-semibold pointer-events-none">
            {info}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Detalle por pregunta
            </h2>

            {loading || reviewLoading ? (
              <div className="text-sm text-gray-500">Cargando...</div>
            ) : reviewError ? (
              <div className="text-sm text-gray-500">{reviewError}</div>
            ) : Array.isArray(reviewData?.questions) &&
              reviewData.questions.length === 0 ? (
              <div className="text-sm text-gray-500">
                No hay respuestas para mostrar.
              </div>
            ) : (
              <div className="space-y-4">
                {(reviewData?.questions ?? []).map((q, idx) => {
                  const fib = getFibData(q);
                  const isFib = !!fib;
                  const options = Array.isArray(q.choices) ? q.choices : [];
                  const kind = String(q.kind || "").toLowerCase();
                  const isMCQ =
                    options.length > 0 ||
                    kind === "mcq" ||
                    kind === "tf" ||
                    kind === "truefalse";
                  const correctIndex = isMCQ ? toIndex(q.correct, options) : null;
                  const studentIndex = isMCQ ? toIndex(q.given, options) : null;
                  const isCorrect =
                    correctIndex != null &&
                    studentIndex != null &&
                    correctIndex === studentIndex;

                  let autoStatus: "correct" | "incorrect" | null = null;

                  if (isFib && fib) {
                    const anyAnswered = fib.studentAnswers.some((val) => norm(val));
                    if (anyAnswered) {
                      const allMatch = fib.studentAnswers.every(
                        (val, i) => norm(val) === norm(fib.correctAnswers[i] || "")
                      );
                      autoStatus = allMatch ? "correct" : "incorrect";
                    }
                  } else if (isMCQ && correctIndex != null && studentIndex != null) {
                    autoStatus = isCorrect ? "correct" : "incorrect";
                  }

                  const studentText =
                    isMCQ && studentIndex != null
                      ? `${optionLetters[studentIndex]}. ${options[studentIndex]}`
                      : isFib && fib
                      ? formatIndexAnswers(fib.studentAnswers)
                      : stringifyAnswer(q.given);
                  const correctText =
                    isMCQ && correctIndex != null
                      ? `${optionLetters[correctIndex]}. ${options[correctIndex]}`
                      : isFib && fib
                      ? formatIndexAnswers(fib.correctAnswers)
                      : stringifyAnswer(q.correct);

                  return (
                    <div
                      key={q.id}
                      className="border border-white/60 bg-white/60 rounded-2xl p-5 shadow-sm space-y-4"
                    >
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Pregunta {idx + 1}</span>
                        {autoStatus && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              autoStatus === "correct"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {autoStatus === "correct" ? "Correcta" : "Incorrecta"}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                          Enunciado
                        </div>
                        <div className="text-sm text-gray-800 leading-relaxed">
                          {isFib && fib ? (
                            <span className="flex flex-wrap items-center gap-1.5">
                              {fib.parts.map((part, i) => {
                                const value = fib.studentAnswers[i] ?? "";
                                const correct = fib.correctAnswers[i] ?? "";
                                const empty = !String(value).trim();
                                const matches =
                                  !empty && norm(value) === norm(correct);
                                return (
                                  <React.Fragment key={`${q.id}-fib-${i}`}>
                                    {part && <span>{part}</span>}
                                    {i < (fib.blanks || fib.parts.length - 1) && (
                                      <span
                                        className={`px-2 py-1 rounded-md border text-xs font-semibold min-w-[42px] text-center ${
                                          empty
                                            ? "border-slate-300 bg-slate-50 text-slate-500 italic"
                                            : matches
                                            ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                            : "border-rose-400 bg-rose-50 text-rose-700"
                                        }`}
                                      >
                                        {value || "\u2014"}
                                      </span>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </span>
                          ) : (
                            q.stem || "(sin enunciado)"
                          )}
                        </div>
                        {options.length > 0 && (
                          <div className="text-xs text-gray-600">
                            <div className="font-semibold text-gray-700 mb-1">
                              Opciones
                            </div>
                            <ul className="space-y-1">
                              {options.map((choice, choiceIndex) => {
                                const isCorrectOption = correctIndex === choiceIndex;
                                const isStudentOption = studentIndex === choiceIndex;
                                const studentCorrect = isStudentOption && isCorrect;
                                const studentWrong =
                                  isStudentOption && !isCorrect && studentIndex != null;
                                return (
                                  <li
                                    key={`${q.id}-opt-${choiceIndex}`}
                                    className={`flex items-start gap-2 rounded-lg border px-2 py-1 ${
                                      isCorrectOption
                                        ? "border-emerald-300 bg-emerald-50/60 text-emerald-700 font-semibold"
                                        : studentWrong
                                        ? "border-rose-300 bg-rose-50/60 text-rose-700"
                                        : "border-transparent"
                                    }`}
                                  >
                                    <span className="mt-0.5 h-3 w-3 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">
                                      {isStudentOption ? "●" : ""}
                                    </span>
                                    <span>
                                      {optionLetters[choiceIndex]}. {choice}
                                    </span>
                                    <span className="ml-auto">
                                      {studentCorrect ? "\u2714" : studentWrong ? "\u2715" : ""}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/60 bg-white/50 p-4">
                        <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                          Respuestas
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">
                              Alumno
                            </div>
                            <div className="text-gray-700">{studentText}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">
                              Correcta
                            </div>
                            <div className="text-gray-700">{correctText}</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/60 bg-white/50 p-4">
                        <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                          Calificación
                        </div>
                        <div className="mt-3 flex flex-col md:flex-row gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-600">
                              Puntaje
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={q.points ?? 0}
                                placeholder="0"
                                value={localGrades[q.id]?.score ?? ""}
                                disabled={isFinalized}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalGrades((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      score: val,
                                      feedback: prev[q.id]?.feedback ?? "",
                                    },
                                  }));
                                }}
                                className="w-24 h-10 rounded-lg border border-slate-200 bg-white/80 px-3 text-sm text-gray-800 shadow-sm"
                              />
                              <span className="text-xs text-gray-500">
                                / {q.points ?? 0}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 flex items-end justify-start relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCommentId((prev) =>
                                  prev === q.id ? null : q.id
                                )
                              }
                              disabled={isFinalized}
                              className="btn-aurora px-3 py-2 rounded-xl text-xs font-bold relative flex items-center gap-2"
                              title="Comentario"
                            >
                              <span>{"\uD83D\uDCAC"}</span>
                              <span>Comentario</span>
                              {localGrades[q.id]?.feedback ? (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                  {"\u2713"}
                                </span>
                              ) : null}
                            </button>
                            {openCommentId === q.id && (
                              <div className="pointer-events-none absolute left-0 top-full mt-2 z-20">
                                <div className="pointer-events-auto bg-white/95 border border-white/60 shadow-lg rounded-xl p-3 w-64">
                                  <div className="text-xs font-bold text-gray-600 mb-2">
                                    Comentario
                                  </div>
                                  <textarea
                                    value={localGrades[q.id]?.feedback ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLocalGrades((prev) => ({
                                        ...prev,
                                        [q.id]: {
                                          score: prev[q.id]?.score ?? "",
                                          feedback: val,
                                        },
                                      }));
                                    }}
                                    rows={3}
                                    className="input-aurora w-full p-2 rounded-xl text-xs"
                                  />
                                  {commentSavedId === q.id && (
                                    <div className="mt-2 text-xs text-emerald-600 font-semibold">
                                      {"Guardado \u2713"}
                                    </div>
                                  )}
                                  <div className="mt-2 flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCommentSavedId(q.id)}
                                      className="btn-aurora-primary px-3 py-1.5 rounded-lg text-xs font-bold"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setOpenCommentId(null)}
                                      className="btn-aurora px-3 py-1.5 rounded-lg text-xs font-bold"
                                    >
                                      Cerrar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="glass-panel p-6 rounded-3xl self-start h-fit">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Nota final
            </h3>
            <div className="text-3xl font-extrabold text-gray-800 mb-2">
              {totalScore} / {maxScore}
            </div>
            <div className="text-xs text-gray-500 mb-4">
              Estado: {isFinalized ? "Corregido" : "Pendiente"}
            </div>
            <div className="text-xs text-gray-500 mb-4">
              <div className="font-bold text-gray-700 mb-2">
                Comentario general
              </div>
              <textarea
                value={overallFeedback}
                onChange={(e) => {
                  setOverallFeedback(e.target.value);
                  setOverallSaved(false);
                }}
                disabled={isFinalized}
                rows={4}
                placeholder="Escribí un comentario general para el alumno..."
                className="input-aurora w-full p-3 rounded-xl text-xs"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                {overallSaved && (
                  <span className="text-emerald-600 font-semibold">
                    {"Guardado \u2713"}
                  </span>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setOverallSaved(true)}
                    disabled={isFinalized}
                    className="btn-aurora-primary px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverallSaved(false)}
                    disabled={isFinalized}
                    className="btn-aurora px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-4">
              {hasMissingScores && "Faltan puntajes. "}
              {hasOverMax && "Total excede maximo."}
              {!hasMissingScores && !hasOverMax && "Sin advertencias."}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveGrading(false)}
                disabled={saving || isFinalized}
                className="btn-aurora px-4 py-2 rounded-lg text-xs font-bold"
              >
                {saving ? "Guardando..." : "Guardar borrador"}
              </button>
              <button
                type="button"
                onClick={() => saveGrading(true)}
                disabled={saving || hasMissingScores || isFinalized}
                className="btn-aurora-primary px-4 py-2 rounded-lg text-xs font-bold"
              >
                {saving ? "Guardando..." : "Finalizar y publicar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}











