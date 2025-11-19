"use client";
import * as React from "react";
import ExamChat from "@/components/ExamChat";

const API = process.env.NEXT_PUBLIC_API_URL!;

type Attempt = {
  id: string;
  studentName: string;
  livesRemaining: number;
  paused: boolean;
  violations?: string; // JSON de strings
  startedAt?: string;
};

export default function BoardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = React.use(params);

  const [items, setItems] = React.useState<Attempt[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/exams/${code}/attempts`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setItems(data.attempts ?? []);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Simular alumno (para pruebas locales)
  async function mockAdd() {
    if (!newName.trim()) return;
    await fetch(`${API}/exams/${code}/attempts/mock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentName: newName.trim() }),
    }).catch(() => {});
    setNewName("");
    await load();
  }

  // Operaciones: pause/resume/vidas
  async function op(id: string, fn: "pause" | "resume" | "lives", body?: any) {
    const url =
      fn === "lives"
        ? `${API}/attempts/${id}/lives`
        : `${API}/attempts/${id}/${fn}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {});
    await load();
  }

  const total = items.length;

  return (
    <div
      style={{
        padding: 16,
        display: "grid",
        gap: 12,
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <h2>Tablero — {code}</h2>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <b>Participantes:</b> {total}
        <div style={{ marginLeft: "auto" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre alumno (mock)"
          />
          <button onClick={mockAdd} style={{ marginLeft: 8 }}>
            ➕ Simular alumno
          </button>
        </div>
      </div>
      {/* Botones de export del chat */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <a
          href={`${API}/exams/${code}/chat.csv`}
          target="_blank"
          rel="noreferrer"
        >
          <button>⬇️ Exportar chat (CSV)</button>
        </a>
        <a
          href={`${API}/exams/${code}/chat.json`}
          target="_blank"
          rel="noreferrer"
        >
          <button>⬇️ Exportar chat (JSON)</button>
        </a>
        <a
          href={`${API}/exams/${code}/chat.docx`}
          target="_blank"
          rel="noreferrer"
        >
          <button>⬇️ Exportar chat (Word)</button>
        </a>
        <a
          href={`${API}/exams/${code}/chat.print`}
          target="_blank"
          rel="noreferrer"
        >
          <button>🖨️ Imprimir / PDF</button>
        </a>
      </div>

      {err && (
        <div
          style={{
            background: "#fee",
            border: "1px solid #f99",
            padding: 8,
            borderRadius: 8,
          }}
        >
          Error: {err}
        </div>
      )}

      <div style={{ border: "1px solid #ddd", borderRadius: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 2fr 2fr",
            gap: 8,
            padding: "8px 12px",
            background: "#f7f7f7",
            fontWeight: 600,
          }}
        >
          <div>Alumno</div>
          <div>Vidas</div>
          <div>Acciones</div>
          <div>Estado</div>
        </div>

        {loading && items.length === 0 && (
          <div style={{ padding: 12, opacity: 0.7 }}>Cargando…</div>
        )}

        {items.map((a) => {
          let vio: string[] = [];
          try {
            vio = a.violations ? JSON.parse(String(a.violations)) : [];
          } catch {}

          return (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 2fr 2fr",
                gap: 8,
                padding: "8px 12px",
                borderTop: "1px solid #eee",
              }}
            >
              <div>{a.studentName}</div>
              <div>{a.livesRemaining}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => op(a.id, "lives", { op: "inc" })}>
                  + Vida
                </button>
                <button onClick={() => op(a.id, "lives", { op: "forgive" })}>
                  💟 Perdonar vida
                </button>
                <button onClick={() => op(a.id, "lives", { op: "dec" })}>
                  - Vida
                </button>
                {a.paused ? (
                  <button onClick={() => op(a.id, "resume")}>▶ Reanudar</button>
                ) : (
                  <button onClick={() => op(a.id, "pause")}>⏸ Pausar</button>
                )}
                <button disabled>+5 min</button>
              </div>
              <div>
                {vio.length ? (
                  <span style={{ color: "red" }}>
                    Violaciones: {vio.join(", ")}
                  </span>
                ) : (
                  <span style={{ opacity: 0.7 }}>
                    {a.paused ? "Pausado" : "En curso"}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {!loading && items.length === 0 && (
          <div style={{ padding: 12, opacity: 0.7 }}>
            Aún no hay alumnos conectados.
          </div>
        )}
      </div>

      {/* Chat flotante (Docente) */}
      <ExamChat code={code} role="teacher" defaultName="Docente" />
    </div>
  );
}
