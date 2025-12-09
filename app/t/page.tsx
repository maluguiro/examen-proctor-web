// web/app/t/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";
import { loadTeacherProfile, type TeacherProfile } from "@/lib/teacherProfile";

type ExamListItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  code: string;
  durationMins?: number | null;
  lives?: number | null;
};

export default function TeacherHomePage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [exams, setExams] = React.useState<ExamListItem[]>([]);

  const [profile, setProfile] = React.useState<TeacherProfile | null>(null);

  const [search, setSearch] = React.useState(""); // 🔎 texto del buscador

  React.useEffect(() => {
    const p = loadTeacherProfile();
    setProfile(p);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/exams`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setExams(data || []);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "No se pudieron cargar los exámenes.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function createExam() {
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/exams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Examen sin título",
          lives: 3,
          durationMins: 60,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const exam = await res.json();
      const code = exam.code || String(exam.id).slice(0, 6);
      router.push(`/t/${code}`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "No se pudo crear el examen.");
    } finally {
      setCreating(false);
    }
  }

  async function copyStudentLink(code: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/s/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copiado para enviar a los alumnos:\n" + url);
    } catch {
      alert("No pude copiar automáticamente. Link:\n" + url);
    }
  }

  function formatDate(dt: string) {
    if (!dt) return "—";
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString();
    } catch {
      return "—";
    }
  }

  function statusBadge(status: string) {
    const s = String(status || "").toUpperCase();
    let bg = "#e5e7eb";
    let color = "#111827";
    let label = s;
    if (s === "OPEN") {
      bg = "#dcfce7";
      color = "#166534";
      label = "Abierto";
    } else if (s === "DRAFT") {
      bg = "#fee2e2";
      color = "#991b1b";
      label = "Borrador";
    }
    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
          background: bg,
          color,
        }}
      >
        {label}
      </span>
    );
  }

  // 🔎 Filtrado en memoria por título o código
  const filteredExams = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((e) => {
      const title = (e.title || "").toLowerCase();
      const code = (e.code || "").toLowerCase();
      return title.includes(q) || code.includes(q);
    });
  }, [exams, search]);

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: 24,
        display: "grid",
        gap: 16,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
            }}
          >
            Panel docente
          </h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.75 }}>
            Acá ves todos tus exámenes, podés entrar a configurarlos, abrir el
            tablero y copiar el link para los alumnos.
          </p>
          {profile?.name && (
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>
              Docente: <b>{profile.name}</b>
              {profile.institution && <> · {profile.institution}</>}
            </p>
          )}
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/t/profile")}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #d4d4d8",
              background: "#f9fafb",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            👤 Perfil docente
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #d4d4d8",
              background: "#fafafa",
              cursor: loading ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            {loading ? "Actualizando…" : "Refrescar lista"}
          </button>
          <button
            onClick={createExam}
            disabled={creating}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: creating ? "#9ca3af" : "#22c55e",
              color: "white",
              cursor: creating ? "default" : "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {creating ? "Creando…" : "➕ Crear examen"}
          </button>
        </div>
      </header>

      {/* Error */}
      {err && (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 8,
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      {/* Lista de exámenes */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "white",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: 18 }}>
            Exámenes ({filteredExams.length}/{exams.length})
          </h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título o código…"
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #d4d4d8",
              fontSize: 13,
              minWidth: 220,
            }}
          />
        </div>

        {loading && <p style={{ fontSize: 13 }}>Cargando exámenes…</p>}

        {!loading && exams.length === 0 && (
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            Todavía no hay exámenes. Creá uno nuevo con el botón de arriba.
          </p>
        )}

        {!loading && exams.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f3f4f6",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}>
                    Título
                  </th>
                  <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}>
                    Código
                  </th>
                  <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}>
                    Estado
                  </th>
                  <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}>
                    Creado
                  </th>
                  <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}>
                    Duración
                  </th>
                  <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}>
                    Vidas
                  </th>
                  <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map((e) => (
                  <tr key={e.id}>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {e.title || "(sin título)"}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                        fontFamily: "monospace",
                      }}
                    >
                      {e.code}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {statusBadge(e.status)}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {formatDate(e.createdAt)}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {e.durationMins != null ? `${e.durationMins} min` : "—"}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {e.lives != null ? e.lives : "—"}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => router.push(`/t/${e.code}`)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #d4d4d8",
                            background: "#f9fafb",
                            cursor: "pointer",
                          }}
                        >
                          Configurar / Tablero
                        </button>
                        <button
                          type="button"
                          onClick={() => copyStudentLink(e.code)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #22c55e",
                            background: "#dcfce7",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Copiar link alumnos
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
