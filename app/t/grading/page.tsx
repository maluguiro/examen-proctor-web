"use client";

import * as React from "react";
import Link from "next/link";
import { API, getAuthToken } from "@/lib/api";

type ManualExamRow = {
  code: string;
  title?: string | null;
  pendingCount?: number | null;
  submittedCount?: number | null;
  lastSubmissionAt?: string | null;
};

export default function GlobalManualGradingPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<ManualExamRow[]>([]);
  const [reloadKey, setReloadKey] = React.useState(0);

  const handleRetry = React.useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = getAuthToken();
        if (!token) {
          setError("Sesión expirada. Iniciá sesión nuevamente.");
          return;
        }

        const res = await fetch(`${API}/grading/manual-exams`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("Sesión expirada. Iniciá sesión nuevamente.");
          } else {
            setError("Hubo un error. Reintentá.");
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : data?.items ?? []);
      } catch {
        if (!cancelled) setError("Hubo un error. Reintentá.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-festive text-3xl text-gradient-aurora">
              Corrección manual
            </h1>
            <p className="text-xs text-gray-500">
              Bandeja global de exámenes pendientes.
            </p>
          </div>
          <Link
            href="/t"
            className="btn-aurora px-4 py-2 rounded-xl text-xs font-bold"
          >
            Volver
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

        <div className="glass-panel p-6 rounded-3xl">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Exámenes pendientes
          </h2>

          {loading ? (
            <div className="text-sm text-gray-500">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">
              No hay exámenes manuales con entregas pendientes.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="py-2">Examen</th>
                    <th className="py-2">Pendientes</th>
                    <th className="py-2">Entregados</th>
                    <th className="py-2">Último envío</th>
                    <th className="py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.code}
                      className="border-t border-white/40"
                    >
                      <td className="py-3">
                        <div className="font-semibold text-gray-800">
                          {row.title || "Examen"}
                        </div>
                        <div className="text-xs text-gray-500">
                          Código: {row.code}
                        </div>
                      </td>
                      <td className="py-3">{row.pendingCount ?? 0}</td>
                      <td className="py-3">{row.submittedCount ?? 0}</td>
                      <td className="py-3">
                        {row.lastSubmissionAt
                          ? new Date(row.lastSubmissionAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/t/exams/${row.code}/grading`}
                          className="btn-aurora px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
