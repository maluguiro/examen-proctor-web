"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Question, QuestionType, ExamSettings } from "@/lib/types";

type ExamSettingsPayload = {
  title: string;
  durationMins: number;
  lives: number;
  settings: ExamSettings;
};

const API = process.env.NEXT_PUBLIC_API_URL!;

function nextLetter(n: number) {
  // 0->A, 1->B...
  return String.fromCharCode("A".charCodeAt(0) + n);
}

export default function EditQuestionsPage() {
  const { code } = useParams<{ code: string }>();
  const [examInfo, setExamInfo] = useState<{
    title: string;
    durationMins: number;
    lives: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Question[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // formulario nuevo
  const [newType, setNewType] = useState<QuestionType>("mcq");
  const [newText, setNewText] = useState("");
  const [newPoints, setNewPoints] = useState<number>(1);
  const [newOptions, setNewOptions] = useState<{ id: string; text: string }[]>([
    { id: "A", text: "" },
    { id: "B", text: "" },
  ]);
  const [newCorrectMCQ, setNewCorrectMCQ] = useState<string[]>([]);
  const [newCorrectTF, setNewCorrectTF] = useState<boolean>(true);

  // cargar info básica del examen (título, duración, vidas)
  useEffect(() => {
    let cancel = false;
    async function loadExam() {
      try {
        const res = await fetch(`${API}/exams/${code}/settings`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const j: ExamSettingsPayload = await res.json();
        if (!cancel)
          setExamInfo({
            title: j.title,
            durationMins: j.durationMins,
            lives: j.lives,
          });
      } catch {
        // ignoramos por ahora
      }
    }
    loadExam();
    return () => {
      cancel = true;
    };
  }, [code]);

  // listar preguntas
  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `${API}/exams/${code}/questions?t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(await res.text());
      const j: Question[] = await res.json();
      setList(j);
    } catch {
      setErr("No se pudieron cargar las preguntas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // crear pregunta
  async function createQuestion(e: React.FormEvent) {
    e.preventDefault();

    const base: Partial<Question> = {
      type: newType,
      text: newText.trim(),
      points: Number(newPoints),
      order: list.length, // al final
    };

    let payload: any = { ...base };

    if (newType === "mcq") {
      const opts = newOptions.map((o, i) => ({
        id: o.id || nextLetter(i),
        text: o.text || "",
      }));
      payload.options = opts;
      payload.correct = newCorrectMCQ;
    } else if (newType === "tf") {
      payload.options = null;
      payload.correct = !!newCorrectTF;
    } else {
      // text u otros tipos abiertos
      payload.options = null;
      payload.correct = null;
    }

    try {
      const res = await fetch(`${API}/exams/${code}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? res.statusText);
      }
      await load();
      // reset form rápido
      setNewText("");
      setNewPoints(1);
      setNewOptions([
        { id: "A", text: "" },
        { id: "B", text: "" },
      ]);
      setNewCorrectMCQ([]);
      setNewCorrectTF(true);
      alert("Pregunta creada");
    } catch (e: any) {
      alert(`Error: ${e.message || "no se pudo crear"}`);
    }
  }

  // actualizar
  async function updateQuestion(id: string, data: Partial<Question>) {
    try {
      const res = await fetch(`${API}/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch {
      alert("No se pudo actualizar");
    }
  }

  // borrar
  async function removeQuestion(id: string) {
    if (!confirm("¿Eliminar la pregunta? Esta acción no se puede deshacer."))
      return;
    try {
      const res = await fetch(`${API}/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch {
      alert("No se pudo borrar");
    }
  }

  // mover (cambia "order" y reenumera todo para evitar huecos)
  async function move(idx: number, dir: -1 | 1) {
    const arr = [...list];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    // swap
    const tmp = arr[idx];
    arr[idx] = arr[j];
    arr[j] = tmp;
    // reordenar 0..n-1
    const ops = arr.map((q, i) =>
      fetch(`${API}/questions/${q.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: i }),
      })
    );
    await Promise.all(ops);
    await load();
  }

  // helpers UI para nuevo MCQ
  function addOption() {
    const next = nextLetter(newOptions.length);
    setNewOptions([...newOptions, { id: next, text: "" }]);
  }
  function removeOption(i: number) {
    const copy = [...newOptions];
    const removed = copy.splice(i, 1)[0];
    setNewOptions(copy);
    // si estaba marcada como correcta, quitarla
    setNewCorrectMCQ((prev) => prev.filter((x) => x !== removed.id));
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 10 }}>
        <a href={`/t/${code}`} style={{ textDecoration: "none" }}>
          ← Volver al tablero
        </a>
      </div>

      <h1 style={{ margin: 0 }}>Editar preguntas</h1>
      {examInfo && (
        <p style={{ color: "#555", marginTop: 6 }}>
          Examen: <b>{examInfo.title}</b> · Duración: {examInfo.durationMins}{" "}
          min · Vidas: {examInfo.lives}
        </p>
      )}

      {/* Crear nueva */}
      <section
        style={{
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Nueva pregunta</h3>
        <form onSubmit={createQuestion} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label>Tipo:</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as QuestionType)}
            >
              <option value="mcq">Opción múltiple</option>
              <option value="tf">Verdadero / Falso</option>
              <option value="text">Texto</option>
            </select>
            <label style={{ marginLeft: 12 }}>Puntos:</label>
            <input
              type="number"
              min={0}
              value={newPoints}
              onChange={(e) => setNewPoints(Number(e.target.value) || 0)}
              style={{ width: 80 }}
            />
          </div>

          <div>
            <label>Enunciado</label>
            <textarea
              rows={3}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              style={{ width: "100%" }}
              placeholder="Escribí el enunciado…"
            />
          </div>

          {newType === "mcq" && (
            <div>
              <label>Opciones</label>
              <div style={{ display: "grid", gap: 8 }}>
                {newOptions.map((opt, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={newCorrectMCQ.includes(opt.id)}
                      onChange={(e) =>
                        setNewCorrectMCQ((prev) =>
                          e.target.checked
                            ? [...prev, opt.id]
                            : prev.filter((x) => x !== opt.id)
                        )
                      }
                      title="Marca si esta opción es correcta"
                    />
                    <code style={{ width: 24, display: "inline-block" }}>
                      {opt.id}
                    </code>
                    <input
                      value={opt.text}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[i] = { ...copy[i], text: e.target.value };
                        setNewOptions(copy);
                      }}
                      placeholder={`Texto de opción ${opt.id}`}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => removeOption(i)}>
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={addOption}>
                  + Agregar opción
                </button>
              </div>
            </div>
          )}

          {newType === "tf" && (
            <div>
              <label>Respuesta correcta</label>
              <div style={{ display: "flex", gap: 12 }}>
                <label>
                  <input
                    type="radio"
                    checked={newCorrectTF === true}
                    onChange={() => setNewCorrectTF(true)}
                  />{" "}
                  Verdadero
                </label>
                <label>
                  <input
                    type="radio"
                    checked={newCorrectTF === false}
                    onChange={() => setNewCorrectTF(false)}
                  />{" "}
                  Falso
                </label>
              </div>
            </div>
          )}

          {newType === "text" && (
            <div style={{ color: "#777" }}>
              Las respuestas se corrigen de forma manual.
            </div>
          )}

          <div>
            <button type="submit">Crear</button>
          </div>
        </form>
      </section>

      {/* Lista / edición rápida */}
      <section
        style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}
      >
        <h3 style={{ marginTop: 0 }}>Preguntas</h3>
        {loading && <div>Cargando…</div>}
        {err && <div style={{ color: "crimson" }}>{err}</div>}
        {!loading && list.length === 0 && <div>No hay preguntas aún.</div>}

        {list.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {list.map((q, idx) => {
              const opts = (q.options as any[]) || [];
              const correct: string[] = Array.isArray(q.correct)
                ? (q.correct as string[])
                : [];

              return (
                <div
                  key={q.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <small style={{ color: "#777" }}>
                        #{idx + 1} · {q.type.toUpperCase()} · {q.points} pts
                      </small>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => move(idx, +1)}
                        disabled={idx === list.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeQuestion(q.id)}
                        style={{ color: "crimson" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label>Enunciado</label>
                    <textarea
                      rows={2}
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(q.id, { text: e.target.value })
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label>Puntos</label>
                    <input
                      type="number"
                      min={0}
                      value={q.points}
                      onChange={(e) =>
                        updateQuestion(q.id, {
                          points: Number(e.target.value) || 0,
                        })
                      }
                      style={{ width: 100 }}
                    />
                  </div>

                  {q.type === "mcq" && (
                    <div style={{ marginTop: 8 }}>
                      <label>Opciones (tildá las correctas)</label>
                      <div style={{ display: "grid", gap: 8 }}>
                        {opts.map((opt: any, i: number) => {
                          const checked = correct.includes(opt.id);
                          return (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const nc = new Set(correct);
                                  if (e.target.checked) nc.add(opt.id);
                                  else nc.delete(opt.id);
                                  updateQuestion(q.id, {
                                    correct: Array.from(nc) as any,
                                  });
                                }}
                              />
                              <code
                                style={{ width: 24, display: "inline-block" }}
                              >
                                {opt.id}
                              </code>
                              <input
                                value={opt.text}
                                onChange={(e) => {
                                  const copy = [...opts];
                                  copy[i] = {
                                    ...copy[i],
                                    text: e.target.value,
                                  };
                                  updateQuestion(q.id, {
                                    options: copy as any,
                                  });
                                }}
                                style={{ flex: 1 }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const id = nextLetter(opts.length);
                            updateQuestion(q.id, {
                              options: [...opts, { id, text: "" }] as any,
                            });
                          }}
                        >
                          + Agregar opción
                        </button>
                        {opts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const last = opts[opts.length - 1];
                              const nc = correct.filter((x) => x !== last.id);
                              updateQuestion(q.id, {
                                options: opts.slice(0, -1) as any,
                                correct: nc as any,
                              });
                            }}
                          >
                            Quitar última opción
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {q.type === "tf" && (
                    <div style={{ marginTop: 8 }}>
                      <label>Respuesta correcta</label>
                      <div style={{ display: "flex", gap: 12 }}>
                        <label>
                          <input
                            type="radio"
                            checked={q.correct === true}
                            onChange={() =>
                              updateQuestion(q.id, { correct: true as any })
                            }
                          />{" "}
                          Verdadero
                        </label>
                        <label>
                          <input
                            type="radio"
                            checked={q.correct === false}
                            onChange={() =>
                              updateQuestion(q.id, { correct: false as any })
                            }
                          />{" "}
                          Falso
                        </label>
                      </div>
                    </div>
                  )}

                  {q.type === "text" && (
                    <div style={{ marginTop: 8, color: "#777" }}>
                      Respuesta abierta – se corrige de forma manual luego del
                      envío.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
