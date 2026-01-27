"use client";

import * as React from "react";
import { API } from "@/lib/api";
import CalendarView from "../components/CalendarView";

type ExamListItem = {
  id: string;
  title: string;
  status: string;
  code: string;
  createdAt: string;
  subject?: string;
  date?: string;
  duration?: number;
  registeredCount?: number;
};

export default function TeacherCalendarPage() {
  const [exams, setExams] = React.useState<ExamListItem[]>([]);

  React.useEffect(() => {
    fetch(`${API}/exams`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setExams(Array.isArray(data) ? data : []))
      .catch(() => setExams([]));
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden">
      <CalendarView exams={exams} profile={null} />
    </main>
  );
}
