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

const STORAGE_KEY = "teacherProfile";

function loadTeacherProfileCache(): TeacherProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as TeacherProfile;
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

  const profile = (await res.json()) as TeacherProfile;
  saveTeacherProfile(profile);
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
  return loadTeacherProfileCache();
}

export function saveTeacherProfile(profile: TeacherProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}
