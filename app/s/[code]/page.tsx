"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import ExamChat from "@/components/ExamChat";

const API = process.env.NEXT_PUBLIC_API_URL!;

type QKind = "TRUE_FALSE" | "MCQ" | "SHORT" | "FIB";

type PaperQuestion = {
  id: string;
  kind: QKind | string; // por compat
  stem: string;
  choices?: string[] | null; // MCQ
  points?: number | null;
};

type PaperResponse = {
  exam: { title: string; code: string };
  questions: PaperQuestion[];
};

type SubmitResponse = {
  ok: boolean;
  gradingMode: "auto" | "manual";
  score?: number | null;
  maxScore?: number | null;
};

// parsea [[...]] -> piezas de texto y cajas (para FIB)
function fibParseToParts(stem: string) {
  const parts: Array<{ type: "text" | "box"; idx?: number; text?: string }> =
    [];
  const re = /\[\[(.*?)\]\]/g;
  let last = 0,
    m: RegExpExecArray | null,
    box = 0;

  while ((m = re.exec(stem)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", text: stem.slice(last, m.index) });
    }
    parts.push({ type: "box", idx: box++ });
    last = m.index + m[0].length;
  }

  if (last < stem.length) {
    parts.push({ type: "text", text: stem.slice(last) });
  }

  if (!parts.length) {
    parts.push({ type: "text", text: stem });
  }

  return parts;
}

