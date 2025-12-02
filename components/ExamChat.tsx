"use client";

import * as React from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

type ChatMessage = {
  id: string;
  fromRole: "student" | "teacher";
  authorName: string;
  message: string;
  createdAt: string;
  broadcast?: number;
};

type Props = {
  code: string;
  role: "student" | "teacher";
  defaultName: string;
};

export default function ExamChat({ code, role, defaultName }: Props) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(defaultName || "");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [asBroadcast, setAsBroadcast] = React.useState(false); // solo docente

  const [hasNew, setHasNew] = React.useState(false); // notificación cuando hay mensajes nuevos

  const canBroadcast = role === "teacher";

  // Referencias para sonido y último mensaje visto
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const lastMessageIdRef = React.useRef<string | null>(null);

  // Ref para auto-scroll
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Cargar sonido una vez
  React.useEffect(() => {
    if (typeof Audio !== "undefined") {
      // El archivo debe estar en web/public/message-notification-190034.mp3
      audioRef.current = new Audio("/message-notification-190034.mp3");
    }
  }, []);

  const fetchMessages = React.useCallback(async () => {
    if (!code) return;
    try {
      const r = await fetch(`${API}/exams/${code}/chat`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data.items)) {
        const list: ChatMessage[] = data.items;

        // Detectar si hay un mensaje nuevo
        const last = list[list.length - 1];
        if (last) {
          const prevId = lastMessageIdRef.current;
          if (last.id !== prevId) {
            // Evitamos notificar en la primera carga (cuando no hay prevId)
            if (prevId !== null) {
              const trimmedName = name.trim();
              const isMine =
                trimmedName &&
                last.authorName === trimmedName &&
                last.fromRole === role;

              // solo notificamos si es mensaje de otra persona
              if (!isMine) {
                setHasNew(true);
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(() => {
                    // algunos navegadores bloquean autoplay; ignoramos
                  });
                }
              }
            }
            lastMessageIdRef.current = last.id;
          }
        }

        setMessages(list);
      }
    } catch (e) {
      console.error("CHAT_FETCH_ERROR", e);
    }
  }, [code, name, role]);

  // Polling SIEMPRE (así hay notificaciones aunque el chat esté cerrado)
  React.useEffect(() => {
    fetchMessages();
    const id = window.setInterval(fetchMessages, 3000);
    return () => window.clearInterval(id);
  }, [fetchMessages]);

  // Auto-scroll al final cuando hay mensajes nuevos y el chat está abierto
  React.useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  // Al abrir el chat, limpiamos el badge de "nuevo"
  React.useEffect(() => {
    if (open) {
      setHasNew(false);
    }
  }, [open]);

  async function sendMessage() {
    setErr(null);
    const trimmed = input.trim();
    const n = name.trim();
    if (!trimmed) return;
    if (!n) {
      setErr("Ingresá un nombre para chatear.");
      return;
    }

    setSending(true);
    try {
      const body: any = {
        authorName: n,
        message: trimmed,
      };

      let url = `${API}/exams/${code}/chat`;
      if (canBroadcast && asBroadcast) {
        url = `${API}/exams/${code}/chat/broadcast`;
      } else {
        body.fromRole = role;
      }

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        throw new Error(await r.text());
      }

      setInput("");
      setHasNew(false); // si estoy escribiendo, asumo que estoy al día
      // refrescamos la lista
      await fetchMessages();
    } catch (e: any) {
      console.error("CHAT_SEND_ERROR", e);
      setErr(e?.message || "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) {
        sendMessage();
      }
    }
  }

  // Badge para saber quién habla
  function badgeColor(msg: ChatMessage) {
    if (msg.broadcast) return "#fde68a"; // amarillo clarito
    if (msg.fromRole === "teacher") return "#bfdbfe"; // azul clarito
    return "#e5e7eb"; // gris
  }

  if (!code) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 50,
        fontSize: 14,
      }}
    >
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "relative",
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            background: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          💬 Chat
          {hasNew && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "999px",
                background: "#ef4444",
              }}
            />
          )}
        </button>
      )}

      {open && (
        <div
          style={{
            width: 320,
            maxHeight: 420,
            background: "white",
            borderRadius: 12,
            border: "1px solid #d1d5db",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>Chat del examen</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {canBroadcast && (
                <label
                  style={{
                    fontSize: 11,
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={asBroadcast}
                    onChange={(e) => setAsBroadcast(e.target.checked)}
                  />
                  Broadcast
                </label>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              padding: 8,
              overflowY: "auto",
              background: "#f9fafb",
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                No hay mensajes aún.
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  marginBottom: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems:
                    m.fromRole === "teacher" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "90%",
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: badgeColor(m),
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.7,
                      marginBottom: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span>
                      {m.authorName ||
                        (m.fromRole === "teacher" ? "Docente" : "Alumno")}
                    </span>
                    <span>
                      {m.broadcast
                        ? "📢 Broadcast"
                        : m.fromRole === "teacher"
                        ? "Docente"
                        : "Alumno"}
                    </span>
                  </div>
                  <div>{m.message}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Nombre + input */}
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              padding: 8,
              display: "grid",
              gap: 6,
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 12,
              }}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribí tu mensaje… (Enter para enviar)"
              rows={2}
              style={{
                resize: "none",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 12,
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 6,
              }}
            >
              {err && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#b91c1c",
                    maxWidth: 180,
                  }}
                >
                  {err}
                </div>
              )}
              <button
                onClick={sendMessage}
                disabled={sending}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "none",
                  background: sending ? "#9ca3af" : "#2563eb",
                  color: "white",
                  fontSize: 12,
                  cursor: sending ? "default" : "pointer",
                }}
              >
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
