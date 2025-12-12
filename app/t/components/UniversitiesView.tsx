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

    // Sync local state with profile prop when it changes (e.g. initial load)
    React.useEffect(() => {
        if (profile?.institutions) {
            setLocalInstitutions(profile.institutions);
        }
    }, [profile]);

    // Selection State
    const [expandedInstIds, setExpandedInstIds] = React.useState<Set<string>>(new Set());
    const [selectedSubjectId, setSelectedSubjectId] = React.useState<string | null>(null);

    // Filter Logic
    const activeInstitutionId = Array.from(expandedInstIds).find(id =>
        localInstitutions.find(i => i.id === id)?.subjects.some(s => s.id === selectedSubjectId)
    );
    const activeInstitution = localInstitutions.find(i => i.id === activeInstitutionId);
    const activeSubject = activeInstitution?.subjects.find(s => s.id === selectedSubjectId);

    const filteredExams = React.useMemo(() => {
        if (!activeSubject) return [];
        const subjectName = activeSubject.name.toLowerCase().trim();
        return exams.filter(e => {
            const examSubject = e.subject?.toLowerCase().trim();
            const examTitle = e.title.toLowerCase();
            // Match strict subject field OR title contains subject name
            return (examSubject === subjectName) || (examTitle.includes(subjectName));
        });
    }, [exams, activeSubject]);

    // --- Handlers (Persistence) ---

    const saveChanges = async (newInsts: Institution[]) => {
        setLocalInstitutions(newInsts); // Optimistic UI
        if (profile) {
            await onUpdateProfile({ ...profile, institutions: newInsts });
        }
    };

    const toggleExpand = (instId: string) => {
        const newSet = new Set(expandedInstIds);
        if (newSet.has(instId)) newSet.delete(instId);
        else newSet.add(instId);
        setExpandedInstIds(newSet);
    };

    const addUniversity = async () => {
        const name = prompt("Nombre de la nueva universidad:");
        if (!name) return;
        const newInst: Institution = {
            id: `inst-${Date.now()}`,
            name,
            subjects: []
        };
        await saveChanges([...localInstitutions, newInst]);
        // Auto expand
        toggleExpand(newInst.id);
    };

    const deleteUniversity = async (instId: string) => {
        if (!confirm("¿Eliminar estación universidad y todas sus materias?")) return;
        const newInsts = localInstitutions.filter(i => i.id !== instId);
        await saveChanges(newInsts);
    };

    const addSubject = async (instId: string) => {
        const name = prompt("Nombre de la nueva materia:");
        if (!name) return;
        const newInsts = localInstitutions.map(i => {
            if (i.id === instId) {
                return {
                    ...i,
                    subjects: [...i.subjects, { id: `subj-${Date.now()}`, name }]
                };
            }
            return i;
        });
        await saveChanges(newInsts);
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
            background: "white",
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
            color: '#1f2937',
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
            color: active ? '#1d4ed8' : '#4b5563',
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

    return (
        <div style={styles.container}>
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
