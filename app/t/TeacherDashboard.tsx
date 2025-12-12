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
  async function handleDeleteExam(id: string) {
    try {
      const res = await apiDeleteExam(id);
      if (res.success || res.id) {
        // Resilient check
        // Actualizar UI optimista o refetch
        setExams((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el examen. Verifica tu conexión o permisos.");
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

  // Estilos
  const styles = {
    container: {
      display: "flex",
      minHeight: "100vh",
      background: "#f3f4f6",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden", // Prevent full page scroll if content scrolls
    },
    sidebar: {
      width: "260px",
      background: "#ffffff",
      borderRight: "1px solid #e5e7eb",
      padding: "24px",
      display: "flex",
      flexDirection: "column" as const,
      flexShrink: 0,
    },
    sidebarLogo: {
      fontSize: "20px",
      fontWeight: 800,
      color: "#111",
      marginBottom: "40px",
      letterSpacing: "-0.5px",
    },
    navItem: (active: boolean) => ({
      padding: "10px 12px",
      borderRadius: "8px",
      marginBottom: "4px",
      cursor: "pointer",
      color: active ? "#111" : "#6b7280",
      background: active ? "#f3f4f6" : "transparent",
      fontWeight: active ? 600 : 500,
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      transition: "all 0.2s",
    }),
    userSection: {
      marginTop: "auto",
      paddingTop: "20px",
      borderTop: "1px solid #e5e7eb",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    avatar: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      background: "#111",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      fontWeight: 700,
    },
    main: {
      flex: 1,
      padding: "32px 40px",
      height: "100vh",
      overflowY: "auto" as const,
    },
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "32px",
    },
    search: {
      padding: "10px 16px",
      borderRadius: "99px",
      border: "1px solid #d1d5db",
      width: "300px",
      fontSize: "14px",
      background: "white",
    },
    createBtn: {
      padding: "10px 20px",
      borderRadius: "99px",
      background: "#111",
      color: "white",
      border: "none",
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: "24px",
      gridAutoRows: "minmax(180px, auto)",
    },
    card: {
      background: "white",
      borderRadius: "20px",
      padding: "24px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.02)",
      display: "flex",
      flexDirection: "column" as const,
    },
    cardTitle: {
      fontSize: "16px",
      fontWeight: 700,
      marginBottom: "16px",
      color: "#111",
    },
    cardList: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "12px",
    },
    listItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "13px",
      color: "#4b5563",
      paddingBottom: "8px",
      borderBottom: "1px solid #f3f4f6",
    },
    statusBadge: (status: string) => {
      const isOpen = status.toUpperCase() === "OPEN";
      return {
        padding: "2px 8px",
        borderRadius: "99px",
        fontSize: "10px",
        fontWeight: 700,
        background: isOpen ? "#dcfce7" : "#f3f4f6",
        color: isOpen ? "#166534" : "#6b7280",
      };
    },
    deleteBtnSmall: {
      background: "transparent",
      border: "none",
      color: "#ef4444",
      fontSize: "14px",
      cursor: "pointer",
      marginLeft: "8px",
      padding: 0,
    },
  };

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
          <div style={styles.grid}>
            {/* A: Próximos Exámenes */}
            <div style={{ ...styles.card, gridColumn: "span 2" }}>
              <h3 style={styles.cardTitle}>Próximos exámenes</h3>
              {loadingExams ? (
                <p>Cargando...</p>
              ) : exams.length === 0 ? (
                <div
                  style={{ textAlign: "center", color: "#9ca3af", padding: 20 }}
                >
                  No hay exámenes creados. Crea uno nuevo para empezar.
                </div>
              ) : (
                <div style={styles.cardList}>
                  {exams.slice(0, 4).map((ex) => (
                    <div key={ex.id} style={styles.listItem}>
                      <div
                        style={{ cursor: "pointer", flex: 1 }}
                        onClick={() => router.push(`/t/${ex.code}`)}
                      >
                        <strong>{ex.title}</strong>
                        <span style={{ margin: "0 8px", color: "#d1d5db" }}>
                          |
                        </span>
                        {ex.code}
                      </div>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={styles.statusBadge(ex.status)}>
                          {ex.status}
                        </span>
                        <button
                          style={styles.deleteBtnSmall}
                          onClick={() => {
                            if (confirm("¿Seguro de borrar?"))
                              handleDeleteExam(ex.id);
                          }}
                          title="Borrar"
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
              style={{
                ...styles.card,
                background: "#1f2937",
                color: "white",
                cursor: "pointer",
              }}
              onClick={() => setActiveView("calendar")}
            >
              <h3
                style={{
                  ...styles.cardTitle,
                  color: "white",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                Calendario
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  ↗ Ver completo
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
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Resumen Antifraude</h3>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div
                  style={{
                    flex: 1,
                    padding: 12,
                    background: "#f3f4f6",
                    borderRadius: 12,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {fraudStats.totalAttempts}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Intentos</div>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: 12,
                    background: "#dcfce7",
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
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Tus Materias</h3>
              {profile?.institutions?.length ? (
                <div style={styles.cardList}>
                  {profile.institutions[0].subjects.slice(0, 3).map((s) => (
                    <div key={s.id} style={styles.listItem}>
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
            <div style={{ ...styles.card, gridColumn: "span 2" }}>
              <h3 style={styles.cardTitle}>Actividad Reciente</h3>
              <div style={styles.cardList}>
                {activityLog.map((log, i) => (
                  <div key={i} style={styles.listItem}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
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
        );
    }
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogo}>ProctoEtic</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((item) => (
            <div
              key={item.id}
              style={styles.navItem(
                activeView === item.id ||
                  (activeView === "profile" && item.id === "profile")
              )}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  setActiveView(item.id as any);
                }
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </div>
          ))}
          <div style={styles.navItem(false)} onClick={onLogout}>
            <span>🚪</span>
            Cerrar sesión
          </div>
        </nav>

        <div style={styles.userSection}>
          <div style={styles.avatar}>
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
      <main style={styles.main}>
        {/* Top Bar */}
        <div style={styles.topBar}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>
              {activeView === "dashboard"
                ? `Hola, ${profile?.name?.split(" ")[0] || "Docente"} 👋`
                : activeView === "universities"
                ? "Universidades y Materias"
                : activeView === "calendar"
                ? "Calendario Académico"
                : "Panel"}
            </h1>
            <p
              style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}
            >
              {activeView === "dashboard"
                ? "Aquí tienes el resumen de tu actividad hoy."
                : "Gestiona y organiza tus evaluaciones."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <input
              style={styles.search}
              placeholder="Buscar examen, materia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={handleCreateExam} style={styles.createBtn}>
              ➕ Crear examen
            </button>
          </div>
        </div>

        {renderContent()}
      </main>
    </div>
  );
}
