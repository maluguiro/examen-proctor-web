"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

// Tipos que entiende el backend
type QuestionKind = "MCQ" | "TRUE_FALSE" | "SHORT_TEXT" | "FILL_IN";

type QuestionLite = {
  id: string;
  examId: string;
  kind: QuestionKind;
  stem: string;
  choices: string[] | null;
  answer: any;
  points: number;
};

export default function EditExamPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code || "").toString();

  const [items, setItems] = React.useState<QuestionLite[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<QuestionKind>("MCQ");
  const [stem, setStem] = React.useState("");

  // Campos tipo MCQ
  const [mcqChoices, setMcqChoices] = React.useState<string[]>([
    "Opción 1",
    "Opción 2",
  ]);
  const [mcqCorrect, setMcqCorrect] = React.useState(0);

  // Campos TRUE/FALSE
  const [tfCorrect, setTfCorrect] = React.useState(true);

  // Campos SHORT_TEXT
  const [shortAnswer, setShortAnswer] = React.useState("");

  // Campos FILL_IN
  const [fillAnswers, setFillAnswers] = React.useState("");

  // Puntos
  const [points, setPoints] = React.useState(1);

  async function load() {
    if (!code) return;
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
    setMcqCorrect((prev) => {
      const newLen = mcqChoices.length - 1;
      if (prev >= newLen) return Math.max(0, newLen - 1);
      return prev;
    });
  }

  function updateMcqChoice(idx: number, val: string) {
    setMcqChoices((prev) => prev.map((c, i) => (i === idx ? val : c)));
  }

  async function saveQuestion() {
    setSaving(true);
    setErrorMsg(null);

    try {
      if (!stem.trim()) {
        throw new Error("Falta el enunciado / consigna.");
      }

      let body: any = {
        kind,
        stem: stem.trim(),
        points: Number(points) || 1,
      };

      if (kind === "MCQ") {
        const choices = mcqChoices.map((s) => s.trim()).filter(Boolean);
        if (choices.length < 2) {
          throw new Error("Opción múltiple requiere al menos 2 opciones.");
        }
        if (mcqCorrect < 0 || mcqCorrect >= choices.length) {
          throw new Error("La opción correcta está fuera de rango.");
        }
        body.choices = choices;
        body.answer = mcqCorrect; // índice correcto (0-based)
      } else if (kind === "TRUE_FALSE") {
        body.answer = Boolean(tfCorrect);
      } else if (kind === "SHORT_TEXT") {
        body.answer = shortAnswer.trim() || null; // opcional
      } else if (kind === "FILL_IN") {
        const answers = fillAnswers
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        body.answer = { answers }; // backend lo guarda como JSON
      }

      const r = await fetch(`${API}/exams/${code}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "No se pudo crear la pregunta.");
      }

      // Reset de formulario para la próxima pregunta
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
      // Si el backend devolvió JSON tipo {"error":"FALTAN_CAMPOS"}, mostramos eso
      const msg = e.message || String(e);
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) setErrorMsg(parsed.error);
        else setErrorMsg(msg);
      } catch {
        setErrorMsg(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: 24,
    display: "grid",
    gap: 16,
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  return (
    <main style={containerStyle}>
      <header>
        <div style={{ marginBottom: 8 }}>
          <a href={`/t/${code}/board`} style={{ textDecoration: "none" }}>
            ← Volver al tablero
          </a>
        </div>
        <h1 style={{ margin: 0 }}>Editar preguntas — {code}</h1>
        <p style={{ color: "#555", marginTop: 4 }}>
          Armá las consignas y sus opciones de respuesta.
        </p>
      </header>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Nueva pregunta</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {/* Tipo */}
          <div>
            <label>Tipo de pregunta:</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as QuestionKind)}
              style={{ marginLeft: 8, padding: 4 }}
            >
              <option value="MCQ">Opción múltiple</option>
              <option value="TRUE_FALSE">Verdadero / Falso</option>
              <option value="SHORT_TEXT">Texto breve</option>
              <option value="FILL_IN">Relleno de casilleros</option>
            </select>
          </div>

          {/* Enunciado */}
          <div>
            <label>Enunciado / consigna</label>
            <textarea
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              rows={3}
              placeholder="Escribí la consigna de la pregunta…"
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>

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
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
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
                    🗑
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
                />{" "}
                Verdadero
              </label>
              <label>
                <input
                  type="radio"
                  name="tf"
                  checked={tfCorrect === false}
                  onChange={() => setTfCorrect(false)}
                />{" "}
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
                Se guardan como <code>{`{ answers: string[] }`}</code> (mínimo
                viable).
              </small>
            </div>
          )}

          {/* Puntos + botón guardar */}
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

          {errorMsg && (
            <div
              style={{
                background: "#fee",
                border: "1px solid #fcc",
                borderRadius: 8,
                padding: 8,
                whiteSpace: "pre-wrap",
                marginTop: 8,
              }}
            >
              Error: {errorMsg}
            </div>
          )}
        </div>
      </section>

      {/* LISTA DE PREGUNTAS */}
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Preguntas ({items.length})</h2>
        {!items.length && <p>No hay preguntas todavía.</p>}
        <ol>
          {items.map((q, idx) => (
            <li key={q.id} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "baseline",
                }}
              >
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
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    Puntos: {q.points}
                  </span>
                )}
              </div>
              {Array.isArray(q.choices) && q.choices.length > 0 && (
                <ul style={{ marginTop: 6 }}>
                  {q.choices.map((c, i) => (
                    <li key={i}>
                      {String.fromCharCode(65 + i)}. {c}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
