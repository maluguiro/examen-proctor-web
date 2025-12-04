"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";

type ExamItem = {
  id: string;
  code: string;
  title: string;
  subject: string | null;
  teacherName: string | null;
  status: string;
  openAt: string | null;
  createdAt: string | null;
};

type ListResponse = {
  exams: ExamItem[];
};

const TEACHER_KEY = "exam_teacher_name";

export default function TeacherProfilePage() {
  const router = useRouter();

  const [teacherName, setTeacherName] = React.useState("");
  const [initialLoaded, setInitialLoaded] = React.useState(false);

  const [loadingList, setLoadingList] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exams, setExams] = React.useState<ExamItem[]>([]);

  // 1) Cargar nombre del docente desde localStorage al entrar
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(TEACHER_KEY);
    if (saved) {
      setTeacherName(saved);
    }
    setInitialLoaded(true);
  }, []);

  // 2) Guardar nombre del docente en localStorage
  function saveTeacherName() {
    const name = teacherName.trim();
    if (!name) {
      setError("Ingresá tu nombre como docente.");
      return;
    }
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEACHER_KEY, name);
    }
  }

  // 3) Cargar exámenes de este docente
  async function loadExams() {
    const name = teacherName.trim();
    if (!name) {
      setError("Ingresá tu nombre como docente antes de buscar.");
      return;
    }
    setError(null);
    setLoadingList(true);

    try {
      const url = `${API}/exams?teacherName=${encodeURIComponent(name)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data: ListResponse = await res.json();
      setExams(data.exams || []);
    } catch (e: any) {
      console.error("LOAD_EXAMS_ERROR", e);
      setError(e?.message || "No se pudieron cargar tus exámenes.");
    } finally {
      setLoadingList(false);
    }
  }

  // 4) Helpers de UI
  function formatDate(dt: string | null) {
    if (!dt) return "—";
    try {
      const d = new Date(dt);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString();
    } catch {
      return "—";
    }
  }

  function statusLabel(status: string) {
    const s = String(status || "").toUpperCase();
    if (s === "OPEN") return "Abierto";
    if (s === "DRAFT") return "Borrador";
    if (s === "CLOSED") return "Cerrado";
    return s;
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 960,
    margin: "0 auto",
    padding: 24,
    display: "grid",
    gap: 16,
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  return (
    <main style={containerStyle}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Perfil docente</h1>
        <p style={{ marginTop: 4, fontSize: 14, opacity: 0.8 }}>
          Acá podés guardar tu nombre, ver tus exámenes y saltar directo al
          tablero de cada uno.
        </p>
      </header>

      {/* Sección: Nombre del docente */}
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Tu información básica</h2>
        <div style={{ display: "grid", gap: 10, maxWidth: 480 }}>
          <div>
            <label style={{ fontSize: 13, display: "block" }}>
              Nombre del docente
            </label>
            <input
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Ej: Prof. Gómez"
              style={{
                marginTop: 4,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                width: "100%",
              }}
            />
            <p style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              Usamos este nombre para buscar los exámenes donde figure como
              docente.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={saveTeacherName}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "white",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Guardar nombre
            </button>
            <button
              type="button"
              onClick={loadExams}
              disabled={loadingList}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: loadingList ? "#e5e7eb" : "#f9fafb",
                fontSize: 14,
                cursor: loadingList ? "default" : "pointer",
              }}
            >
              {loadingList ? "Buscando…" : "Ver mis exámenes"}
            </button>
          </div>
        </div>
      </section>

      {/* Sección: Lista de exámenes */}
      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Mis exámenes</h2>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            Total: {exams.length}
          </span>
        </div>

        {!loadingList && exams.length === 0 && (
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            No encontramos exámenes para este docente. Verificá el nombre, o
            creá exámenes usando ese mismo nombre en el paso 1 del armado.
          </p>
        )}

        {loadingList && (
          <p style={{ fontSize: 13 }}>Cargando exámenes…</p>
        )}

        {exams.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                fontSize: 13,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f3f4f6",
                    textAlign: "left",
                  }}
                >
                  <th
                    style={{
                      padding: 6,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Código
                  </th>
                  <th
                    style={{
                      padding: 6,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Título
                  </th>
                  <th
                    style={{
                      padding: 6,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Materia
                  </th>
                  <th
                    style={{
                      padding: 6,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Estado
                  </th>
                  <th
                    style={{
                      padding: 6,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Apertura
                  </th>
                  <th
                    style={{
                      padding: 6,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Creado
                  </th>
                  <th
                    style={{
                      padding: 6,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {exams.map((ex) => (
                  <tr key={ex.id}>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <code>{ex.code}</code>
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={ex.title}
                    >
                      {ex.title}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={ex.subject || undefined}
                    >
                      {ex.subject || "—"}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          background:
                            ex.status === "OPEN"
                              ? "#dcfce7"
                              : ex.status === "DRAFT"
                              ? "#e5e7eb"
                              : "#fee2e2",
                        }}
                      >
                        {statusLabel(ex.status)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(ex.openAt)}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(ex.createdAt)}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/t/${ex.code}`)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          background: "#f9fafb",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Abrir tablero
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </section>

      <section style={{ fontSize: 12, opacity: 0.7 }}>
        <a href="/t" style={{ textDecoration: "none" }}>
          ← Volver al panel docente
        </a>
      </section>
    </main>
  );
}
