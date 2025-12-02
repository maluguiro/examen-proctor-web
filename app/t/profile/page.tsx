"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  loadTeacherProfile,
  saveTeacherProfile,
  type TeacherProfile,
} from "@/lib/teacherProfile";

export default function TeacherProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<TeacherProfile>({
    name: "",
    subject: "",
    institution: "",
    email: "",
  });
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const p = loadTeacherProfile();
    if (p) {
      setProfile((prev) => ({
        ...prev,
        ...p,
      }));
    }
    setLoaded(true);
  }, []);

  function update<K extends keyof TeacherProfile>(
    key: K,
    value: TeacherProfile[K]
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const trimmed: TeacherProfile = {
        name: profile.name.trim(),
        subject: profile.subject?.trim() || "",
        institution: profile.institution?.trim() || "",
        email: profile.email?.trim() || "",
      };
      saveTeacherProfile(trimmed);
      alert("Perfil guardado. Se usará como prellenado en tus exámenes.");
      router.push("/t");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: 24,
        }}
      >
        <p>Cargando perfil…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 24,
        display: "grid",
        gap: 16,
      }}
    >
      <header>
        <h1 style={{ margin: 0, fontSize: 24 }}>Perfil docente</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, opacity: 0.75 }}>
          Estos datos se guardan en este navegador y se usarán como prellenado
          en los exámenes que configures (nombre del docente, materia, etc.).
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "white",
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <label style={{ fontSize: 13, display: "block" }}>
            Nombre del docente
          </label>
          <input
            value={profile.name}
            onChange={(e) => update("name", e.target.value)}
            required
            placeholder="Ej: Lic. Malena Guirotane"
            style={{
              marginTop: 4,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #d4d4d8",
              width: "100%",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, display: "block" }}>
            Materia principal
          </label>
          <input
            value={profile.subject || ""}
            onChange={(e) => update("subject", e.target.value)}
            placeholder="Ej: Psicología General, Programación I…"
            style={{
              marginTop: 4,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #d4d4d8",
              width: "100%",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, display: "block" }}>
            Institución principal
          </label>
          <input
            value={profile.institution || ""}
            onChange={(e) => update("institution", e.target.value)}
            placeholder="Ej: Universidad X, Instituto Y…"
            style={{
              marginTop: 4,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #d4d4d8",
              width: "100%",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, display: "block" }}>
            Email de contacto (opcional)
          </label>
          <input
            type="email"
            value={profile.email || ""}
            onChange={(e) => update("email", e.target.value)}
            placeholder="Ej: profe@colegio.edu"
            style={{
              marginTop: 4,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #d4d4d8",
              width: "100%",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <a
            href="/t"
            style={{
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            ← Volver al panel docente
          </a>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "none",
              background: saving ? "#9ca3af" : "#2563eb",
              color: "white",
              fontSize: 14,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Guardando…" : "Guardar perfil"}
          </button>
        </div>
      </form>
    </main>
  );
}
