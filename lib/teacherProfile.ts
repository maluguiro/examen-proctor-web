// web/lib/teacherProfile.ts

export type TeacherProfile = {
  name: string;
  subject?: string;
  institution?: string;
  email?: string;
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
