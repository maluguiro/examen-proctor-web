"use client";
import * as React from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function ExamsList() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/exams`, { cache: "no-store" });
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }
  React.useEffect(() => {
    load();
  }, []);

  function copyLink(pubCode: string) {
    const link = `${window.location.origin}/s/${pubCode}`;
    navigator.clipboard.writeText(link);
    alert("Link copiado: " + link);
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Exámenes</h2>
      {loading && <p>Cargando…</p>}
      {!loading && !items.length && <p>No hay exámenes.</p>}
      <ul>
        {items.map((e) => (
          <li
            key={e.id}
            style={{
              marginBottom: 8,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <b>{e.title}</b>
            <span>({e.publicCode})</span>
            <a href={`/t/${e.publicCode}`} style={{ marginLeft: "auto" }}>
              Abrir
            </a>
            <button onClick={() => copyLink(e.publicCode)}>
              Copiar link alumno
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
