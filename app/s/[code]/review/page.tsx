"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { API } from "@/lib/api";

export default function StudentReviewRedirectPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = (params?.code || "").toString();

  React.useEffect(() => {
    if (!code) return;
    const attemptIdParam = (searchParams?.get("attemptId") || "").trim();
    let storedAttemptId = attemptIdParam || null;
    if (!storedAttemptId) {
      const raw = localStorage.getItem(`examproctor_attempt_${code}`);
      const parsed = raw ? JSON.parse(raw) : null;
      storedAttemptId = (parsed?.attemptId ?? "").toString().trim() || null;
    }

    if (!storedAttemptId) {
      router.replace(`/s/${code}`);
      return;
    }

    const url = `${API}/attempts/${storedAttemptId}/review.print`;
    window.location.replace(url);
  }, [code, router, searchParams]);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-2xl mx-auto glass-panel p-6 rounded-2xl text-sm text-gray-600">
        Redirigiendo a la revisión...
      </div>
    </div>
  );
}