// web/lib/teacherProfile.ts

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

export function loadTeacherProfile(): TeacherProfile | null {
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

export function saveTeacherProfile(profile: TeacherProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}
