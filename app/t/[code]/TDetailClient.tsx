"use client";

import { useEffect, useState } from "react";

type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_text"
  | "long_text"
  | "numeric";
type Exam = {
  id: string;
  title: string;
  allowedTypes: QuestionType[];
  durationMinutes?: number;
  isOpen: boolean;
};

const API = {
  get: (p: string) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}${p}`, { cache: "no-store" }).then(
      (r) => r.json()
    ),
  json: (p: string, m: "POST" | "PUT" | "PATCH" | "DELETE", b: any) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}${p}`, {
      method: m,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    }).then((r) => r.json()),
};

export default function TDetailClient({ code }: { code: string }) {
  const [exam, setExam] = useState<Exam | null>(null);

  const load = async () => setExam((await API.get(`/exams/${code}`)).exam);
  useEffect(() => {
    load();
  }, [code]);

  const toggle = async () => {
    if (!exam) return;
    setExam(await API.json(`/exams/${code}`, "PUT", { isOpen: !exam.isOpen }));
  };

  if (!exam) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{exam.title}</h1>
      <div>
        Abierto: <b>{exam.isOpen ? "Sí" : "No"}</b>
      </div>
      {typeof exam.durationMinutes === "number" && (
        <div>Duración: {exam.durationMinutes} min</div>
      )}
      <div>Modalidades: {exam.allowedTypes.join(", ")}</div>

      <div className="flex gap-3">
        <button
          className="px-4 py-2 rounded bg-black text-white"
          onClick={toggle}
        >
          {exam.isOpen ? "Cerrar" : "Abrir"}
        </button>
        <a className="underline" href={`/t/${code}/edit`}>
          Configurar / Builder →
        </a>
        <a className="underline" href={`/e/${code}`}>
          Ver como estudiante →
        </a>
      </div>
    </div>
  );
}
