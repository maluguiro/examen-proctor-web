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
  const [taskColor, setTaskColor] = React.useState("#34d399");

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

  const addEvent = () => {
    const title = newEventTitle.trim();
    if (!title) return;
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      date: selectedDateKey,
      title,
    };
    setEvents((prev) => [...prev, newEvent]);
    setNewEventTitle("");
  };

  const saveTask = () => {
    const title = taskTitle.trim();
    if (!title || !taskDate) return;
    const newTask: CalendarTask = {
      id: `task-${Date.now()}`,
      date: taskDate,
      time: taskTime.trim(),
      title,
      color: taskColor,
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
                <input
                  style={styles.taskInput}
                  type="color"
                  value={taskColor}
                  onChange={(e) => setTaskColor(e.target.value)}
                />
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
                    <span
                      key={evt.id}
                      style={{
                        ...styles.eventDot,
                        background: "#ecfdf5",
                        color: "#047857",
                        borderLeft: "2px solid #10b981",
                      }}
                    >
                      {evt.title}
                    </span>
                  ))}

                  {dayTasks.map((task) => (
                    <span
                      key={task.id}
                      style={{
                        ...styles.eventDot,
                        background: task.color,
                        color: "#111",
                        borderLeft: "2px solid rgba(0,0,0,0.2)",
                      }}
                    >
                      {task.time ? `${task.time} · ${task.title}` : task.title}
                    </span>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {weekDays.map((day) => {
                const dayKey = day.toISOString().slice(0, 10);
                const dayEvents = eventsByDay[dayKey] ?? [];
                const dayTasks = tasksByDay[dayKey] ?? [];
                return (
                  <div key={dayKey} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>
                      {day.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
                    </div>
                    {dayEvents.length === 0 && dayTasks.length === 0 ? (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Sin eventos</div>
                    ) : (
                      <>
                        {dayEvents.map((evt) => (
                          <div key={evt.id} style={styles.eventItem}>{evt.title}</div>
                        ))}
                        {dayTasks.map((task) => (
                          <div key={task.id} style={styles.eventItem}>
                            <span style={{ color: task.color }}>{task.time ? `${task.time} · ` : ""}</span>
                            {task.title}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "day" && (
            <>
              <div style={{ fontWeight: 600 }}>{selectedDateLabel}</div>
              <div style={{ marginTop: 8 }}>
                {selectedEvents.length === 0 && selectedTasks.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Sin eventos para este día.</div>
                ) : (
                  <>
                    {selectedEvents.map((evt) => (
                      <div key={evt.id} style={styles.eventItem}>{evt.title}</div>
                    ))}
                    {selectedTasks.map((task) => (
                      <div key={task.id} style={styles.eventItem}>
                        <span style={{ color: task.color }}>{task.time ? `${task.time} · ` : ""}</span>
                        {task.title}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div style={styles.dayForm}>
                <input
                  style={styles.input}
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Agregar evento"
                />
                <button style={styles.addBtn} onClick={addEvent}>Guardar</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
