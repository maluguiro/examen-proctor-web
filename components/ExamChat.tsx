"use client";

import * as React from "react";
import { ChatShellContext } from "./FloatingChatShell";

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
  // Consumimos el contexto del Shell
  const { setHasNew } = React.useContext(ChatShellContext);

  const [name, setName] = React.useState(defaultName || "");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [asBroadcast, setAsBroadcast] = React.useState(false); // solo docente

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

  // Auto-scroll al final cuando hay mensajes nuevos
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

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
    <>
      {/* Header dentro del panel */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.5)",
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: "#333",
            letterSpacing: -0.2,
          }}
        >
          Chat del examen
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {canBroadcast && (
            <label
              style={{
                fontSize: 11,
                fontWeight: 500,
                display: "flex",
                gap: 4,
                alignItems: "center",
                color: "#555",
                cursor: "pointer",
                background: "rgba(0,0,0,0.05)",
                padding: "2px 8px",
                borderRadius: 99,
              }}
            >
              <input
                type="checkbox"
                checked={asBroadcast}
                onChange={(e) => setAsBroadcast(e.target.checked)}
                style={{ accentColor: "#ff9a9e" }}
              />
              Broadcast
            </label>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          padding: 12,
          overflowY: "auto",
          background: "transparent",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              fontSize: 13,
              opacity: 0.6,
              textAlign: "center",
              marginTop: 20,
            }}
          >
            No hay mensajes aún.
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              marginBottom: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: m.fromRole === "teacher" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius:
                  m.fromRole === "teacher"
                    ? "20px 20px 4px 20px"
                    : "20px 20px 20px 4px",
                background:
                  m.fromRole === "teacher"
                    ? "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)"
                    : "rgba(255, 255, 255, 0.7)",
                color: m.fromRole === "teacher" ? "#1e1b4b" : "#1f2937",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.7,
                  marginBottom: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
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
              <div style={{ wordBreak: "break-word", lineHeight: 1.4 }}>
                {m.message}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Nombre + input */}
      <div
        style={{
          borderTop: "1px solid rgba(0,0,0,0.04)",
          padding: 12,
          display: "grid",
          gap: 10,
          background: "rgba(255,255,255,0.5)",
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre (para el chat)"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.08)",
            fontSize: 12,
            background: "rgba(255,255,255,0.6)",
            outline: "none",
            width: "100%",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribí tu mensaje…"
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              padding: "10px 14px",
              borderRadius: 20,
              border: "1px solid rgba(0,0,0,0.08)",
              fontSize: 13,
              background: "rgba(255,255,255,0.8)",
              outline: "none",
              minHeight: 40,
              boxShadow: "inner 0 1px 2px rgba(0,0,0,0.02)",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: sending
                ? "#ccc"
                : "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: sending ? "default" : "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 8px rgba(161, 140, 209, 0.4)",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.9)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            ➤
          </button>
        </div>
        {err && (
          <div
            style={{
              fontSize: 11,
              color: "#e11d48",
              textAlign: "center",
            }}
          >
            {err}
          </div>
        )}
      </div>
    </>
  );
}
