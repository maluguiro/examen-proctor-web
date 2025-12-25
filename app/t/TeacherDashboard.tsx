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

type ViewState =
  | "dashboard"
  | "universities"
  | "calendar"
  | "profile"
  | "exams";

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
  const [activeView, setActiveView] = React.useState<ViewState>("dashboard");
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
  ];
  const normalizedSearch = search.trim().toLowerCase();

  const filteredExams = React.useMemo(
    () =>
      !normalizedSearch
        ? exams
        : exams.filter((exam) => {
            const title = exam.title?.toLowerCase() || "";
            const subject = exam.subject?.toLowerCase() || "";
            const code = exam.code?.toLowerCase() || "";
            return (
              title.includes(normalizedSearch) ||
              subject.includes(normalizedSearch) ||
              code.includes(normalizedSearch)
            );
          }),
    [exams, normalizedSearch]
  );

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
      case "exams": // Vista dedicada (grid completo)
        return (
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-200/50">
              <div>
                <h2 className="font-festive text-gradient-sun text-3xl mb-1">
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
                className="border-2 border-dashed border-lime-200 bg-lime-50/40 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-lime-50 transition-colors group min-h-[180px]"
              >
                <div className="w-12 h-12 rounded-full bg-white text-[#1f2933] flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform shadow-sm">
                  +
                </div>
                <span className="font-bold text-lime-700 text-sm">
                  Crear examen
                </span>
              </div>

              {loadingExams ? (
                <div className="col-span-full py-10 text-center text-gray-500 animate-pulse font-medium">
                  Cargando exámenes...
                </div>
              ) : filteredExams.length === 0 ? (
                <div className="col-span-full py-10 text-center text-gray-400 font-medium">
                  No tienes exámenes creados aún.
                </div>
              ) : (
                filteredExams.map((exam) => (
                  <div
                    key={exam.id}
                    onClick={() => router.push(`/t/${exam.code}`)}
                    className="bg-white/70 border border-white/70 p-5 rounded-3xl hover:bg-white transition-all flex flex-col gap-3 group relative shadow-sm"
                  >
                    {/* Estado Abierto / Cerrado */}
                    <div className="flex justify-between items-start">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          exam.status.toLowerCase() === "open"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {exam.status.toLowerCase() === "open"
                          ? "Abierto"
                          : "Cerrado"}
                      </span>

                      {/* Botón eliminar (usa la lógica existente handleDeleteExam) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteExam(exam.id);
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                        title="Eliminar examen"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Título + materia (solo si existe) */}
                    <div>
                      <h3 className="font-bold text-gray-800 leading-tight mb-1 text-base">
                        {exam.title || "Sin título"}
                      </h3>
                      {exam.subject && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {exam.subject}
                        </p>
                      )}
                    </div>

                    {/* Fecha de creación + código */}
                    <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center text-[11px] font-medium text-gray-500">
                      <span>
                        Creado el{" "}
                        {new Date(exam.createdAt).toLocaleDateString()}
                      </span>
                      <span className="font-mono text-gray-400">
                        Código: {exam.code}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "profile":
        return (
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up bg-white/60">
            <h2 className="font-festive text-gradient-sun text-3xl mb-6">
              Mi Perfil Docente
            </h2>
            <div className="bg-white/40 p-6 rounded-3xl border border-white/50 space-y-4 max-w-xl">
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

      default: // "dashboard" -> 3 Column Soft UI Layout (Column 2 & 3 here, Sidebar is Col 1)
        return (
          <div className="animate-slide-up grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Columna Central (2): Lista de Horarios/Exámenes */}
            <div className="lg:col-span-2 space-y-6">
              {/* Box 1: Título y Acciones */}
              <div className="glass-panel p-5 rounded-[2rem] flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#1e1b4b]">
                  Mis Exámenes
                </h2>
                <button
                  onClick={() => setActiveView("exams")}
                  className="text-xs font-bold px-4 py-1.5 rounded-full transition-colors shadow-sm
               bg-white/80 border border-emerald-100 text-emerald-700
               hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Ver todos
                </button>
              </div>

              {/* Box 2: Lista Contenida */}
              <div className="glass-panel p-6 rounded-[2.5rem] min-h-[400px]">
                <div className="space-y-3 max-w-2xl mx-auto">
                  {loadingExams ? (
                    <div className="py-12 text-center text-gray-400 font-medium">
                      Cargando exámenes...
                    </div>
                  ) : exams.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 font-medium border border-dashed border-gray-200 rounded-3xl">
                      No tienes exámenes activos hoy.
                    </div>
                  ) : (
                    filteredExams.slice(0, 4).map((exam) => (
                      <div
                        key={exam.id}
                        onClick={() => router.push(`/t/${exam.code}`)}
                        className="group bg-white/40 hover:bg-white/80 p-4 rounded-2xl transition-all cursor-pointer border border-white/60 flex justify-between items-center shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm border border-white/50 bg-pink-50">
                            📄
                          </div>
                          <div>
                            <div className="font-bold text-gray-800 group-hover:text-indigo-700 transition-colors text-lg">
                              {exam.title || "Sin título"}
                            </div>

                            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                              {/* Estado abierto/cerrado */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                                  exam.status?.toLowerCase() === "open"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    exam.status?.toLowerCase() === "open"
                                      ? "bg-emerald-500"
                                      : "bg-slate-400"
                                  }`}
                                />
                                {exam.status?.toLowerCase() === "open"
                                  ? "Abierto"
                                  : "Cerrado"}
                              </span>

                              {/* Materia solo si existe */}
                              {exam.subject && (
                                <span className="font-medium">
                                  • {exam.subject}
                                </span>
                              )}

                              {/* Fecha de creación si existe */}
                              {exam.createdAt && (
                                <span className="text-[10px] text-gray-400">
                                  •{" "}
                                  {new Date(
                                    exam.createdAt
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">
                          →
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Columna Derecha (3): Widgets */}
            <div className="space-y-6">
              {/* Widget 1: Calendar Thumbnail (New) */}
              <div className="glass-panel p-6 rounded-[2.5rem] flex flex-col gap-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-bold text-gray-700">
                    Noviembre 2024
                  </span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    <span className="w-2 h-2 rounded-full bg-gray-200"></span>
                  </div>
                </div>
                {/* Mini Grid Visual */}
                <div className="grid grid-cols-7 gap-1 text-[10px] text-center font-medium text-gray-400 mb-2">
                  <div>L</div>
                  <div>M</div>
                  <div>M</div>
                  <div>J</div>
                  <div>V</div>
                  <div>S</div>
                  <div>D</div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[10px] text-center font-bold text-gray-600">
                  {/* Dummy days row 1 */}
                  <div className="py-1">29</div>
                  <div className="py-1">30</div>
                  <div className="py-1">1</div>
                  <div className="py-1">2</div>
                  <div className="py-1">3</div>
                  <div className="py-1">4</div>
                  <div className="py-1">5</div>

                  {/* Dummy days row 2 */}
                  <div className="py-1 bg-indigo-500 text-white rounded-full">
                    6
                  </div>
                  <div className="py-1">7</div>
                  <div className="py-1">8</div>
                  <div className="py-1">9</div>
                  <div className="py-1">10</div>
                  <div className="py-1">11</div>
                  <div className="py-1">12</div>

                  {/* Dummy days row 3 */}
                  <div className="py-1">13</div>
                  <div className="py-1">14</div>
                  <div className="py-1">15</div>
                  <div className="py-1">16</div>
                  <div className="py-1">17</div>
                  <div className="py-1">18</div>
                  <div className="py-1">19</div>
                </div>
              </div>

              {/* Widget 2: Activity Log */}
              <div className="bg-white/40 p-6 rounded-[2.5rem] border border-white/40">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-[#1e1b4b]">Actividad</h3>
                  <span className="text-xs text-indigo-500 font-bold cursor-pointer">
                    Ver todo
                  </span>
                </div>
                <div className="space-y-4">
                  {activityLog.map((log, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div
                        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                          log.type === "alert"
                            ? "bg-rose-400"
                            : log.type === "success"
                            ? "bg-emerald-400"
                            : "bg-indigo-400"
                        }`}
                      />
                      <div>
                        <p className="text-gray-700 font-bold text-xs leading-snug">
                          {log.text}
                        </p>
                        <span className="text-[10px] text-gray-400 font-medium">
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
    <div
      className="
        flex flex-col md:flex-row
        min-h-screen
        w-full
        bg-transparent
        p-4 md:p-6
        gap-6
      "
    >
      {/* Sidebar - Ahora es Glass Panel */}
      {/* SIDEBAR CON 3 BLOQUES */}
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-3 h-[calc(100vh-3rem)] sticky top-4">
        {/* BLOQUE 1: PROCTOETIC (DEJAMOS IGUAL SALVO TAMAÑO LIGERAMENTE MENOR SI QUERÉS) */}
        <div className="glass-panel p-3 rounded-[1rem] flex items-center justify-center">
          <div className="font-festive text-gradient-sun text-3xl font-extrabold cursor-default leading-tight">
            ProctoEtic
          </div>
        </div>

        {/* BLOQUE 2: MENÚ (SE ALARGA CON flex-1) */}
        <div className="glass-panel flex-1 rounded-[1.5rem] p-4 md:p-6 flex flex-col">
          <nav className="flex-1 flex flex-col gap-2">
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
                      ? "bg-white/60 text-indigo-900 border border-white/80 shadow-sm"
                      : "text-slate-500 hover:bg-white/25 hover:text-slate-700 border border-transparent"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </div>
              );
            })}
          </nav>

          {/* BOTÓN SALIR PEGADO AL FINAL DEL BLOQUE 2 */}
          <div
            onClick={onLogout}
            className="mt-4 flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer text-sm font-bold text-red-500 hover:bg-red-50/70 transition-colors"
          >
            <span className="text-xl">🚪</span>
            Salir
          </div>
        </div>

        {/* BLOQUE 3: AVATAR DOCENTE, SIEMPRE ABAJO */}
        <div className="glass-panel p-4 rounded-[1.5rem] flex items-center gap-3 border border-white/40 backdrop-blur-sm shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-500 to-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
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

      {/* Main Content Area */}
      <main
        className="
    flex-1
    flex
    justify-center
    overflow-y-auto
    overflow-x-hidden
  "
      >
        <div className="w-full max-w-6xl mx-auto space-y-8 pb-8">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-gradient-sun font-festive text-3xl font-bold m-0 leading-tight">
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
            <div className="flex gap-4 w-full md:w-auto relative">
              {/* Contenedor del buscador con resultados debajo */}
              <div className="relative w-full md:w-80">
                <input
                  className="input-aurora px-5 py-2.5 rounded-full w-full text-sm"
                  placeholder="Buscar examen, materia..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                {/* Resultados tipo “Google” debajo del input */}
                {normalizedSearch && (
                  <div className="absolute left-0 right-0 mt-2 bg-white/95 rounded-3xl shadow-xl border border-gray-100 max-h-72 overflow-y-auto z-30">
                    {filteredExams.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400">
                        Sin resultados para “{search}”.
                      </div>
                    ) : (
                      filteredExams.slice(0, 6).map((exam) => (
                        <button
                          key={exam.id}
                          type="button"
                          onClick={() => {
                            // limpiar búsqueda y navegar
                            setSearch("");
                            router.push(`/t/${exam.code}`);
                          }}
                          className="w-full text-left px-4 py-3 text-xs hover:bg-emerald-50/80 transition-colors flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-gray-800 truncate">
                              {exam.title || "Sin título"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                exam.status?.toLowerCase() === "open"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {exam.status?.toLowerCase() === "open"
                                ? "Abierto"
                                : "Cerrado"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            {exam.subject && (
                              <span className="truncate">{exam.subject}</span>
                            )}
                            {exam.createdAt && (
                              <span className="text-gray-400">
                                •{" "}
                                {new Date(exam.createdAt).toLocaleDateString()}
                              </span>
                            )}
                            <span className="font-mono text-gray-400 ml-auto">
                              {exam.code}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Botón Crear Examen igual que antes */}
              <button
                onClick={handleCreateExam}
                className="
px-8 py-3 rounded-full text-sm font-bold whitespace-nowrap
shadow-md hover:shadow-lg transition-all
bg-gradient-to-r from-lime-300 via-amber-300 to-orange-300
text-[#1f2933]
border border-white/60
"
              >
                🌼 Crear examen
              </button>
            </div>
          </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
}
