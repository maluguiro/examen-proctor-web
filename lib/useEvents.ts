import { useEffect, useRef, useState } from "react";
import { getEvents } from "./api";

export function useEvents(examId: string) {
  const [events, setEvents] = useState<any[]>([]);
  const sinceRef = useRef<number>(0);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    async function loop() {
      while (!cancelled) {
        try {
          const { events: evs, now } = await getEvents(
            examId,
            sinceRef.current
          );
          if (evs.length) {
            setEvents((prev) => [...prev, ...evs]);
            sinceRef.current = now;
          } else {
            sinceRef.current = now;
          }
        } catch {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  return events;
}
