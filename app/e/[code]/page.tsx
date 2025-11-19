"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

// Debounce simple
function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay = 400
) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (...args: Parameters<T>) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => fn(...args), delay);
  };
}

// Beep
function beep(duration = 90, frequency = 880) {
  try {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = frequency;
    o.type = "sine";
    o.start();
    g.gain.exponentialRampToValueAtTime(
      0.00001,
      ctx.currentTime + duration / 1000
    );
    setTimeout(() => {
      try {
        o.stop();
        ctx.close();
      } catch {}
    }, duration + 40);
  } catch {}
}

type Question = {
  id: string;
  type?: "MCQ" | "TRUE_FALSE" | "SHORT_TEXT" | "FILL_IN";
  kind?: "MCQ" | "TRUE_FALSE" | "SHORT_TEXT" | "FILL_IN";
  text: string;
  options?: { value: string; label: string }[] | null;
  answerKey?: any;
};
type Message = {
  id: string;
  from: "student" | "teacher";
  text: string;
  ts: string;
};
type EventItem = { id: string; type: string; ts: string; meta?: any };

function ChatWidget({ attemptId, api }: { attemptId: string; api: string }) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [hasNew, setHasNew] = useState(false);
  const lastId = useRef<string | null>(null);

  async function load() {
    if (!attemptId) return;
    try {
      const r = await fetch(
        `${api}/attempts/${attemptId}/messages?ts=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!r.ok) return;
      const list: Message[] = await r.json();
      if (list[0]?.id && lastId.current && list[0].id !== lastId.current) {
        setHasNew(true);
        beep(120, 1200);
      }
      lastId.current = list[0]?.id || lastId.current;
      setMessages(list);
    } catch {}
  }
  async function send() {
    const t = text.trim();
    if (!t || !attemptId) return;
    try {
      const r = await fetch(`${api}/attempts/${attemptId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "student", text: t }),
      });
      if (r.ok) {
        setText("");
        setHasNew(false);
        load();
      }
    } catch {}
  }

  useEffect(() => {
    if (!attemptId) return;
    load();
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [attemptId]);

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 300,
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
        border: "1px solid #e0e0e0",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#1976d2",
          color: "#fff",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <b>
          Chat con docente{" "}
          {hasNew && (
            <span
              style={{
                marginLeft: 6,
                width: 8,
                height: 8,
                background: "#ffeb3b",
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
          )}
        </b>
        <button
          onClick={() => {
            setOpen(!open);
            if (open) setHasNew(false);
          }}
          style={{
            background: "transparent",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          {open ? "–" : "+"}
        </button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", height: 300 }}>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 8,
              display: "grid",
              gap: 6,
            }}
          >
            {messages.length === 0 ? (
              <div style={{ color: "#777" }}>Sin mensajes aún.</div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    fontSize: 13,
                    alignSelf: m.from === "student" ? "end" : "start",
                    maxWidth: "85%",
                  }}
                >
                  <div
                    style={{
                      background: m.from === "student" ? "#e3f2fd" : "#f5f5f5",
                      border: "1px solid #ddd",
                      padding: "6px 8px",
                      borderRadius: 8,
                    }}
                  >
                    {m.text}
                  </div>
                  <div style={{ color: "#777", fontSize: 11, marginTop: 2 }}>
                    {new Date(m.ts).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              borderTop: "1px solid #eee",
              padding: 8,
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Escribí tu mensaje…"
              style={{ flex: 1, padding: "8px 10px" }}
            />
            <button onClick={send}>Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentExamPage() {
  const p = useParams();
  const code = (p?.code as string) || "";

  // pasos
  const [step, setStep] = useState<
    "name" | "loading" | "exam" | "submitted" | "blocked"
  >("name");
  const [err, setErr] = useState<string | null>(null);

  // intento + examen
  const [studentName, setStudentName] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  // vidas + timer
  const [livesLeft, setLivesLeft] = useState<number | null>(null);
  const [remainingSecs, setRemainingSecs] = useState<number>(0);
  const endMsRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // respuestas
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // --- DEBUG PANEL (temporal) ---
  const [debugEvent, setDebugEvent] = useState<string>("-");
  const [debugStatus, setDebugStatus] = useState<string>("-");

  // fullscreen
  async function goFullscreen() {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
    } catch {}
  }
  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  }

  // ---------- ANTIFRAUDE ----------
  const startedRef = useRef(false);

  async function report(kind: string) {
    if (!attemptId) return;

    const map: Record<string, string> = {
      BLUR: "window_blur",
      VISIBILITY_HIDDEN: "tab_hidden",
      COPY: "copy",
      PASTE: "paste",
      CONTEXT_MENU: "context_menu",
      FULLSCREEN_EXIT: "fullscreen_exit",
    };
    const reason = map[kind.toUpperCase()] || kind.toLowerCase();

    const penaliza = new Set([
      "window_blur",
      "tab_hidden",
      "copy",
      "paste",
      "context_menu",
      "fullscreen_exit",
    ]);
    if (
      penaliza.has(reason) &&
      typeof livesLeft === "number" &&
      livesLeft > 0
    ) {
      setLivesLeft((x) => (typeof x === "number" ? Math.max(x - 1, 0) : x));
    }

    try {
      const r = await fetch(`${API}/attempts/${attemptId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "violation", reason }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(t);

      let j: any = {};
      try {
        j = JSON.parse(t);
      } catch {}
      if (typeof j.livesLeft === "number") setLivesLeft(j.livesLeft);

      const st = String(j.status || "").toLowerCase();
      if (st === "submitted" || j.autoSubmitted) setStep("submitted");
      if (st === "blocked") setStep("blocked");
    } catch {}
  }

  function attachAntiFraud() {
    if (startedRef.current) return;
    startedRef.current = true;

    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) report("FULLSCREEN_EXIT");
    });
    window.addEventListener("blur", () => report("BLUR"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") report("VISIBILITY_HIDDEN");
    });
    document.addEventListener("copy", () => report("COPY"));
    document.addEventListener("paste", () => report("PASTE"));
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      report("CONTEXT_MENU");
    });
    document.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "c" || k === "v")) {
        report(k === "c" ? "COPY" : "PASTE");
      }
      if (k === "escape") report("FULLSCREEN_EXIT");
    });
  }

  // autosave
  const debouncedSave = useDebouncedCallback(async (payload: any) => {
    if (!attemptId) return;
    try {
      await fetch(`${API}/attempts/${attemptId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
  }, 400);

  useEffect(() => {
    const arr = Object.entries(answers).map(([questionId, value]) => ({
      questionId,
      value,
    }));
    debouncedSave({ answers: arr });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  // poll +Tiempo
  useEffect(() => {
    if (!attemptId) return;
    let prevAddIds = new Set<string>();
    async function pollEvents() {
      try {
        const r = await fetch(
          `${API}/attempts/${attemptId}/events?take=10&t=${Date.now()}`,
          { cache: "no-store" }
        );
        if (!r.ok) return;
        const list: EventItem[] = await r.json();
        for (const ev of list) {
          if (ev.type === "ADD_TIME" && ev.id && !prevAddIds.has(ev.id)) {
            const sec = Number(ev.meta?.seconds || 0);
            if (sec > 0 && endMsRef.current) {
              endMsRef.current += sec * 1000;
              beep(120, 1000);
            }
            prevAddIds.add(ev.id);
          }
        }
      } catch {}
    }
    const id = setInterval(pollEvents, 1500);
    return () => clearInterval(id);
  }, [attemptId]);

  // ---------- poll resumen (vidas/status/pausa) ----------
  useEffect(() => {
    if (!attemptId) return;
    let mounted = true;

    async function pollSummary() {
      try {
        const r = await fetch(
          `${API}/attempts/${attemptId}/summary?t=${Date.now()}`,
          { cache: "no-store" }
        );
        if (!r.ok) return;
        const j = await r.json();
        if (!mounted) return;

        // vidas reflejan perdones del docente
        if (typeof j.livesLeft === "number") setLivesLeft(j.livesLeft);

        // si docente pausó
        if (j.paused) {
          // opcional: podés bloquear inputs aquí
        }

        // si el intento pasó a SUBMITTED por cualquier causa
        const st = String(j.status || "").toLowerCase();
        if (st === "submitted") setStep("submitted");
      } catch {}
    }

    const id = setInterval(pollSummary, 1500);
    pollSummary();
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [attemptId]);

  // iniciar intento
  async function startAttempt() {
    try {
      setErr(null);
      if (!studentName.trim()) {
        setErr("Ingresá tu nombre");
        return;
      }
      setStep("loading");
      await goFullscreen();

      const r = await fetch(`${API}/exams/${code}/attempts/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(t);
      const { attempt } = JSON.parse(t);
      setAttemptId(attempt.id);

      const eRes = await fetch(`${API}/exams/by-code/${code}`, {
        cache: "no-store",
      });
      if (!eRes.ok) throw new Error(await eRes.text());
      const e = await eRes.json();
      setExam(e);
      setLivesLeft(e.lives ?? null);

      const qRes = await fetch(`${API}/exams/${e.id}/questions`, {
        cache: "no-store",
      });
      if (!qRes.ok) throw new Error(await qRes.text());
      const qs: Question[] = await qRes.json();
      setQuestions(qs);

      const init: Record<string, any> = {};
      qs.forEach((q) => {
        const k = (q.kind || q.type)!;
        if (k === "MCQ") init[q.id] = "";
        else if (k === "TRUE_FALSE") init[q.id] = "true";
        else if (k === "SHORT_TEXT") init[q.id] = "";
        else if (k === "FILL_IN") {
          const n =
            q.answerKey?.slots && Array.isArray(q.answerKey.slots)
              ? q.answerKey.slots.length
              : 1;
          init[q.id] = Array(n).fill("");
        }
      });
      setAnswers(init);

      const dur = Number(e.durationMins || 0);
      if (dur > 0) {
        const startMs = new Date(attempt.startAt).getTime();
        const endMs = startMs + dur * 60 * 1000;
        endMsRef.current = endMs;
        const tick = () => {
          const now = Date.now();
          const left = Math.max(
            0,
            Math.floor(((endMsRef.current ?? now) - now) / 1000)
          );
          setRemainingSecs(left);
          if (left <= 0) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            submitExam();
          }
        };
        tick();
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(tick, 1000);
      }

      attachAntiFraud();
      setStep("exam");
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar el intento");
      setStep("name");
      await exitFullscreen();
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function submitExam() {
    try {
      setErr(null);
      const r = await fetch(`${API}/attempts/${attemptId}/submit`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      await exitFullscreen();
      setStep("submitted");
    } catch (e: any) {
      setErr(e?.message || "No pude enviar el examen");
    }
  }

  // UI preguntas
  function renderQuestion(q: Question) {
    const kind = (q.kind || q.type)!;

    if (kind === "MCQ") {
      const opts = (q.options || []) as { value: string; label: string }[];
      return (
        <div>
          {opts.map((op) => (
            <label
              key={op.value}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                margin: "6px 0",
              }}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                value={op.value}
                checked={answers[q.id] === op.value}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.id]: e.target.value })
                }
              />
              <span>
                <b>{op.value}.</b> {op.label}
              </span>
            </label>
          ))}
        </div>
      );
    }

    if (kind === "TRUE_FALSE") {
      return (
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="radio"
              name={`q-${q.id}`}
              value="true"
              checked={answers[q.id] === "true"}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
            />
            Verdadero
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="radio"
              name={`q-${q.id}`}
              value="false"
              checked={answers[q.id] === "false"}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
            />
            Falso
          </label>
        </div>
      );
    }

    if (kind === "SHORT_TEXT") {
      return (
        <textarea
          rows={3}
          style={{ width: "100%" }}
          value={answers[q.id] ?? ""}
          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
          placeholder="Escribí tu respuesta…"
        />
      );
    }

    // FILL_IN
    const count =
      q.answerKey?.slots && Array.isArray(q.answerKey.slots)
        ? q.answerKey.slots.length
        : 1;
    const arr = (answers[q.id] as string[]) || Array(count).fill("");
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {arr.map((val, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div style={{ opacity: 0.7 }}>#{idx + 1}</div>
            <input
              value={val}
              onChange={(e) => {
                const copy = [...arr];
                copy[idx] = e.target.value;
                setAnswers({ ...answers, [q.id]: copy });
              }}
              placeholder={`Casillero ${idx + 1}`}
            />
          </div>
        ))}
      </div>
    );
  }

  // Vistas
  if (step === "name") {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1>Ingresá tu nombre</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Nombre y apellido"
            style={{ flex: 1, padding: 10 }}
          />
          <button onClick={startAttempt}>Empezar</button>
        </div>
        {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}
        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          Al comenzar se activará pantalla completa. Cambiar de pestaña,
          copiar/pegar o salir del fullscreen descuenta vidas.
        </div>
      </main>
    );
  }

  if (step === "loading")
    return <div style={{ padding: 24 }}>Cargando examen…</div>;

  if (step === "blocked") {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1>Intento finalizado</h1>
        <p>
          Se detectaron infracciones y se agotaron las vidas. El intento fue
          enviado al docente.
        </p>
      </main>
    );
  }

  if (step === "submitted") {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1>¡Examen enviado!</h1>
        <p>Tu intento fue entregado al docente.</p>
      </main>
    );
  }

  const timerEl =
    remainingSecs > 0 ? (
      <div
        style={{
          background: "#e3f2fd",
          border: "1px solid #90caf9",
          padding: "6px 10px",
          borderRadius: 8,
        }}
      >
        Tiempo:{" "}
        <b>
          {Math.floor(remainingSecs / 60)}:
          {String(remainingSecs % 60).padStart(2, "0")}
        </b>
      </div>
    ) : null;

  const headerLivesEl =
    livesLeft == null ? null : (
      <div
        style={{
          background: "#fff8e1",
          border: "1px solid #ffe082",
          padding: "6px 10px",
          borderRadius: 8,
        }}
      >
        Vidas restantes: <b>{livesLeft}</b>
      </div>
    );

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      {/* PANEL DEBUG (podés borrar cuando confirmemos) */}
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          border: "1px dashed #ccc",
          borderRadius: 8,
          background: "#fafafa",
          display: "grid",
          gap: 6,
        }}
      >
        <div>
          <b>Debug antifraude</b> · attemptId: <code>{attemptId || "-"}</code>
        </div>
        <div>
          Último evento: <code>{debugEvent}</code>
        </div>
        <div>
          Última respuesta:{" "}
          <code style={{ whiteSpace: "pre-wrap" }}>{debugStatus}</code>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => report("COPY")}>Simular COPY</button>
          <button onClick={() => report("FULLSCREEN_EXIT")}>
            Simular salir fullscreen
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0 }}>{exam?.title || "Examen"}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {timerEl}
          {headerLivesEl}
        </div>
      </div>
      <div style={{ color: "#666", marginBottom: 12 }}>
        Intento: <code>{attemptId}</code> · Duración:{" "}
        <b>{exam?.durationMins ?? 0} min</b>
      </div>

      <ol style={{ display: "grid", gap: 12, paddingLeft: 18 }}>
        {questions.map((q, i) => (
          <li
            key={q.id}
            style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {i + 1}. {q.text}
            </div>
            {renderQuestion(q)}
            <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>
              <i>Tipo:</i> {(q.kind || q.type) as string}
            </div>
          </li>
        ))}
      </ol>

      {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button onClick={submitExam}>Enviar examen</button>
        <button
          onClick={async () => {
            await exitFullscreen();
            alert(
              "Saliste del modo pantalla completa. Evitá hacerlo para no perder vidas."
            );
          }}
        >
          Salir de pantalla completa
        </button>
      </div>

      {/* Chat flotante */}
      <ChatWidget attemptId={attemptId} api={API} />
    </main>
  );
}
