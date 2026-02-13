"use client";

import * as React from "react";
import { API, clearAuthToken, getAuthToken } from "@/lib/api";
import CalendarView from "../components/CalendarView";
import { useRouter } from "next/navigation";

type ExamListItem = {
  id: string;
  title: string;
  status: string;
  code: string;
  createdAt: string;
  subject?: string;
  date?: string;
  duration?: number;
  registeredCount?: number;
};

export default function TeacherCalendarPage() {
  const router = useRouter();
  const [exams, setExams] = React.useState<ExamListItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  React.useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setSessionExpired(true);
      setError("Sesión expirada. Iniciá sesión nuevamente.");
      return;
    }

    fetch(`${API}/teacher/exams`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          let body: any = null;
          try {
            body = await res.json();
          } catch {
            body = null;
          }
          if (body?.error === "INVALID_OR_EXPIRED_TOKEN") {
            clearAuthToken();
          }
          setSessionExpired(true);
          setError("Sesión expirada. Iniciá sesión nuevamente.");
          return { authError: true };
        }
        const data = await res.json();
        return { data };
      })
      .then((result) => {
        if (!result || (result as any).authError) return;
        const data = (result as any).data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.exams)
            ? data.exams
            : [];
        const normalized = list.map((e: any) => ({
          ...e,
          code: e.code ?? e.publicCode ?? e.public_code ?? "",
        }));
        setExams(normalized);
      })
      .catch(() => {
        setError("No se pudo cargar el calendario.");
        setExams([]);
      });
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden">
      {sessionExpired ? (
        <div className="h-full w-full flex items-center justify-center">
          <div className="glass-panel p-8 rounded-3xl text-center max-w-md">
            <div className="text-sm font-bold text-gray-700 mb-4">
              {error || "Sesión expirada. Iniciá sesión nuevamente."}
            </div>
            <button
              onClick={() =>
                router.push(`/t?returnUrl=${encodeURIComponent("/t/calendar")}`)
              }
              className="btn-aurora px-5 py-2 rounded-xl text-sm font-bold shadow-sm"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      ) : (
        <CalendarView exams={exams} profile={null} />
      )}
    </main>
  );
}
