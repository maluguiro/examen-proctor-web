"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  API,
  deleteExam as apiDeleteExam,
  updateTeacherProfile,
  createExam,
  getAuthToken,
  clearAuthToken,
} from "@/lib/api";
import {
  TeacherProfile,
  deriveProfileKeyFromToken,
  loadTeacherProfileCache,
  saveTeacherProfile,
} from "@/lib/teacherProfile";
import UniversitiesView from "./components/UniversitiesView";
import CalendarView from "./components/CalendarView";
import ThemeToggle from "./components/ThemeToggle";

// --- Props ---
type TeacherDashboardProps = {
  profile: TeacherProfile | null;
  onLogout: () => void;
  onProfileRefresh: () => Promise<TeacherProfile | null>;
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
  university?: string;
  subject?: string;
  date?: string;
  duration?: number;
  registeredCount?: number;
};

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
};

type CalendarTask = {
  id: string;
  date: string;
  time: string;
  title: string;
  color: string;
};

// --- Componente Dashboard ---
export default function TeacherDashboard({
  profile,
  onLogout,
  onProfileRefresh,
}: TeacherDashboardProps) {
  const router = useRouter();

  // View State
  const [activeView, setActiveView] = React.useState<ViewState>("dashboard");
  const [search, setSearch] = React.useState("");
  const [selectedUniversity, setSelectedUniversity] = React.useState("");
  const [selectedSubject, setSelectedSubject] = React.useState("");

  // Estado local para exámenes
  const [exams, setExams] = React.useState<ExamListItem[]>([]);
  const [loadingExams, setLoadingExams] = React.useState(true);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [sessionMessage, setSessionMessage] = React.useState<string | null>(null);
  const [lastActionMessage, setLastActionMessage] = React.useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
const [widgetDate] = React.useState(new Date());
  const [calendarEvents, setCalendarEvents] = React.useState<CalendarEvent[]>(
    []
  );
  const [calendarTasks, setCalendarTasks] = React.useState<CalendarTask[]>([]);

  const institutions = profile?.institutions ?? [];
  const selectedInstitution = institutions.find(
    (inst) => inst.name === selectedUniversity
  );
  const availableSubjects = selectedInstitution?.subjects ?? [];

  React.useEffect(() => {
    setSelectedSubject("");
  }, [selectedUniversity]);

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
    setSessionExpired(false);
    setSessionMessage(null);

    const token = getAuthToken();
    if (!token) {
      setSessionExpired(true);
      setSessionMessage("Sesión expirada. Iniciá sesión nuevamente.");
      setLoadingExams(false);
      return;
    }

    fetch(`${API}/teacher/exams`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          let body: any = null;
          try {
            body = await res.json();
          } catch {
            body = null;
          }
          if (body?.error === "INVALID_OR_EXPIRED_TOKEN") {
            clearAuthToken();
          }
          setSessionExpired(true);
          setSessionMessage("Sesión expirada. Iniciá sesión nuevamente.");
          return { authError: true };
        }
        const data = await res.json();
        return { data };
      })
      .then((result) => {
        if (!result || (result as any).authError) return;
        const data = (result as any).data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.exams)
            ? data.exams
            : [];
        if (
          !Array.isArray(data) &&
          !Array.isArray(data?.exams) &&
          process.env.NODE_ENV !== "production"
        ) {
          console.warn("teacher/exams unexpected shape", data);
        }
        setExams(list);
      })
      .catch((e) => console.error("Error loading exams:", e))
      .finally(() => setLoadingExams(false));
  }, []);

  React.useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const getCalendarStorageKeys = React.useCallback(() => {
  if (typeof window === "undefined") {
    return {
      eventsKey: "teacher_calendar_events",
      tasksKey: "teacher_calendar_tasks",
    };
  }

  let profileKey = "";
  const profileId = (profile as any)?.id;
  if (profileId) {
    profileKey = String(profileId).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  } else if (profile?.email) {
    profileKey = String(profile.email).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  } else {
    const token = getAuthToken();
    profileKey = deriveProfileKeyFromToken(token) || "";
    if (!profileKey) {
      const cached = loadTeacherProfileCache(token ? deriveProfileKeyFromToken(token) : null);
      const candidate = cached?.email || (cached as any)?.id || "";
      profileKey = String(candidate).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    }
  }

  const eventsKey = profileKey
    ? `teacher_${profileKey}_teacher_calendar_events`
    : "teacher_calendar_events";

  const tasksKey = profileKey
    ? `teacher_${profileKey}_teacher_calendar_tasks`
    : "teacher_calendar_tasks";

  return { eventsKey, tasksKey };
}, []);

