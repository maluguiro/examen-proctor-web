"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API, getAuthToken } from "@/lib/api";

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
  } | null;
  questions?: QuestionItem[];
  items?: QuestionItem[];
  perQuestion?: Array<{ questionId: string; score?: number | null; feedback?: string | null }>;
  grading?: {
    perQuestion?: Array<{ questionId: string; score?: number | null; feedback?: string | null }>;
  };
};

type LocalGrade = {
  score: string;
  feedback: string;
};

export default function GradingDetailPage() {
  const params = useParams<{ code: string; attemptId: string }>();
  const router = useRouter();
  const code = (params?.code || "").toString().toUpperCase();
  const attemptId = (params?.attemptId || "").toString();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [attempt, setAttempt] = React.useState<GradingResponse["attempt"] | null>(null);
  const [questions, setQuestions] = React.useState<QuestionItem[]>([]);
  const [localGrades, setLocalGrades] = React.useState<Record<string, LocalGrade>>({});

  const infoTimerRef = React.useRef<number | null>(null);

  function logDevError(label: string, detail?: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error(label, detail);
    }
  }

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
        setError(null);
        const token = getAuthToken();
        if (!token) {
          setError("Sesion expirada. Inicia sesion nuevamente.");
          return;
        }

        const res = await fetch(
          `${API}/exams/${code}/attempts/${attemptId}/grading`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("No tenes permisos o tu sesion expiro.");
          } else {
            setError("Hubo un error. Reintenta.");
          }
          const text = await res.text().catch(() => "");
          logDevError("GRADING_LOAD_ERROR", text || res.status);
          return;
        }

        const data = (await res.json()) as GradingResponse;
        if (cancelled) return;

        const qList = Array.isArray(data?.questions)
          ? data.questions
          : Array.isArray(data?.items)
          ? data.items
          : [];

        setAttempt(data.attempt ?? null);
        setQuestions(qList);

        const incoming =
          data?.perQuestion ?? data?.grading?.perQuestion ?? [];
        const nextGrades: Record<string, LocalGrade> = {};
        qList.forEach((q) => {
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
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, attemptId, reloadKey]);

  const maxScore = React.useMemo(() => {
    return questions.reduce((acc, q) => {
      const pts = typeof q.points === "number" ? q.points : 0;
      return acc + pts;
    }, 0);
  }, [questions]);

  const totalScore = React.useMemo(() => {
    return questions.reduce((acc, q) => {
      const raw = localGrades[q.id]?.score;
      const val = Number(raw);
      if (raw === "" || Number.isNaN(val)) return acc;
      return acc + val;
    }, 0);
  }, [localGrades, questions]);

  const hasMissingScores = React.useMemo(() => {
    return questions.some((q) => {
      const raw = localGrades[q.id]?.score;
      if (raw === "" || raw == null) return true;
      return Number.isNaN(Number(raw));
    });
  }, [localGrades, questions]);

  const hasOverMax = totalScore > maxScore;

  function stringifyAnswer(ans: any) {
    if (ans == null) return "-";
    if (Array.isArray(ans)) return ans.join(", ");
    if (typeof ans === "object") {
      try {
        return JSON.stringify(ans);
      } catch {
        return "[respuesta]";
      }
    }
    return String(ans);
  }

  async function saveGrading(finalize: boolean) {
    if (!code || !attemptId) return;
    const token = getAuthToken();
    if (!token) {
      setError("Sesion expirada. Inicia sesion nuevamente.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const perQuestion = questions.map((q) => {
        const raw = localGrades[q.id]?.score;
        const scoreVal = raw === "" ? null : Number(raw);
        return {
          questionId: q.id,
          score: Number.isNaN(scoreVal as number) ? null : scoreVal,
          feedback: localGrades[q.id]?.feedback ?? "",
        };
      });

      const res = await fetch(
        `${API}/exams/${code}/attempts/${attemptId}/grading`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ perQuestion, finalize }),
        }
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError("No tenes permisos o tu sesion expiro.");
        } else {
          setError("Hubo un error. Reintenta.");
        }
        const text = await res.text().catch(() => "");
        logDevError("GRADING_SAVE_ERROR", text || res.status);
        return;
      }

      if (finalize) {
        router.push(`/t/exams/${code}/grading?updated=1`);
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
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-festive text-3xl text-gradient-aurora">
              Correccion manual
            </h1>
            <p className="text-xs text-gray-500">
              Examen: {code} - Intento: {attemptId}
            </p>
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
              Respuestas del alumno
            </h2>

            {loading ? (
              <div className="text-sm text-gray-500">Cargando...</div>
            ) : questions.length === 0 ? (
              <div className="text-sm text-gray-500">
                No hay respuestas para mostrar.
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="border border-white/60 bg-white/40 rounded-2xl p-4"
                  >
                    <div className="text-xs text-gray-500 mb-2">
                      Pregunta {idx + 1}
                    </div>
                    <div className="font-semibold text-gray-800 mb-2">
                      {q.stem || "(sin enunciado)"}
                    </div>
                    {Array.isArray(q.choices) && q.choices.length > 0 && (
                      <div className="text-xs text-gray-500 mb-2">
                        Opciones: {q.choices.join(" - ")}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 mb-3">
                      Respuesta: {stringifyAnswer(q.studentAnswer ?? q.answer)}
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600">
                          Puntaje (0 - {q.points ?? 0})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={q.points ?? 0}
                          value={localGrades[q.id]?.score ?? ""}
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
                          className="input-aurora w-32 p-2 rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600">
                          Feedback (opcional)
                        </label>
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
                          rows={2}
                          className="input-aurora w-full p-2 rounded-xl text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="glass-panel p-6 rounded-3xl">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Nota final
            </h3>
            <div className="text-3xl font-extrabold text-gray-800 mb-2">
              {totalScore} / {maxScore}
            </div>
            {attempt?.studentName && (
              <div className="text-xs text-gray-500 mb-3">
                Alumno: {attempt.studentName}
              </div>
            )}
            <div className="text-xs text-gray-500 mb-4">
              {hasMissingScores && "Faltan puntajes. "}
              {hasOverMax && "Total excede maximo."}
              {!hasMissingScores && !hasOverMax && "Sin advertencias."}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveGrading(false)}
                disabled={saving}
                className="btn-aurora px-4 py-2 rounded-lg text-xs font-bold"
              >
                {saving ? "Guardando..." : "Guardar borrador"}
              </button>
              <button
                type="button"
                onClick={() => saveGrading(true)}
                disabled={saving || hasMissingScores}
                className="btn-aurora-primary px-4 py-2 rounded-lg text-xs font-bold"
              >
                {saving ? "Guardando..." : "Finalizar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
