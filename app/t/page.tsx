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
      <>
        <style jsx global>{`
          @keyframes superbloom {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          @keyframes float {
            0% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-10px);
            }
            100% {
              transform: translateY(0px);
            }
          }
          .input-bloom:focus {
            background: rgba(255, 255, 255, 0.95) !important;
            box-shadow: 0 0 0 3px rgba(255, 154, 158, 0.3) !important;
            border-color: #ff9a9e !important;
          }
          .btn-bloom:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(255, 107, 107, 0.3) !important;
          }
        `}</style>
        <div
          className="bg-noise"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Inter', sans-serif",
            background:
              "linear-gradient(-45deg, #ff9a9e, #fad0c4, #fad0c4, #a18cd1, #fbc2eb)",
            backgroundSize: "400% 400%",
            animation: "superbloom 15s ease infinite",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Orbes decorativos de fondo */}
          <div
            style={{
              position: "absolute",
              top: "20%",
              left: "15%",
              width: "300px",
              height: "300px",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)",
              filter: "blur(40px)",
              animation: "float 6s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              right: "10%",
              width: "400px",
              height: "400px",
              background:
                "radial-gradient(circle, rgba(161, 140, 209, 0.4) 0%, rgba(161, 140, 209, 0) 70%)",
              filter: "blur(60px)",
              animation: "float 8s ease-in-out infinite reverse",
            }}
          />

          <main
            style={{
              width: "100%",
              maxWidth: 440,
              background: "rgba(255, 255, 255, 0.65)",
              backdropFilter: "blur(25px)",
              WebkitBackdropFilter: "blur(25px)",
              borderRadius: 30,
              border: "1px solid rgba(255, 255, 255, 0.9)",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.1)",
              padding: "48px 40px",
              position: "relative",
              zIndex: 10,
              animation: "float 1s ease-out", // Simple entrance
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 32,
                  fontFamily: "var(--font-festive), sans-serif", // Syne Font
                  fontWeight: 800,
                  background: "linear-gradient(90deg, #ff6b6b, #556270)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-1px",
                }}
              >
                {authMode === "forgot" ? "Recuperar" : "ProctoEtic"}
              </h1>
              <p
                style={{
                  color: "#6c757d",
                  fontSize: 15,
                  marginTop: 8,
                  fontWeight: 500,
                }}
              >
                {authMode === "forgot"
                  ? "Restaura tu acceso"
                  : "Crea examenes más seguros"}
              </p>
            </div>

            {authMode !== "forgot" && (
              <div
                style={{
                  display: "flex",
                  background: "rgba(255,255,255,0.5)",
                  padding: 5,
                  borderRadius: 16,
                  marginBottom: 32,
                  border: "1px solid rgba(255,255,255,0.6)",
                }}
              >
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: authMode === "login" ? "white" : "transparent",
                    color: authMode === "login" ? "#ff6b6b" : "#888",
                    border: "none",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                    boxShadow:
                      authMode === "login"
                        ? "0 4px 6px rgba(0,0,0,0.05)"
                        : "none",
                    transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                  }}
                >
                  Ingresar
                </button>
                <button
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background:
                      authMode === "register" ? "white" : "transparent",
                    color: authMode === "register" ? "#ff6b6b" : "#888",
                    border: "none",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                    boxShadow:
                      authMode === "register"
                        ? "0 4px 6px rgba(0,0,0,0.05)"
                        : "none",
                    transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                  }}
                >
                  Registrarse
                </button>
              </div>
            )}

            {authError && (
              <div
                style={{
                  background: "rgba(254, 226, 226, 0.9)",
                  color: "#ef4444",
                  padding: "14px",
                  borderRadius: 16,
                  marginBottom: 24,
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                  border: "1px solid rgba(252, 165, 165, 0.5)",
                  backdropFilter: "blur(4px)",
                }}
              >
                {authError}
              </div>
            )}

            {/* FORGOT PASSWORD FORM */}
            {authMode === "forgot" ? (
              <form onSubmit={handleForgot}>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 8,
                      color: "#495057",
                      marginLeft: 4,
                    }}
                  >
                    Email de recuperación
                  </label>
                  <input
                    type="email"
                    required
                    className="input-bloom"
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.8)",
                      background: "rgba(255,255,255,0.6)",
                      fontSize: 15,
                      outline: "none",
                      transition: "all 0.3s",
                      color: "#495057",
                    }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn-bloom"
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: 16,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
                    color: "white",
                    fontWeight: 800,
                    cursor: authLoading ? "default" : "pointer",
                    opacity: authLoading ? 0.8 : 1,
                    fontSize: 15,
                    boxShadow: "0 4px 15px rgba(255, 154, 158, 0.4)",
                    marginTop: 8,
                    transition: "transform 0.2s, box-shadow 0.2s",
                    letterSpacing: "0.5px",
                    textShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                >
                  {authLoading ? "Enviando enlace..." : "Recuperar Contraseña"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: "transparent",
                    border: "none",
                    color: "#888",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: 8,
                    transition: "color 0.2s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#ff6b6b")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#888")}
                >
                  ← Volver al inicio
                </button>
              </form>
            ) : (
              <form
                onSubmit={authMode === "login" ? handleLogin : handleRegister}
              >
                {authMode === "register" && (
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 8,
                        color: "#495057",
                        marginLeft: 4,
                      }}
                    >
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      required
                      className="input-bloom"
                      style={{
                        width: "100%",
                        padding: "14px 18px",
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.8)",
                        background: "rgba(255,255,255,0.6)",
                        fontSize: 15,
                        outline: "none",
                        transition: "all 0.3s",
                        color: "#495057",
                      }}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Pérez"
                    />
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 8,
                      color: "#495057",
                      marginLeft: 4,
                    }}
                  >
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    className="input-bloom"
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.8)",
                      background: "rgba(255,255,255,0.6)",
                      fontSize: 15,
                      outline: "none",
                      transition: "all 0.3s",
                      color: "#495057",
                    }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hola@ejemplo.com"
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 8,
                      color: "#495057",
                      marginLeft: 4,
                    }}
                  >
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-bloom"
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.8)",
                      background: "rgba(255,255,255,0.6)",
                      fontSize: 15,
                      outline: "none",
                      transition: "all 0.3s",
                      color: "#495057",
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                {/* REMEMBER ME CHECKBOX */}
                {authMode === "login" && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 32,
                      padding: "0 4px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        cursor: "pointer",
                        color: "#6c757d",
                        fontWeight: 500,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{
                          accentColor: "#ff9a9e",
                          width: 16,
                          height: 16,
                        }}
                      />
                      Recordarme
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot");
                        setAuthError(null);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#a18cd1",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      ¿Olvidaste pass?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn-bloom"
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: 16,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
                    color: "white",
                    fontWeight: 800,
                    cursor: authLoading ? "default" : "pointer",
                    opacity: authLoading ? 0.8 : 1,
                    fontSize: 15,
                    boxShadow: "0 4px 15px rgba(255, 154, 158, 0.4)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    letterSpacing: "0.5px",
                    textShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
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
      </>
    );
  }

  // 2) AUTENTICADO -> NUEVO DASHBOARD ProctoEtic
  return <TeacherDashboard profile={profile} onLogout={handleLogout} />;
}