const loadCalendarData = React.useCallback(() => {
  if (typeof window === "undefined") return;

  const legacyEventsKey = "teacher_calendar_events";
  const legacyTasksKey = "teacher_calendar_tasks";

  const token = window.localStorage.getItem("examproctor_token");

  // keys por perfil (misma normalización que CalendarView)
  let profileKey = "";
  const profileId = (profile as any)?.id;
  if (profileId) {
    profileKey = String(profileId).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  } else if (profile?.email) {
    profileKey = String(profile.email).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  } else {
    const token = getAuthToken();
    profileKey = deriveProfileKeyFromToken(token) || "";
    if (!profileKey) {
      const cached = loadTeacherProfileCache(token ? deriveProfileKeyFromToken(token) : null);
      const candidate = cached?.email || (cached as any)?.id || "";
      profileKey = String(candidate).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    }
  }

  const eventsKey = profileKey
    ? `teacher_${profileKey}_teacher_calendar_events`
    : legacyEventsKey;

  const tasksKey = profileKey
    ? `teacher_${profileKey}_teacher_calendar_tasks`
    : legacyTasksKey;

  const readArray = (key: string) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const loadFromStorage = () => {
    const storedEvents =
      readArray(eventsKey) ?? readArray(legacyEventsKey) ?? [];
    const storedTasks =
      readArray(tasksKey) ?? readArray(legacyTasksKey) ?? [];
    setCalendarEvents(storedEvents);
    setCalendarTasks(storedTasks);
  };

  // 1) Siempre: hidratar rápido desde storage
  loadFromStorage();

  // 2) Luego: si hay token, backend -> estado + sync storage
  if (!token) return;

  fetch(`${API}/teacher/calendar`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    })
    .then((data) => {
      const fetchedEvents = Array.isArray(data?.events) ? data.events : [];
      const fetchedTasks = Array.isArray(data?.tasks) ? data.tasks : [];

      setCalendarEvents(fetchedEvents);
      setCalendarTasks(fetchedTasks);

      window.localStorage.setItem(eventsKey, JSON.stringify(fetchedEvents));
      window.localStorage.setItem(tasksKey, JSON.stringify(fetchedTasks));
      window.localStorage.setItem(legacyEventsKey, JSON.stringify(fetchedEvents));
      window.localStorage.setItem(legacyTasksKey, JSON.stringify(fetchedTasks));
    })
    .catch(() => {
      // si falla backend, te quedás con lo que ya cargaste desde storage
      loadFromStorage();
    });
}, []);

  React.useEffect(() => {
    loadCalendarData();
    if (typeof window === "undefined") return;
    const handleUpdate = () => loadCalendarData();
    window.addEventListener("teacher_calendar_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("teacher_calendar_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadCalendarData]);

  React.useEffect(() => {
  if (typeof window === "undefined") return;
  const { eventsKey } = getCalendarStorageKeys();
  window.localStorage.setItem(eventsKey, JSON.stringify(calendarEvents));
}, [calendarEvents, getCalendarStorageKeys]);

React.useEffect(() => {
  if (typeof window === "undefined") return;
  const { tasksKey } = getCalendarStorageKeys();
  window.localStorage.setItem(tasksKey, JSON.stringify(calendarTasks));
}, [calendarTasks, getCalendarStorageKeys]);

  const widgetMonthData = React.useMemo(() => {
    const year = widgetDate.getFullYear();
    const month = widgetDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const examDays = new Set<number>();
    exams.forEach((exam) => {
      const date = new Date(exam.createdAt);
      if (date.getFullYear() === year && date.getMonth() === month) {
        examDays.add(date.getDate());
      }
   });

    const eventItemsByDay: Record<number, CalendarEvent[]> = {};
    const eventDays = new Set<number>();
    calendarEvents.forEach((evt) => {
      const date = new Date(`${evt.date}T00:00:00`);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const day = date.getDate();
        eventDays.add(day);
        if (!eventItemsByDay[day]) {
          eventItemsByDay[day] = [];
        }
        eventItemsByDay[day].push(evt);
      }
    });

    const taskItemsByDay: Record<number, CalendarTask[]> = {};
    const taskDays = new Set<number>();
    calendarTasks.forEach((task) => {
      const date = new Date(`${task.date}T00:00:00`);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const day = date.getDate();
        taskDays.add(day);
        if (!taskItemsByDay[day]) {
          taskItemsByDay[day] = [];
        }
        taskItemsByDay[day].push(task);
      }
    });

    return {
      year,
      month,
      days,
      startOffset,
      examDays,
      eventDays,
      taskDays,
      eventItemsByDay,
      taskItemsByDay,
    };
  }, [calendarEvents, calendarTasks, exams, widgetDate]);

  // Crear Examen
  // Crear Examen
  async function handleCreateExam() {
    try {
      const exam = await createExam({
        university: selectedUniversity || null,
        subject: selectedSubject || null,
      });

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

      await onProfileRefresh();
    } catch (e) {
      console.error("SAVE_PROFILE_ERROR", e);
      alert("Error al guardar cambios. Verifica la consola.");
      throw e;
    }
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "universities", label: "Universidades", icon: "🏛️" },
    {
      id: "calendar",
      label: "Calendario",
      icon: "📅",
      action: () => router.push("/t/calendar"),
    },
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

