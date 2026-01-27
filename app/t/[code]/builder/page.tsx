"use client";
import * as React from "react";

import { API } from "@/lib/api";

type QuestionKind = "MCQ" | "TRUE_FALSE" | "SHORT_TEXT" | "FILL_IN";

export default function BuilderPage({
  params,
}: {
  params: Promise<{ code: string }>; // Next 15: params es Promise
}) {
  const { code } = React.use(params);

  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<QuestionKind>("MCQ");

  // Campos comunes
  const [stem, setStem] = React.useState("");

  // MCQ
  const [mcqChoices, setMcqChoices] = React.useState<string[]>([
    "Opción 1",
    "Opción 2",
  ]);
  const [mcqCorrect, setMcqCorrect] = React.useState<number>(0);
  const [points, setPoints] = React.useState<number>(1);

  // TRUE_FALSE
  const [tfCorrect, setTfCorrect] = React.useState<boolean>(true);

  // SHORT_TEXT
  const [shortAnswer, setShortAnswer] = React.useState<string>("");

  // FILL_IN (libre: podés guardar estructura como JSON o usar campos simples)
  // En este mínimo, pedimos “Respuestas correctas” separadas por “;”
  const [fillAnswers, setFillAnswers] = React.useState<string>("");

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await fetch(`${API}/exams/${code}/questions`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setItems(data.items ?? []);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("No se pudieron cargar las preguntas.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function addMcqChoice() {
    setMcqChoices((prev) => [...prev, `Opción ${prev.length + 1}`]);
  }

  function removeMcqChoice(idx: number) {
    setMcqChoices((prev) => prev.filter((_, i) => i !== idx));
    if (mcqCorrect >= mcqChoices.length - 1) {
      setMcqCorrect(Math.max(0, mcqChoices.length - 2));
    }
  }

  function updateMcqChoice(idx: number, val: string) {
    setMcqChoices((prev) => prev.map((c, i) => (i === idx ? val : c)));
  }

  async function saveQuestion() {
    setSaving(true);
    setErrorMsg(null);
    try {
      if (!stem.trim()) {
        throw new Error("Falta el enunciado/consigna (stem).");
      }

      let body: any = { kind, stem: stem.trim(), points: Number(points) || 1 };

      if (kind === "MCQ") {
        const choices = mcqChoices.map((s) => s.trim()).filter(Boolean);
        if (choices.length < 2) {
          throw new Error("MCQ requiere al menos 2 opciones.");
        }
        if (mcqCorrect < 0 || mcqCorrect >= choices.length) {
          throw new Error("Índice correcto fuera de rango.");
        }
        body.choices = choices;
        body.answer = mcqCorrect; // índice correcto (0-based)
      } else if (kind === "TRUE_FALSE") {
        body.answer = Boolean(tfCorrect);
      } else if (kind === "SHORT_TEXT") {
        body.answer = shortAnswer.trim() || null; // opcional
      } else if (kind === "FILL_IN") {
        // guardamos como { answers: string[] }
        const answers = fillAnswers
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        body.answer = { answers };
      }

      const r = await fetch(`${API}/exams/${code}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "No se pudo crear la pregunta");
      }

      // limpiar campos para próxima pregunta
      setStem("");
      setPoints(1);
      setMcqChoices(["Opción 1", "Opción 2"]);
      setMcqCorrect(0);
      setTfCorrect(true);
      setShortAnswer("");
      setFillAnswers("");

      await load();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        padding: 16,
        display: "grid",
        gap: 16,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h2>Editor de examen — {code}</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontWeight: 600 }}>Tipo de pregunta:</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as QuestionKind)}
          style={{ padding: 6 }}
        >
          <option value="MCQ">Multiple Choice (MCQ)</option>
          <option value="TRUE_FALSE">Verdadero / Falso</option>
          <option value="SHORT_TEXT">Texto breve</option>
          <option value="FILL_IN">Completar (Fill in)</option>
        </select>

        <div style={{ marginLeft: "auto", opacity: 0.7 }}>
          {loading ? "Cargando preguntas..." : `Preguntas: ${items.length}`}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#fee",
            border: "1px solid #f99",
            padding: 10,
            borderRadius: 8,
          }}
        >
          <b>Error:</b> {errorMsg}
        </div>
      )}

      {/* Formulario común */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <label style={{ fontWeight: 600 }}>Enunciado / Consigna</label>
        <textarea
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          rows={3}
          placeholder="Escribí la consigna de la pregunta…"
          style={{ width: "100%" }}
        />

        {/* Campos por tipo */}
        {kind === "MCQ" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <b>Opciones</b>
              <button type="button" onClick={addMcqChoice}>
                + Agregar opción
              </button>
            </div>

            {mcqChoices.map((c, idx) => (
              <div
                key={idx}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  type="radio"
                  name="mcqCorrect"
                  checked={mcqCorrect === idx}
                  onChange={() => setMcqCorrect(idx)}
                  title="Correcta"
                />
                <input
                  value={c}
                  onChange={(e) => updateMcqChoice(idx, e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => removeMcqChoice(idx)}
                  disabled={mcqChoices.length <= 2}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        {kind === "TRUE_FALSE" && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label>Respuesta correcta:</label>
            <label>
              <input
                type="radio"
                name="tf"
                checked={tfCorrect === true}
                onChange={() => setTfCorrect(true)}
              />
              Verdadero
            </label>
            <label>
              <input
                type="radio"
                name="tf"
                checked={tfCorrect === false}
                onChange={() => setTfCorrect(false)}
              />
              Falso
            </label>
          </div>
        )}

        {kind === "SHORT_TEXT" && (
          <div style={{ display: "grid", gap: 6 }}>
            <label>Respuesta de referencia (opcional)</label>
            <input
              value={shortAnswer}
              onChange={(e) => setShortAnswer(e.target.value)}
              placeholder="Respuesta esperada (opcional)"
            />
          </div>
        )}

        {kind === "FILL_IN" && (
          <div style={{ display: "grid", gap: 6 }}>
            <label>Respuestas correctas (separadas por “;”)</label>
            <input
              value={fillAnswers}
              onChange={(e) => setFillAnswers(e.target.value)}
              placeholder="ej: palabra1; palabra2; palabra3"
            />
            <small style={{ opacity: 0.7 }}>
              Se guardan como <code>{`{ answers: string[] }`}</code>. (Mínimo
              viable)
            </small>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label>Puntos</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value, 10) || 1)}
            style={{ width: 120 }}
          />
          <div style={{ marginLeft: "auto" }}>
            <button disabled={saving || !stem.trim()} onClick={saveQuestion}>
              {saving ? "Guardando..." : "Guardar pregunta"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>📋 Preguntas ({items.length})</h3>
        {!items.length && <p>No hay preguntas todavía.</p>}
        <ol>
          {items.map((q: any, idx: number) => (
            <li key={q.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <b
                  style={{
                    fontSize: 12,
                    background: "#eef",
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                >
                  {q.kind}
                </b>
                <span style={{ fontWeight: 600 }}>{idx + 1}.</span>
                <span>{q.stem}</span>
                {typeof q.points === "number" && (
                  <span
                    style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}
                  >
                    Puntos: {q.points}
                  </span>
                )}
              </div>
              {Array.isArray(q.choices) && q.choices.length > 0 && (
                <ul style={{ marginTop: 6 }}>
                  {q.choices.map((c: string, i: number) => (
                    <li key={i}>
                      {i}. {c}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
