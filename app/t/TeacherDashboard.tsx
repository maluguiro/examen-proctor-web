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
  date?: string;
  duration?: number;
  registeredCount?: number;
};

// --- Componente Dashboard ---
export default function TeacherDashboard({
  profile,
  onLogout,
}: TeacherDashboardProps) {
  const router = useRouter();

  // View State
  const [activeView, setActiveView] = React.useState<
    "dashboard" | "universities" | "calendar" | "profile" | "exams"
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
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up">
            <UniversitiesView
              profile={profile}
              exams={exams}
              onDeleteExam={handleDeleteExam}
              onUpdateProfile={handleUpdateProfile}
            />
          </div>
        );

      case "calendar":
        return (
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up">
            <CalendarView exams={exams} />
          </div>
        );
      case "exams":
        return (
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-200/50">
              <div>
                <h2 className="font-festive text-gradient-aurora text-3xl mb-1">
                  Mis Exámenes
                </h2>
                <p className="text-gray-500 font-medium text-sm">
                  Gestiona tus evaluaciones y crea nuevas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card "Crear Nuevo" rápida */}
              <div
                onClick={handleCreateExam}
                className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-colors group min-h-[180px]"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform shadow-sm">
                  +
                </div>
                <span className="font-bold text-indigo-700">Crear Examen</span>
              </div>

              {loadingExams ? (
                <div className="col-span-full py-10 text-center text-gray-500 animate-pulse font-medium">
                  Cargando exámenes...
                </div>
              ) : exams.length === 0 ? (
                <div className="col-span-full py-10 text-center text-gray-400 font-medium">
                  No tienes exámenes creados aún.
                </div>
              ) : (
                exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="bg-white/40 border border-white/60 p-5 rounded-2xl hover:bg-white/60 transition-all flex flex-col gap-3 group relative shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          exam.status.toLowerCase() === "open"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {exam.status === "open" ? "Abierto" : "Borrador"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/t/${exam.code}`);
                        }}
                        className="p-1.5 hover:bg-white rounded-lg text-indigo-600 transition-colors bg-white/50"
                        title="Editar"
                      >
                        ✏️
                      </button>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 leading-tight mb-1 text-lg">
                        {exam.title || "Sin título"}
                      </h3>
                      <div className="text-xs text-gray-500 font-mono bg-white/50 px-2 py-0.5 rounded inline-block border border-white/50">
                        {exam.code}
                      </div>
                    </div>
                    <div className="mt-auto pt-3 border-t border-gray-200/50 flex justify-between items-center text-xs font-medium text-gray-500">
                      <span>{exam.subject || "Sin materia"}</span>
                      <span>
                        {new Date(exam.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={() => router.push(`/t/${exam.code}`)}
                      className="absolute inset-0 z-0"
                      aria-label="Ver detalle"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case "profile":
        return (
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up bg-white/60">
            <h2 className="font-festive text-gradient-aurora text-3xl mb-6">
              Mi Perfil Docente
            </h2>
            <div className="bg-white/40 p-6 rounded-2xl border border-white/50 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Nombre
                </label>
                <div className="text-lg font-bold text-gray-800">
                  {profile?.name}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Email
                </label>
                <div className="text-lg font-bold text-gray-800">
                  {profile?.email}
                </div>
              </div>
              <div className="pt-4">
                <button className="btn-aurora px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm">
                  Editar información
                </button>
              </div>
            </div>
          </div>
        );

      default: // "dashboard"
        return (
          <div className="animate-slide-up space-y-6">
            {/* KPI Cards HIDDEN
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="glass-panel p-6 rounded-[2rem] flex flex-col justify-between h-36 md:h-44 relative overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl rotate-12">📊</div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide z-10">Exámenes Activos</h3>
                <div className="text-4xl md:text-5xl font-black text-[#1e1b4b] z-10 mt-auto">
                  {exams.filter(e => e.status === 'open').length}
                </div>
              </div>

              <div className="glass-panel p-6 rounded-[2rem] flex flex-col justify-between h-36 md:h-44 relative overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl rotate-12">🛡️</div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide z-10">Intentos de Fraude</h3>
                <div className="text-4xl md:text-5xl font-black text-rose-500 z-10 mt-auto">
                  {fraudStats.violations}
                </div>
                <div className="text-xs font-bold text-rose-400 mt-1 uppercase tracking-wide">Últimos 7 días</div>
              </div>

              <div className="glass-panel p-6 rounded-[2rem] flex flex-col justify-between h-36 md:h-44 relative overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl rotate-12">🎓</div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide z-10">Alumnos Evaluados</h3>
                <div className="text-4xl md:text-5xl font-black text-emerald-600 z-10 mt-auto">
                  {fraudStats.clean + fraudStats.violations}
                </div>
              </div>
            </div>
            */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* M: Mis Exámenes Recientes */}
              <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] lg:col-span-2 flex flex-col shadow-sm">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg md:text-xl font-bold text-[#1e1b4b]">
                    Mis Exámenes Recientes
                  </h3>
                  <button
                    onClick={() => setActiveView("exams")}
                    className="text-[11px] md:text-xs font-bold text-indigo-500 hover:text-indigo-700 hover:underline bg-indigo-50 px-3 py-1.5 rounded-full transition-colors"
                  >
                    Ver todos →
                  </button>
                </div>

                <div className="flex-1 space-y-2.5">
                  {loadingExams ? (
                    <div className="text-center py-8 text-gray-400 font-medium">
                      Cargando...
                    </div>
                  ) : (
                    exams.slice(0, 3).map((exam) => (
                      <div
                        key={exam.id}
                        onClick={() => router.push(`/t/${exam.code}`)}
                        className="group bg-pink-50/60 hover:bg-pink-100 p-4 rounded-2xl transition-all cursor-pointer border border-pink-100 flex justify-between items-center shadow-sm hover:shadow-md"
                      >
                        {/* Icono + texto */}
                        <div className="flex items-center gap-3">
                          {/* Icono documento + estado */}
                          <div className="relative w-9 h-9 rounded-2xl flex items-center justify-center text-base shadow-sm border border-pink-100 bg-pink-50">
                            <span className="text-lg">📄</span>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                                exam.status === "open"
                                  ? "bg-emerald-400"
                                  : "bg-slate-300"
                              }`}
                            />
                          </div>

                          <div>
                            <div className="font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors text-sm md:text-base">
                              {exam.title || "Sin título"}
                            </div>
                            <div className="text-[11px] md:text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded border border-gray-100">
                                {exam.code}
                              </span>
                              <span className="font-medium">
                                • {exam.subject || "Sin materia"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Acciones: eliminar + flecha */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteExam(exam.id);
                            }}
                            className="w-7 h-7 rounded-full bg-white/70 text-[11px] flex items-center justify-center text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-rose-100 opacity-0 group-hover:opacity-100 transition-all"
                            title="Eliminar examen"
                          >
                            🗑️
                          </button>
                          <div className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0">
                            →
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    onClick={handleCreateExam}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-500 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2 mt-4 text-sm"
                  >
                    <span className="text-base">+</span> Crear nuevo examen
                  </button>
                </div>
              </div>

              {/* R: Actividad Reciente */}
              <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] flex flex-col shadow-sm">
                <h3 className="text-xl font-bold text-[#1e1b4b] mb-6">
                  Actividad
                </h3>
                <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                  {activityLog.map((log, i) => (
                    <div
                      key={i}
                      className="flex gap-4 p-3 hover:bg-white/30 rounded-xl transition-colors"
                    >
                      <div
                        className={`mt-1.5 min-w-[10px] h-2.5 rounded-full shadow-sm ${
                          log.type === "alert"
                            ? "bg-rose-400"
                            : log.type === "success"
                            ? "bg-emerald-400"
                            : "bg-blue-400"
                        }`}
                      />
                      <div>
                        <p className="text-gray-700 font-bold leading-snug text-sm">
                          {log.text}
                        </p>
                        <span className="text-xs text-gray-400 font-medium block mt-1">
                          {log.time}
                        </span>
                      </div>
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
    <div className="flex flex-col md:flex-row min-h-screen relative overflow-hidden bg-transparent p-4 md:p-6 gap-6">
      {/* Sidebar - Ahora es Glass Panel */}
      <aside className="glass-panel w-full md:w-72 p-6 md:p-8 flex flex-col md:h-[calc(100vh-3rem)] rounded-3xl sticky top-6 z-50 shrink-0">
        <div className="font-festive text-gradient-aurora text-xl md:text-2xl font-extrabold mb-8 md:mb-12 tracking-tight text-center w-full leading-tight">
          ProctoEtic
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const active =
              activeView === item.id ||
              (activeView === "profile" && item.id === "profile");
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
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer text-sm font-semibold transition-all duration-200 ${
                  active
                    ? "bg-white/50 text-indigo-900 border border-white/80 shadow-sm"
                    : "text-slate-500 hover:bg-white/20 hover:text-slate-700 border border-transparent"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </div>
            );
          })}
          <div
            onClick={onLogout}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer text-sm font-bold text-red-500 hover:bg-red-50/50 mt-8 transition-colors"
          >
            <span className="text-xl">🚪</span>
            Cerrar sesión
          </div>
        </nav>

        <div className="mt-auto p-4 bg-white/30 rounded-2xl flex items-center gap-3 border border-white/40 backdrop-blur-sm shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            {profile?.name?.charAt(0).toUpperCase() || "D"}
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-sm truncate text-gray-800">
              {profile?.name || "Docente"}
            </div>
            <div className="text-xs text-gray-500 font-medium">Dashboard</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex justify-center overflow-y-auto h-[calc(100vh-3rem)] relative rounded-3xl pb-20 md:pb-0 scrollbar-hide">
        <div className="w-full max-w-6xl space-y-6">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-gradient-aurora font-festive text-4xl font-bold m-0 leading-tight">
                {activeView === "dashboard"
                  ? `Hola, ${profile?.name?.split(" ")[0] || "Docente"} 👋`
                  : activeView === "universities"
                  ? "Universidades"
                  : activeView === "calendar"
                  ? "Calendario"
                  : "Panel"}
              </h1>
              <p className="mt-2 text-gray-500 text-sm font-medium">
                {activeView === "dashboard"
                  ? "Resumen de tu actividad académica hoy."
                  : "Gestión de evaluaciones."}
              </p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <input
                className="input-aurora px-6 py-3 rounded-full w-full md:w-80 text-sm"
                placeholder="Buscar examen, materia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                onClick={handleCreateExam}
                className="btn-aurora-primary px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap shadow-md hover:shadow-lg transition-all"
              >
                ➕ Crear examen
              </button>
            </div>
          </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
}
