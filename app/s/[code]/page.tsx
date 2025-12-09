"use client";

import * as React from "react";
import ExamChat from "@/components/ExamChat";

const API = process.env.NEXT_PUBLIC_API_URL!;

type QKind = "MCQ" | "TRUE_FALSE" | "SHORT" | "FIB";

type PaperQuestion = {
  id: string;
  kind: QKind;
  stem: string;
  choices: string[] | null;
  points: number;
};

type Step = "name" | "exam" | "submitting" | "submitted";

type SubmitResponse = {
  ok: boolean;
  gradingMode: "auto" | "manual";
  score: number | null;
  maxScore: number | null;
};

// Normaliza el kind que viene del backend al que usamos en el front
function mapKind(raw: string): QKind {
  const k = String(raw || "").toUpperCase();
  if (k === "TRUE_FALSE") return "TRUE_FALSE";
  if (k === "MCQ") return "MCQ";
  if (k === "FIB" || k === "FILL_IN") return "FIB";
  return "SHORT";
}

// Divide el enunciado de FIB en partes: texto y “huecos”
// parsea [[...]] -> piezas de texto y cajas (para FIB)
function fibParseToParts(stem: string) {
  const parts: Array<{ type: "text" | "box"; idx?: number; text?: string }> =
    [];
  const re = /\[\[(.*?)\]\]/g;
  let last = 0,
    m: RegExpExecArray | null,
    box = 0;

  while ((m = re.exec(stem)) !== null) {
    // texto ANTES del [[...]]
    if (m.index > last) {
      parts.push({ type: "text", text: stem.slice(last, m.index) });
    }

    // la caja (el casillero); ignoramos lo que haya dentro de [[...]]
    parts.push({ type: "box", idx: box++ });

    // avanzar el cursor
    last = m.index + m[0].length;
  }

  // texto luego del último [[...]]
  if (last < stem.length) {
    parts.push({ type: "text", text: stem.slice(last) });
  }

  // si no hay ninguna [[ ]], devolvemos todo como texto
  if (!parts.length) {
    parts.push({ type: "text", text: stem });
  }

  return parts;
}