export default function Student() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  // pasos UI
  const [step, setStep] = React.useState<
    "name" | "exam" | "submitting" | "submitted"
  >("name");

  // alumno
  const [studentName, setStudentName] = React.useState("");

  // intento actual
  const [attemptId, setAttemptId] = React.useState<string | null>(null);

  // examen/paper
  const [exam, setExam] = React.useState<{
    title: string;
    code: string;
  } | null>(null);
  const [questions, setQuestions] = React.useState<PaperQuestion[]>([]);
  const [loadingPaper, setLoadingPaper] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // runtime: vidas + tiempo
  const [lives, setLives] = React.useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  const [flash, setFlash] = React.useState(false); // aviso visual pérdida vida

  // respuestas
  const [answers, setAnswers] = React.useState<Record<string, any>>({});

  // resultado post-submit
  const [gradingMode, setGradingMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [score, setScore] = React.useState<number | null>(null);
  const [maxScore, setMaxScore] = React.useState<number | null>(null);

  // util: mapear kind sueltos a nuestros 4 soportados
  const mapKind = (k: string): QKind => {
    const s = String(k || "").toUpperCase();
    if (s === "TRUE_FALSE" || s === "TF" || s === "VOF") return "TRUE_FALSE";
    if (s === "MCQ" || s === "MULTIPLE" || s === "MULTIPLE_CHOICE")
      return "MCQ";
    if (s === "SHORT" || s === "TEXT" || s === "TEXT_SHORT" || s === "BREVE")
      return "SHORT";
    if (s === "FIB" || s.includes("FILL") || s.includes("BLANK")) return "FIB";
    // fallback amigable
    return "SHORT";
  };

  // ======= terminar intento (por vidas / tiempo / manual)
  async function finishAttempt(reason?: "lives" | "time" | "manual") {
    if (!attemptId) return;
    try {
      await fetch(`${API}/s/attempt/${attemptId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "manual" }),
      }).catch(() => {});
    } finally {
      setStep("submitting");
    }
  }

  // ======= antifraude: summary + aviso visual
  const refreshSummary = React.useCallback(async () => {
    if (!attemptId) return;
    try {
      const r = await fetch(`${API}/attempts/${attemptId}/summary`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await r.json();
      setLives(Number.isFinite(data.remaining) ? data.remaining : null);
      setSecondsLeft(data.secondsLeft ?? null);

      if (data.remaining != null && data.remaining <= 0) {
        await finishAttempt("lives");
      }
    } catch {
      // ignore
    }
  }, [attemptId]);

  const reportViolation = React.useCallback(
    async (type: string, meta?: any) => {
      if (!attemptId) return;
      try {
        const r = await fetch(`${API}/s/attempt/${attemptId}/event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, meta }),
        });

        if (r.ok) {
          const data = await r.json();

          if (typeof data.livesRemaining === "number") {
            setLives(data.livesRemaining);
            if (data.livesRemaining <= 0) {
              await finishAttempt("lives");
              return;
            }
          }

          setFlash(true);
          setTimeout(() => setFlash(false), 500);
          await refreshSummary();
        }
      } catch (err) {
        console.error("Antifraude error", err);
      }
    },
    [attemptId, refreshSummary]
  );

  // listeners antifraude
  React.useEffect(() => {
    if (step !== "exam" || !attemptId) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        reportViolation("blur");
      }
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation("copy");
    };

    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation("cut");
    };

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation("paste");
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        reportViolation("print");
      }
      if (e.key === "PrintScreen") {
        e.preventDefault();
        reportViolation("printscreen");
      }
    };

    const onFull = () => {
      // si se sale del fullscreen, cuenta como violación
      // @ts-ignore
      const fs =
        document.fullscreenElement ||
        // @ts-ignore
        (document as any).webkitFullscreenElement;
      if (!fs) reportViolation("fullscreen-exit");
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("copy", onCopy as any);
    document.addEventListener("cut", onCut as any);
    document.addEventListener("paste", onPaste as any);
    document.addEventListener("keydown", onKey as any);
    document.addEventListener("fullscreenchange", onFull as any);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("copy", onCopy as any);
      document.removeEventListener("cut", onCut as any);
      document.removeEventListener("paste", onPaste as any);
      document.removeEventListener("keydown", onKey as any);
      document.removeEventListener("fullscreenchange", onFull as any);
    };
  }, [step, attemptId, reportViolation]);

  // polling del summary (cada 2s mientras rinde)
  React.useEffect(() => {
    if (step !== "exam" || !attemptId) return;
    const t = setInterval(refreshSummary, 2000);
    refreshSummary();
    return () => clearInterval(t);
  }, [step, attemptId, refreshSummary]);

  // ======= inicio intento
  async function startAttempt() {
    setErr(null);
    const name = studentName.trim();
    if (!name) {
      setErr("Ingresá tu nombre para comenzar.");
      return;
    }

    try {
      // fullscreen (mejor esfuerzo)
      const el: any = document.documentElement;
      if (el.requestFullscreen) {
        try {
          await el.requestFullscreen();
        } catch {
          // ignoramos si falla
        }
      }

      // crear intento en backend REAL
      const r = await fetch(`${API}/exams/${code}/attempts/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name }),
      });
      if (!r.ok) throw new Error(await r.text());

      const data = await r.json();
      setAttemptId(data.attempt.id);

      // paper
      setLoadingPaper(true);
      const pr = await fetch(`${API}/exams/${code}/paper`, {
        cache: "no-store",
      });
      if (!pr.ok) throw new Error(await pr.text());
      const pdata: PaperResponse = await pr.json();

      setExam(pdata.exam);

      // normalizar kinds
      const qs = (pdata.questions || []).map((q) => ({
        ...q,
        kind: mapKind(q.kind as string),
      }));
      setQuestions(qs);

      // semillas de respuestas
      const seed: Record<string, any> = {};
      for (const q of qs) {
        if (q.kind === "TRUE_FALSE") seed[q.id] = "";
        else if (q.kind === "MCQ") seed[q.id] = null;
        else if (q.kind === "SHORT") seed[q.id] = "";
        else if (q.kind === "FIB") seed[q.id] = [];
      }
      setAnswers(seed);

      setLoadingPaper(false);
      setStep("exam");
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar el examen");
    }
  }

  // ======= enviar intento
  async function submitAttempt() {
    if (!attemptId) return;
    setErr(null);
    setStep("submitting");

    try {
      const payload = {
        answers: questions.map((q) => {
          const v = answers[q.id];
          if (q.kind === "FIB") {
            const arr = Array.isArray(v) ? v.map((x) => String(x ?? "")) : [];
            return { questionId: q.id, value: arr };
          }
          return { questionId: q.id, value: v };
        }),
      };

      const r = await fetch(`${API}/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await r.text());
      const data: SubmitResponse = await r.json();

      setGradingMode(data.gradingMode);
      setScore(data.score ?? null);
      setMaxScore(data.maxScore ?? null);
      setStep("submitted");
    } catch (e: any) {
      setErr(e?.message || "Error al enviar el intento");
      setStep("exam");
    }
  }

  // ======= UI helpers

  const Header = (
    <div>
      <h2>{exam?.title || "Examen"}</h2>
      <div style={{ fontSize: 14, opacity: 0.8 }}>
        Requiere pantalla completa
      </div>
    </div>
  );

  function renderQuestion(q: PaperQuestion, idx: number) {
    const commonBox: React.CSSProperties = {
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    };

    const kind = mapKind(q.kind as string);

    // TRUE / FALSE
    if (kind === "TRUE_FALSE") {
      const v = String(answers[q.id] ?? "");
      return (
        <div key={q.id} style={commonBox}>
          <div style={{ marginBottom: 8 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <label>
              <input
                type="radio"
                checked={v === "true"}
                onChange={() => setAnswers({ ...answers, [q.id]: "true" })}
              />{" "}
              Verdadero
            </label>
            <label>
              <input
                type="radio"
                checked={v === "false"}
                onChange={() => setAnswers({ ...answers, [q.id]: "false" })}
              />{" "}
              Falso
            </label>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // MCQ
    if (kind === "MCQ") {
      const v = Number(answers[q.id]);
      return (
        <div key={q.id} style={commonBox}>
          <div style={{ marginBottom: 8 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {(q.choices || []).map((c, i) => (
              <label key={i} style={{ display: "flex", gap: 6 }}>
                <input
                  type="radio"
                  checked={v === i}
                  onChange={() => setAnswers({ ...answers, [q.id]: i })}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // SHORT
    if (kind === "SHORT") {
      const v = String(answers[q.id] ?? "");
      return (
        <div key={q.id} style={commonBox}>
          <div style={{ marginBottom: 8 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>
          <textarea
            value={v}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            placeholder="Escribe tu respuesta…"
            rows={4}
            maxLength={2000}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // FILL IN BLANK
    if (kind === "FIB") {
      const parts = fibParseToParts(q.stem || "");
      const vArr: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];

      const setAt = (ix: number, val: string) => {
        const next = [...(vArr || [])];
        next[ix] = val;
        setAnswers({ ...answers, [q.id]: next });
      };

      // Banco de palabras sugeridas (correctas por ahora)
      const bank = Array.isArray(q.choices) ? q.choices : [];

      const selectFromBank = (word: string) => {
        // llenamos el primer casillero vacío
        const next = [...(vArr || [])];
        const emptyIndex = next.findIndex((x) => !x || x.trim() === "");
        if (emptyIndex === -1) {
          // si no hay vacío, no hacemos nada (o podríamos sobrescribir el último)
          return;
        }
        next[emptyIndex] = word;
        setAnswers({ ...answers, [q.id]: next });
      };

      return (
        <div key={q.id} style={commonBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{idx + 1}.</div>

          {/* Texto con casilleros */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            {parts.map((p, i) =>
              p.type === "text" ? (
                <span key={i}>{p.text}</span>
              ) : (
                <input
                  key={i}
                  placeholder={`Casillero ${p.idx! + 1}`}
                  value={vArr[p.idx!] || ""}
                  onChange={(e) => setAt(p.idx!, e.target.value)}
                  style={{
                    width: 160,
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              )
            )}
          </div>

          {/* Banco de palabras */}
          {bank.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.8,
                  marginBottom: 4,
                }}
              >
                Opciones sugeridas:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {bank.map((w, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectFromBank(w)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // fallback
    return (
      <div key={q.id} style={commonBox}>
        <div>
          <b>{idx + 1}.</b> {q.stem}
        </div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Tipo no soportado aún.</div>
      </div>
    );
  }

  // ======= render
  return (
    <div
      style={{
        padding: 16,
        maxWidth: 900,
        margin: "0 auto",
        display: "grid",
        gap: 12,
      }}
    >
      {/* Paso: ingresar nombre */}
      {step === "name" && (
        <div style={{ display: "grid", gap: 12 }}>
          <h2>{exam?.title || "Examen"}</h2>
          <div style={{ fontSize: 14, opacity: 0.8 }}>
            Ingresá tu nombre para comenzar. El examen requiere pantalla
            completa.
          </div>
          <input
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Tu nombre"
            style={{
              padding: 10,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          />
          <div>
            <button onClick={startAttempt} style={{ padding: "10px 14px" }}>
              Empezar
            </button>
          </div>
          {err && (
            <div
              style={{
                background: "#fee",
                border: "1px solid #fcc",
                borderRadius: 8,
                padding: 8,
              }}
            >
              {err}
            </div>
          )}
        </div>
      )}

      {/* Paso: examen */}
      {step === "exam" && (
        <div style={{ display: "grid", gap: 12 }}>
          {Header}

          {/* Cabecera info (vidas/timer/título) */}
          <div
            style={{
              padding: 8,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: flash ? "#ffe6e6" : "#f7f7f7",
              transition: "background 200ms",
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <b>{exam?.title || "Examen"}</b>
            </div>
            <div>
              Alumno: <b>{studentName}</b>
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 16,
              }}
            >
              <div>
                <b>Vidas:</b> {lives ?? "—"}
              </div>
              <div>
                <b>Tiempo:</b>{" "}
                {secondsLeft != null
                  ? (() => {
                      const m = Math.floor(secondsLeft / 60);
                      const s = secondsLeft % 60;
                      const danger = secondsLeft <= 600;
                      return (
                        <span style={{ color: danger ? "red" : undefined }}>
                          {m}:{String(s).padStart(2, "0")}
                        </span>
                      );
                    })()
                  : "—"}
              </div>
            </div>
          </div>

          {loadingPaper && <div>Cargando examen…</div>}

          {!loadingPaper && questions.map((q, i) => renderQuestion(q, i))}

          {!loadingPaper && (
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={submitAttempt} style={{ padding: "10px 14px" }}>
                Enviar examen
              </button>
            </div>
          )}

          {err && (
            <div
              style={{
                background: "#fee",
                border: "1px solid #fcc",
                borderRadius: 8,
                padding: 8,
              }}
            >
              {err}
            </div>
          )}

          {/* Chat flotante (alumno) */}
          <ExamChat
            code={code}
            role="student"
            defaultName={studentName || "Alumno"}
          />
        </div>
      )}

      {/* Paso: enviando */}
      {step === "submitting" && (
        <div>
          <h3>Enviando tu examen…</h3>
        </div>
      )}

      {/* Paso: enviado */}
      {step === "submitted" && (
        <div style={{ display: "grid", gap: 12 }}>
          {Header}

          {gradingMode === "auto" ? (
            <>
              <div
                style={{
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                }}
              >
                <div>
                  <b>Tu examen fue enviado.</b>
                </div>
                <div>
                  Calificación automática: <b>{score}</b> / <b>{maxScore}</b>
                </div>
              </div>

              {attemptId && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={`${API}/attempts/${attemptId}/review.print`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <button>🖨️ Ver/Descargar revisión (PDF)</button>
                  </a>
                  <a
                    href={`${API}/attempts/${attemptId}/review.docx`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <button>⬇️ Descargar revisión (Word)</button>
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                }}
              >
                <div>
                  <b>Tu examen fue enviado.</b>
                </div>
                <div>
                  El docente corregirá y publicará la nota y la revisión.
                </div>
              </div>
              {attemptId && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Guardá este identificador: <code>{attemptId}</code>
                </div>
              )}
            </>
          )}

          {/* Chat flotante (sigue disponible) */}
          <ExamChat
            code={code}
            role="student"
            defaultName={studentName || "Alumno"}
          />
        </div>
      )}
    </div>
  );
}
