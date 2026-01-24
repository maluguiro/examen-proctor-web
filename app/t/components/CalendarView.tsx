"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";


// --- Tipos Locales ---
type ExamListItem = {
  id: string;
  title: string;
  code: string;
  createdAt: string; // Usaremos createdAt como fecha de evento por ahora
  status: string;
};

type Props = {
  exams: ExamListItem[];
  profile: { email?: string | null; name?: string | null } | null;
};

type ViewMode = "day" | "week" | "month";

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  time?: string;
  color?: string;
};

type CalendarTask = {
  id: string;
  date: string;
  time: string;
  title: string;
  color: string;
};

export default function CalendarView({ exams }: Props) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isDark, setIsDark] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [newEventTitle, setNewEventTitle] = React.useState("");

  const [tasks, setTasks] = React.useState<CalendarTask[]>([]);
  const [showTaskForm, setShowTaskForm] = React.useState(false);
  const [taskDate, setTaskDate] = React.useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [taskTime, setTaskTime] = React.useState("");
  const [taskTitle, setTaskTitle] = React.useState("");
  const sherbetColors = React.useMemo(
    () => ["#c9be9c", "#c2a2b5", "#c585a6", "#9c8dae", "#a6c7c9", "#82c0c6"],
    []
  );
  const [useCustomColor, setUseCustomColor] = React.useState(false);
  const [selectedColor, setSelectedColor] = React.useState(sherbetColors[0]);
  const [taskColor, setTaskColor] = React.useState(sherbetColors[0]);
  const [newEventTime, setNewEventTime] = React.useState("");
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editType, setEditType] = React.useState<"event" | "task" | null>(null);
  const [editId, setEditId] = React.useState("");
  const [editDate, setEditDate] = React.useState("");
  const [editTime, setEditTime] = React.useState("");
  const [editTitle, setEditTitle] = React.useState("");
  const [editUseCustomColor, setEditUseCustomColor] = React.useState(false);
  const [editPaletteColor, setEditPaletteColor] = React.useState(
    sherbetColors[0]
  );
  const [editCustomColor, setEditCustomColor] = React.useState(
    sherbetColors[0]
  );

  const [hydrated, setHydrated] = React.useState(false);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = React.useRef(true);

  const notifyCalendarUpdate = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("teacher_calendar_updated"));
  }, []);

  // Mantener MISMAS KEYS que TeacherDashboard (por perfil)
  const getCalendarStorageKeys = React.useCallback(() => {
    // legacy (global) keys
    const legacyEventsKey = "teacher_calendar_events";
    const legacyTasksKey = "teacher_calendar_tasks";

    if (typeof window === "undefined") {
      return {
        eventsKey: legacyEventsKey,
        tasksKey: legacyTasksKey,
        legacyEventsKey,
        legacyTasksKey,
      };
    }

    const rawProfile = window.localStorage.getItem("teacherProfile");
    let profileKey = "";

    if (rawProfile) {
      try {
        const parsed = JSON.parse(rawProfile);
        // Usar email primero (más estable), si no name.
        const identifier = `${parsed?.email || parsed?.name || ""}`
          .trim()
          .toLowerCase();
        if (identifier) {
          // Normalización más estable (evita espacios, símbolos, etc.)
          profileKey = identifier.replace(/[^a-z0-9]+/g, "_");
        }
      } catch {
        profileKey = "";
      }
    }

    const eventsKey = profileKey
      ? `teacher_${profileKey}_teacher_calendar_events`
      : legacyEventsKey;
    const tasksKey = profileKey
      ? `teacher_${profileKey}_teacher_calendar_tasks`
      : legacyTasksKey;

    return { eventsKey, tasksKey, legacyEventsKey, legacyTasksKey };
  }, []);

  const getAuthToken = React.useCallback(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("examproctor_token") || "";
  }, []);

  const fetchCalendar = React.useCallback(
    async (signal?: AbortSignal) => {
      const token = getAuthToken();
      if (!token) return null;
      const res = await fetch(`${API}/teacher/calendar`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
      if (!res.ok) {
        throw new Error(`GET /api/teacher/calendar failed: ${res.status}`);
      }
      const data = await res.json();
      const fetchedEvents = Array.isArray(data?.events) ? data.events : [];
      const fetchedTasks = Array.isArray(data?.tasks) ? data.tasks : [];
      return { events: fetchedEvents, tasks: fetchedTasks };
    },
    [getAuthToken]
  );

  const saveCalendar = React.useCallback(
    async (
      payload: { events: CalendarEvent[]; tasks: CalendarTask[] },
      signal?: AbortSignal
    ) => {
      const token = getAuthToken();
      if (!token) return false;
      const res = await fetch(`${API}/teacher/calendar`, {

        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal,
      });
      if (!res.ok) {
        throw new Error(`PUT /api/teacher/calendar failed: ${res.status}`);
      }
      return true;
    },
    [getAuthToken]
  );

  // Detectar dark mode (sin cambios)
  React.useEffect(() => {
    const html = document.documentElement;
    const updateTheme = () => setIsDark(html.classList.contains("dark"));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!useCustomColor) {
      setTaskColor(selectedColor);
    }
  }, [useCustomColor, selectedColor]);

  // Cargar events + tasks 1 vez (backend con fallback a localStorage)
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const controller = new AbortController();
    const { eventsKey, tasksKey, legacyEventsKey, legacyTasksKey } =
      getCalendarStorageKeys();

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
      const currentEvents = readArray(eventsKey);
      const legacyEvents = readArray(legacyEventsKey);
      const loadedEvents = currentEvents ?? legacyEvents ?? [];
      setEvents(loadedEvents);

      if (
        (!currentEvents || currentEvents.length === 0) &&
        loadedEvents.length > 0 &&
        eventsKey !== legacyEventsKey
      ) {
        window.localStorage.setItem(eventsKey, JSON.stringify(loadedEvents));
      }

      const currentTasks = readArray(tasksKey);
      const legacyTasks = readArray(legacyTasksKey);
      const loadedTasks = currentTasks ?? legacyTasks ?? [];
      setTasks(loadedTasks);

      if (
        (!currentTasks || currentTasks.length === 0) &&
        loadedTasks.length > 0 &&
        tasksKey !== legacyTasksKey
      ) {
        window.localStorage.setItem(tasksKey, JSON.stringify(loadedTasks));
      }
    };

    const finalizeHydration = () => {
      setHydrated(true);
      skipNextSaveRef.current = true;
    };

    const hydrate = async () => {
      try {
        const remote = await fetchCalendar(controller.signal);
        if (remote) {
          setEvents(remote.events);
          setTasks(remote.tasks);
          finalizeHydration();
          return;
        }
      } catch (err) {
        console.error("Calendar hydrate failed, using localStorage fallback.", err);
      }

      loadFromStorage();
      finalizeHydration();
    };

    hydrate();

    return () => controller.abort();
  }, [fetchCalendar, getCalendarStorageKeys]);

  // Persistir events + tasks (debounced, backend first, localStorage on success)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const controller = new AbortController();
   saveTimeoutRef.current = setTimeout(async () => {
  const { eventsKey, tasksKey, legacyEventsKey, legacyTasksKey } =
    getCalendarStorageKeys();

  // 1) Guardado local SIEMPRE (así al refrescar no se pierde)
  try {
    window.localStorage.setItem(eventsKey, JSON.stringify(events));
    window.localStorage.setItem(tasksKey, JSON.stringify(tasks));
    window.localStorage.setItem(legacyEventsKey, JSON.stringify(events));
    window.localStorage.setItem(legacyTasksKey, JSON.stringify(tasks));
    notifyCalendarUpdate();
  } catch (err) {
    console.error("LocalStorage write failed.", err);
  }

  // 2) Guardado en backend (si falla, igual queda lo local)
  try {
    await saveCalendar({ events, tasks }, controller.signal);
  } catch (err) {
    console.error("Calendar save to backend failed.", err);
  }
}, 500);


    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      controller.abort();
    };
  }, [
    events,
    tasks,
    hydrated,
    getCalendarStorageKeys,
    notifyCalendarUpdate,
    saveCalendar,
  ]);

  // Helpers de fecha
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(currentDate);

  // Ajuste para empezar la semana en Lunes
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Mapear exámenes a días
  const examsByDay = React.useMemo(() => {
    const map: Record<number, ExamListItem[]> = {};
    exams.forEach((ex) => {
      const d = new Date(ex.createdAt);
      if (
        d.getMonth() === currentDate.getMonth() &&
        d.getFullYear() === currentDate.getFullYear()
      ) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push(ex);
      }
    });
    return map;
  }, [exams, currentDate]);

  const changeMonth = (delta: number) => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1)
    );
  };

  const monthText = currentDate.toLocaleDateString("es-ES", { month: "long" });
  const monthName = `${monthText.charAt(0).toUpperCase()}${monthText.slice(
    1
  )} del ${currentDate.getFullYear()}`;
  const selectedDateLabel = selectedDate.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Estilos (sin cambios)
  const styles = {
    container: {
      background: isDark ? "#9ca3af" : "#ffffff",
      borderRadius: "16px",
      border: "1px solid #e5e7eb",
      padding: "16px",
      height: "auto",
      display: "flex",
      flexDirection: "column" as const,
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },
    title: {
      fontSize: "20px",
      fontWeight: 700,
      textTransform: "capitalize" as const,
    },
    navBtn: {
      background: "transparent",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 500,
    },
    viewTabs: {
      display: "flex",
      gap: "8px",
    },
    viewTab: (active: boolean) => ({
      padding: "6px 10px",
      borderRadius: "8px",
      border: active ? "1px solid #10b981" : "1px solid #e5e7eb",
      background: active ? "#ecfdf5" : "transparent",
      color: "#111",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer",
    }),
    taskBtn: {
      padding: "6px 12px",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,0.6)",
      background: "linear-gradient(90deg, #bbf7d0, #fde68a, #fdba74)",
      color: "#1f2933",
      fontSize: "12px",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 6px 16px rgba(250, 204, 21, 0.35)",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: "1px",
      background: "#e5e7eb",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      overflow: "hidden",
      flex: 1,
    },
    dayHeader: {
      background: "#f9fafb",
      padding: "8px",
      textAlign: "center" as const,
      fontSize: "12px",
      fontWeight: 600,
      color: "#6b7280",
      textTransform: "uppercase" as const,
    },
    dayCell: {
      background: isDark ? "#f3f4f6" : "white",
      minHeight: "70px",
      padding: "6px",
      position: "relative" as const,
      cursor: "pointer",
      transition: "background 0.2s",
    },
    dayNumber: {
      fontSize: "14px",
      fontWeight: 600,
      color: "#374151",
      marginBottom: "4px",
    },
    eventDot: {
      fontSize: "11px",
      background: "#eff6ff",
      color: "#1d4ed8",
      borderLeft: "2px solid #3b82f6",
      padding: "2px 4px",
      borderRadius: "2px",
      marginBottom: "2px",
      whiteSpace: "nowrap" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "block",
    },
    dayPanel: {
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      padding: "12px",
      background: "#ffffff",
    },
    dayForm: {
      display: "flex",
      gap: "8px",
      marginTop: "10px",
    },
    input: {
      flex: 1,
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      padding: "8px 10px",
      fontSize: "13px",
    },
    addBtn: {
      border: "1px solid #10b981",
      background: "#ecfdf5",
      color: "#065f46",
      borderRadius: "8px",
      padding: "8px 12px",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: "13px",
    },
    eventItem: {
      fontSize: "13px",
      color: "#111",
      padding: "6px 0",
      borderBottom: "1px dashed #e5e7eb",
    },
    taskPanel: {
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      padding: "16px",
      background: "linear-gradient(90deg, #bbf7d0, #fde68a, #fdba74)",
      width: "100%",
      maxWidth: "420px",
      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.2)",
    },
    modalOverlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(15, 23, 42, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 90,
      padding: "16px",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "10px",
    },
    closeBtn: {
      border: "none",
      background: "transparent",
      fontSize: "16px",
      cursor: "pointer",
      color: "#6b7280",
    },
    taskGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
      marginTop: "10px",
    },
    taskInput: {
      border: "1px solid #f9fcf8",
      borderRadius: "8px",
      padding: "8px 10px",
      fontSize: "13px",
    },
    taskFull: {
      gridColumn: "1 / -1",
    },
    taskActions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      marginTop: "10px",
    },
    taskSave: {
      border: "1px solid #10b981",
      background: "#ecfdf5",
      color: "#065f46",
      borderRadius: "8px",
      padding: "8px 12px",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: "13px",
    },
    paletteRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap" as const,
      marginTop: "10px",
    },
    paletteDot: (active: boolean, color: string) => ({
      width: "22px",
      height: "22px",
      borderRadius: "999px",
      border: active ? "2px solid #111827" : "1px solid rgba(0,0,0,0.1)",
      background: color,
      cursor: "pointer",
      boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.7)" : "none",
    }),
    paletteLabel: {
      fontSize: "12px",
      fontWeight: 600,
      color: "#4b5563",
    },
    agendaHeader: {
      display: "grid",
      gridTemplateColumns: "80px repeat(7, 1fr)",
      gap: "6px",
      marginBottom: "8px",
    },
    agendaHeaderCell: {
      fontSize: "11px",
      fontWeight: 700,
      color: "#6b7280",
      textTransform: "uppercase" as const,
      letterSpacing: "0.02em",
    },
    agendaBody: {
      display: "grid",
      gridTemplateColumns: "80px repeat(7, 1fr)",
      gap: "6px",
    },
    timeColumn: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    timeCell: {
      fontSize: "11px",
      color: "#6b7280",
      textAlign: "right" as const,
      paddingRight: "8px",
      height: "54px",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    agendaDayColumn: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    noTimeBox: {
      background: "rgba(255,255,255,0.7)",
      border: "1px solid rgba(148,163,184,0.25)",
      borderRadius: "10px",
      padding: "8px",
      minHeight: "48px",
    },
    hourCell: {
      background: "rgba(255,255,255,0.7)",
      border: "1px solid rgba(148,163,184,0.25)",
      borderRadius: "10px",
      padding: "6px",
      minHeight: "54px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "4px",
    },
    agendaItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "6px",
      padding: "4px 6px",
      borderRadius: "8px",
      fontSize: "11px",
      fontWeight: 600,
      color: "#1f2937",
      background: "rgba(255,255,255,0.85)",
      border: "1px solid rgba(0,0,0,0.05)",
    },
    agendaActions: {
      display: "flex",
      gap: "4px",
      alignItems: "center",
    },
    actionBtn: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "12px",
      opacity: 0.8,
    },
  };

  const eventsByDay = React.useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((evt) => {
      if (!map[evt.date]) map[evt.date] = [];
      map[evt.date].push(evt);
    });
    return map;
  }, [events]);

  const tasksByDay = React.useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    tasks.forEach((task) => {
      if (!map[task.date]) map[task.date] = [];
      map[task.date].push(task);
    });
    return map;
  }, [tasks]);

  const selectedDateKey = selectedDate.toISOString().slice(0, 10);
  const selectedEvents = eventsByDay[selectedDateKey] ?? [];
  const selectedTasks = tasksByDay[selectedDateKey] ?? [];

  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const hours = React.useMemo(
    () => Array.from({ length: 13 }, (_, i) => 8 + i),
    []
  );

  const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

  const parseHour = (time?: string) => {
    if (!time) return null;
    const [h] = time.split(":");
    const hour = Number(h);
    return Number.isNaN(hour) ? null : hour;
  };

  const resolveColor = (color?: string) => color || sherbetColors[0];

  const openEditModal = (
    item: CalendarEvent | CalendarTask,
    type: "event" | "task"
  ) => {
    const existingColor = resolveColor(item.color);
    const isCustom = !sherbetColors.includes(existingColor);
    setEditType(type);
    setEditId(item.id);
    setEditDate(item.date);
    setEditTime(item.time || "");
    setEditTitle(item.title);
    setEditUseCustomColor(isCustom);
    setEditPaletteColor(isCustom ? sherbetColors[0] : existingColor);
    setEditCustomColor(existingColor);
    setShowEditModal(true);
  };

  const deleteEvent = (id: string) => {
    if (!confirm("¿Eliminar este evento?")) return;
    setEvents((prev) => prev.filter((evt) => evt.id !== id));
  };

  const deleteTask = (id: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const saveEdit = () => {
    if (!editType) return;
    const title = editTitle.trim();
    if (!title) return;
    const finalColor = editUseCustomColor ? editCustomColor : editPaletteColor;

    if (editType === "event") {
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === editId
            ? {
                ...evt,
                title,
                date: editDate,
                time: editTime.trim() || undefined,
                color: finalColor,
              }
            : evt
        )
      );
    } else {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === editId
            ? {
                ...task,
                title,
                date: editDate,
                time: editTime.trim(),
                color: finalColor,
              }
            : task
        )
      );
    }

    setShowEditModal(false);
  };

  const renderAgendaItem = (
    item: CalendarEvent | CalendarTask,
    type: "event" | "task"
  ) => {
    const color = resolveColor(item.color);
    const label =
      "time" in item && item.time ? `${item.time} · ${item.title}` : item.title;
    return (
      <div
        key={item.id}
        style={{
          ...styles.agendaItem,
          borderLeft: `3px solid ${color}`,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        <span style={styles.agendaActions}>
          <button
            style={styles.actionBtn}
            onClick={() => openEditModal(item, type)}
            aria-label={`Editar ${type}`}
          >
            ✏️
          </button>
          <button
            style={styles.actionBtn}
            onClick={() =>
              type === "event" ? deleteEvent(item.id) : deleteTask(item.id)
            }
            aria-label={`Borrar ${type}`}
          >
            🗑️
          </button>
        </span>
      </div>
    );
  };

  const addEvent = () => {
    const title = newEventTitle.trim();
    if (!title) return;
    const colorForNew = useCustomColor ? taskColor : selectedColor;
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      date: selectedDateKey,
      title,
      time: newEventTime.trim() || undefined,
      color: colorForNew,
    };
    setEvents((prev) => [...prev, newEvent]);
    setNewEventTitle("");
    setNewEventTime("");
  };

  const saveTask = () => {
    const title = taskTitle.trim();
    if (!title || !taskDate) return;
    const colorForNew = useCustomColor ? taskColor : selectedColor;
    const newTask: CalendarTask = {
      id: `task-${Date.now()}`,
      date: taskDate,
      time: taskTime.trim(),
      title,
      color: colorForNew,
    };
    setTasks((prev) => [...prev, newTask]);
    setTaskTitle("");
    setTaskTime("");
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>{monthName}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.navBtn} onClick={() => changeMonth(-1)}>
            ← Anterior
          </button>
          <button style={styles.navBtn} onClick={() => changeMonth(1)}>
            Siguiente →
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={styles.viewTabs}>
          <button
            style={styles.viewTab(viewMode === "day")}
            onClick={() => setViewMode("day")}
          >
            Día
          </button>
          <button
            style={styles.viewTab(viewMode === "week")}
            onClick={() => setViewMode("week")}
          >
            Semana
          </button>
          <button
            style={styles.viewTab(viewMode === "month")}
            onClick={() => setViewMode("month")}
          >
            Mes
          </button>
          <button
            style={styles.taskBtn}
            onClick={() => {
              setTaskDate(selectedDateKey);
              setShowTaskForm((prev) => !prev);
            }}
          >
            Tarea +
          </button>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>{selectedDateLabel}</div>
      </div>

      <div style={styles.paletteRow}>
        <span style={styles.paletteLabel}>Colores sugeridos</span>
        {sherbetColors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Seleccionar color ${color}`}
            style={styles.paletteDot(!useCustomColor && selectedColor === color, color)}
            onClick={() => {
              setSelectedColor(color);
              setUseCustomColor(false);
            }}
          />
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={useCustomColor}
            onChange={(e) => setUseCustomColor(e.target.checked)}
          />
          Color personalizado
        </label>
        {useCustomColor && (
          <input
            type="color"
            value={taskColor}
            onChange={(e) => setTaskColor(e.target.value)}
            style={{ width: 36, height: 28, border: "1px solid #e5e7eb" }}
          />
        )}
      </div>

      {showTaskForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.taskPanel}>
            <div style={styles.modalHeader}>
              <div style={{ fontWeight: 600 }}>Nueva tarea</div>
              <button
                style={styles.closeBtn}
                onClick={() => setShowTaskForm(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div style={styles.taskGrid}>
              <input
                style={styles.taskInput}
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
              />
              <input
                style={styles.taskInput}
                type="time"
                value={taskTime}
                onChange={(e) => setTaskTime(e.target.value)}
              />
              <input
                style={{ ...styles.taskInput, ...styles.taskFull }}
                placeholder="Nombre de la tarea"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
              <div
                style={{
                  ...styles.taskFull,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "#292a2c" }}>🎨 Color</span>
                {!useCustomColor && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {sherbetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        style={styles.paletteDot(selectedColor === color, color)}
                        onClick={() => setSelectedColor(color)}
                        aria-label={`Seleccionar color ${color}`}
                      />
                    ))}
                  </div>
                )}
                {useCustomColor && (
                  <input
                    style={styles.taskInput}
                    type="color"
                    value={taskColor}
                    onChange={(e) => setTaskColor(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div style={styles.taskActions}>
              <button style={styles.taskSave} onClick={saveTask}>
                Guardar tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.taskPanel}>
            <div style={styles.modalHeader}>
              <div style={{ fontWeight: 600 }}>
                {editType === "task" ? "Editar tarea" : "Editar evento"}
              </div>
              <button
                style={styles.closeBtn}
                onClick={() => setShowEditModal(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div style={styles.taskGrid}>
              <input
                style={styles.taskInput}
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
              <input
                style={styles.taskInput}
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
              <input
                style={{ ...styles.taskInput, ...styles.taskFull }}
                placeholder="Título"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <div
                style={{
                  ...styles.taskFull,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 12, color: "#292a2c" }}>🎨 Color</span>
                {!editUseCustomColor && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {sherbetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        style={styles.paletteDot(editPaletteColor === color, color)}
                        onClick={() => setEditPaletteColor(color)}
                        aria-label={`Seleccionar color ${color}`}
                      />
                    ))}
                  </div>
                )}
                {editUseCustomColor && (
                  <input
                    style={styles.taskInput}
                    type="color"
                    value={editCustomColor}
                    onChange={(e) => setEditCustomColor(e.target.value)}
                  />
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={editUseCustomColor}
                    onChange={(e) => setEditUseCustomColor(e.target.checked)}
                  />
                  Color personalizado
                </label>
              </div>
            </div>
            <div style={styles.taskActions}>
              <button style={styles.taskSave} onClick={saveEdit}>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === "month" && (
        <div style={styles.grid}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} style={styles.dayHeader}>
              {d}
            </div>
          ))}

          {Array.from({ length: startOffset }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{ background: isDark ? "#f3f4f6" : "white" }}
            />
          ))}

          {Array.from({ length: days }).map((_, i) => {
            const dayNum = i + 1;
            const dayExams = examsByDay[dayNum] || [];
            const cellDate = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              dayNum
            );
            const isToday =
              dayNum === new Date().getDate() &&
              currentDate.getMonth() === new Date().getMonth() &&
              currentDate.getFullYear() === new Date().getFullYear();
            const dayBackground = isToday ? "#ecfdf5" : isDark ? "#f3f4f6" : "white";
            const dayKey = cellDate.toISOString().slice(0, 10);
            const dayEvents = eventsByDay[dayKey] ?? [];
            const dayTasks = tasksByDay[dayKey] ?? [];

            return (
              <div
                key={dayNum}
                style={{ ...styles.dayCell, background: dayBackground }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                onMouseLeave={(e) => (e.currentTarget.style.background = dayBackground)}
                onClick={() => {
                  setSelectedDate(cellDate);
                  setViewMode("day");
                }}
              >
                <div style={styles.dayNumber}>{dayNum}</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dayExams.map((ex) => (
                    <span
                      key={ex.id}
                      style={styles.eventDot}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/t/${ex.code}`);
                      }}
                      title={`${ex.title} (${ex.status})`}
                    >
                      {ex.title}
                    </span>
                  ))}

                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        ...styles.eventDot,
                        background: resolveColor(evt.color),
                        color: "#1f2937",
                        borderLeft: `2px solid ${resolveColor(evt.color)}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {evt.time ? `${evt.time} · ${evt.title}` : evt.title}
                      </span>
                      <span style={styles.agendaActions}>
                        <button
                          style={styles.actionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(evt, "event");
                          }}
                          aria-label="Editar evento"
                        >
                          ✏️
                        </button>
                        <button
                          style={styles.actionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEvent(evt.id);
                          }}
                          aria-label="Borrar evento"
                        >
                          🗑️
                        </button>
                      </span>
                    </div>
                  ))}

                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        ...styles.eventDot,
                        background: task.color,
                        color: "#1f2937",
                        borderLeft: `2px solid ${task.color}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {task.time ? `${task.time} · ${task.title}` : task.title}
                      </span>
                      <span style={styles.agendaActions}>
                        <button
                          style={styles.actionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(task, "task");
                          }}
                          aria-label="Editar tarea"
                        >
                          ✏️
                        </button>
                        <button
                          style={styles.actionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                          }}
                          aria-label="Borrar tarea"
                        >
                          🗑️
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode !== "month" && (
        <div style={styles.dayPanel}>
          {viewMode === "week" && (
            <>
              <div style={styles.agendaHeader}>
                <div style={styles.agendaHeaderCell}>Hora</div>
                {weekDays.map((day) => (
                  <div key={day.toISOString()} style={styles.agendaHeaderCell}>
                    {day.toLocaleDateString("es-ES", {
                      weekday: "short",
                      day: "numeric",
                    })}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "6px",
                  marginBottom: "10px",
                }}
              >
                {weekDays.map((day) => {
                  const dayKey = day.toISOString().slice(0, 10);
                  const noTimeEvents = (eventsByDay[dayKey] ?? []).filter(
                    (evt) => !evt.time
                  );
                  const noTimeTasks = (tasksByDay[dayKey] ?? []).filter(
                    (task) => !task.time
                  );
                  return (
                    <div key={`no-time-${dayKey}`} style={styles.noTimeBox}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#6b7280",
                          marginBottom: 6,
                        }}
                      >
                        Sin hora
                      </div>
                      {noTimeEvents.map((evt) => renderAgendaItem(evt, "event"))}
                      {noTimeTasks.map((task) => renderAgendaItem(task, "task"))}
                      {noTimeEvents.length === 0 && noTimeTasks.length === 0 && (
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          Sin items
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={styles.agendaBody}>
                <div style={styles.timeColumn}>
                  {hours.map((hour) => (
                    <div key={`time-${hour}`} style={styles.timeCell}>
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>
                {weekDays.map((day) => {
                  const dayKey = day.toISOString().slice(0, 10);
                  const dayEvents = eventsByDay[dayKey] ?? [];
                  const dayTasks = tasksByDay[dayKey] ?? [];
                  return (
                    <div key={dayKey} style={styles.agendaDayColumn}>
                      {hours.map((hour) => {
                        const timedEvents = dayEvents.filter(
                          (evt) => parseHour(evt.time) === hour
                        );
                        const timedTasks = dayTasks.filter(
                          (task) => parseHour(task.time) === hour
                        );
                        return (
                          <div key={`${dayKey}-${hour}`} style={styles.hourCell}>
                            {timedEvents.map((evt) =>
                              renderAgendaItem(evt, "event")
                            )}
                            {timedTasks.map((task) =>
                              renderAgendaItem(task, "task")
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {viewMode === "day" && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {selectedDateLabel}
              </div>
              <div style={{ ...styles.noTimeBox, marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#6b7280",
                    marginBottom: 6,
                  }}
                >
                  Sin hora
                </div>
                {selectedEvents
                  .filter((evt) => !evt.time)
                  .map((evt) => renderAgendaItem(evt, "event"))}
                {selectedTasks
                  .filter((task) => !task.time)
                  .map((task) => renderAgendaItem(task, "task"))}
                {selectedEvents.filter((evt) => !evt.time).length === 0 &&
                  selectedTasks.filter((task) => !task.time).length === 0 && (
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      Sin items
                    </div>
                  )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: "6px",
                  marginBottom: "12px",
                }}
              >
                <div style={styles.timeColumn}>
                  {hours.map((hour) => (
                    <div key={`day-time-${hour}`} style={styles.timeCell}>
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>
                <div style={styles.agendaDayColumn}>
                  {hours.map((hour) => {
                    const timedEvents = selectedEvents.filter(
                      (evt) => parseHour(evt.time) === hour
                    );
                    const timedTasks = selectedTasks.filter(
                      (task) => parseHour(task.time) === hour
                    );
                    return (
                      <div key={`day-${hour}`} style={styles.hourCell}>
                        {timedEvents.map((evt) =>
                          renderAgendaItem(evt, "event")
                        )}
                        {timedTasks.map((task) =>
                          renderAgendaItem(task, "task")
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={styles.dayForm}>
                <input
                  style={styles.input}
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Agregar evento"
                />
                <input
                  style={{ ...styles.input, maxWidth: 120 }}
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                />
                <button style={styles.addBtn} onClick={addEvent}>
                  Guardar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
