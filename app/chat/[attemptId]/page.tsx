"use client";

import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import { useParams } from "next/navigation";

type Msg = {
  id: string;
  from: "student" | "teacher";
  text: string;
  ts: string;
};
type AttemptInfo = {
  id: string;
  status: string;
  paused: boolean;
  livesUsed: number;
  exam: { lives: number; title: string; durationMins: number };
};

export default function TeacherChat() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId as string;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [info, setInfo] = useState<AttemptInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  async function loadInfo() {
    const r = await fetch(`${API}/attempts/${attemptId}?t=${Date.now()}`, {
      cache: "no-store",
    });
    setInfo(await r.json());
  }

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const res = await fetch(
        `${API}/attempts/${attemptId}/messages?t=${Date.now()}`,
        { cache: "no-store" }
      );
      const msgs: Msg[] = await res.json();
      if (!cancelled) {
        setMessages(msgs);
        setTimeout(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
        }, 0);
      }
    };

    loadInfo();
    tick();
    const id = setInterval(() => {
      loadInfo();
      tick();
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [attemptId]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await fetch(`${API}/attempts/${attemptId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "teacher", text }),
    });
  }

  async function mod(action: "pause" | "resume" | "forgive_life") {
    setBusy(true);
    try {
      await fetch(`${API}/attempts/${attemptId}/mod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await loadInfo();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 840, margin: "0 auto" }}>
      <h2>Chat — Attempt: {attemptId}</h2>

      {info && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <b>{info.exam.title}</b> · Estado: {info.status} · Pausado:{" "}
            {info.paused ? "Sí" : "No"} · Vidas:{" "}
            {Math.min(info.livesUsed, info.exam.lives)} / {info.exam.lives}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {info.paused ? (
              <button disabled={busy} onClick={() => mod("resume")}>
                Reanudar
              </button>
            ) : (
              <button
                disabled={busy || info.status !== "in_progress"}
                onClick={() => mod("pause")}
              >
                Pausar
              </button>
            )}
            <button
              disabled={busy || info.livesUsed <= 0}
              onClick={() => mod("forgive_life")}
            >
              Perdonar vida
            </button>
          </div>
        </div>
      )}

      <div
        ref={listRef}
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          height: 420,
          overflowY: "auto",
          padding: 12,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.from === "teacher" ? "flex-end" : "flex-start",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                background: m.from === "teacher" ? "#e6f2ff" : "#f5f5f5",
                padding: "8px 10px",
                borderRadius: 8,
                maxWidth: "70%",
                whiteSpace: "pre-wrap",
              }}
            >
              <div style={{ fontSize: 12, color: "#777", marginBottom: 2 }}>
                {m.from}
              </div>
              <div>{m.text}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                {new Date(m.ts).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensaje al alumno..."
          style={{
            flex: 1,
            padding: 8,
            border: "1px solid #ddd",
            borderRadius: 6,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send();
          }}
        />
        <button onClick={send} style={{ padding: "8px 12px" }}>
          Enviar
        </button>
      </div>
    </main>
  );
}