export default function StudentPage({ params }: { params: { code: string } }) {
  const { code } = params;

  const [step, setStep] = React.useState<Step>("name");

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
  const [flash, setFlash] = React.useState(false);

  // cartel pantalla completa / antifraude
  const [showFullscreenWarning, setShowFullscreenWarning] =
    React.useState(false);
  const [lastViolationType, setLastViolationType] = React.useState<
    string | null
  >(null);

  // cartel revisión programada
  const [reviewModal, setReviewModal] = React.useState<{
    title: string;
    body: string;
  } | null>(null);

  // respuestas
  const [answers, setAnswers] = React.useState<Record<string, any>>({});

  // resultado post-submit
  const [gradingMode, setGradingMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [score, setScore] = React.useState<number | null>(null);
  const [maxScore, setMaxScore] = React.useState<number | null>(null);

  // ============================= Header común =============================
  const Header = (
    <div
      style={{
        padding: "8px 0",
        borderBottom: "1px solid #eee",
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>Alumno · Modo examen</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>
        {exam?.title || "Examen"}
      </div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>Código: {exam?.code}</div>
    </div>
  );

  // ========================= Cargar paper (examen) ========================
  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoadingPaper(true);
        const r = await fetch(`${API}/exams/${code}/paper`);
        if (!r.ok) {
          throw new Error(`Error al cargar examen (${r.status})`);
        }
        const data = await r.json();
        if (cancelled) return;

        const rawQs: any[] = Array.isArray(data.questions)
          ? data.questions
          : [];

        setExam({
          title: data.exam?.title || "Examen",
          code: data.exam?.code || code,
        });

        setQuestions(
          rawQs.map((q) => ({
            id: String(q.id),
            kind: mapKind(q.kind),
            stem: String(q.stem ?? ""),
            choices: Array.isArray(q.choices)
              ? q.choices.map((x: any) => String(x ?? ""))
              : null,
            points: Number(q.points ?? 1) || 1,
          }))
        );
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setErr(e?.message || "ERROR_PAPER");
      } finally {
        if (!cancelled) setLoadingPaper(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // =========================== Summary (vidas/time) =======================
  const refreshSummary = React.useCallback(async () => {
    if (!attemptId) return;
    try {
      const r = await fetch(`${API}/attempts/${attemptId}/summary`);
      if (!r.ok) return;
      const data = await r.json();
      if (typeof data.remaining === "number") {
        setLives(data.remaining);
      }
      if (typeof data.secondsLeft === "number") {
        setSecondsLeft(data.secondsLeft);
      }
    } catch (e) {
      console.error("SUMMARY_ERROR", e);
    }
  }, [attemptId]);

  React.useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await refreshSummary();
      if (!cancelled) {
        setTimeout(tick, 5000);
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [attemptId, refreshSummary]);

  // ============================ Start / Submit ============================
  const startAttempt = React.useCallback(async () => {
    if (!studentName.trim()) {
      setErr("Ingresá tu nombre antes de comenzar.");
      return;
    }
    setErr(null);

    try {
      // Intentar entrar en fullscreen
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        console.warn("No se pudo entrar en fullscreen:", e);
      }

      const r = await fetch(`${API}/exams/${code}/attempts/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: studentName.trim() }),
      });

      if (!r.ok) {
        throw new Error(`No se pudo iniciar el intento (${r.status})`);
      }

      const data = await r.json();
      const at = data.attempt;

      setAttemptId(at.id);
      setStep("exam");

      await refreshSummary();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "ERROR_START");
    }
  }, [code, studentName, refreshSummary]);

  const submitAttempt = React.useCallback(
    async (reason: "manual" | "time" | "lives") => {
      if (!attemptId) return;
      setErr(null);
      setStep("submitting");

      try {
        const payload = {
          answers: questions.map((q) => {
            const v = answers[q.id];

            if (q.kind === "FIB") {
              const arr = Array.isArray(v)
                ? v.map((x: any) => String(x ?? ""))
                : [];
              return { questionId: q.id, value: arr };
            }

            return { questionId: q.id, value: v };
          }),
          reason,
        };

        const r = await fetch(`${API}/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || "Error al enviar el intento");
        }

        const data: SubmitResponse = await r.json();

        setGradingMode(data.gradingMode);
        setScore(data.score ?? null);
        setMaxScore(data.maxScore ?? null);
        setStep("submitted");
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Error al enviar el intento");
        setStep("exam");
      }
    },
    [attemptId, answers, questions]
  );

  // =============================== Antifraude =============================
  const reportViolation = React.useCallback(
    async (type: string, meta?: any) => {
      if (!attemptId) return;
      try {
        const r = await fetch(`${API}/attempts/${attemptId}/antifraud`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, meta }),
        });

        if (!r.ok) {
          console.error("ANTIFRAUD_HTTP_ERROR", r.status);
          return;
        }

        const data = await r.json();

        if (typeof data.remaining === "number") {
          setLives(data.remaining);

          if (data.remaining <= 0) {
            // se quedó sin vidas -> auto-submit
            await submitAttempt("lives");
            return;
          }
        }

        // feedback visual
        setFlash(true);
        setTimeout(() => setFlash(false), 400);

        // 👇 ahora mostramos cartel SIEMPRE que haya violación
        setLastViolationType(type);
        setShowFullscreenWarning(true);

        await refreshSummary();
      } catch (err) {
        console.error("Antifraude error", err);
      }
    },
    [attemptId, refreshSummary, submitAttempt]
  );

  React.useEffect(() => {
    if (!attemptId) return;

    const onBlur = () => {
      reportViolation("blur");
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        reportViolation("visibility-hidden");
      }
    };

    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        reportViolation("fullscreen-exit");
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

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [attemptId, reportViolation]);

  // ============================ Manejadores de respuestas ====================
  const handleChangeAnswer = (qid: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  // Si el tiempo llega a 0 y seguimos en el examen => auto-submit por tiempo
  React.useEffect(() => {
    if (!attemptId) return;
    if (secondsLeft === null) return;
    if (secondsLeft > 0) return;
    if (step !== "exam") return;

    submitAttempt("time");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, attemptId, step]);

  // =================== Descarga revisión (PDF) con chequeo =================
  const handleDownloadReview = React.useCallback(async () => {
    if (!attemptId) return;

    try {
      const r = await fetch(`${API}/exams/${code}/meta`);
      if (!r.ok) {
        // si falla el meta, dejamos pasar igual al PDF
        window.open(`${API}/attempts/${attemptId}/review.print`, "_blank");
        return;
      }

      const data = await r.json();
      const openAtRaw = data?.meta?.openAt as string | null | undefined;

      if (openAtRaw) {
        const openDate = new Date(openAtRaw);
        if (!isNaN(openDate.getTime())) {
          const now = new Date();
          if (now < openDate) {
            const pretty = openDate.toLocaleString();
            setReviewModal({
              title: "Revisión todavía no habilitada",
              body: `El docente programó la revisión para el: ${pretty}. Hasta ese momento no vas a poder ver ni descargar el detalle de tu examen.`,
            });
            return;
          }
        }
      }

      window.open(`${API}/attempts/${attemptId}/review.print`, "_blank");
    } catch (e) {
      console.error("REVIEW_MODAL_ERROR", e);
      window.open(`${API}/attempts/${attemptId}/review.print`, "_blank");
    }
  }, [attemptId, code]);

  // ============================ Render preguntas ==========================
  function renderQuestion(q: PaperQuestion, idx: number) {
    const commonBox: React.CSSProperties = {
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    };

    // 👇 muy importante que esté esta línea:
    const kind = mapKind(q.kind as string);

    // ---------- TRUE / FALSE ----------
    if (kind === "TRUE_FALSE") {
      const v = String(answers[q.id] ?? "");

      return (
        <div key={q.id} style={commonBox}>
          <div style={{ marginBottom: 8 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>

          <label style={{ display: "block", marginBottom: 4 }}>
            <input
              type="radio"
              name={`tf-${q.id}`}
              checked={v === "true"}
              onChange={() =>
                setAnswers({
                  ...answers,
                  [q.id]: "true",
                })
              }
            />{" "}
            Verdadero
          </label>

          <label style={{ display: "block", marginBottom: 4 }}>
            <input
              type="radio"
              name={`tf-${q.id}`}
              checked={v === "false"}
              onChange={() =>
                setAnswers({
                  ...answers,
                  [q.id]: "false",
                })
              }
            />{" "}
            Falso
          </label>

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // ---------- MCQ ----------
    if (kind === "MCQ") {
      const v = Number(answers[q.id]);

      return (
        <div key={q.id} style={commonBox}>
          <div style={{ marginBottom: 8 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>

          {(q.choices || []).map((c, i) => (
            <label key={i} style={{ display: "block", marginBottom: 4 }}>
              <input
                type="radio"
                name={`mcq-${q.id}`}
                checked={v === i}
                onChange={() =>
                  setAnswers({
                    ...answers,
                    [q.id]: i,
                  })
                }
              />{" "}
              {c}
            </label>
          ))}

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // ---------- SHORT ----------
    if (kind === "SHORT") {
      const v = String(answers[q.id] ?? "");

      return (
        <div key={q.id} style={commonBox}>
          <div style={{ marginBottom: 8 }}>
            <b>{idx + 1}.</b> {q.stem}
          </div>

          <textarea
            value={v}
            onChange={(e) =>
              setAnswers({
                ...answers,
                [q.id]: e.target.value,
              })
            }
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

    // ---------- FILL IN (FIB) ----------
    if (kind === "FIB") {
      const parts = fibParseToParts(q.stem || "");
      const vArr: string[] = Array.isArray(answers[q.id])
        ? (answers[q.id] as string[])
        : [];

      const setAt = (ix: number, val: string) => {
        const next = [...(vArr || [])];
        next[ix] = val;
        setAnswers({
          ...answers,
          [q.id]: next,
        });
      };

      // 👇 banco de palabras (correctas + distractoras)
      const bank: string[] = Array.isArray(q.choices)
        ? q.choices.filter((w) => typeof w === "string" && w.trim().length > 0)
        : [];

      // al hacer click en una palabra, la ponemos en el primer casillero vacío
      const handleChipClick = (word: string) => {
        const boxCount = parts.filter((p) => p.type === "box").length;
        let targetIndex = -1;

        for (let i = 0; i < boxCount; i++) {
          if (!vArr[i] || vArr[i].trim() === "") {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex === -1) targetIndex = 0; // si todos llenos, sobreescribe el primero
        setAt(targetIndex, word);
      };

      // al soltar una palabra arrastrada sobre un casillero
      const handleDropOnBlank = (
        ix: number,
        ev: React.DragEvent<HTMLInputElement>
      ) => {
        ev.preventDefault();
        const word = ev.dataTransfer.getData("text/plain");
        if (word) {
          setAt(ix, word);
        }
      };

      return (
        <div key={q.id} style={commonBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{idx + 1}.</div>

          {/* Enunciado con casilleros */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
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
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnBlank(p.idx!, e)}
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

          {/* Banco de palabras para completar (arrastrar o clickear) */}
          {bank.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  marginBottom: 4,
                }}
              >
                Opciones para completar (podés arrastrarlas a los casilleros o
                hacer click):
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {bank.map((word, i) => (
                  <span
                    key={i}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", word)
                    }
                    onClick={() => handleChipClick(word)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#f3f4f6",
                      fontSize: 13,
                      cursor: "grab",
                      userSelect: "none",
                    }}
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // ---------- fallback ----------
    return (
      <div key={q.id} style={commonBox}>
        <div>
          <b>{idx + 1}.</b> {q.stem}
        </div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Tipo no soportado aún.</div>
      </div>
    );
  }

  // ================================ Render ================================
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
              <button
                onClick={() => submitAttempt("manual")}
                style={{ padding: "10px 14px" }}
              >
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
                  <button onClick={handleDownloadReview}>
                    🖨️ Ver/Descargar revisión (PDF)
                  </button>
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

      {/* Cartel de infracción antifraude */}
      {showFullscreenWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 20,
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
              Atención: infracción antifraude
            </h2>
            <p
              style={{
                fontSize: 14,
                marginBottom: 16,
                color: "#111",
              }}
            >
              {lastViolationType === "fullscreen-exit"
                ? "Intentaste salir de la pantalla completa. Este examen requiere pantalla completa por seguridad. Si seguís intentando salir, podés quedarte sin vidas y que el examen se cierre automáticamente."
                : "Se detectó una acción no permitida durante el examen (por ejemplo cambiar de pestaña, copiar/pegar, etc.). Estas acciones pueden hacerte perder vidas y cerrar el examen automáticamente."}
            </p>
            <button
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                fontSize: 14,
                fontWeight: 500,
                background: "black",
                color: "white",
                cursor: "pointer",
              }}
              onClick={async () => {
                setShowFullscreenWarning(false);
                try {
                  if (
                    lastViolationType === "fullscreen-exit" &&
                    !document.fullscreenElement
                  ) {
                    await document.documentElement.requestFullscreen();
                  }
                } catch (e) {
                  console.error("requestFullscreen error", e);
                }
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de revisión no habilitada */}
      {reviewModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 20,
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              {reviewModal.title}
            </h2>
            <p
              style={{
                fontSize: 14,
                marginBottom: 16,
                color: "#111",
              }}
            >
              {reviewModal.body}
            </p>
            <button
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                fontSize: 14,
                fontWeight: 500,
                background: "black",
                color: "white",
                cursor: "pointer",
              }}
              onClick={() => setReviewModal(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
