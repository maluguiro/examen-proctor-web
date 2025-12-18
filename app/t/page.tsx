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
  const [authMode, setAuthMode] = React.useState<
    "login" | "register" | "forgot"
  >("login");
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
      console.log("Check RememberMe:", savedEmail);
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
          console.log("Saving RememberMe:", email);
          window.localStorage.setItem("teacher_email_remember", email);
        } else {
          console.log("Removing RememberMe");
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
      alert(
        "Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña."
      );
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
      <div className="relative z-10 w-full min-h-screen flex justify-center items-center p-6 md:p-10">
        <main className="glass-panel p-10 rounded-3xl max-w-md w-full text-center animate-slide-up relative z-20">
          <div className="mb-8">
            <h1 className="font-festive text-gradient-aurora text-5xl mb-4">
              {authMode === "forgot" ? "Recuperar" : "ProctoEtic"}
            </h1>
            <p className="text-gray-600 font-medium text-lg opacity-80">
              {authMode === "forgot"
                ? "Restaura tu acceso docente"
                : "Evaluaciones seguras y simples"}
            </p>
          </div>

          {authMode !== "forgot" && (
            <div className="flex bg-white/40 p-1.5 rounded-2xl mb-8 border border-white/50">
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${authMode === "login"
                    ? "bg-white text-pink-500 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                Ingresar
              </button>
              <button
                onClick={() => {
                  setAuthMode("register");
                  setAuthError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${authMode === "register"
                    ? "bg-white text-pink-500 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                Registrarse
              </button>
            </div>
          )}

          {authError && (
            <div className="bg-red-100/80 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-sm font-semibold backdrop-blur-sm">
              {authError}
            </div>
          )}

          {/* FORGOT PASSWORD FORM */}
          {authMode === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="text-left">
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                  Email de recuperación
                </label>
                <input
                  type="email"
                  required
                  className="input-aurora w-full p-4 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <button type="submit" disabled={authLoading} className="btn-aurora-primary w-full p-4 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all mt-4">
                {authLoading ? "Enviando..." : "Recuperar Contraseña"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                }}
                className="w-full p-3 text-gray-500 hover:text-pink-500 font-bold text-sm transition-colors"
              >
                ← Volver al inicio
              </button>
            </form>
          ) : (
            <form
              onSubmit={authMode === "login" ? handleLogin : handleRegister}
              className="space-y-5"
            >
              {authMode === "register" && (
                <div className="text-left">
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    className="input-aurora w-full p-4 rounded-xl"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                  />
                </div>
              )}

              <div className="text-left">
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  className="input-aurora w-full p-4 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hola@ejemplo.com"
                />
              </div>

              <div className="text-left">
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input-aurora w-full p-4 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {/* REMEMBER ME CHECKBOX */}
              {authMode === "login" && (
                <div className="flex justify-between items-center px-1">
                  <label className="flex items-center gap-2 text-sm text-gray-600 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-pink-400 w-4 h-4 cursor-pointer"
                    />
                    Recordarme
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("forgot");
                      setAuthError(null);
                    }}
                    className="text-sm font-bold text-indigo-400 hover:text-pink-500 transition-colors"
                  >
                    ¿Olvidaste pass?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-aurora-primary w-full p-4 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                {authLoading
                  ? "Conectando..."
                  : authMode === "login"
                    ? "Comenzar"
                    : "Crear Cuenta"}
              </button>
            </form>
          )}
        </main>
      </div>
    );
  }

  // 2) AUTENTICADO -> NUEVO DASHBOARD ProctoEtic
  return <TeacherDashboard profile={profile} onLogout={handleLogout} />;
}
