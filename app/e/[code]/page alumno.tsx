"use client";

import React, { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import { useParams } from "next/navigation";

type Exam = {
  title: string;
  durationMins: number;
  lives: number;
  publicCode: string;
};

const BLUR_GRACE_MS = 800; // ms de tolerancia para blur (Alt+Tab)
const DEDUPE_MS = 1200; // ventana de dedupe por canal en el cliente (además del server)

function channelOf(reason: string): "focus" | "clipboard" | "print" | "other" {
  if (
    reason === "window_blur" ||
    reason === "tab_hidden" ||
    reason === "fullscreen_exit"
  )
    return "focus";
  if (reason === "copy" || reason === "paste") return "clipboard";
  if (reason === "print") return "print";
  return "other";
}

export default function ExamPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code as string | undefined;

  const [exam, setExam] = useState<Exam | null>(null);
  const [attemptId, setAttemptId] = useState("");
  const [lives, setLives] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const startedRef = useRef(false);
  const blurTimeout = useRef<number | null>(null);
  const lastViolation = useRef<{ ts: number; channel: string } | null>(null);

  // Iniciar intento
  useEffect(() => {
    if (startedRef.current || !code) return;
    startedRef.current = true;

    const studentId = "demo-student";
    fetch(`${API}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicCode: code, studentId }),
    })
      .then((r) => r.json())
      .then(({ attemptId, exam }) => {
        setAttemptId(attemptId);
        setExam(exam);
        setLives(exam.lives);
        setTimeLeft(exam.durationMins * 60);
      })
      .catch(() => alert("No se pudo iniciar el intento"));
  }, [code]);

  // Timer
  useEffect(() => {
    if (!attemptId) return;
    if (timeLeft <= 0) {
      submit("time_up");
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft, attemptId]);

  function logEvent(type: string, reason?: string) {
    if (!attemptId) return;
    fetch(`${API}/attempts/${attemptId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, reason, meta: {} }),
    }).catch(() => {});
  }

  // Gasta vida (con dedupe en cliente para UX) — el server también deduplica
  function spendLife(reason: string) {
    if (!attemptId) return;

    const channel = channelOf(reason);
    const now = Date.now();
    const last = lastViolation.current;

    if (last && last.channel === channel && now - last.ts < DEDUPE_MS) {
      logEvent("violation_suppressed", reason);
      return;
    }
    lastViolation.current = { ts: now, channel };

    setLives((prev) => {
      const next = Math.max(prev - 1, 0);
      logEvent("violation", reason);
      alert(`Perdiste 1 vida por: ${reason}. Te quedan ${next}.`);
      if (next === 0) submit("lives_exhausted");
      return next;
    });
  }

  function submit(reason: string) {
    if (!attemptId) return;
    fetch(`${API}/attempts/${attemptId}/submit`, { method: "POST" })
      .then(() => alert(`Examen enviado (${reason}). ¡Gracias!`))
      .catch(() => alert("No se pudo enviar el examen"));
  }

  // Sensores (pestaña/ventana/print/copy/paste/close y blur/focus)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (blurTimeout.current) {
          window.clearTimeout(blurTimeout.current);
          blurTimeout.current = null;
        }
        spendLife("tab_hidden");
      }
    };
    const onFs = () => {
      if (!document.fullscreenElement) spendLife("fullscreen_exit");
    };
    const onCopy = () => spendLife("copy");
    const onPaste = () => spendLife("paste");
    const onBeforePrint = () => spendLife("print");
    const onBeforeUnload = () => {
      if (!attemptId) return;
      navigator.sendBeacon(
        `${API}/attempts/${attemptId}/events`,
        new Blob([JSON.stringify({ type: "beforeunload", ts: Date.now() })], {
          type: "application/json",
        })
      );
    };

    const onWindowBlur = () => {
      if (blurTimeout.current) window.clearTimeout(blurTimeout.current);
      blurTimeout.current = window.setTimeout(() => {
        spendLife("window_blur");
        blurTimeout.current = null;
      }, BLUR_GRACE_MS);
      logEvent("blur", "window_blur_start");
    };
    const onWindowFocus = () => {
      if (blurTimeout.current) {
        window.clearTimeout(blurTimeout.current);
        blurTimeout.current = null;
      }
      logEvent("focus", "window_focus");
    };

    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [attemptId]);

  function enterFullscreen() {
    if (document.fullscreenElement) return;
    if (!document.documentElement.requestFullscreen) {
      console.warn("Fullscreen no disponible en este navegador.");
      return;
    }
    const request = document.documentElement.requestFullscreen();
    if (request && typeof request.then === "function") {
      request.catch((e) => {
        console.warn("No se pudo reactivar pantalla completa:", e);
      });
    }
  }

  if (!exam) return <p style={{ padding: 24 }}>Cargando examen...</p>;

  const mm = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const ss = (timeLeft % 60).toString().padStart(2, "0");

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div
        style={{
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <strong>{exam.title}</strong> · Tiempo: {mm}:{ss} · Vidas: {lives}/
        {exam.lives}
      </div>
      <button onClick={enterFullscreen} style={{ padding: 10 }}>
        Entrar en pantalla completa
      </button>
      <div style={{ marginTop: 16 }}>
        <textarea
          rows={6}
          style={{ width: "100%" }}
          placeholder="Respuesta (demo)"
        ></textarea>
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => submit("user_submit")} style={{ padding: 10 }}>
          Enviar examen
        </button>
      </div>
    </main>
  );
}
