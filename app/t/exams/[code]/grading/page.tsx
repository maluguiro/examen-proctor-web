"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API, getAuthToken } from "@/lib/api";

type AttemptRow = {
  id: string;
  studentName?: string | null;
  submittedAt?: string | null;
  status?: string | null;
  score?: number | null;
  reviewOpenAt?: string | null;
};

export default function GradingInboxPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = (params?.code || "").toString().toUpperCase();

  const [loading, setLoading] = React.useState(true);
  const [attempts, setAttempts] = React.useState<AttemptRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const infoTimerRef = React.useRef<number | null>(null);

  const handleRetry = React.useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

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


  React.useEffect(() => {
    if (!code) return;
    if (searchParams?.get("updated") !== "1") return;
    setInfo("Corrección guardada.");
    setReloadKey((k) => k + 1);
    router.replace(`/t/exams/${code}/grading`);
  }, [code, router, searchParams]);

  function isFinalStatus(status?: string | null) {
    const raw = String(status || "").toLowerCase();
    return raw === "graded" || raw === "corrected";
  }

  function mapStatus(status?: string | null) {
    return isFinalStatus(status) ? "Corregido" : "Pendiente";
  }

  function formatDateTime(raw?: string | null) {
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("es-AR");
  }

  function getEditLabel(
    status?: string | null,
    reviewOpenAt?: string | null
  ) {
    const isFinal = isFinalStatus(status);
    if (!isFinal) return { text: "A corregir", tone: "neutral" as const };
    if (!reviewOpenAt) {
      return {
        text: "Editable hasta habilitar revisión",
        tone: "editable" as const,
      };
    }
    const t = new Date(reviewOpenAt).getTime();
    if (Number.isNaN(t)) {
      return {
        text: "Editable hasta habilitar revisión",
        tone: "editable" as const,
      };
    }
    if (Date.now() < t) {
      return {
        text: `Editable hasta ${formatDateTime(reviewOpenAt)}`,
        tone: "editable" as const,
      };
    }
    return {
      text: "Bloqueado (revisión habilitada)",
      tone: "blocked" as const,
    };
  }

  React.useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = getAuthToken();
        if (!token) {
          setError("Hubo un error. Reintentá.");
          return;
        }
        const res = await fetch(
          `${API}/exams/${code}/attempts?view=bandeja`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          if (!cancelled) {
            setError("Hubo un error. Reintentá.");
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.attempts)
          ? data.attempts
          : Array.isArray(data)
          ? data
          : [];
        if (process.env.NODE_ENV !== "production" && items.length === 0) {
          console.warn("Bandeja attempts empty; response shape:", data);
        }
        setAttempts(items);
      } catch {
        if (!cancelled) {
          setError("Hubo un error. Reintentá.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, reloadKey]);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-festive text-3xl text-gradient-aurora">
              Corrección manual
            </h1>
            <p className="text-xs text-gray-500">Examen: {code}</p>
          </div>
          <Link
            href={`/t/${code}`}
            className="btn-aurora px-4 py-2 rounded-xl text-xs font-bold"
          >
            Volver a configuracion
          </Link>
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

        <div className="glass-panel p-4 md:p-6 rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="py-2 px-2">Alumno</th>
                  <th className="py-2 px-2">Enviado</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-2">Nota</th>
                    <th className="py-2 px-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-4 px-2 text-gray-400" colSpan={5}>
                      Cargando intentos...
                    </td>
                  </tr>
                ) : attempts.length === 0 ? (
                  <tr>
                    <td className="py-4 px-2 text-gray-400" colSpan={5}>
                      Todavia no hay intentos registrados.
                    </td>
                  </tr>
                ) : (
                  attempts.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="py-3 px-2 font-semibold text-gray-700">
                        {row.studentName || "Sin nombre"}
                      </td>
                      <td className="py-3 px-2 text-gray-500">
                        {row.submittedAt
                          ? new Date(row.submittedAt).toLocaleString()
                          : "-"}
                      </td>
                        <td className="py-3 px-2 text-gray-500">
                          {mapStatus(row.status)}
                          {(() => {
                            const isFinal = isFinalStatus(row.status);
                            const label = isFinal
                              ? getEditLabel(row.status, row.reviewOpenAt ?? null)
                              : row.score !== null && row.score !== undefined
                              ? { text: "Borrador guardado", tone: "draft" as const }
                              : { text: "A corregir", tone: "neutral" as const };
                            const toneClass =
                              label.tone === "editable"
                                ? "text-emerald-600"
                                : label.tone === "blocked"
                                ? "text-rose-600"
                                : label.tone === "draft"
                                ? "text-sky-600"
                                : "text-slate-500";
                            return (
                              <div className={`text-[11px] mt-1 ${toneClass}`}>
                                {label.text}
                              </div>
                            );
                          })()}
                        </td>
                      <td className="py-3 px-2 text-gray-500">
                        {row.score != null ? row.score : "-"}
                      </td>
                        <td className="py-3 px-2">
                          <Link
                            href={`/t/exams/${code}/grading/${row.id}`}
                            className="btn-aurora px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            {isFinalStatus(row.status) ? "Ver" : "Corregir"}
                          </Link>
                        </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
