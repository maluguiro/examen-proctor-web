// URL base de la API. En .env.local deberias tener:
// NEXT_PUBLIC_API_URL=http://localhost:3001
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
  /\/$/,
  ""
);
export const API = `${API_BASE}/api`;


export async function patchAttemptLives(
  id: string,
  op: "increment" | "decrement",
  reason?: string
) {
  const res = await fetch(`${API}/attempts/${id}/lives`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, reason }),
  });

  if (!res.ok) throw new Error("PATCH_LIVES_FAILED");
  return res.json();
}

export async function getEvents(examId: string, since: number) {
  const res = await fetch(`${API}/events/${examId}?since=${since}`);

  if (!res.ok) throw new Error("EVENTS_FAILED");
  return (await res.json()) as { events: any[]; now: number };
}

// ====== Auth Client ======

export async function registerTeacher(payload: {
  name: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Error al registrarse");
  }
  return res.json();
}

export async function loginTeacher(payload: {
  email: string;
  password: string;
}) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Error al iniciar sesión");
  }
  return res.json();
}

export async function getTeacherProfile(token: string) {
  const res = await fetch(`${API}/teacher/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("PROFILE_FAILED");
  }
  return res.json();
}

export async function updateTeacherProfile(token: string, payload: any) {
  const res = await fetch(`${API}/teacher/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("PROFILE_UPDATE_FAILED");
  }
  return res.json();
}

export async function forgotPassword(email: string) {
  const res = await fetch(`${API}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const txt = await res.text();
    // No lanzamos error para no revelar si el email existe o no,
    // pero logueamos y retornamos ok salvo que sea un error 500 grave
    console.warn("Forgot Password Error:", txt);
  }
  // Siempre retornamos éxito genérico
  return { success: true };
}

export async function deleteExam(id: string) {
  const token = getAuthToken();
  if (!token) throw new Error("UNAUTHORIZED");

  const res = await fetch(`${API}/exams/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    // Intentamos leer el cuerpo por si viene un mensaje más específico
    const text = await res.text().catch(() => "");
    throw new Error(text || "DELETE_FAILED");
  }

  // El backend devuelve { ok: true } o podría devolver 204.
  if (res.status === 204) {
    return { ok: true };
  }

  try {
    return await res.json();
  } catch {
    return { ok: true };
  }
}

// ====== Token Management ======

const AUTH_TOKEN_KEY = "examproctor_token";

export function saveAuthToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}
// ⭐ Nueva función para crear examen con auth
// ⭐ Nueva función para crear examen con auth
export async function createExam() {
  const token = getAuthToken();
  if (!token) throw new Error("No hay sesión. Por favor logueate nuevamente.");

  const res = await fetch(`${API}/exams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "Examen sin título",
      lives: 3,
      durationMins: 60,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Error al crear examen");
  }

  return res.json();
}
