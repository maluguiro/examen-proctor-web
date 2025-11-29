"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function TeacherHomePage() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [codeInput, setCodeInput] = React.useState("");

  async function createExam() {
    setErr(null);
    setCreating(true);
    try {
      const res = await fetch(`${API}/exams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Examen sin título", // 👈 esto es lo que faltaba
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "No se pudo crear el examen");
      }

      const json = await res.json();
      const exam = json.exam ?? json; // tu backend devuelve los campos directo

      if (!exam.code) {
        throw new Error(
          "La API no devolvió el código del examen (campo 'code')."
        );
      }

      router.push(`/t/${exam.code}`);
    } catch (e: any) {
      setErr(e?.message || "Error al crear el examen");
    } finally {
      setCreating(false);
    }
  }
  function openExisting(e: React.FormEvent) {
    e.preventDefault();
    const c = codeInput.trim();
    if (!c) return;
    router.push(`/t/${c}`);
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 600,
        margin: "0 auto",
        display: "grid",
        gap: 24,
      }}
    >
      <header>
        <h1 style={{ margin: 0 }}>Panel docente</h1>
        <p style={{ color: "#555", marginTop: 8 }}>
          Desde acá podés crear exámenes nuevos y acceder a los que ya tenés
          creados.
        </p>
      </header>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Crear examen nuevo</h2>
        <p style={{ color: "#555", fontSize: 14 }}>
          Se generará un código único (como los links de Google Meet) y vas a
          pasar al armado del examen (título, duración, vidas, preguntas, etc.).
        </p>
        <button
          onClick={createExam}
          disabled={creating}
          style={{ padding: "8px 14px", fontSize: 14 }}
        >
          {creating ? "Creando…" : "➕ Crear examen nuevo"}
        </button>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Ir a un examen existente</h2>
        <form
          onSubmit={openExisting}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Código del examen (ej: SDOJE8)"
            style={{
              flex: 1,
              padding: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          />
          <button type="submit" style={{ padding: "8px 12px", fontSize: 14 }}>
            Abrir
          </button>
        </form>
      </section>

      {err && (
        <div
          style={{
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: 8,
            padding: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      )}
    </main>
  );
}
