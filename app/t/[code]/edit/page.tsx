"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

const ALL_KINDS = [
  { key: "TRUE_FALSE", label: "Verdadero / Falso" },
  { key: "MCQ", label: "Multiple Choice" },
  { key: "SHORT_TEXT", label: "Texto breve" },
  { key: "FILL_IN", label: "Relleno de casilleros" },
];

export default function EditExam({
  params: { code },
}: {
  params: { code: string };
}) {
  const [duration, setDuration] = useState<number>(60);
  const [kinds, setKinds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/exams/${code}`);
        if (!r.ok) return;
        const data = await r.json();
        setDuration(data.exam?.durationMinutes ?? 60);
        setKinds(data.exam?.allowedTypes ?? []);
      } catch {}
    })();
  }, [code]);

  function toggleKind(k: string) {
    setKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  }

  async function onSave(openAfter = false) {
    try {
      setErr(null);
      const body: any = {
        durationMinutes: Number(duration) || 60,
        allowedKinds: kinds,
      };
      if (openAfter) body.isOpen = true;

      const r = await fetch(`${API}/exams/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      alert(openAfter ? "Guardado y abierto" : "Guardado");
    } catch (e: any) {
      setErr(e?.message || "Error guardando");
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Editor de examen – {code}</h1>

      <div style={{ marginTop: 12 }}>
        <label>Duración (minutos): </label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 60)}
          style={{
            border: "1px solid #ccc",
            padding: 6,
            width: 120,
            marginLeft: 6,
          }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div>Modalidades habilitadas:</div>
        <div
          style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}
        >
          {ALL_KINDS.map((k) => (
            <label key={k.key}>
              <input
                type="checkbox"
                checked={kinds.includes(k.key)}
                onChange={() => toggleKind(k.key)}
              />
              <span style={{ marginLeft: 6 }}>{k.label}</span>
            </label>
          ))}
        </div>
      </div>

      {err && <div style={{ color: "red", marginTop: 10 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => onSave(false)}>💾 Guardar</button>
        <button onClick={() => onSave(true)}>✅ Guardar y abrir examen</button>
        <a
          href={`/t/${code}`}
          style={{ textDecoration: "none", marginLeft: "auto" }}
        >
          <button>Volver al tablero</button>
        </a>
      </div>
    </main>
  );
}
