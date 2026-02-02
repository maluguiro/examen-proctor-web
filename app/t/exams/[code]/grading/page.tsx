"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API } from "@/lib/api";

type AttemptRow = {
  id: string;
  studentName?: string | null;
  submittedAt?: string | null;
  status?: string | null;
  score?: number | null;
};

export default function GradingInboxPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  const [loading, setLoading] = React.useState(true);
  const [attempts, setAttempts] = React.useState<AttemptRow[]>([]);
  const [isPlaceholder, setIsPlaceholder] = React.useState(false);

  React.useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setIsPlaceholder(false);
        const res = await fetch(`${API}/exams/${code}/attempts`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setIsPlaceholder(true);
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setAttempts(items);
      } catch {
        if (!cancelled) {
          setIsPlaceholder(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-festive text-3xl text-gradient-aurora">
              Correcci�n manual
            </h1>
            <p className="text-xs text-gray-500">Examen: {code}</p>
          </div>
          <Link
            href={`/t/${code}`}
            className="btn-aurora px-4 py-2 rounded-xl text-xs font-bold"
          >
            Volver a configuraci�n
          </Link>
        </div>

        {isPlaceholder && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-sm font-semibold">
            Pr�ximamente.
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
                  <th className="py-2 px-2">Acci�n</th>
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
                      No hay intentos para corregir.
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
                        {row.status || "Pendiente"}
                      </td>
                      <td className="py-3 px-2 text-gray-500">
                        {row.score != null ? row.score : "-"}
                      </td>
                      <td className="py-3 px-2">
                        <Link
                          href={`/t/exams/${code}/grading/${row.id}`}
                          className="btn-aurora px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Corregir
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
