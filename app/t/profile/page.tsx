"use client";

import * as React from "react";

type TeacherProfile = {
  name: string;
  institution: string;
  email: string;
  message: string;
};

const STORAGE_KEY = "teacherProfile";

export default function TeacherProfilePage() {
  const [profile, setProfile] = React.useState<TeacherProfile>({
    name: "",
    institution: "",
    email: "",
    message: "",
  });

  const [status, setStatus] = React.useState<string | null>(null);

  // Cargar perfil desde localStorage (si existe)
  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      setProfile({
        name: data?.name ?? "",
        institution: data?.institution ?? "",
        email: data?.email ?? "",
        message: data?.message ?? "",
      });
    } catch (e) {
      console.error("PROFILE_LOAD_ERROR", e);
    }
  }, []);

  const handleChange =
    (field: keyof TeacherProfile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setProfile((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!profile.name.trim()) {
      setStatus("Ingresá al menos tu nombre para guardar el perfil.");
      return;
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      }
      setStatus("Perfil guardado.");
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      console.error("PROFILE_SAVE_ERROR", err);
      setStatus("No se pudo guardar el perfil en este navegador.");
    }
  };

  const handleReset = () => {
    setProfile({
      name: "",
      institution: "",
      email: "",
      message: "",
    });
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
    setStatus("Perfil borrado en este navegador.");
    setTimeout(() => setStatus(null), 2500);
  };

  const initial = profile.name
    ? profile.name.trim().charAt(0).toUpperCase()
    : "D";

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 900,
        margin: "0 auto",
        display: "grid",
        gap: 16,
      }}
    >
      {/* Volver al panel */}
      <div
        style={{
          fontSize: 13,
          opacity: 0.7,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <a href="/t" style={{ textDecoration: "none", color: "#111" }}>
          ← Volver al panel docente
        </a>
      </div>

      {/* Cabecera */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "999px",
            background:
              "linear-gradient(135deg, #111827 0%, #4b5563 40%, #9ca3af 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 600,
            fontSize: 20,
          }}
        >
          {initial}
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Perfil docente</h1>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Configurá tus datos para usarlos en tus exámenes.
          </div>
        </div>
      </div>

      {/* Formulario de perfil */}
      <form
        onSubmit={handleSubmit}
        style={{
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: 16,
          display: "grid",
          gap: 12,
          background: "#f9fafb",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            marginBottom: 4,
          }}
        >
          Datos del docente
        </h2>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          <Field label="Nombre y apellido *">
            <input
              type="text"
              value={profile.name}
              onChange={handleChange("name")}
              placeholder="Ej: Malena Guirotane"
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
              }}
            />
          </Field>

          <Field label="Institución / Universidad">
            <input
              type="text"
              value={profile.institution}
              onChange={handleChange("institution")}
              placeholder="Ej: UDEMM"
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
              }}
            />
          </Field>

          <Field label="Correo de contacto">
            <input
              type="email"
              value={profile.email}
              onChange={handleChange("email")}
              placeholder="Ej: nombre.apellido@institucion.edu"
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
              }}
            />
          </Field>

          <Field label="Mensaje para los alumnos (opcional)">
            <textarea
              value={profile.message}
              onChange={handleChange("message")}
              placeholder="Este mensaje puede mostrarse al inicio del examen (instrucciones, saludo, etc.)"
              rows={3}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </Field>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 4,
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              background: "black",
              color: "white",
              cursor: "pointer",
            }}
          >
            Guardar perfil
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontSize: 14,
              fontWeight: 500,
              background: "white",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            Borrar datos
          </button>
        </div>

        {status && (
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              opacity: 0.8,
            }}
          >
            {status}
          </div>
        )}
      </form>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{props.label}</div>
      <div>{props.children}</div>
    </div>
  );
}
