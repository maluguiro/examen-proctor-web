"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getAuthToken,
  getTeacherProfile,
  updateTeacherProfile,
} from "@/lib/api";

// --- Tipos ---

type Subject = {
  id: string;
  name: string;
};

type Institution = {
  id: string;
  name: string;
  subjects: Subject[];
};

type TeacherProfile = {
  fullName: string;
  institutions: Institution[];
};

// --- Componente Principal ---

export default function TeacherProfilePage() {
  const router = useRouter();

  // Estado
  const [profile, setProfile] = React.useState<TeacherProfile>({
    fullName: "",
    institutions: [],
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // --- Carga Inicial ---
  React.useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push("/t");
      return;
    }

    setLoading(true);
    getTeacherProfile(token)
      .then((data) => {
        // Mapeo seguro de datos
        setProfile({
          fullName: data.fullName || data.name || "",
          institutions: Array.isArray(data.institutions)
            ? data.institutions
            : [],
        });
      })
      .catch((err) => {
        console.error("Error cargando perfil:", err);
        setStatus({
          type: "error",
          msg: "No se pudo cargar el perfil.",
        });
      })
      .finally(() => setLoading(false));
  }, [router]);

  // --- Handlers de Estado ---

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile((p) => ({ ...p, fullName: e.target.value }));
  };

  const addInstitution = () => {
    setProfile((p) => ({
      ...p,
      institutions: [
        ...p.institutions,
        {
          id: `new-inst-${Date.now()}`,
          name: "",
          subjects: [],
        },
      ],
    }));
  };

  const removeInstitution = (instId: string) => {
    if (!confirm("¿Seguro que querés eliminar esta institución?")) return;
    setProfile((p) => ({
      ...p,
      institutions: p.institutions.filter((i) => i.id !== instId),
    }));
  };

  const updateInstitutionName = (instId: string, name: string) => {
    setProfile((p) => ({
      ...p,
      institutions: p.institutions.map((i) =>
        i.id === instId ? { ...i, name } : i
      ),
    }));
  };

  const addSubject = (instId: string) => {
    setProfile((p) => ({
      ...p,
      institutions: p.institutions.map((i) => {
        if (i.id === instId) {
          return {
            ...i,
            subjects: [
              ...i.subjects,
              { id: `new-subj-${Date.now()}`, name: "" },
            ],
          };
        }
        return i;
      }),
    }));
  };

  const removeSubject = (instId: string, subjId: string) => {
    setProfile((p) => ({
      ...p,
      institutions: p.institutions.map((i) => {
        if (i.id === instId) {
          return {
            ...i,
            subjects: i.subjects.filter((s) => s.id !== subjId),
          };
        }
        return i;
      }),
    }));
  };

  const updateSubjectName = (instId: string, subjId: string, name: string) => {
    setProfile((p) => ({
      ...p,
      institutions: p.institutions.map((i) => {
        if (i.id === instId) {
          return {
            ...i,
            subjects: i.subjects.map((s) =>
              s.id === subjId ? { ...s, name } : s
            ),
          };
        }
        return i;
      }),
    }));
  };

  // --- Guardado ---

  const handleSave = async () => {
    setStatus(null);
    const token = getAuthToken();
    if (!token) {
      router.push("/t");
      return;
    }

    if (!profile.fullName.trim()) {
      setStatus({ type: "error", msg: "El nombre completo es obligatorio." });
      return;
    }

    setSaving(true);
    try {
      await updateTeacherProfile(token, profile);
      setStatus({ type: "success", msg: "Cambios guardados correctamente." });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error("Error guardando:", err);
      setStatus({ type: "error", msg: "Hubo un error al guardar." });
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = false; // Podría implementarse comparando con estado inicial

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
        Cargando perfil...
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "24px 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.push("/t")}
          style={{
            background: "none",
            border: "none",
            color: "#666",
            cursor: "pointer",
            marginBottom: 8,
            fontSize: 14,
            padding: 0,
          }}
        >
          ← Volver al panel
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
          Mi Perfil Docente
        </h1>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
          Gestioná tus datos personales y tus materias.
        </p>
      </div>

      {/* Datos Personales */}
      <section
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>
          Datos Personales
        </h2>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Nombre Completo
          </label>
          <input
            type="text"
            value={profile.fullName}
            onChange={handleNameChange}
            placeholder="Tu nombre real"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </div>
      </section>

      {/* Instituciones y Materias */}
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Instituciones y Materias
          </h2>
          <button
            onClick={addInstitution}
            style={{
              background: "#22c55e",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            + Nueva Institución
          </button>
        </div>

        {profile.institutions.length === 0 ? (
          <div
            style={{
              background: "#f9fafb",
              padding: 24,
              borderRadius: 12,
              textAlign: "center",
              color: "#6b7280",
              fontSize: 14,
              border: "1px dashed #d1d5db",
            }}
          >
            No tenés instituciones cargadas. Agregá una para empezar.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {profile.institutions.map((inst) => (
              <div
                key={inst.id}
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                {/* Header Institución */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 16,
                    alignItems: "start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      Institución
                    </label>
                    <input
                      type="text"
                      value={inst.name}
                      onChange={(e) =>
                        updateInstitutionName(inst.id, e.target.value)
                      }
                      placeholder="Ej: Universidad de Buenos Aires"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <button
                    onClick={() => removeInstitution(inst.id)}
                    title="Eliminar institución"
                    style={{
                      marginTop: 20,
                      background: "white",
                      border: "1px solid #fecaca",
                      color: "#ef4444",
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    🗑️
                  </button>
                </div>

                {/* Materias */}
                <div
                  style={{
                    background: "#f9fafb",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#4b5563",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Materias
                    </span>
                    <button
                      onClick={() => addSubject(inst.id)}
                      style={{
                        background: "white",
                        border: "1px solid #d1d5db",
                        fontSize: 11,
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      + Agregar
                    </button>
                  </div>

                  {inst.subjects.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
                      Sin materias.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {inst.subjects.map((subj) => (
                        <div
                          key={subj.id}
                          style={{ display: "flex", gap: 8 }}
                        >
                          <input
                            type="text"
                            value={subj.name}
                            onChange={(e) =>
                              updateSubjectName(
                                inst.id,
                                subj.id,
                                e.target.value
                              )
                            }
                            placeholder="Nombre de la materia"
                            style={{
                              flex: 1,
                              padding: "6px",
                              borderRadius: 4,
                              border: "1px solid #d1d5db",
                              fontSize: 13,
                            }}
                          />
                          <button
                            onClick={() => removeSubject(inst.id, subj.id)}
                            style={{
                              border: "none",
                              background: "none",
                              color: "#ef4444",
                              fontSize: 16,
                              cursor: "pointer",
                              padding: "0 4px",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Actions */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          alignItems: "center",
        }}
      >
        {status && (
          <span
            style={{
              fontSize: 14,
              color: status.type === "success" ? "#166534" : "#991b1b",
              fontWeight: 500,
            }}
          >
            {status.msg}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 24px",
            background: "#111",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