const widgetMonthText = widgetDate.toLocaleDateString("es-ES", {
    month: "long",
  });
  const widgetMonthLabel = `${widgetMonthText.charAt(0).toUpperCase()}${widgetMonthText.slice(
    1
  )} ${widgetMonthData.year}`;

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
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up min-h-[calc(100vh-220px)] flex">
            <CalendarView exams={exams} profile={profile} />
          </div>
        );
      case "exams": // Vista dedicada (grid completo)
        return (
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-200/50">
                <div>
                  <h2 className="font-festive text-gradient-sun dark:!text-slate-100 dark:!bg-none dark:!text-fill-inherit text-3xl mb-1">
                    Mis Exámenes
                  </h2>

                  <p className="text-gray-500 font-medium text-sm">
                    Gestiona tus evaluaciones y crea nuevas.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 dark:text-slate-200">
                    Universidad
                  </label>
                  <select
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-sm text-gray-800 dark:text-slate-100"
                    value={selectedUniversity}
                    onChange={(e) => setSelectedUniversity(e.target.value)}
                  >
                    <option value="">Selecciona universidad</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.name}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 dark:text-slate-200">
                    Materia
                  </label>
                  <select
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-sm text-gray-800 dark:text-slate-100"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    disabled={!selectedInstitution || availableSubjects.length === 0}
                  >
                    <option value="">
                      {selectedInstitution
                        ? "Selecciona materia"
                        : "Selecciona universidad"}
                    </option>
                    {availableSubjects.map((subj) => (
                      <option key={subj.id} value={subj.name}>
                        {subj.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {institutions.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-slate-300">
                  Primero creá universidades en /t
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card "Crear Nuevo" rápida */}
              <div
                onClick={handleCreateExam}
                className="border-2 border-dashed border-lime-200 bg-lime-50/40 dark:border-lime-800 dark:bg-lime-900/10 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors group min-h-[180px]"
              >
                <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-[#1f2933] dark:text-white flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform shadow-sm">
                  +
                </div>
                <span className="font-bold text-lime-700 dark:text-lime-400 text-sm">
                  Crear examen
                </span>
              </div>

              {sessionExpired ? (
                <div className="col-span-full py-10 text-center text-gray-500 font-medium border border-dashed border-gray-200 rounded-3xl">
                  <div className="mb-3">
                    {sessionMessage || "Sesión expirada. Iniciá sesión nuevamente."}
                  </div>
                  <button
                    onClick={() =>
                      router.push(`/t?returnUrl=${encodeURIComponent("/t")}`)
                    }
                    className="btn-aurora px-5 py-2 rounded-xl text-sm font-bold shadow-sm"
                  >
                    Iniciar sesión
                  </button>
                </div>
              ) : loadingExams ? (
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
  className="bg-white/70 dark:bg-slate-800/60 border border-white/70 dark:border-slate-700 p-5 rounded-3xl hover:bg-white dark:hover:bg-slate-800 transition-all flex flex-col gap-3 group relative shadow-sm dark:text-slate-200"
>
  {/* Estado Abierto / Cerrado */}
  <div className="flex justify-between items-start">
    <span
      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
        exam.status.toLowerCase() === "open"
          ? "bg-emerald-100 text-black dark:!text-black"
          : "bg-slate-100 text-black dark:!text-black"
      }`}
    >
      {exam.status.toLowerCase() === "open" ? "Abierto" : "Cerrado"}
    </span>

    {/* Botón eliminar (usa la lógica existente handleDeleteExam) */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleDeleteExam(exam.id);
      }}
      className="p-1.5 rounded-lg text-black dark:!text-black hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      title="Eliminar examen"
    >
      🗑️
    </button>
  </div>

                    {/* Título + materia (solo si existe) */}
                   <div>
    <h3 className="font-bold !text-grey leading-tight mb-1 text-base">
      {exam.title || "Sin título"}
    </h3>
    {(exam.university || exam.subject) && (
      <p className="text-[11px] !text-grey mt-0.5">
        {exam.university && exam.subject
          ? `${exam.university} • ${exam.subject}`
          : exam.university || exam.subject}
      </p>
    )}
  </div>

  {/* Fecha de creación + código */}
  <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center text-[11px] font-medium !text-black">
    <span>
      Creado el{" "}
      {new Date(exam.createdAt).toLocaleDateString()}
    </span>
    <span className="font-mono !text-black">
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
          <div className="glass-panel p-8 rounded-[2rem] w-full animate-slide-up bg-white/60 dark:bg-slate-800/60">
            <h2 className="font-festive text-gradient-sun text-3xl mb-6">
              Mi Perfil Docente
            </h2>
            <div className="bg-white/40 dark:bg-slate-800/40 p-6 rounded-3xl border border-white/50 dark:border-slate-700 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Nombre
                </label>
                <div className="text-lg font-bold text-gray-800 dark:text-slate-200">
                  {profile?.name}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Email
                </label>
                <div className="text-lg font-bold text-gray-800 dark:text-slate-200">
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
                <h2 className="font-extrabold text-xl truncate text-gray-800 dark:text-slate-200">
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
                  {sessionExpired ? (
                    <div className="py-12 text-center text-gray-400 font-medium border border-dashed border-gray-200 rounded-3xl">
                      <div className="mb-3">
                        {sessionMessage || "Sesión expirada. Iniciá sesión nuevamente."}
                      </div>
                      <button
                        onClick={() =>
                          router.push(`/t?returnUrl=${encodeURIComponent("/t")}`)
                        }
                        className="btn-aurora px-5 py-2 rounded-xl text-sm font-bold shadow-sm"
                      >
                        Iniciar sesión
                      </button>
                    </div>
                  ) : loadingExams ? (
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
                        className="group bg-white/40 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 p-4 rounded-2xl transition-all cursor-pointer border border-white/60 dark:border-slate-700 flex justify-between items-center shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm border border-white/50 dark:border-slate-600 bg-pink-50 dark:bg-pink-900/20">
                            📄
                          </div>
                          <div>
                            <div className="font-bold text-gray-800 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors text-lg">
                              {exam.title || "Sin título"}
                            </div>

                            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                              {/* Estado abierto/cerrado */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${exam.status?.toLowerCase() === "open"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                                  }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${exam.status?.toLowerCase() === "open"
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                    }`}
                                />
                                {exam.status?.toLowerCase() === "open"
                                  ? "Abierto"
                                  : "Cerrado"}
                              </span>

                              {/* Materia solo si existe */}
                              {(exam.university || exam.subject) && (
                                <span className="font-medium">
                                  •{" "}
                                  {exam.university && exam.subject
                                    ? `${exam.university} • ${exam.subject}`
                                    : exam.university || exam.subject}
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

                        <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400 hover:text-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-all">
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
                    {widgetMonthLabel}
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
                               {Array.from({ length: widgetMonthData.startOffset }).map(
                    (_, i) => (
                      <div key={`empty-${i}`} className="py-1 text-gray-300">
                        ·
                      </div>
                    )
                  )}
                  {Array.from({ length: widgetMonthData.days }).map((_, i) => {
                    const dayNum = i + 1;
                    const isToday =
                      dayNum === new Date().getDate() &&
                      widgetMonthData.month === new Date().getMonth() &&
                      widgetMonthData.year === new Date().getFullYear();
                    const dayEvents =
                      widgetMonthData.eventItemsByDay[dayNum] ?? [];
                    const dayTasks =
                      widgetMonthData.taskItemsByDay[dayNum] ?? [];
                      const hasItem =
                      widgetMonthData.examDays.has(dayNum) ||
                       dayEvents.length > 0 ||
                      dayTasks.length > 0;
                    const tooltipLines = [
                      ...dayTasks.map((task) =>
                        task.time
                          ? `• ${task.time} · ${task.title}`
                          : `• ${task.title}`
                      ),
                      ...dayEvents.map((evt) => `• ${evt.title}`),
                    ];
                    return (
                      <div
                        key={`day-${dayNum}`}
                        className={`py-1 rounded-full flex flex-col items-center gap-0.5 ${
                          isToday ? "bg-indigo-500 text-white" : ""
                        }`}
                         title={tooltipLines.length > 0 ? tooltipLines.join("\n") : undefined}
                      >
                        <span>{dayNum}</span>
                        {hasItem && (
                          <span className="flex items-center gap-0.5">
                            {dayTasks.map((task) => (
                              <span
                                key={task.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: task.color }}
                              />
                            ))}
                            {dayEvents.map((evt) => (
                              <span
                                key={evt.id}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isToday ? "bg-white" : "bg-emerald-400"
                                }`}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white/40 dark:bg-slate-800/40 p-6 rounded-[2.5rem] border border-white/40 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-indigo-950 dark:text-white">Actividad</h3>
                  <span className="text-xs text-indigo-500 font-bold cursor-pointer">
                    Ver todo
                  </span>
                </div>
                <div className="space-y-4">
                  {activityLog.map((log, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div
                        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${log.type === "alert"
                          ? "bg-rose-400"
                          : log.type === "success"
                            ? "bg-emerald-400"
                            : "bg-indigo-400"
                          }`}
                      />
                      <div>
                        <p className="text-gray-700 dark:text-slate-300 font-bold text-xs leading-snug">
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
            {navItems.map((item: any) => {
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
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer text-sm font-semibold transition-all duration-200 ${active
                    ? "bg-white/60 dark:bg-slate-800/60 text-indigo-900 dark:text-indigo-300 border border-white/80 dark:border-slate-700 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-white/25 dark:hover:bg-slate-800/30 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent"
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

        {/* BLOQUE TOGGLE + AVATAR (Agrupados o separados) */}
        <div className="flex items-center gap-2">
          <div className="glass-panel p-3 rounded-[1.5rem] flex items-center justify-center">
            <ThemeToggle />
          </div>

          <div className="glass-panel p-4 rounded-[1.5rem] flex-1 flex items-center gap-3 border border-white/40 backdrop-blur-sm shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-500 to-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
              {profile?.name?.charAt(0).toUpperCase() || "D"}
            </div>
            <div className="overflow-hidden">
              <div className="font-bold text-sm truncate text-gray-800 dark:text-slate-200">
                {profile?.name || "Docente"}
              </div>
              <div className="text-xs text-gray-500 font-medium">Dashboard</div>
            </div>
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
              <p className="mt-2 text-gray-500 dark:text-slate-400 text-sm font-medium">
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
                  <div className="absolute left-0 right-0 mt-2 bg-white/95 dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700 max-h-72 overflow-y-auto z-30">
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
                            <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">
                              {exam.title || "Sin título"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${exam.status?.toLowerCase() === "open"
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
                            {(exam.university || exam.subject) && (
                              <span className="truncate">
                          {exam.university && exam.subject
                            ? `${exam.university} • ${exam.subject}`
                            : exam.university || exam.subject}
                              </span>
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




