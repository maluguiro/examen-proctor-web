// web/lib/teacherProfile.ts

import { API, getAuthToken } from "@/lib/api";

export type Subject = {
  id: string;
  name: string;
};

export type Institution = {
  id: string;
  name: string;
  subjects: Subject[];
};

export type TeacherProfile = {
  name: string;
  subject?: string;     // legacy/optional
  institution?: string; // legacy/optional
  email?: string;
  institutions?: Institution[]; // New hierarchical structure
};

const LEGACY_KEY = "teacherProfile";
const NS_PREFIX = "teacherProfile:";

function nsKey(profileKey: string) {
  return `${NS_PREFIX}${profileKey}`;
}

type RawProfileResponse =
  | TeacherProfile
  | { profile?: TeacherProfile | null }
  | null
  | undefined;

function normalizeProfile(raw: RawProfileResponse): TeacherProfile | null {
  if (!raw) return null;
  if (typeof raw === "object" && "profile" in raw) {
    const inner = (raw as { profile?: TeacherProfile | null }).profile ?? null;
    return inner && typeof inner === "object" ? inner : null;
  }
  return typeof raw === "object" ? (raw as TeacherProfile) : null;
}

export function deriveProfileKeyFromToken(
  token: string | null | undefined
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "="
    );
    const decoded = atob(padded);
    const data = JSON.parse(decoded);
    const candidate = data?.id || data?.userId || data?.sub || data?.email || "";
    if (!candidate) return null;
    return String(candidate).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  } catch {
    return null;
  }
}

export function loadTeacherProfileCache(
  profileKey: string | null
): TeacherProfile | null {
  if (typeof window === "undefined") return null;
  if (!profileKey) return null;
  try {
    const raw = window.localStorage.getItem(nsKey(profileKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeProfile(parsed);
  } catch {
    return null;
  }
}

async function loadTeacherProfileRemote(
  token?: string | null
): Promise<TeacherProfile | null> {
  const authToken = token ?? getAuthToken();
  if (!authToken) {
    throw new Error("UNAUTHORIZED");
  }

  if (process.env.NODE_ENV !== "production") {
    console.count("loadTeacherProfile remote");
  }

  const res = await fetch(`${API}/teacher/profile`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (!res.ok) {
    throw new Error("PROFILE_FAILED");
  }

  const raw = (await res.json()) as RawProfileResponse;
  const profile = normalizeProfile(raw);
  if (profile) {
    saveTeacherProfile(profile);
  }
  return profile;
}

export function loadTeacherProfile(): TeacherProfile | null;
export function loadTeacherProfile(options: {
  remote: true;
  token?: string | null;
}): Promise<TeacherProfile | null>;
export function loadTeacherProfile(options?: {
  remote?: boolean;
  token?: string | null;
}) {
  if (options?.remote) {
    return loadTeacherProfileRemote(options.token);
  }
  const token = getAuthToken();
  const profileKey = deriveProfileKeyFromToken(token);
  return (
    loadTeacherProfileCache(profileKey) ||
    maybeMigrateLegacyTeacherProfile(profileKey)
  );
}

export function saveTeacherProfile(
  profile: TeacherProfile,
  profileKey?: string | null
) {
  if (typeof window === "undefined") return;
  const key =
    profileKey ||
    (profile as any)?.id ||
    profile?.email ||
    (profile as any)?.userId ||
    "";
  const normalizedKey = String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  if (!normalizedKey) return;
  try {
    window.localStorage.setItem(nsKey(normalizedKey), JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function maybeMigrateLegacyTeacherProfile(
  profileKey: string | null
): TeacherProfile | null {
  if (typeof window === "undefined") return null;
  if (!profileKey) return null;
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return null;
    const parsed = JSON.parse(legacyRaw);
    const legacy = normalizeProfile(parsed);
    if (!legacy) return null;
    const legacyId = String(
      (legacy as any)?.id || (legacy as any)?.userId || legacy?.email || ""
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    if (!legacyId || legacyId !== profileKey) return null;
    window.localStorage.setItem(nsKey(profileKey), JSON.stringify(legacy));
    window.localStorage.removeItem(LEGACY_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function clearTeacherProfileCache(profileKey?: string | null) {
  if (typeof window === "undefined") return;
  if (profileKey) {
    window.localStorage.removeItem(nsKey(profileKey));
  }
}
