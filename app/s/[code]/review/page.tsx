"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { API } from "@/lib/api";

type ReviewQuestion = {
  id?: string | number | null;
  stem?: string | null;
  prompt?: string | null;
  points?: number | null;
  maxScore?: number | null;
  score?: number | null;
  given?: any;
  studentAnswer?: any;
  correct?: any;
  answer?: any;
  feedback?: string | null;
  teacherFeedback?: string | null;
  isCorrect?: boolean | null;
  isIncorrect?: boolean | null;
};

type ReviewPayload = {
  overallFeedback?: string | null;
  feedback?: string | null;
  totals?: { totalScore?: number | null; maxScore?: number | null } | null;
  totalScore?: number | null;
  maxScore?: number | null;
  questions?: ReviewQuestion[];
};

type FetchResult = {
  ok: boolean;
  nonJson: boolean;
  status: number;
  data: any;
};

export default function StudentReviewPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = (params?.code || "").toString();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [canReview, setCanReview] = React.useState(false);
  const [reviewBlockedReason, setReviewBlockedReason] = React.useState<
    string | null
  >(null);
  const [reviewBlockedMessage, setReviewBlockedMessage] = React.useState<
    string | null
  >(null);
  const [reviewAvailableAt, setReviewAvailableAt] = React.useState<
    string | null
  >(null);
  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [totalScore, setTotalScore] = React.useState<number | null>(null);
  const [maxScore, setMaxScore] = React.useState<number | null>(null);
  const [review, setReview] = React.useState<ReviewPayload | null>(null);

  const nonJsonMessage = "No se pudo validar la revisión. Intentá de nuevo.";

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

  function normalizeReviewValue(value: any): string | null {
    if (value == null) return null;
    if (Array.isArray(value)) {
      return value.map((v) => String(v ?? "").trim()).join(" · ").trim();
    }
    if (typeof value === "object") {
      const asAny = value as any;
      if (Array.isArray(asAny.answers)) {
        return asAny.answers
          .map((v: any) => String(v ?? "").trim())
          .join(" · ")
          .trim();
      }
      if (asAny.value != null) {
        return String(asAny.value).trim();
      }
      return null;
    }
    return String(value).trim();
  }

  function resolveCorrectness(q: ReviewQuestion): boolean | null {
    if (typeof q.isCorrect === "boolean") return q.isCorrect;
    const incorrectFlag = (q as any).isIncorrect;
    if (typeof incorrectFlag === "boolean" && incorrectFlag) return false;
    return null;
  }

  function logDevFetchIssue(status: number, url: string, contentType: string) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[review] non-json response", {
        status,
        url,
        contentType,
      });
    }
  }

  async function fetchJsonOrNull(url: string): Promise<FetchResult> {
    const res = await fetch(url, { cache: "no-store" });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      logDevFetchIssue(res.status, url, contentType);
      return { ok: false, nonJson: true, status: res.status, data: null };
    }
    const data = await res.json().catch(() => null);
    return { ok: res.ok, nonJson: false, status: res.status, data };
  }

  React.useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setReview(null);
        setReviewBlockedMessage(null);

        const attemptIdParam = (searchParams?.get("attemptId") || "").trim();
        let storedAttemptId = attemptIdParam || null;
        if (!storedAttemptId) {
          const raw = localStorage.getItem(`examproctor_attempt_${code}`);
          const parsed = raw ? JSON.parse(raw) : null;
          storedAttemptId = (parsed?.attemptId ?? "").toString().trim() || null;
        }
        if (!storedAttemptId) {
          setError("No se encontró un intento para este examen.");
          return;
        }
        setAttemptId(storedAttemptId);

        const reviewUrl = `${API}/attempts/${storedAttemptId}/review`;
        const res = await fetchJsonOrNull(reviewUrl);
        if (cancelled) return;

        if (res.nonJson) {
          setError(nonJsonMessage);
          return;
        }

        if (!res.ok) {
          const reason = res.data?.reason ?? res.data?.reviewBlockedReason ?? null;
          const message = res.data?.message ?? res.data?.error ?? null;
          const reviewAvailableAt =
            res.data?.reviewAvailableAt ?? res.data?.review?.availableAt ?? null;

          if (res.status === 403) {
            setCanReview(false);
            setReviewBlockedReason(reason);
            setReviewAvailableAt(reviewAvailableAt);
            setReviewBlockedMessage(message || null);
            return;
          }

          if (res.status === 404 || res.status === 400) {
            setError(message || nonJsonMessage);
            return;
          }

          setError(message || nonJsonMessage);
          return;
        }

        const reviewData = res.data as ReviewPayload;
        const totals = reviewData?.totals ?? reviewData ?? {};
        setReview(reviewData);
        setTotalScore(
          reviewData?.totalScore ?? (totals as any)?.totalScore ?? null
        );
        setMaxScore(
          reviewData?.maxScore ?? (totals as any)?.maxScore ?? null
        );
        setCanReview(true);
      } catch (e) {
        setError(nonJsonMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, searchParams]);

  const percent =
    typeof totalScore === "number" &&
    typeof maxScore === "number" &&
    maxScore > 0
      ? Math.round((totalScore / maxScore) * 100)
      : null;

  const blockedMessage = reviewBlockedMessage
    ? reviewBlockedMessage
    : reviewBlockedReason === "NOT_GRADED"
    ? "El docente corregirá tu examen pronto."
    : reviewBlockedReason === "NOT_OPEN_YET"
    ? `Tu examen fue corregido. La revisión estará disponible el ${formatReviewDate(
        reviewAvailableAt
      )}.`
    : "Tu revisión aún no está disponible.";

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-festive text-3xl text-gradient-aurora">
              Revisión del examen
            </h1>
            {percent !== null && (
              <div className="text-sm text-gray-600">
                Nota: {totalScore} / {maxScore} ({percent}%)
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canReview && attemptId && (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `${API}/attempts/${attemptId}/review.print`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="btn-aurora px-4 py-2 rounded-xl text-xs font-bold"
              >
                Descargar PDF
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/s/${code}`)}
              className="btn-aurora px-4 py-2 rounded-xl text-xs font-bold"
            >
              Volver
            </button>
          </div>
        </div>

        {loading && (
          <div className="glass-panel p-6 rounded-2xl text-sm text-gray-600">
            Cargando revisión...
          </div>
        )}
        {error && (
          <div className="glass-panel p-6 rounded-2xl text-sm text-red-500">
            {error}
          </div>
        )}
        {!loading && !error && !canReview && (
          <div className="glass-panel p-6 rounded-2xl text-sm text-gray-600">
            {blockedMessage}
          </div>
        )}
        {!loading && !error && canReview && (
          <>
            {review?.overallFeedback && (
              <div className="glass-panel p-5 rounded-2xl">
                <div className="text-xs uppercase tracking-wider opacity-60">
                  Comentario general
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {review.overallFeedback}
                </div>
              </div>
            )}
            <div className="space-y-4">
              {(review?.questions ?? []).map((q, idx) => {
                const correct = resolveCorrectness(q);
                const student = q.given ?? (q as any).studentAnswer ?? null;
                const correctAns = q.correct ?? (q as any).answer ?? null;
                const studentText = normalizeReviewValue(student) || "—";
                const correctText = normalizeReviewValue(correctAns) || "—";
                const qScore = q.score ?? (q as any).teacherScore ?? null;
                const qMax = q.points ?? q.maxScore ?? null;
                const feedback = q.feedback ?? q.teacherFeedback ?? null;
                return (
                  <div key={q.id ?? idx} className="glass-panel p-5 rounded-2xl">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Pregunta {idx + 1}</span>
                      {correct !== null && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            correct
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {correct ? "Correcta" : "Incorrecta"}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-800">
                      {q.stem || q.prompt || "Pregunta"}
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">
                          Tu respuesta
                        </div>
                        <div className="text-gray-700">{studentText}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Correcta</div>
                        <div className="text-gray-700">{correctText}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      Puntaje: {qScore != null ? qScore : "—"} / {qMax != null ? qMax : "—"}
                    </div>
                    {feedback && (
                      <div className="mt-2 text-sm text-gray-700">
                        <div className="text-xs text-gray-500 mb-1">
                          Comentario del docente
                        </div>
                        {feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}