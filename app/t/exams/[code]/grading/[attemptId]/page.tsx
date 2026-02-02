"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function GradingDetailPage() {
  const params = useParams<{ code: string; attemptId: string }>();
  const code = (params?.code || "").toString().toUpperCase();
  const attemptId = (params?.attemptId || "").toString();

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-festive text-3xl text-gradient-aurora">
              Correcci�n manual
            </h1>
            <p className="text-xs text-gray-500">
              Examen: {code} � Intento: {attemptId}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Respuestas del alumno
            </h2>
            <div className="text-sm text-gray-500">Pr�ximamente.</div>
          </div>
          <div className="glass-panel p-6 rounded-3xl">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Nota final
            </h3>
            <div className="text-3xl font-extrabold text-gray-800 mb-4">
              �
            </div>
            <div className="text-xs text-gray-500 mb-6">
              Advertencias: sin datos por ahora.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled
                className="btn-aurora px-4 py-2 rounded-lg text-xs font-bold opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                disabled
                className="btn-aurora-primary px-4 py-2 rounded-lg text-xs font-bold opacity-60"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
