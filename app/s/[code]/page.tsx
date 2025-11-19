"use client";

import * as React from "react";
import { use } from "react";
import ExamChat from "@/components/ExamChat";

// ============= CONFIG =============
const API = process.env.NEXT_PUBLIC_API_URL!;

// ============= TIPOS =============
type PaperQuestion = {
  id: string;
  kind: "TRUE_FALSE" | "MCQ" | "SHORT" | "FIB";
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

// ============= HELPERS UI =============
function mapKind(k: string): "TRUE_FALSE" | "MCQ" | "SHORT" | "FIB" {
  const x = String(k || "").toUpperCase();
  if (x === "TRUE_FALSE" || x === "V_F" || x === "VOF") return "TRUE_FALSE";
  if (x === "MCQ" || x === "MULTIPLE_CHOICE") return "MCQ";
  if (x === "SHORT" || x === "TEXT" || x === "TEXTO") return "SHORT";
  if (x === "FIB" || x === "FILL_IN_BLANKS" || x === "CASILLEROS") return "FIB";
  return "MCQ";
}

function fibParseToParts(
  stem: string
): Array<{ type: "text" | "box"; idx?: number; text?: string }> {
  const parts: Array<{ type: "text" | "box"; idx?: number; text?: string }> =
    [];
  const re = /\[\[(.*?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let boxIdx = 0;
  while ((match = re.exec(stem)) !== null) {
    const i = match.index;
    if (i > lastIndex) {
      parts.push({ type: "text", text: stem.slice(lastIndex, i) });
    }
    parts.push({ type: "box", idx: boxIdx++ });
    lastIndex = i + match[0].length;
  }
  if (lastIndex < stem.length) {
    parts.push({ type: "text", text: stem.slice(lastIndex) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", text: stem });
  }
  return parts;
}

export default function Student({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  // ---- pasos UI
  const [step, setStep] = React.useState<
    "name" | "exam" | "submitting" | "submitted"
  >("name");

  // ---- alumno
  const [studentName, setStudentName] = React.useState("");

  // ---- intento
  const [attemptId, setAttemptId] = React.useState<string | null>(null);

  // ---- paper
  const [exam, setExam] = React.useState<{
    title: string;
    code: string;
  } | null>(null);
  const [questions, setQuestions] = React.useState<PaperQuestion[]>([]);
  const [loadingPaper, setLoadingPaper] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // ---- respuestas
  const [answers, setAnswers] = React.useState<Record<string, any>>({});

  // ---- resultado
  const [gradingMode, setGradingMode] = React.useState<"auto" | "manual">(
    "auto"
  );
  const [score, setScore] = React.useState<number | null>(null);
  const [maxScore, setMaxScore] = React.useState<number | null>(null);

  // ---- estado runtime (vidas + timer)
  const [lives, setLives] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<string>("running");
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);

  // ============= ANTIFRAUDE: reportar eventos al backend alias que YA FUNCIONA =============
  const reportViolation = React.useCallback(
    async (type: string, meta?: any) => {
      if (!attemptId) return;
      try {
        await fetch(`${API}/attempts/${attemptId}/antifraud`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, meta }),
        });
      } catch {}
    },
    [attemptId]
  );

  // Instalar listeners de antifraude cuando estamos en el examen
  React.useEffect(() => {
    if (step !== "exam") return;

    const onBlur = () => reportViolation("blur");
    const onVis = () => {
      if (document.visibilityState === "hidden") reportViolation("tab-hidden");
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) reportViolation("fullscreen-exit");
    };
    const onCopy = (e: ClipboardEvent) => {
      reportViolation("copy");
      // e.preventDefault(); // opcional
    };
    const onPaste = (e: ClipboardEvent) => {
      reportViolation("paste");
      // e.preventDefault(); // opcional
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("copy", onCopy as any);
    document.addEventListener("paste", onPaste as any);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("copy", onCopy as any);
      document.removeEventListener("paste", onPaste as any);
    };
  }, [step, reportViolation]);

  // ============= POLL SUMMARY: vidas + timer, y auto-submit =============
  React.useEffect(() => {
    if (step !== "exam" || !attemptId) return;
    let stop = false;

    async function tick() {
      try {
        const r = await fetch(`${API}/attempts/${attemptId}/summary`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(await r.text());
        const s = await r.json();

        if (stop) return;
        setLives(s.remaining ?? null);
        setStatus(String(s.status || "running"));

        if (typeof s.secondsLeft === "number") {
          setSecondsLeft(s.secondsLeft);
          if (s.secondsLeft <= 0) {
            submitAttempt(); // fin de tiempo => auto envío
            return;
          }
        }

        if (typeof s.remaining === "number" && s.remaining <= 0) {
          submitAttempt(); // vidas agotadas => auto envío
          return;
        }
      } catch (e) {
        // opcional: setErr("No se puede sincronizar estado");
      }
    }

    tick();
    const id = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [step, attemptId]);

  // ============= ACCIONES PRINCIPALES =============
  async function startAttempt() {
    setErr(null);
    const name = studentName.trim();
    if (!name) {
      setErr("Ingresá tu nombre para comenzar.");
      return;
    }

    try {
      // pedir fullscreen
      const el = document.documentElement;
      if (el.requestFullscreen) {
        try {
          await el.requestFullscreen();
        } catch {}
      }

      // crear intento
      const r0 = await fetch(`${API}/exams/${code}/attempts/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name }),
      });
      if (!r0.ok) throw new Error(await r0.text());
      const data0 = await r0.json();
      setAttemptId(data0.attempt.id);

      // cargar paper
      setLoadingPaper(true);
      const pr = await fetch(`${API}/exams/${code}/paper`, {
        cache: "no-store",
      });
      if (!pr.ok) throw new Error(await pr.text());
      const pdata: PaperResponse = await pr.json();

      setExam(pdata.exam);
      const qs = (pdata.questions || []).map((q) => ({
        ...q,
        kind: mapKind(q.kind as any),
      }));
      setQuestions(qs);

      // seed de respuestas
      const seed: Record<string, any> = {};
      for (const q of qs) {
        if (q.kind === "TRUE_FALSE") seed[q.id] = ""; // "true"/"false"
        else if (q.kind === "MCQ") seed[q.id] = null; // índice
        else if (q.kind === "SHORT") seed[q.id] = "";
        else if (q.kind === "FIB") seed[q.id] = []; // array
      }
      setAnswers(seed);

      setLoadingPaper(false);
      setStep("exam");
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar el examen");
    }
  }

  async function submitAttempt() {
    if (!attemptId) return;
    setErr(null);
    setStep("submitting");

    try {
      const payload = {
        answers: questions.map((q) => {
          const val = answers[q.id];
          if (q.kind === "FIB") {
            const arr = Array.isArray(val)
              ? val.map((v) => String(v ?? ""))
              : [];
            return { questionId: q.id, value: arr };
          }
          return { questionId: q.id, value: val };
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

  // ============= RENDER PREGUNTAS =============
  function renderQuestion(q: PaperQuestion, idx: number) {
    const commonBox = {
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    } as React.CSSProperties;

    if (q.kind === "TRUE_FALSE") {
      const v = String(answers[q.id] ?? "");
      return (
        <div key={q.id} style={commonBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {idx + 1}. {q.stem}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "6px 0",
            }}
          >
            <input
              type="radio"
              name={`q-${q.id}`}
              checked={v === "true"}
              onChange={() => setAnswers({ ...answers, [q.id]: "true" })}
            />
            Verdadero
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "6px 0",
            }}
          >
            <input
              type="radio"
              name={`q-${q.id}`}
              checked={v === "false"}
              onChange={() => setAnswers({ ...answers, [q.id]: "false" })}
            />
            Falso
          </label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    if (q.kind === "MCQ") {
      const v = Number(answers[q.id]);
      return (
        <div key={q.id} style={commonBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {idx + 1}. {q.stem}
          </div>
          {(q.choices || []).map((c, i) => (
            <label
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                margin: "6px 0",
              }}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={v === i}
                onChange={() => setAnswers({ ...answers, [q.id]: i })}
              />
              {c}
            </label>
          ))}
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    if (q.kind === "SHORT") {
      const v = String(answers[q.id] ?? "");
      return (
        <div key={q.id} style={commonBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {idx + 1}. {q.stem}
          </div>
          <textarea
            value={v}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            placeholder="Escribe tu respuesta…"
            rows={5}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              resize: "vertical",
              minHeight: 120,
            }}
          />
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    if (q.kind === "FIB") {
      const parts = fibParseToParts(q.stem || "");
      const vArr: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
      function setAt(ix: number, val: string) {
        const next = [...(vArr || [])];
        next[ix] = val;
        setAnswers({ ...answers, [q.id]: next });
      }
      return (
        <div key={q.id} style={commonBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {idx + 1}. Completa los casilleros
          </div>
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
                  style={{
                    width: 160,
                    padding: 6,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                />
              )
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Puntaje: {q.points ?? 1}
          </div>
        </div>
      );
    }

    // fallback (no debería verse si mapKind funciona)
    return (
      <div key={q.id} style={commonBox}>
        <div>
          <b>{idx + 1}.</b> {q.stem}
        </div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Tipo no soportado aún.</div>
      </div>
    );
  }

  // ============= HEADER (título + vidas + timer) =============
  const Header = (
    <div
      style={{
        padding: 8,
        borderRadius: 10,
        border: "1px solid #ddd",
        background: "#f7f7f7",
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
      <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
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
  );

  // ============= JSX =============
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
                  Guardá este identificador de intento por si necesitás
                  consultarlo: <code>{attemptId}</code>
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
