"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";
import { TeacherProfile } from "@/lib/teacherProfile";

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
};

// --- Componente Dashboard ---
export default function TeacherDashboard({
    profile,
    onLogout,
}: TeacherDashboardProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = React.useState("dashboard");
    const [search, setSearch] = React.useState("");

    // Estado local para exáamenes (Real fetch logic simplificada)
    const [exams, setExams] = React.useState<ExamListItem[]>([]);
    const [loadingExams, setLoadingExams] = React.useState(true);

    // MOCK DATA para Cards
    const fraudStats = {
        totalAttempts: 124,
        clean: 85,
        violations: 15,
        topReasons: ["Salida de pantalla", "Detección de celular", "Voces detectadas"],
    };

    const activityLog = [
        { text: "Juan Pérez entregó examen de Lógica I", time: "hace 3 min", type: "info" },
        { text: "Se detectó fraude en Matemática I", time: "hace 10 min", type: "alert" },
        { text: "Nuevo examen creado: Introducción a la IA", time: "hace 2 horas", type: "success" },
    ];

    // Fetch Exámenes Real
    React.useEffect(() => {
        fetch(`${API}/exams`, { cache: "no-store" })
            .then((res) => res.json())
            .then((data) => {
                setExams(Array.isArray(data) ? data : []);
            })
            .catch((e) => console.error("Error loading exams:", e))
            .finally(() => setLoadingExams(false));
    }, []);

    // Crear Examen (mantiene lógica)
    async function handleCreateExam() {
        try {
            const res = await fetch(`${API}/exams`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "Examen sin título",
                    lives: 3,
                    durationMins: 60,
                }),
            });
            if (res.ok) {
                const exam = await res.json();
                const code = exam.code || String(exam.id).slice(0, 6);
                router.push(`/t/${code}`);
            }
        } catch (e) {
            alert("Error creando examen. Ver consola.");
            console.error(e);
        }
    }

    // Estilos
    const styles = {
        container: {
            display: "flex", // Sidebar + Main
            minHeight: "100vh",
            background: "#f3f4f6", // fondo gris claro
            fontFamily: "'Inter', sans-serif",
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
            const isOpen = status.toUpperCase() === 'OPEN';
            return {
                padding: "2px 8px",
                borderRadius: "99px",
                fontSize: "10px",
                fontWeight: 700,
                background: isOpen ? "#dcfce7" : "#f3f4f6",
                color: isOpen ? "#166534" : "#6b7280",
            }
        }
    };

    const navItems = [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "university", label: "Universidades y materias", icon: "🏛️", action: () => router.push("/t/profile") },
        { id: "exams", label: "Exámenes", icon: "📝", action: () => {/* scroll or filter */ } },
        { id: "calendar", label: "Calendario", icon: "📅" },
        { id: "profile", label: "Perfil", icon: "👤", action: () => router.push("/t/profile") },
    ];

    return (
        <div style={styles.container}>
            {/* Sidebar */}
            <aside style={styles.sidebar}>
                <div style={styles.sidebarLogo}>ProctoEtic</div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {navItems.map((item) => (
                        <div
                            key={item.id}
                            style={styles.navItem(activeTab === item.id)}
                            onClick={() => {
                                setActiveTab(item.id);
                                if (item.action) item.action();
                            }}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                    <div
                        style={styles.navItem(false)}
                        onClick={onLogout}
                    >
                        <span>🚪</span>
                        Cerrar sesión
                    </div>
                </nav>

                <div style={styles.userSection}>
                    <div style={styles.avatar}>
                        {profile?.name?.charAt(0).toUpperCase() || "D"}
                    </div>
                    <div style={{ fontSize: "13px", overflow: "hidden" }}>
                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
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
                            Hola, {profile?.name?.split(" ")[0] || "Docente"} 👋
                        </h1>
                        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                            Aquí tienes el resumen de tu actividad hoy.
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "16px" }}>
                        <input
                            style={styles.search}
                            placeholder="Buscar examen, materia..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button style={styles.createBtn} onClick={handleCreateExam}>
                            + Crear examen
                        </button>
                    </div>
                </div>

                {/* CSS Grid Layout */}
                <div style={styles.grid}>
                    {/* A: Próximos Exámenes (Real Data) */}
                    <div style={{ ...styles.card, gridColumn: "span 2" }}>
                        <h3 style={styles.cardTitle}>Próximos exámenes</h3>
                        {loadingExams ? (
                            <p>Cargando...</p>
                        ) : exams.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>
                                No hay exámenes creados. Crea uno nuevo para empezar.
                            </div>
                        ) : (
                            <div style={styles.cardList}>
                                {exams.slice(0, 4).map((ex) => (
                                    <div key={ex.id} style={{ ...styles.listItem, cursor: 'pointer' }} onClick={() => router.push(`/t/${ex.code}`)}>
                                        <div>
                                            <strong>{ex.title}</strong>
                                            <span style={{ margin: "0 8px", color: "#d1d5db" }}>|</span>
                                            {ex.code}
                                        </div>
                                        <span style={styles.statusBadge(ex.status)}>
                                            {ex.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* B: Calendario (Mock) */}
                    <div style={{ ...styles.card, background: "#1f2937", color: "white" }}>
                        <h3 style={{ ...styles.cardTitle, color: "white" }}>Calendario</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", fontSize: "12px", marginTop: "auto" }}>
                            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div key={i} style={{ textAlign: "center", opacity: 0.5 }}>{d}</div>)}
                            {Array.from({ length: 30 }).map((_, i) => (
                                <div key={i} style={{
                                    textAlign: "center",
                                    padding: "6px",
                                    borderRadius: "6px",
                                    background: [12, 15, 23].includes(i + 1) ? "#3b82f6" : "transparent",
                                    fontWeight: [12, 15, 23].includes(i + 1) ? 700 : 400
                                }}>
                                    {i + 1}
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12, textAlign: 'center' }}>3 eventos este mes</p>
                    </div>

                    {/* C: Resumen Antifraude (Mock) */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>Resumen Antifraude</h3>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            <div style={{ flex: 1, padding: 12, background: '#f3f4f6', borderRadius: 12 }}>
                                <div style={{ fontSize: 24, fontWeight: 800 }}>{fraudStats.totalAttempts}</div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>Intentos</div>
                            </div>
                            <div style={{ flex: 1, padding: 12, background: '#dcfce7', borderRadius: 12, color: '#166534' }}>
                                <div style={{ fontSize: 24, fontWeight: 800 }}>{fraudStats.clean}%</div>
                                <div style={{ fontSize: 12 }}>Limpios</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Top motivos:</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#4b5563' }}>
                            {fraudStats.topReasons.map(r => <li key={r}>{r}</li>)}
                        </ul>
                    </div>

                    {/* D: Materias (Mock) */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>Tus Materias</h3>
                        <div style={styles.cardList}>
                            {/* Mock data */}
                            <div style={styles.listItem}>
                                <span>🧠 Psicología I</span>
                                <span style={{ fontSize: 11, background: '#e5e7eb', padding: '2px 6px', borderRadius: 4 }}>3 activos</span>
                            </div>
                            <div style={styles.listItem}>
                                <span>💻 Lógica Computacional</span>
                                <span style={{ fontSize: 11, background: '#e5e7eb', padding: '2px 6px', borderRadius: 4 }}>1 activo</span>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/t/profile')}
                            style={{ marginTop: 16, border: 'none', background: 'transparent', color: '#2563eb', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                            Gestionar materias →
                        </button>
                    </div>

                    {/* E: Actividad Reciente (Mock) */}
                    <div style={{ ...styles.card, gridColumn: "span 2" }}>
                        <h3 style={styles.cardTitle}>Actividad Reciente</h3>
                        <div style={styles.cardList}>
                            {activityLog.map((log, i) => (
                                <div key={i} style={styles.listItem}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: log.type === 'alert' ? '#ef4444' : log.type === 'success' ? '#22c55e' : '#3b82f6'
                                        }} />
                                        {log.text}
                                    </div>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{log.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
