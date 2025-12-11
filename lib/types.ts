// web/lib/types.ts

// ==================== Examen / Configuración ====================

export type ExamStatus = "DRAFT" | "OPEN" | "CLOSED";

export type GradingMode = "auto" | "manual";
export type ReviewMode = "immediate" | "after_manual";

export type ExamSettings = {
  requireFullscreen: boolean;
  blurGraceMs: number;
  dedupeMs: number;
  channels: {
    tabHidden: boolean;
    windowBlur: boolean;
    fullscreenExit: boolean;
    copy: boolean;
    paste: boolean;
    print: boolean;
  };
  features: {
    chat: boolean;
    pause: boolean;
    forgiveLife: boolean;
    addTime: boolean;
  };
};

export type ExamMeta = {
  examId: string;
  code: string;
  title: string;
  status: string;
  durationMinutes: number | null;
  lives: number | null;
  teacherName: string | null;
  subject: string | null;
  gradingMode: GradingMode;
  reviewMode: ReviewMode; // Mantenemos reviewMode si existía o lo agregamos si viene del back
  maxScore: number;
  openAt: string | null;
  closeAt: string | null;
};

export type Exam = {
  id: string;
  publicCode: string;
  title: string;
  lives: number;
  durationMins: number | null;
  status: ExamStatus;

  // opcionales / para futuro:
  teacherName?: string | null;
  subject?: string | null;
  gradingMode?: GradingMode;
  reviewMode?: ReviewMode;
  openAt?: string | null;

  createdAt?: string;
  closedAt?: string | null;
  retentionDays?: number;

  settings?: ExamSettings;
};

// ==================== Preguntas ====================

export type QuestionType = "mcq" | "tf" | "text" | "fill";

export type QuestionOption = {
  id: string;   // "A", "B", "C"...
  text: string; // texto visible
};

export type Question = {
  id: string;
  examId: string;
  type: QuestionType;
  text: string;
  options: QuestionOption[] | null; // null para tf/text
  // mcq: string[] (ids correctas), tf: boolean, text/fill: null
  correct: any;
  points: number; // puede ser entero o decimal (tratamos como number)
  order: number;
};

// ==================== Alumno (lado estudiante) ====================

export type AttemptStatus = "in_progress" | "submitted";

export type AttemptExamInfo = {
  title: string;
  durationMins: number;
  lives: number;
  publicCode?: string;
  settings?: ExamSettings;
};

export type AttemptStateStudent = {
  id: string;
  status: AttemptStatus;
  livesUsed: number;
  paused: boolean;
  extraTimeSecs: number;
  studentName: string | null;
  score: number | null;
  exam: AttemptExamInfo;
};

// ==================== Docente (tablero) ====================

export type EventSummary = {
  id: string;
  type: string;
  reason: string | null;
  ts: string;
};

export type MessageSummary = {
  id: string;
  from: "student" | "teacher";
  text: string;
  ts: string;
};

export type AttemptSummary = {
  id: string;
  studentId: string;
  studentName: string | null;
  status: AttemptStatus;
  score: number | null;
  livesUsed: number;
  paused: boolean;

  violationsCount?: number;
  lastViolationReason?: string | null;
  violationTypes?: { type: string; count: number }[];
  startedAt?: string;
  finishedAt?: string | null;
  lastActivityAt?: string | null;

  events: EventSummary[];
  messages: MessageSummary[];
};

export type ExamAttemptsResponse = {
  exam: {
    title: string;
    lives: number;
    status: ExamStatus | string; // por si el back aún devuelve "open"/"closed"
    settings: ExamSettings;
  };
  attempts: AttemptSummary[];
};

// ==================== Revisión ====================

export type AnswerReview = {
  questionId: string;
  content: any; // respuesta del alumno
  isCorrect: boolean | null;
  score: number | null;
  maxPoints: number;
};

export type AttemptReview = {
  attemptId: string;
  exam: {
    title: string;
    publicCode: string;
  };
  studentName: string | null;
  startedAt: string;
  endedAt: string | null;
  score: number | null;
  maxScore: number;
  answers: AnswerReview[];
  events: EventSummary[];
};
