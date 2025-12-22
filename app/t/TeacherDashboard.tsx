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
                className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-colors group min-h-[180px]"
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
                    className="bg-white/60 border border-white/60 p-5 rounded-3xl hover:bg-white/80 transition-all flex flex-col gap-3 group relative shadow-sm"
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
                      {/* Código removido visualmente en la tarjeta soft, pero visible aquí en vista completa si se desea. En el dashboard principal se ocultará. */}
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
                    exams.slice(0, 4).map((exam) => (
                      <div
                        key={exam.id}
                        onClick={() => router.push(`/t/${exam.code}`)}
                        className="group bg-white/60 hover:bg-white p-3 md:p-4 rounded-2xl transition-all cursor-pointer border border-gray-100 shadow-sm hover:shadow-md flex items-center gap-4"
                      >
                        {/* Time/Status Block (Left) - Smaller */}
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50/50 text-indigo-500 font-bold shrink-0 text-lg">
                          <span>📄</span>
                        </div>

                        {/* Info Central */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-800 text-base mb-0.5 truncate">
                            {exam.title || "Sin título"}
                          </h3>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                exam.status === "open"
                                  ? "bg-emerald-400"
                                  : "bg-gray-300"
                              }`}
                            />
                            <span>
                              {exam.status === "open" ? "Activo" : "Borrador"}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span>
                              {new Date(exam.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions (Right) */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Simple chevron or minimal action */}
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            ➜
                          </div>
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
    <div className="flex flex-col md:flex-row min-h-screen w-full overflow-x-hidden bg-transparent p-4 md:p-6 gap-6">
      {/* Sidebar - Ahora es Glass Panel */}
      <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-3 h-full transition-all duration-300">
        {/* Panel 1: Logo */}
        <div className="glass-panel p-3 rounded-[1rem] flex flex-col items-center text-center justify-center shrink-0">
          <div className="font-festive text-gradient-sun text-3xl md:text-2xl font-extrabold cursor-default leading-tight">
            ProctoEtic
          </div>
        </div>

        {/* Panel 2: Navigation */}
        <div className="glass-panel p-2 rounded-[1.5rem] flex-1 flex flex-col gap-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as ViewState)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                activeView === item.id
                  ? "bg-white shadow-sm text-indigo-600 font-bold"
                  : "text-gray-500 hover:bg-white/50 hover:text-indigo-500 font-medium"
              }`}
            >
              <span className="text-xl relative z-10 group-hover:scale-110 transition-transform duration-300">
                {item.icon}
              </span>
              <span className="relative z-10 text-sm whitespace-nowrap">
                {item.label}
              </span>
              {activeView === item.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Panel 3: Logout & Profile (Ultra Compacto) */}
        <div className="glass-panel p-2 rounded-[1.5rem] shrink-0 flex flex-col gap-1">
          <button
            onClick={onLogout}
            className="flex items-center gap-4 text-rose-500 hover:bg-rose-50 p-3 rounded-xl transition-all w-full font-bold text-[10px]"
          >
            <span className="text-sm">🚪</span>
            Salir
          </button>

          <div className="bg-indigo-50/50 p-1.5 rounded-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {profile?.name?.charAt(0) || "D"}
            </div>
            <div className="flex-col overflow-hidden">
              <div className="text-[11px] font-bold text-gray-800 truncate leading-tight">
                {profile?.name?.split(" ")[0]}
              </div>
              <div className="text-[8px] text-gray-400 font-bold uppercase tracking-wider leading-tight">
                Docente
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-x-hidden relative">
        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto pr-1 pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <div className="w-full max-w-6xl mx-auto space-y-6">
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
              <div className="flex gap-4 w-full md:w-auto">
                <input
                  className="input-aurora px-5 py-2.5 rounded-full w-full md:w-80 text-sm"
                  placeholder="Buscar examen, materia..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
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
        </div>
      </main>
    </div>
  );
}
