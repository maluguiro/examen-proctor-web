"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  API,
  deleteExam as apiDeleteExam,
  updateTeacherProfile,
  createExam,
} from "@/lib/api";
import { TeacherProfile, saveTeacherProfile } from "@/lib/teacherProfile";
import UniversitiesView from "./components/UniversitiesView";
import CalendarView from "./components/CalendarView";

// --- Props ---
type TeacherDashboardProps = {
  profile: TeacherProfile | null;
  onLogout: () => void;
};

type ExamListItem = {
  id: string;
  title: string;
  status: string;
  code: string;
  createdAt: string;
  subject?: string;
};

// --- Componente Dashboard ---
export default function TeacherDashboard({
  profile,
  onLogout,
}: TeacherDashboardProps) {
  const router = useRouter();

  // View State
  const [activeView, setActiveView] = React.useState<
    "dashboard" | "universities" | "calendar" | "profile"
  >("dashboard");
  const [search, setSearch] = React.useState("");

  // Estado local para exámenes
  const [exams, setExams] = React.useState<ExamListItem[]>([]);
  const [loadingExams, setLoadingExams] = React.useState(true);
  const [lastActionMessage, setLastActionMessage] = React.useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // MOCK DATA para Cards
  const fraudStats = {
    totalAttempts: 124,
    clean: 85,
    violations: 15,
    topReasons: [
      "Salida de pantalla",
      "Detección de celular",
      "Voces detectadas",
    ],
  };

  const activityLog = [
    {
      text: "Juan Pérez entregó examen de Lógica I",
      time: "hace 3 min",
      type: "info",
    },
    {
      text: "Se detectó fraude en Matemática I",
      time: "hace 10 min",
      type: "alert",
    },
    {
      text: "Nuevo examen creado: Introducción a la IA",
      time: "hace 2 horas",
      type: "success",
    },
  ];

  // Fetch Exámenes Real
  const fetchExams = React.useCallback(() => {
    setLoadingExams(true);
    fetch(`${API}/exams`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setExams(Array.isArray(data) ? data : []);
      })
      .catch((e) => console.error("Error loading exams:", e))
      .finally(() => setLoadingExams(false));
  }, []);

  React.useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Crear Examen
  // Crear Examen
  async function handleCreateExam() {
    try {
      const exam = await createExam();

      // El backend puede devolver distintos formatos
      const code =
        exam.code ||
        exam.publicCode ||
        (exam.exam ? exam.exam.code : null) ||
        (exam.id ? String(exam.id).slice(0, 6) : null);

      if (!code) {
        console.error("Respuesta al crear examen:", exam);
        alert("No se pudo obtener el código del examen desde la API.");
        return;
      }

      // 1) Redirigir a la configuración del nuevo examen
      router.push(`/t/${code}`);
    } catch (e: any) {
      console.error("Error creando examen:", e);
      alert(e?.message || "Error creando examen. Ver consola.");
    }
  }

  // Borrar Examen
  // Borrar Examen
  async function handleDeleteExam(id: string) {
    if (
      !confirm(
        "¿Seguro que querés eliminar este examen? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      await apiDeleteExam(id);
      // Éxito: Actualización optimista
      setExams((prev) => prev.filter((e) => e.id !== id));
      setLastActionMessage({
        text: "Examen eliminado correctamente.",
        type: "success",
      });
      setTimeout(() => setLastActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setLastActionMessage({
        text: "No se pudo eliminar el examen. Intenta nuevamente.",
        type: "error",
      });
      setTimeout(() => setLastActionMessage(null), 4000);
    }
  }

  // Actualizar Perfil (Persistencia)
  async function handleUpdateProfile(newProfile: TeacherProfile) {
    console.log("SAVE_PROFILE_REQUEST", newProfile);
    try {
      const token = localStorage.getItem("examproctor_token");
      if (!token) {
        console.error("SAVE_PROFILE_ERROR: No token found");
        alert("Error de sesión. Por favor relogueate.");
        return;
      }

      // 1. Guardar en API (Backend)
      const updatedFromApi = await updateTeacherProfile(token, newProfile);
      console.log("SAVE_PROFILE_SUCCESS (API)", updatedFromApi);

      // 2. Guardar en LocalStorage (Frontend Sync)
      // Esto asegura que al recargar la página (F5) los datos se lean correcamente
      // ya que page.tsx usa loadTeacherProfile().
      saveTeacherProfile(newProfile);
      console.log("SAVE_PROFILE_SUCCESS (LocalStorage)");
    } catch (e) {
      console.error("SAVE_PROFILE_ERROR", e);
      alert("Error al guardar cambios. Verifica la consola.");
      throw e;
    }
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "universities", label: "Universidades", icon: "🏛️" },
    { id: "calendar", label: "Calendario", icon: "📅" },
    // Exams tab could be redundant with new views, keeping as placeholder logic or simple list
    // { id: "exams", label: "Exámenes", icon: "📝" },
    {
      id: "profile",
      label: "Perfil",
      icon: "👤",
      action: () => router.push("/t/profile"),
    },
  ];

  // --- Contenido según ViewState ---
  const renderContent = () => {
    switch (activeView) {
      case "universities":
        return (
          <UniversitiesView
            profile={profile}
            exams={exams}
            onDeleteExam={handleDeleteExam}
            onUpdateProfile={handleUpdateProfile}
          />
        );
      case "calendar":
        return <CalendarView exams={exams} />;
      case "dashboard":
      default:
        // Vista original Dashboard
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {lastActionMessage && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background:
                    lastActionMessage.type === "success"
                      ? "#dcfce7"
                      : "#fee2e2",
                  color:
                    lastActionMessage.type === "success"
                      ? "#166534"
                      : "#991b1b",
                  fontSize: "14px",
                  fontWeight: 600,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {lastActionMessage.type === "success" ? "✅ " : "⚠️ "}
                {lastActionMessage.text}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "32px",
                gridAutoRows: "minmax(200px, auto)",
              }}
            >
              {/* A: Próximos Exámenes */}
              <div className="glass-panel" style={{ padding: 32, gridColumn: "span 2", borderRadius: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: "#1e1b4b" }}>
                  Próximos exámenes{" "}
                  <span
                    style={{
                      color: "#9ca3af",
                      fontWeight: 400,
                      fontSize: "0.9em",
                      marginLeft: 4,
                    }}
                  >
                    ({exams.length})
                  </span>
                </h3>
                {loadingExams ? (
                  <p>Cargando...</p>
                ) : exams.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#9ca3af",
                      padding: 20,
                    }}
                  >
                    No hay exámenes creados. Crea uno nuevo para empezar.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {exams.slice(0, 4).map((ex) => (
                      <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div
                          style={{ cursor: "pointer", flex: 1, color: '#4b5563' }}
                          onClick={() => router.push(`/t/${ex.code}`)}
                        >
                          <strong>{ex.title}</strong>
                          <span style={{ margin: "0 8px", color: "#d1d5db" }}>
                            |
                          </span>
                          {ex.code}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: "99px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: ex.status.toUpperCase() === "OPEN" ? "#dcfce7" : "#f1f5f9",
                              color: ex.status.toUpperCase() === "OPEN" ? "#166534" : "#64748b",
                              border: ex.status.toUpperCase() === "OPEN" ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                            }}
                          >
                            {ex.status}
                          </span>
                          <button
                            onClick={() => {
                              if (confirm("¿Seguro de borrar?"))
                                handleDeleteExam(ex.id);
                            }}
                            title="Borrar"
                            className="btn-aurora"
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#ef4444', border: 'none'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* B: Calendario Mini (Acceso rápido a vista completa) */}
              <div
                className="glass-panel"
                style={{
                  padding: 32, borderRadius: 32,
                  background: "rgba(31, 41, 55, 0.95)", // Dark override
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column"
                }}
                onClick={() => setActiveView("calendar")}
              >
                <h3
                  style={{
                    fontSize: 18, fontWeight: 800, marginBottom: 20,
                    color: "white",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  Calendario
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    ↗ Ver
                  </span>
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "8px",
                    fontSize: "12px",
                    marginTop: "auto",
                  }}
                >
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <div key={i} style={{ textAlign: "center", opacity: 0.5 }}>
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        textAlign: "center",
                        padding: "6px",
                        borderRadius: "6px",
                        background: [12, 15, 23].includes(i + 1)
                          ? "#3b82f6"
                          : "transparent",
                        fontWeight: [12, 15, 23].includes(i + 1) ? 700 : 400,
                      }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {/* C: Resumen Antifraude */}
              <div className="glass-panel" style={{ padding: 32, borderRadius: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: '#1e1b4b' }}>Resumen Antifraude</h3>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div
                    style={{
                      flex: 1,
                      padding: 12,
                      background: "rgba(255,255,255,0.5)",
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800 }}>
                      {fraudStats.totalAttempts}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Intentos
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: 12,
                      background: "#dcfce7", // Keep green for success
                      borderRadius: 12,
                      color: "#166534",
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800 }}>
                      {fraudStats.clean}%
                    </div>
                    <div style={{ fontSize: 12 }}>Limpios</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Top motivos:
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    fontSize: 13,
                    color: "#4b5563",
                  }}
                >
                  {fraudStats.topReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* D: Materias Shortcut */}
              <div className="glass-panel" style={{ padding: 32, borderRadius: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: '#1e1b4b' }}>Tus Materias</h3>
                {profile?.institutions?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {profile.institutions[0].subjects.slice(0, 3).map((s) => (
                      <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#4b5563', fontSize: 14 }}>
                        <span>📚 {s.name}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveView("universities")}
                      style={{
                        marginTop: 8,
                        border: "none",
                        background: "transparent",
                        color: "#2563eb",
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left",
                        padding: 0,
                      }}
                    >
                      Ver todas →
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "#9ca3af" }}>
                    No hay materias configuradas.
                  </p>
                )}
              </div>

              {/* E: Actividad Reciente */}
              <div className="glass-panel" style={{ padding: 32, gridColumn: "span 2", borderRadius: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: '#1e1b4b' }}>Actividad Reciente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {activityLog.map((log, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 14, color: '#4b5563' }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background:
                              log.type === "alert"
                                ? "#ef4444"
                                : log.type === "success"
                                  ? "#22c55e"
                                  : "#3b82f6",
                          }}
                        />
                        {log.text}
                      </div>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {log.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: 'relative', overflow: 'hidden' }}>

      {/* Sidebar - Ahora es Glass Panel */}
      <aside
        className="glass-panel"
        style={{
          width: "280px",
          borderRight: "1px solid rgba(255,255,255,0.4)",
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <div
          className="font-festive text-gradient-aurora"
          style={{
            fontSize: "28px",
            fontWeight: 800,
            marginBottom: "48px",
            letterSpacing: "-1px",
            paddingLeft: "12px",
          }}
        >
          ProctoEtic
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((item) => {
            const active = activeView === item.id || (activeView === "profile" && item.id === "profile");
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else {
                    setActiveView(item.id as any);
                  }
                }}
                className={active ? "glass-panel" : ""}
                style={{
                  padding: "12px 20px",
                  borderRadius: "16px",
                  marginBottom: "8px",
                  cursor: "pointer",
                  color: active ? "#1e1b4b" : "#64748b",
                  background: active ? "rgba(255, 255, 255, 0.5)" : "transparent",
                  fontWeight: active ? 700 : 500,
                  fontSize: "15px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                  border: active ? "1px solid rgba(255,255,255,0.8)" : "1px solid transparent",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </div>
            );
          })}
          <div
            onClick={onLogout}
            style={{
              padding: "12px 20px",
              borderRadius: "16px",
              marginTop: "20px",
              cursor: "pointer",
              color: "#ef4444",
              fontWeight: 600,
              fontSize: "15px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span>🚪</span>
            Cerrar sesión
          </div>
        </nav>

        <div style={{
          marginTop: "auto",
          padding: "16px",
          background: "rgba(255,255,255,0.3)",
          borderRadius: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backdropFilter: "blur(5px)",
          border: "1px solid rgba(255,255,255,0.4)",
        }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 700,
            boxShadow: "0 4px 6px rgba(118, 75, 162, 0.3)",
          }}>
            {profile?.name?.charAt(0).toUpperCase() || "D"}
          </div>
          <div style={{ fontSize: "13px", overflow: "hidden" }}>
            <div
              style={{
                fontWeight: 600,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {profile?.name || "Docente"}
            </div>
            <div style={{ color: "#6b7280", fontSize: "12px" }}>Dashboard</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: "40px",
        height: "100vh",
        overflowY: "auto",
        position: "relative",
      }}>
        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div>
            <h1 className="text-gradient-aurora font-festive" style={{ fontSize: "32px", fontWeight: 700, margin: 0 }}>
              {activeView === "dashboard"
                ? `Hola, ${profile?.name?.split(" ")[0] || "Docente"} 👋`
                : activeView === "universities"
                  ? "Universidades"
                  : activeView === "calendar"
                    ? "Calendario"
                    : "Panel"}
            </h1>
            <p
              style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}
            >
              {activeView === "dashboard"
                ? "Resumen de tu actividad académica hoy."
                : "Gestión de evaluaciones."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <input
              className="input-aurora"
              style={{
                padding: "12px 24px",
                borderRadius: "24px",
                width: "320px",
                fontSize: "14px",
              }}
              placeholder="Buscar examen, materia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={handleCreateExam} className="btn-aurora-primary" style={{ padding: "12px 28px", borderRadius: "24px", fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ➕ Crear examen
            </button>
          </div>
        </div>

        {renderContent()}
      </main>
    </div>
  );
}
