"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TeacherProfile, Institution } from "@/lib/teacherProfile";

// --- Tipos Locales ---
type ExamListItem = {
    id: string;
    title: string;
    status: string;
    code: string;
    createdAt: string;
    university?: string;
    subject?: string;
};

type Props = {
    profile: TeacherProfile | null;
    exams: ExamListItem[];
    onDeleteExam: (id: string) => void;
    onUpdateProfile: (newProfile: TeacherProfile) => Promise<void>;
};

export default function UniversitiesView({ profile, exams, onDeleteExam, onUpdateProfile }: Props) {
    const router = useRouter();

    // Local state for institutions (to support immediate UI feedback before/during save)
    // Initialize from props.profile, but then manage locally
    const [localInstitutions, setLocalInstitutions] = React.useState<Institution[]>([]);
    const [isSaving, setIsSaving] = React.useState(false);
    const lastAppliedSigRef = React.useRef<string>("");

    // Sync local state with profile prop when it changes (e.g. initial load)
    React.useEffect(() => {
        const institutions = Array.isArray(profile?.institutions)
            ? profile?.institutions
            : null;
        if (!institutions) return;

        if (process.env.NODE_ENV !== "production") {
            console.debug(
                "[unis] profile institutions isArray",
                Array.isArray(profile?.institutions),
                "len",
                profile?.institutions?.length
            );
        }

        const sig = `${institutions
            .map((i) => i.id ?? i.name ?? "")
            .join("|")}:${institutions.length}`;

        if (sig === lastAppliedSigRef.current) return;
        if (isSaving) return;
        if (localInstitutions.length > institutions.length) return;

        setLocalInstitutions(institutions);
        lastAppliedSigRef.current = sig;
        if (process.env.NODE_ENV !== "production") {
            console.debug("[unis] apply sync sig", sig);
        }
    }, [profile?.institutions, isSaving, localInstitutions.length]);

    // Selection State
    const [expandedInstIds, setExpandedInstIds] = React.useState<Set<string>>(new Set());
    const [selectedSubjectId, setSelectedSubjectId] = React.useState<string | null>(null);
const [isDark, setIsDark] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [uniInput, setUniInput] = React.useState("");
    const [subjectInput, setSubjectInput] = React.useState("");
    const [modalError, setModalError] = React.useState<string | null>(null);
    const [modalInfo, setModalInfo] = React.useState<string | null>(null);

    React.useEffect(() => {
        const html = document.documentElement;
        const updateTheme = () => setIsDark(html.classList.contains("dark"));
        updateTheme();
        const observer = new MutationObserver(updateTheme);
        observer.observe(html, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // Filter Logic
    const activeInstitutionId = Array.from(expandedInstIds).find(id =>
        localInstitutions.find(i => i.id === id)?.subjects.some(s => s.id === selectedSubjectId)
    );
    const activeInstitution = localInstitutions.find(i => i.id === activeInstitutionId);
    const activeSubject = activeInstitution?.subjects.find(s => s.id === selectedSubjectId);

    const filteredExams = React.useMemo(() => {
        if (!activeSubject || !activeInstitution) return [];
        const subjectName = activeSubject.name.trim();
        const institutionName = activeInstitution.name.trim();
        return exams.filter(e => {
            return (
                e.university &&
                e.subject &&
                e.university === institutionName &&
                e.subject === subjectName
            );
        });
    }, [exams, activeSubject, activeInstitution]);

    // --- Handlers (Persistence) ---

    const saveChanges = async (newInsts: Institution[]) => {
        console.log("[Universities] saveChanges", newInsts);
        setLocalInstitutions(newInsts); // Optimistic UI
        if (profile) {
            setIsSaving(true);
            try {
                await onUpdateProfile({ ...profile, institutions: newInsts });
            } finally {
                setIsSaving(false);
            }
        }
    };

    const toggleExpand = (instId: string) => {
        const newSet = new Set(expandedInstIds);
        if (newSet.has(instId)) newSet.delete(instId);
        else newSet.add(instId);
        setExpandedInstIds(newSet);
    };

    const addUniversity = async () => {
        setModalError(null);
        setModalInfo(null);
        setUniInput("");
        setSubjectInput("");
        setIsModalOpen(true);
    };

    const deleteUniversity = async (instId: string) => {
        if (!confirm("¿Eliminar estación universidad y todas sus materias?")) return;
        const newInsts = localInstitutions.filter(i => i.id !== instId);
        await saveChanges(newInsts);
    };

    const addSubject = async (instId: string) => {
        const inst = localInstitutions.find(i => i.id === instId);
        if (!inst) return;
        setModalError(null);
        setModalInfo(null);
        setUniInput(inst.name);
        setSubjectInput("");
        setIsModalOpen(true);
    };

    const handleSaveModal = async () => {
        console.log("[Universities] click Guardar", {
            profile: !!profile,
            uniInput,
            subjectInput,
        });
        if (!profile) {
            setModalError("Perfil no cargado. Recargá e iniciá sesión de nuevo.");
            return;
        }
        if (typeof onUpdateProfile !== "function") {
            setModalError("onUpdateProfile no está conectado desde el dashboard.");
            return;
        }
        const uniName = uniInput.trim();
        const subjName = subjectInput.trim();
        if (!uniName || !subjName) {
            setModalError("Completa universidad y materia.");
            return;
        }

        const existingInst = localInstitutions.find(
            (i) => i.name.trim().toLowerCase() === uniName.toLowerCase()
        );
        const existingSubject = existingInst?.subjects.find(
            (s) => s.name.trim().toLowerCase() === subjName.toLowerCase()
        );

        if (existingSubject) {
            setModalError("Esa materia ya existe en la universidad.");
            return;
        }

        let updatedInstitutions: Institution[];
        if (existingInst) {
            updatedInstitutions = localInstitutions.map((i) => {
                if (i.id !== existingInst.id) return i;
                return {
                    ...i,
                    subjects: [...i.subjects, { id: `subj-${Date.now()}`, name: subjName }],
                };
            });
        } else {
            updatedInstitutions = [
                ...localInstitutions,
                {
                    id: `inst-${Date.now()}`,
                    name: uniName,
                    subjects: [{ id: `subj-${Date.now()}`, name: subjName }],
                },
            ];
        }

        try {
            await saveChanges(updatedInstitutions);
            setModalInfo("Guardado.");
            setIsModalOpen(false);
            setUniInput("");
            setSubjectInput("");
            setModalError(null);
        } catch (e) {
            console.error(e);
            setModalError("No se pudo guardar. Intenta nuevamente.");
        }
    };

    const deleteSubject = async (instId: string, subjId: string) => {
        if (!confirm("¿Eliminar esta materia?")) return;
        const newInsts = localInstitutions.map(i => {
            if (i.id === instId) {
                return {
                    ...i,
                    subjects: i.subjects.filter(s => s.id !== subjId)
                };
            }
            return i;
        });
        await saveChanges(newInsts);
        if (selectedSubjectId === subjId) setSelectedSubjectId(null);
    };

    // --- Estilos ---
    const styles = {
        container: {
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: "24px",
            height: "calc(100vh - 140px)",
        },
        
        column: {
            background: isDark ? "#9ca3af" : "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column" as const,
        },
        header: {
            padding: "16px",
            borderBottom: "1px solid #f3f4f6",
            fontWeight: 700,
            fontSize: "15px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa",
            color: "#111",
        },
        modalOverlay: {
            position: "fixed" as const,
            inset: 0,
            background: "rgba(15, 23, 42, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
        },
        modalCard: {
            width: "100%",
            maxWidth: "520px",
            background: "rgba(255,255,255,0.92)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
            padding: "20px",
            backdropFilter: "blur(8px)",
        },
        modalTitle: {
            fontWeight: 700,
            fontSize: "16px",
            marginBottom: "12px",
            color: "#111",
        },
        input: {
            width: "100%",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            fontSize: "14px",
        },
        modalActions: {
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            marginTop: "16px",
        },
        btnSecondary: {
            background: "transparent",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "13px",
            cursor: "pointer",
        },
        btnPrimary: {
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: 600,
        },
        modalError: {
            color: "#b91c1c",
            fontSize: "12px",
            marginTop: "8px",
        },
        modalInfo: {
            color: "#0f766e",
            fontSize: "12px",
            marginTop: "8px",
        },
        btnPrimarySmall: {
            background: "#111",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "12px",
            cursor: "pointer",
            fontWeight: 600,
        },
        list: {
            padding: "12px",
            overflowY: "auto" as const,
            flex: 1,
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '8px'
        },
        treeItem: {
            // Container for uni
        },
        uniRow: (expanded: boolean) => ({
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: '8px',
            background: expanded ? '#f3f4f6' : 'transparent',
            cursor: 'pointer',
            transition: 'background 0.2s',
            justifyContent: 'space-between'
        }),
        uniName: {
            fontWeight: 600,
            fontSize: '14px',
            color: '#0a0d11',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
        },
        subjectList: {
            paddingLeft: '32px',
            paddingTop: '4px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '2px',
        },
        subjectRow: (active: boolean) => ({
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            color: active ? '#202022' : '#000000',
            background: active ? '#eff6ff' : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: active ? 500 : 400,
        }),
        btnIcon: {
            background: 'transparent',
            border: 'none',
            opacity: 0.4,
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px',
            transition: 'opacity 0.2s',
        },
        emptyState: {
            color: '#9ca3af',
            fontSize: '13px',
            padding: '24px',
            textAlign: 'center' as const,
        },
    };

    const existingUniversities = React.useMemo(
        () => localInstitutions.map((i) => i.name),
        [localInstitutions]
    );
    const subjectsForSelectedUni = React.useMemo(() => {
        const inst = localInstitutions.find(
            (i) => i.name.trim().toLowerCase() === uniInput.trim().toLowerCase()
        );
        return inst ? inst.subjects.map((s) => s.name) : [];
    }, [localInstitutions, uniInput]);

    return (
        <div style={styles.container}>
            {isModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalCard}>
                        <div style={styles.modalTitle}>Agregar Universidad / Materia</div>
                        <div style={{ display: "grid", gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
                                    Universidad
                                </label>
                                <input
                                    list="universities-datalist"
                                    value={uniInput}
                                    onChange={(e) => setUniInput(e.target.value)}
                                    style={styles.input}
                                    placeholder="Ej: UBA"
                                />
                                <datalist id="universities-datalist">
                                    {existingUniversities.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
                                    Nombre de la Asignatura
                                </label>
                                <input
                                    list="subjects-datalist"
                                    value={subjectInput}
                                    onChange={(e) => setSubjectInput(e.target.value)}
                                    style={styles.input}
                                    placeholder="Ej: Álgebra I"
                                />
                                <datalist id="subjects-datalist">
                                    {subjectsForSelectedUni.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                        {modalError && <div style={styles.modalError}>{modalError}</div>}
                        {modalInfo && <div style={styles.modalInfo}>{modalInfo}</div>}
                        <div style={styles.modalActions}>
                            <button
                                style={styles.btnSecondary}
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setModalError(null);
                                    setModalInfo(null);
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                style={styles.btnPrimary}
                                type="button"
                                onClick={handleSaveModal}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Left: Tree */}
            <div style={styles.column}>
                <div style={styles.header}>
                    <span>Universidades</span>
                    <button style={styles.btnPrimarySmall} onClick={addUniversity}>+ Agregar</button>
                </div>
                <div style={styles.list}>
                    {localInstitutions.length === 0 && (
                        <div style={styles.emptyState}>
                            No hay universidades. <br />Agrega una para empezar.
                        </div>
                    )}
                    {localInstitutions.map(inst => {
                        const isExpanded = expandedInstIds.has(inst.id);
                        return (
                            <div key={inst.id} style={styles.treeItem}>
                                <div style={styles.uniRow(isExpanded)} onClick={() => toggleExpand(inst.id)}>
                                    <div style={styles.uniName}>
                                        <span style={{ fontSize: 10, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                                        {inst.name}
                                    </div>
                                    <div style={{ display: 'flex' }}>
                                        {/* Edit logic omitted for brevity, just delete available */}
                                        <button
                                            style={{ ...styles.btnIcon, color: '#ef4444' }}
                                            onClick={(e) => { e.stopPropagation(); deleteUniversity(inst.id); }}
                                            title="Eliminar universidad"
                                        >🗑️</button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={styles.subjectList}>
                                        {inst.subjects.map(subj => (
                                            <div
                                                key={subj.id}
                                                style={styles.subjectRow(selectedSubjectId === subj.id)}
                                                onClick={() => setSelectedSubjectId(subj.id)}
                                            >
                                                <span>{subj.name}</span>
                                                <button
                                                    style={{ ...styles.btnIcon, color: '#ef4444', fontSize: 12 }}
                                                    onClick={(e) => { e.stopPropagation(); deleteSubject(inst.id, subj.id); }}
                                                    title="Eliminar materia"
                                                >×</button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => addSubject(inst.id)}
                                            style={{
                                                textAlign: 'left',
                                                background: 'transparent',
                                                border: '1px dashed #d1d5db',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                marginTop: '4px',
                                                fontSize: '11px',
                                                color: '#6b7280',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            + Agregar materia
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right: Exams */}
            <div style={styles.column}>
                <div style={styles.header}>
                    <div>
                        {activeSubject ? (
                            <>
                                <span style={{ color: '#6b7280', fontWeight: 400 }}>Exámenes de </span>
                                {activeSubject.name}
                            </>
                        ) : "Selecciona una materia"}
                    </div>
                </div>
                <div style={styles.list}>
                    {!activeSubject ? (
                        <div style={styles.emptyState}>
                            Selecciona una materia del panel izquierdo para ver y gestionar sus exámenes.
                        </div>
                    ) : (
                        <>
                            {filteredExams.length === 0 ? (
                                <div style={styles.emptyState}>
                                    No se encontraron exámenes asociados a {activeSubject.name}.
                                </div>
                            ) : (
                                filteredExams.map(ex => (
                                    <div key={ex.id} style={{
                                        background: "white", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px",
                                        display: "flex", justifyContent: "space-between", alignItems: "center"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.title}</div>
                                            <div style={{ fontSize: 11, color: "#6b7280" }}>{ex.code} • {new Date(ex.createdAt).toLocaleDateString()}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => router.push(`/t/${ex.code}`)}
                                                style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: "6px", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
                                            >Ver</button>
                                            <button
                                                onClick={() => { if (confirm("¿Borrar examen?")) onDeleteExam(ex.id); }}
                                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                                            >🗑️</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
