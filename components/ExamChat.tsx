"use client";
import * as React from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

type ChatMsg = {
  id: string;
  fromRole: "student" | "teacher";
  authorName: string;
  message: string;
  createdAt: string;
  broadcast?: number | boolean; // 1/0 en DB
};

export default function ExamChat({
  code,
  role, // 'student' | 'teacher'
  defaultName, // ej: "Docente" o nombre del alumno
}: {
  code: string;
  role: "student" | "teacher";
  defaultName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(defaultName);
  const [input, setInput] = React.useState("");
  const [isBroadcast, setIsBroadcast] = React.useState(false); // SOLO docente
  const [msgs, setMsgs] = React.useState<ChatMsg[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [muted, setMuted] = React.useState(false);

  const lastTsRef = React.useRef<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const beep = React.useRef<HTMLAudioElement | null>(null);

  // -- Preferencia de silencio por examen --
  React.useEffect(() => {
    const v = localStorage.getItem(`chat.muted.${code}`);
    if (v === "1") setMuted(true);
  }, [code]);
  React.useEffect(() => {
    localStorage.setItem(`chat.muted.${code}`, muted ? "1" : "0");
  }, [muted, code]);

  // -- Beep base64 (ligero, sin archivos externos) --
  if (!beep.current && typeof window !== "undefined") {
    // tono 800Hz ~120ms (wav minúsculo)
    beep.current = new Audio(
      "data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABwAACAgICAgP8AAP8AAICAf39/f39/f4CAgICA/4CAgICAf39/f39/gICAf39/f4CAgP8A/wAA"
    );
  }
  function playBeep() {
    if (muted) return;
    try {
      beep.current?.play().catch(() => {});
    } catch {}
  }

  // -- Fetch de mensajes (polling) --
  async function fetchMsgs() {
    try {
      const qs = lastTsRef.current
        ? `?since=${encodeURIComponent(lastTsRef.current)}`
        : "";
      const r = await fetch(`${API}/exams/${code}/chat${qs}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await r.json();
      const items: ChatMsg[] = data.items || [];
      if (items.length) {
        setMsgs((old) => [...old, ...items]);
        const last = items[items.length - 1]!;
        lastTsRef.current = last.createdAt;

        // sonido al recibir nuevos
        playBeep();

        // contador no leídos si está cerrado
        if (!open) setUnread((n) => n + items.length);

        // autoscroll si está abierto
        setTimeout(() => {
          if (open && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 0);
      }
    } catch {}
  }

  React.useEffect(() => {
    fetchMsgs(); // inicial
    const t = setInterval(fetchMsgs, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  React.useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [open, msgs.length]);

  // -- Enviar mensaje / broadcast --
  async function send() {
    const text = input.trim();
    const who = name.trim();
    if (!text || !who) return;
    setInput("");

    try {
      if (role === "teacher" && isBroadcast) {
        await fetch(`${API}/exams/${code}/chat/broadcast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorName: who, message: text }),
        });
      } else {
        await fetch(`${API}/exams/${code}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromRole: role,
            authorName: who,
            message: text,
          }),
        });
      }
      await fetchMsgs();
    } catch {}
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 9999 }}>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "relative",
            width: 56,
            height: 56,
            borderRadius: 28,
            background: "#2563eb",
            color: "white",
            border: "none",
            boxShadow: "0 6px 20px rgba(0,0,0,.2)",
            cursor: "pointer",
            fontSize: 24,
          }}
          title="Abrir chat"
        >
          💬
          {unread > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                background: "#ef4444",
                color: "white",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 6px",
                border: "2px solid white",
              }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          style={{
            width: 320,
            height: 460,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 12px 30px rgba(0,0,0,.2)",
          }}
        >
          <div
            style={{
              background: "#1f2937",
              color: "white",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <strong>Chat del examen</strong>
            <span style={{ marginLeft: "auto" }} />
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: 18,
                cursor: "pointer",
              }}
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          <div style={{ padding: 8, display: "grid", gap: 6 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === "student" ? "Tu nombre" : "Nombre docente"}
              style={{
                padding: 6,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
              }}
            />

            {role === "teacher" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isBroadcast}
                  onChange={(e) => setIsBroadcast(e.target.checked)}
                />
                <b>📢 Enviar como broadcast</b>
              </label>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={muted}
                onChange={(e) => setMuted(e.target.checked)}
              />
              🔕 Silenciar
            </label>
          </div>

          <div
            ref={scrollRef}
            style={{
              padding: 8,
              height: 290,
              overflowY: "auto",
              display: "grid",
              gap: 6,
            }}
          >
            {msgs.map((m) => {
              const mine =
                (role === "student" &&
                  m.fromRole === "student" &&
                  m.authorName === name) ||
                (role === "teacher" &&
                  m.fromRole === "teacher" &&
                  m.authorName === name);

              const isBc = !!m.broadcast;
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: mine ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      background: isBc
                        ? "#fffbeb"
                        : mine
                        ? "#dbeafe"
                        : "#f3f4f6",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "6px 8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        marginBottom: 2,
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      {isBc && (
                        <span style={{ fontWeight: 700 }}>📢 Broadcast</span>
                      )}
                      <span>
                        {m.authorName} •{" "}
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.message}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: 8, display: "flex", gap: 6 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={
                role === "teacher" && isBroadcast
                  ? "Mensaje (broadcast a todos)"
                  : "Escribe un mensaje…"
              }
              style={{
                flex: 1,
                padding: 8,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
              }}
            />
            <button onClick={send} style={{ padding: "8px 12px" }}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
