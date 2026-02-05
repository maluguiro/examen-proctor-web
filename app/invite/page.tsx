"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { acceptInvite, getAuthToken } from "@/lib/api";

function InviteInner() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams?.get("token") || "";

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tokenParam) {
      setError("Token invalido.");
      return;
    }

    const auth = getAuthToken();
    if (!auth) {
      const returnUrl = `/invite?token=${encodeURIComponent(tokenParam)}`;
      window.location.href = `/t?returnUrl=${encodeURIComponent(returnUrl)}`;
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await acceptInvite(tokenParam);
        if (cancelled) return;
        const examCode =
          res?.examCode || res?.code || res?.exam?.code || res?.examId || "";
        if (!examCode) {
          setError("No se pudo aceptar la invitación.");
          return;
        }
        window.location.href = `/t/exams/${String(examCode).toUpperCase()}/grading?updated=1`;
      } catch (e: any) {
        if (process.env.NODE_ENV !== "production") {
          console.error("INVITE_ACCEPT_ERROR", e);
        }
        if (e?.message === "UNAUTHORIZED") {
          setError("Sesión expirada. Iniciá sesión nuevamente.");
        } else {
          setError("No se pudo aceptar la invitación.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tokenParam]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-panel p-8 rounded-3xl w-full max-w-md text-center">
        <h1 className="font-festive text-3xl text-gradient-aurora mb-4">
          Invitación
        </h1>
        {loading && <p className="text-sm text-gray-500">Procesando...</p>}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {error}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-aurora px-4 py-2 rounded-lg text-xs font-bold"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass-panel p-8 rounded-3xl w-full max-w-md text-center">
            <h1 className="font-festive text-3xl text-gradient-aurora mb-4">
              Invitación
            </h1>
            <p className="text-sm text-gray-500">Cargando...</p>
          </div>
        </div>
      }
    >
      <InviteInner />
    </React.Suspense>
  );
}
