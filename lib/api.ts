// URL base de la API. En .env.local deberías tener:
// NEXT_PUBLIC_API_URL=http://localhost:3001/api
export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

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
