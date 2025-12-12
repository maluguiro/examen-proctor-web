"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  API,
  loginTeacher,
  registerTeacher,
  saveAuthToken,
  getAuthToken,
  clearAuthToken,
} from "@/lib/api";
import { loadTeacherProfile, type TeacherProfile } from "@/lib/teacherProfile";
import TeacherDashboard from "./TeacherDashboard";

export default function TeacherHomePage() {
  const router = useRouter();

  // Auth State
  const [authToken, setAuthToken] = React.useState<string | null>(null);
  const [authChecking, setAuthChecking] = React.useState(true);
  const [authMode, setAuthMode] = React.useState<"login" | "register" | "forgot">("login");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  // Form State
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [firstName, setFirstName] = React.useState(""); // Not used, removing if present or adapting
  // Remember Me State
  const [rememberMe, setRememberMe] = React.useState(false);

  const [profile, setProfile] = React.useState<TeacherProfile | null>(null);

  // Check Token & Remember Me on Mount
  React.useEffect(() => {
    // Token
    const token = getAuthToken();
    if (token) {
      setAuthToken(token);
    }

    // Remember Me
    if (typeof window !== "undefined") {
      const savedEmail = window.localStorage.getItem("teacher_email_remember");
      if (savedEmail && !token) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }

    setAuthChecking(false);
  }, []);

  // Load Profile when Auth changes
  React.useEffect(() => {
    if (authToken && !profile) {
      const p = loadTeacherProfile();
      setProfile(p);
    }
  }, [authToken, profile]);


  // Auth Actions
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await loginTeacher({ email, password });

      // Handle Remember Me
      if (typeof window !== "undefined") {
        if (rememberMe) {
          window.localStorage.setItem("teacher_email_remember", email);
        } else {
          window.localStorage.removeItem("teacher_email_remember");
        }
      }

      saveAuthToken(res.token);
      setAuthToken(res.token);
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await registerTeacher({ name: fullName, email, password });
      saveAuthToken(res.token);
      setAuthToken(res.token);
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      // Importamos dinámicamente o usamos la función del api
      const { forgotPassword } = await import("@/lib/api");
      await forgotPassword(email);
      alert("Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.");
      setAuthMode("login");
    } catch (e: any) {
      setAuthError("Ocurrió un error al procesar la solicitud.");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    clearAuthToken();
    setAuthToken(null);
    setProfile(null);
    setAuthMode("login");
  }

  // --- RENDER ---

  if (authChecking) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
        Cargando sesión...
      </div>
    );
  }

  // 1) NO AUTENTICADO -> Pantalla de acceso
  if (!authToken) {
    return (
      <main
        style={{
          maxWidth: 400,
          margin: "80px auto 0",
          padding: 24,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
        }}
      >
        <h1 style={{ marginTop: 0, textAlign: "center", fontSize: 22 }}>
          {authMode === 'forgot' ? 'Recuperar Contraseña' : 'Acceso Docente'}
        </h1>

        {authMode !== 'forgot' && (
          <div style={{ display: "flex", marginBottom: 20 }}>
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
              style={{
                flex: 1,
                padding: "8px",
                background: authMode === "login" ? "#f3f4f6" : "transparent",
                border: "none",
                borderBottom:
                  authMode === "login" ? "2px solid #111" : "2px solid #e5e7eb",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
              }}
              style={{
                flex: 1,
                padding: "8px",
                background: authMode === "register" ? "#f3f4f6" : "transparent",
                border: "none",
                borderBottom:
                  authMode === "register" ? "2px solid #111" : "2px solid #e5e7eb",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {authError && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: 10,
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {authError}
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {authMode === 'forgot' ? (
          <form onSubmit={handleForgot}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Ingresá tu correo electrónico y te enviaremos un enlace para que restablezcas tu contraseña.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                Email de recuperación
              </label>
              <input
                type="email"
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid #d4d4d8",
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: 600,
                cursor: authLoading ? "default" : "pointer",
                marginBottom: 12,
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading ? "Enviando..." : "Enviar enlace"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              style={{
                width: "100%",
                padding: "8px",
                background: "transparent",
                border: "none",
                color: "#6b7280",
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Volver al inicio de sesión
            </button>
          </form>
        ) : (
          <form onSubmit={authMode === "login" ? handleLogin : handleRegister}>
            {authMode === "register" && (
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 6,
                    border: "1px solid #d4d4d8",
                  }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Email (usuario)
              </label>
              <input
                type="email"
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid #d4d4d8",
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid #d4d4d8",
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* REMEMBER ME CHECKBOX */}
            {authMode === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  Recordarme
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot');
                    setAuthError(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: 600,
                cursor: authLoading ? "default" : "pointer",
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading
                ? "Procesando..."
                : authMode === "login"
                  ? "Ingresar"
                  : "Crear cuenta"}
            </button>
          </form>
        )}
      </main>
    );
  }

  // 2) AUTENTICADO -> NUEVO DASHBOARD ProctoEtic
  return (
    <TeacherDashboard
      profile={profile}
      onLogout={handleLogout}
    />
  );
}
