"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
};

export default function CalendarView({ exams }: Props) {
    const router = useRouter();
    const [currentDate, setCurrentDate] = React.useState(new Date());

    // Helpers de fecha
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
        return { days, firstDay };
    };

    const { days, firstDay } = getDaysInMonth(currentDate);

    // Ajuste para empezar la semana en Lunes (opcional, pero común en ES)
    // 0(Sun)->6, 1(Mon)->0, etc.
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    // Mapear exámenes a días
    const examsByDay = React.useMemo(() => {
        const map: Record<number, ExamListItem[]> = {};
        exams.forEach(ex => {
            const d = new Date(ex.createdAt);
            // Solo si es el mismo mes y año
            if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) {
                const dayNum = d.getDate();
                if (!map[dayNum]) map[dayNum] = [];
                map[dayNum].push(ex);
            }
        });
        return map;
    }, [exams, currentDate]);

    const changeMonth = (delta: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
    };

    const monthName = currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    // Estilos
    const styles = {
        container: {
            background: "white",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            padding: "24px",
            height: "calc(100vh - 140px)",
            display: "flex",
            flexDirection: "column" as const,
        },
        header: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
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
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
        },
        grid: {
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "1px",
            background: "#e5e7eb", // lineas de grilla
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            overflow: "hidden",
            flex: 1,
        },
        dayHeader: {
            background: "#f9fafb",
            padding: "12px",
            textAlign: "center" as const,
            fontSize: "12px",
            fontWeight: 600,
            color: "#6b7280",
            textTransform: "uppercase" as const,
        },
        dayCell: {
            background: "white",
            minHeight: "100px",
            padding: "8px",
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
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h2 style={styles.title}>{monthName}</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button style={styles.navBtn} onClick={() => changeMonth(-1)}>← Anterior</button>
                    <button style={styles.navBtn} onClick={() => changeMonth(1)}>Siguiente →</button>
                </div>
            </div>

            {/* Grid */}
            <div style={styles.grid}>
                {/* Headers Semanales */}
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                    <div key={d} style={styles.dayHeader}>{d}</div>
                ))}

                {/* Celdas Vacías inicio mes */}
                {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ background: "white" }} />
                ))}

                {/* Días */}
                {Array.from({ length: days }).map((_, i) => {
                    const dayNum = i + 1;
                    const dayExams = examsByDay[dayNum] || [];
                    return (
                        <div
                            key={dayNum}
                            style={styles.dayCell}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#fafafa"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                        >
                            <div style={styles.dayNumber}>{dayNum}</div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {dayExams.map(ex => (
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
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
