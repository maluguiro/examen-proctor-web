"use client";

import * as React from "react";
import type {
    ExamAttemptsResponse,
    AttemptSummary,
    ExamStatus,
} from "@/lib/types";
import { getAuthToken } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL!;

export function BoardClient({ code }: { code: string }) {
    const [data, setData] = React.useState<ExamAttemptsResponse | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);
    const [info, setInfo] = React.useState<string | null>(null);

    // ====== Cargar tablero ======
    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const r = await fetch(`${API}/exams/${code}/attempts?t=${Date.now()}`, {
                cache: "no-store",
            });
            if (!r.ok) throw new Error(await r.text());
            const json: ExamAttemptsResponse = await r.json();
            setData(json);
        } catch (e: any) {
            setErr(e?.message || "No se pudo cargar el tablero");
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        load();
        const t = setInterval(load, 4000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    // ====== Acciones del docente (pausa, perdonar vida, +tiempo) ======
    async function modAttempt(
        id: string,
        action: "pause" | "resume" | "forgive_life" | "add_time",
        seconds?: number
    ) {
        const token = getAuthToken();
        if (!token) {
            alert("Sesión expirada. Volvé a iniciar sesión.");
            return;
        }

        try {
            const r = await fetch(`${API}/attempts/${id}/mod`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(
                    action === "add_time"
                        ? { action, seconds: seconds ?? 300 }
                        : { action }
                ),
            });

            if (!r.ok) {
                const txt = await r.text();
                // Manejo de errores específicos para debug
                if (r.status === 401 || r.status === 403) {
                    alert(`Error ${r.status}: Sesión inválida. Recargá la página.`);
                } else if (r.status === 404) {
                    alert(`Error 404: No se encontró el intento.`);
                } else {
                    alert(`Error al realizar acción (${r.status}): ${txt}`);
                }
                return;
            }

            await load();
            setInfo("Acción realizada con éxito.");
            setTimeout(() => setInfo(null), 3000);
        } catch (e: any) {
            console.error(e);
            alert("Hubo un error de conexión al intentar la acción. Revisá tu internet o recargá.");
        }
    }

    const [sortMode, setSortMode] = React.useState<"activity" | "name-asc">(
        "activity"
    );
    const [filterMode, setFilterMode] = React.useState<
        "all" | "in-progress" | "submitted" | "violations"
    >("all");
    const [searchTerm, setSearchTerm] = React.useState("");

    const attempts: AttemptSummary[] = data?.attempts ?? [];
    const total = attempts.length;
    const exam = data?.exam;

    function renderAttemptStatus(status: string, paused: boolean) {
        if (status === "submitted") return "Enviado";
        if (paused) return "Pausado";
        return "En curso";
    }

    function mapStatusLabel(status?: ExamStatus | string) {
        switch (status) {
            case "DRAFT":
                return "Borrador";
            case "OPEN":
            case "open":
                return "Abierto";
            case "CLOSED":
            case "closed":
                return "Cerrado";
            default:
                return status || "";
        }
    }

    const sortedAttempts = React.useMemo(() => {
        const list = [...attempts];
        if (sortMode === "name-asc") {
            list.sort((a, b) =>
                (a.studentName || "").localeCompare(b.studentName || "")
            );
        } else {
            // "Unified Timestamp" Sorting
            list.sort((a, b) => {
                const tA = a.lastActivityAt
                    ? new Date(a.lastActivityAt).getTime()
                    : a.finishedAt
                        ? new Date(a.finishedAt).getTime()
                        : a.startedAt
                            ? new Date(a.startedAt).getTime()
                            : 0;

                const tB = b.lastActivityAt
                    ? new Date(b.lastActivityAt).getTime()
                    : b.finishedAt
                        ? new Date(b.finishedAt).getTime()
                        : b.startedAt
                            ? new Date(b.startedAt).getTime()
                            : 0;

                return tB - tA;
            });
        }
        return list;
    }, [attempts, sortMode]);

    const finalAttempts = React.useMemo(() => {
        // 1. Filtro por Estado
        const byStatus = sortedAttempts.filter((a) => {
            if (filterMode === "in-progress") return a.status !== "submitted";
            if (filterMode === "submitted") return a.status === "submitted";
            if (filterMode === "violations") return (a.violationsCount ?? 0) > 0;
            return true;
        });

        // 2. Filtro por Nombre
        const term = searchTerm.trim().toLowerCase();
        if (!term) return byStatus;

        return byStatus.filter((a) =>
            (a.studentName || "").toLowerCase().includes(term)
        );
    }, [sortedAttempts, filterMode, searchTerm]);

    function toggleSort() {
        setSortMode((prev) => (prev === "activity" ? "name-asc" : "activity"));
    }

    const cardStyle: React.CSSProperties = {
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        marginTop: 16,
    };

    const examTitle =
        exam?.title && String(exam.title).trim().length > 0
            ? String(exam.title).trim()
            : "(sin título)";

    const examStatusLabel = (() => {
        const raw = exam?.status;
        const mapped = mapStatusLabel(raw);
        return mapped && mapped.trim().length > 0 ? mapped : "Borrador";
    })();

    return (
        <section style={cardStyle}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                }}
            >
                <h2 style={{ margin: 0 }}>Tablero y antifraude</h2>
                <button
                    onClick={load}
                    disabled={loading}
                    style={{
                        marginLeft: "auto",
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        fontSize: 12,
                        cursor: loading ? "default" : "pointer",
                    }}
                >
                    {loading ? "Actualizando…" : "Refrescar"}
                </button>
            </div>

            {exam && (
                <p style={{ color: "#555", fontSize: 13, marginBottom: 12 }}>
                    Examen: <b>{examTitle}</b>{" "}
                    {typeof exam.lives === "number" && (
                        <>
                            · Vidas por alumno: <b>{exam.lives}</b>
                        </>
                    )}{" "}
                    · Estado: <b>{examStatusLabel}</b> · Participantes:{" "}
                    <b>{total}</b>
                </p>
            )}

            {/* Filtros Unificados */}
            <div
                style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginBottom: 16,
                    background: "#f9fafb",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #f0f0f0",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>
                        Ver:
                    </label>
                    <select
                        value={filterMode}
                        onChange={(e) =>
                            setFilterMode(
                                e.target.value as
                                | "all"
                                | "in-progress"
                                | "submitted"
                                | "violations"
                            )
                        }
                        style={{
                            padding: "6px 8px",
                            fontSize: 13,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: "white",
                            cursor: "pointer",
                        }}
                    >
                        <option value="all">Todos</option>
                        <option value="in-progress">En curso</option>
                        <option value="submitted">Enviados</option>
                        <option value="violations">Con fraude</option>
                    </select>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flex: 1,
                        minWidth: 200,
                    }}
                >
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar alumno..."
                        style={{
                            flex: 1,
                            padding: "6px 10px",
                            fontSize: 13,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            outline: "none",
                        }}
                    />
                </div>
            </div>

            {err && (
                <div style={{ color: "crimson", marginBottom: 12, fontSize: 13 }}>
                    Error: {err}
                </div>
            )}
            {info && (
                <div style={{ color: "green", marginBottom: 12, fontSize: 13 }}>
                    {info}
                </div>
            )}

            {loading && attempts.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.7 }}>Cargando tablero…</p>
            ) : attempts.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.7 }}>
                    Todavía no hay intentos registrados.
                </p>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 13,
                        }}
                    >
                        <thead>
                            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                                <th
                                    style={{
                                        padding: 8,
                                        borderBottom: "1px solid #ddd",
                                        cursor: "pointer",
                                        userSelect: "none",
                                    }}
                                    onClick={toggleSort}
                                    title="Click para cambiar criterio de orden"
                                >
                                    Alumno{" "}
                                    <span
                                        style={{ fontSize: 11, color: "#666", fontWeight: 400 }}
                                    >
                                        {sortMode === "activity" ? "(Actividad ⚡)" : "(A-Z ▲)"}
                                    </span>
                                </th>
                                <th
                                    style={{
                                        textAlign: "center",
                                        padding: 8,
                                        borderBottom: "1px solid #ddd",
                                    }}
                                >
                                    Vidas
                                </th>
                                <th
                                    style={{
                                        textAlign: "center",
                                        padding: 8,
                                        borderBottom: "1px solid #ddd",
                                    }}
                                >
                                    Nota / Puntaje
                                </th>
                                <th
                                    style={{
                                        textAlign: "left",
                                        padding: 8,
                                        borderBottom: "1px solid #ddd",
                                    }}
                                >
                                    Tiempo (inicio / fin)
                                </th>
                                <th
                                    style={{
                                        textAlign: "center",
                                        padding: 8,
                                        borderBottom: "1px solid #ddd",
                                    }}
                                >
                                    Acciones
                                </th>
                                <th
                                    style={{
                                        textAlign: "left",
                                        padding: 8,
                                        borderBottom: "1px solid #ddd",
                                    }}
                                >
                                    Estado
                                </th>
                                <th
                                    style={{
                                        textAlign: "left",
                                        padding: 8,
                                        borderBottom: "1px solid #ddd",
                                    }}
                                >
                                    Fraude
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalAttempts.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        style={{
                                            padding: 24,
                                            textAlign: "center",
                                            color: "#666",
                                            fontSize: 13,
                                        }}
                                    >
                                        No hay intentos que coincidan con el filtro/búsqueda actual.
                                    </td>
                                </tr>
                            ) : (
                                finalAttempts.map((a) => {
                                    const examLives = exam?.lives ?? 0;
                                    const livesRemaining =
                                        examLives > 0
                                            ? Math.max(0, examLives - (a.livesUsed ?? 0))
                                            : 0;

                                    let scoreText: string;
                                    if (typeof a.score === "number") {
                                        scoreText = new Intl.NumberFormat("es-AR", {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2,
                                        }).format(a.score);
                                    } else if (a.status === "submitted") {
                                        scoreText = "Pendiente";
                                    } else {
                                        scoreText = "—";
                                    }

                                    const violations = a.violationsCount ?? 0;
                                    const hasFraud = violations > 0;
                                    const isSubmitted = a.status === "submitted";
                                    const isFraudSubmitted = isSubmitted && hasFraud && livesRemaining === 0;

                                    // Formato de hora
                                    const fmtTime = (iso?: string) => {
                                        if (!iso) return "—";
                                        const d = new Date(iso);
                                        if (isNaN(d.getTime())) return "—";
                                        return d.toLocaleTimeString("es-AR", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        });
                                    };

                                    const startStr = fmtTime(a.startedAt || undefined);
                                    const endStr = fmtTime(a.finishedAt || undefined);
                                    const timeLabel = (
                                        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                                            <div style={{ color: "#444" }}>Inicio: {startStr}</div>
                                            <div style={{ color: "#888" }}>Fin: {endStr}</div>
                                        </div>
                                    );

                                    return (
                                        <tr key={a.id}>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: "1px solid #f0f0f0",
                                                }}
                                            >
                                                {a.studentName || (
                                                    <span style={{ color: "#999" }}>(sin nombre)</span>
                                                )}
                                                {isFraudSubmitted && (
                                                    <span
                                                        title="Examen enviado automáticamente por antifraude (sin vidas)"
                                                        style={{
                                                            marginLeft: 8,
                                                            fontSize: 16,
                                                            cursor: "help",
                                                        }}
                                                    >
                                                        🚨
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: "1px solid #f0f0f0",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {examLives ? `${livesRemaining}/${examLives}` : "—"}
                                            </td>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: "1px solid #f0f0f0",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {scoreText}
                                            </td>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: "1px solid #f0f0f0",
                                                }}
                                            >
                                                {timeLabel}
                                            </td>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: "1px solid #f0f0f0",
                                                    textAlign: "center",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: 6,
                                                        justifyContent: "center",
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => modAttempt(a.id, "forgive_life")}
                                                        style={{ padding: "4px 8px", fontSize: 11 }}
                                                    >
                                                        +1 Vida ❤️
                                                    </button>
                                                    <button
                                                        onClick={() => modAttempt(a.id, "add_time", 300)}
                                                        style={{ padding: "4px 8px", fontSize: 11 }}
                                                    >
                                                        +5 min
                                                    </button>
                                                    {a.paused ? (
                                                        <button
                                                            onClick={() => modAttempt(a.id, "resume")}
                                                            style={{ padding: "4px 8px", fontSize: 11 }}
                                                        >
                                                            ▶
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => modAttempt(a.id, "pause")}
                                                            style={{ padding: "4px 8px", fontSize: 11 }}
                                                        >
                                                            ⏸
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: "1px solid #f0f0f0",
                                                }}
                                            >
                                                {/* STATUS COLUMN */}
                                                {(() => {
                                                    if (a.paused) {
                                                        return (
                                                            <span
                                                                style={{
                                                                    background: "#fff7ed",
                                                                    color: "#c2410c",
                                                                    padding: "2px 6px",
                                                                    borderRadius: 4,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    border: "1px solid #ffedd5",
                                                                }}
                                                            >
                                                                PAUSADO
                                                            </span>
                                                        );
                                                    }
                                                    if (isFraudSubmitted) {
                                                        return (
                                                            <span
                                                                style={{
                                                                    background: "#fef2f2",
                                                                    color: "#b91c1c",
                                                                    padding: "2px 6px",
                                                                    borderRadius: 4,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    border: "1px solid #fee2e2",
                                                                }}
                                                            >
                                                                ENVIADO (FRAUDE)
                                                            </span>
                                                        );
                                                    }
                                                    if (isSubmitted) {
                                                        return (
                                                            <span
                                                                style={{
                                                                    background: "#f0fdf4",
                                                                    color: "#15803d",
                                                                    padding: "2px 6px",
                                                                    borderRadius: 4,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    border: "1px solid #bbf7d0",
                                                                }}
                                                            >
                                                                ENVIADO
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span
                                                            style={{
                                                                background: "#eff6ff",
                                                                color: "#1d4ed8",
                                                                padding: "2px 6px",
                                                                borderRadius: 4,
                                                                fontSize: 11,
                                                                fontWeight: 600,
                                                                border: "1px solid #dbeafe",
                                                            }}
                                                        >
                                                            EN CURSO
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: "1px solid #f0f0f0",
                                                    fontSize: 12,
                                                    color: "#666",
                                                }}
                                            >
                                                {a.violationsCount && a.violationsCount > 0 ? (
                                                    <div
                                                        title={
                                                            a.violationTypes
                                                                ?.map((v) => `${v.type} x${v.count}`)
                                                                .join(", ") || ""
                                                        }
                                                        style={{ cursor: "help" }}
                                                    >
                                                        <span style={{ color: "#d32f2f", fontWeight: 500 }}>
                                                            {a.violationsCount} violaciones
                                                        </span>
                                                        {a.lastViolationReason && (
                                                            <span style={{ marginLeft: 6, color: "#888" }}>
                                                                · {a.lastViolationReason}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "#aaa" }}>Sin incidencias</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
