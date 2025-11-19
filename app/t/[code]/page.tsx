"use client";
import * as React from "react";

const API = process.env.NEXT_PUBLIC_API_URL!; // ej: http://localhost:3001/api

type QuestionKind = "MCQ" | "TRUE_FALSE" | "SHORT_TEXT" | "FILL_IN";
type GradingMode = "auto" | "manual";

export default function TeacherBoard({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = React.use(params);

  // ---- examen base ----
  const [exam, setExam] = React.useState<any>(null);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [duration, setDuration] = React.useState<number>(60);
  const [savingExam, setSavingExam] = React.useState(false);

  // ---- meta (docente, materia, grading, maxScore, openAt) ----
  const [teacherName, setTeacherName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [gradingMode, setGradingMode] = React.useState<GradingMode>("auto");
  const [maxScore, setMaxScore] = React.useState<number>(10);
  const [openAt, setOpenAt] = React.useState<string>(""); // ISO local datetime (input type="datetime-local")
  const [savingMeta, setSavingMeta] = React.useState(false);

  // ---- preguntas ----
  const [items, setItems] = React.useState<any[]>([]);
  const [loadingQ, setLoadingQ] = React.useState(false);
  const [savingQ, setSavingQ] = React.useState(false);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  // formulario crear pregunta
  const [kind, setKind] = React.useState<QuestionKind>("MCQ");
  const [stem, setStem] = React.useState("");
  const [points, setPoints] = React.useState(1);

  // MCQ
  const [mcqChoices, setMcqChoices] = React.useState<string[]>([
    "Opción 1",
    "Opción 2",
  ]);
  const [mcqCorrect, setMcqCorrect] = React.useState(0);

  // VOF
  const [tfCorrect, setTfCorrect] = React.useState(true);

  // Texto
  const [shortAnswer, setShortAnswer] = React.useState("");

  // Completar
  const [fillAnswers, setFillAnswers] = React.useState("");

  // ---- Step (pestañas) ----
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  // ----------------- helpers -----------------
  async function loadExam() {
    const r = await fetch(`${API}/exams/${code}`, { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo cargar el examen");
    const data = await r.json();
    const ex = data.exam;
    setExam(ex);
    setIsOpen(!!ex.isOpen);
    setDuration(Number(ex.durationMinutes ?? 60));
  }

  async function loadMeta() {
    const r = await fetch(`${API}/exams/${code}/meta`, { cache: "no-store" });
    if (!r.ok) return; // no meta aún
    const data = await r.json();
    if (data?.meta) {
      setTeacherName(data.meta.teacherName ?? "");
      setSubject(data.meta.subject ?? "");
      setGradingMode((data.meta.gradingMode as GradingMode) ?? "auto");
      setMaxScore(
        Number.isFinite(data.meta.maxScore) ? Number(data.meta.maxScore) : 10
      );
      // openAt del server es UTC; acá podrías convertir a local si quisieras
      setOpenAt(data.meta.openAt ?? "");
    }
  }

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const body: any = {
        teacherName: teacherName.trim() || null,
        subject: subject.trim() || null,
        gradingMode,
        maxScore: Number(maxScore) || 10,
        openAt: openAt ? new Date(openAt).toISOString() : null, // ✅ a ISO
      };

      const r = await fetch(`${API}/exams/${code}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadMeta();
      alert("Datos guardados");
      setStep(2); // ir al siguiente paso
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar los datos del docente/materia");
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveExamConfig(open?: boolean) {
    setSavingExam(true);
    try {
      const body: any = {
        durationMins: Number(duration) || 0,
      };
      if (typeof open === "boolean") body.isOpen = open;

      const r = await fetch(`${API}/exams/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const upd = await r.json();
      setExam(upd);
      setIsOpen(!!upd.isOpen);
      alert("Configuración guardada");
      setStep(3);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la configuración");
    } finally {
      setSavingExam(false);
    }
  }

  async function loadQuestions() {
    setLoadingQ(true);
    setErrMsg(null);
    try {
      const r = await fetch(`${API}/exams/${code}/questions`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setItems(data.items ?? []);
    } catch (e: any) {
      console.error(e);
      setErrMsg("No se pudieron cargar las preguntas.");
    } finally {
      setLoadingQ(false);
    }
  }

  React.useEffect(() => {
    (async () => {
      try {
        await loadExam();
        await loadMeta();
        await loadQuestions();
      } catch (e) {
        console.error(e);
        alert("Error cargando el examen");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ---- builder helpers ----
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
    setSavingQ(true);
    setErrMsg(null);
    try {
      if (!stem.trim()) throw new Error("Falta el enunciado/consigna.");
      const body: any = {
        kind,
        stem: stem.trim(),
        points: Number(points) || 1,
      };

      if (kind === "MCQ") {
        const choices = mcqChoices.map((s) => s.trim()).filter(Boolean);
        if (choices.length < 2)
          throw new Error("MCQ requiere al menos 2 opciones.");
        if (mcqCorrect < 0 || mcqCorrect >= choices.length)
          throw new Error("Índice correcto fuera de rango.");
        body.choices = choices;
        body.answer = mcqCorrect;
      } else if (kind === "TRUE_FALSE") {
        body.answer = Boolean(tfCorrect);
      } else if (kind === "SHORT_TEXT") {
        body.answer = shortAnswer.trim() || null;
      } else if (kind === "FILL_IN") {
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
      if (!r.ok) throw new Error(await r.text());

      // limpiar y recargar
      setStem("");
      setPoints(1);
      setMcqChoices(["Opción 1", "Opción 2"]);
      setMcqCorrect(0);
      setTfCorrect(true);
      setShortAnswer("");
      setFillAnswers("");
      await loadQuestions();
    } catch (e: any) {
      console.error(e);
      setErrMsg(e.message || String(e));
    } finally {
      setSavingQ(false);
    }
  }

  function copyLink() {
    const link = `${window.location.origin}/s/${code}`;
    navigator.clipboard.writeText(link);
    alert("Link copiado: " + link);
  }

  return (
    <div
      style={{
        padding: 16,
        display: "grid",
        gap: 16,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h2>Docente – {code}</h2>

      {/* Navegación simple de pasos */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setStep(1)}
          style={{ fontWeight: step === 1 ? 700 : 400 }}
        >
          1) Datos
        </button>
        <button
          onClick={() => setStep(2)}
          style={{ fontWeight: step === 2 ? 700 : 400 }}
        >
          2) Configuración
        </button>
        <button
          onClick={() => setStep(3)}
          style={{ fontWeight: step === 3 ? 700 : 400 }}
        >
          3) Cuestionario
        </button>
        <button
          onClick={() => setStep(4)}
          style={{ fontWeight: step === 4 ? 700 : 400 }}
        >
          4) Publicar
        </button>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={copyLink}>Copiar link alumno</button>
        </div>
      </div>

      {/* Paso 1: Datos del docente y materia */}
      {step === 1 && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <h3>Datos del docente y materia</h3>
          <label>Nombre del docente</label>
          <input
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            placeholder="Ej: Malena Pérez"
          />
          <label>Materia</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: Psicología Clínica"
          />
          <div style={{ display: "flex", gap: 12 }}>
            <div>
              <label>Modo de corrección</label>
              <select
                value={gradingMode}
                onChange={(e) => setGradingMode(e.target.value as GradingMode)}
              >
                <option value="auto">Instantánea (automática)</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label>Nota máxima del examen</label>
              <input
                type="number"
                value={maxScore}
                onChange={(e) =>
                  setMaxScore(parseInt(e.target.value, 10) || 10)
                }
                style={{ width: 120 }}
              />
            </div>
          </div>
          <div>
            <label>Hora de apertura (opcional)</label>
            <input
              type="datetime-local"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
            />
            <small style={{ display: "block", opacity: 0.7 }}>
              Si se completa, el examen queda con “hora sugerida de apertura”.
              El cierre se produce cuando vence el tiempo del alumno.
            </small>
          </div>
          <div>
            <button disabled={savingMeta} onClick={saveMeta}>
              {savingMeta ? "Guardando…" : "Guardar y continuar"}
            </button>
          </div>
        </section>
      )}

      {/* Paso 2: Configuración básica del examen */}
      {step === 2 && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <h3>Configuración básica</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div>
              <b>Título:</b> {exam?.title ?? "—"}
            </div>
            <div>
              <b>Abierto:</b> {isOpen ? "Sí" : "No"}
            </div>
          </div>
          <label>Duración del examen (minutos)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
            style={{ width: 140 }}
          />
          <div style={{ display: "flex", gap: 12 }}>
            <button disabled={savingExam} onClick={() => saveExamConfig()}>
              {savingExam ? "Guardando…" : "Guardar configuración"}
            </button>
            <button disabled={savingExam} onClick={() => saveExamConfig(true)}>
              {savingExam ? "…" : "Guardar y abrir examen"}
            </button>
          </div>
        </section>
      )}

      {/* Paso 3: Cuestionario (crear preguntas) */}
      {step === 3 && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 12,
          }}
        >
          <h3>Cuestionario</h3>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ fontWeight: 600 }}>Tipo:</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as QuestionKind)}
            >
              <option value="MCQ">Multiple Choice (MCQ)</option>
              <option value="TRUE_FALSE">Verdadero / Falso</option>
              <option value="SHORT_TEXT">Texto breve</option>
              <option value="FILL_IN">Completar</option>
            </select>
            <div style={{ marginLeft: "auto", opacity: 0.7 }}>
              {loadingQ ? "Cargando…" : `Preguntas: ${items.length}`}
            </div>
          </div>

          {errMsg && (
            <div
              style={{
                background: "#fee",
                border: "1px solid #f99",
                padding: 10,
                borderRadius: 8,
              }}
            >
              <b>Error: </b>
              {errMsg}
            </div>
          )}

          <label style={{ fontWeight: 600 }}>Enunciado / consigna</label>
          <textarea
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            rows={3}
            placeholder="Escribí la consigna…"
            style={{ width: "100%" }}
          />

          {kind === "MCQ" && (
            <div style={{ display: "grid", gap: 8 }}>
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
                    title="Eliminar opción"
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

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label>Puntos</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value, 10) || 1)}
              style={{ width: 120 }}
            />
            <button
              disabled={savingQ || !stem.trim()}
              onClick={saveQuestion}
              style={{ marginLeft: "auto" }}
            >
              {savingQ ? "Guardando…" : "Guardar pregunta"}
            </button>
          </div>

          {/* listado */}
          <h4>📋 Preguntas ({items.length})</h4>
          {!items.length && <p>No hay preguntas todavía.</p>}
          <ol>
            {items.map((q: any, idx: number) => (
              <li key={q.id} style={{ marginBottom: 12 }}>
                <div
                  style={{ display: "flex", gap: 8, alignItems: "baseline" }}
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

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={() => setStep(4)}>Continuar a publicación</button>
          </div>
        </section>
      )}

      {/* Paso 4: Publicación (guardar todo + link) */}
      {step === 4 && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <h3>Publicación y link</h3>
          <p>
            <b>Modo de corrección:</b>{" "}
            {gradingMode === "auto" ? "Instantánea (automática)" : "Manual"}
            {" — "}
            <b>Nota máxima:</b> {maxScore}
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={copyLink}>Guardar y copiar link</button>
            <a href={`/t`} style={{ alignSelf: "center" }}>
              Ir a “Exámenes”
              <a href={`/t/${code}/board`}>
                <button>Ir al tablero de control</button>
              </a>
            </a>
          </div>
          <small style={{ opacity: 0.7 }}>
            Link del alumno:{" "}
            <code>
              {typeof window !== "undefined"
                ? `${window.location.origin}/s/${code}`
                : `/s/${code}`}
            </code>
          </small>
        </section>
      )}
    </div>
  );
}
