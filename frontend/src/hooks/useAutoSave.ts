"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
  onSave: (content: string, isPublic: boolean) => Promise<void>;
  debounceMs?: number;
}

export function useAutoSave({
  onSave,
  debounceMs = 2000,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPublicRef = useRef(false);

  const scheduleAutoSave = useCallback(
    (content: string, isPublic: boolean) => {
      isPublicRef.current = isPublic;

      // Clear pending save
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setStatus("idle");

      timerRef.current = setTimeout(async () => {
        setStatus("saving");
        try {
          await onSave(content, isPublicRef.current);
          setStatus("saved");
          setLastSavedAt(new Date());
        } catch {
          setStatus("error");
        }
      }, debounceMs);
    },
    [onSave, debounceMs]
  );

  const saveNow = useCallback(
    async (content: string, isPublic: boolean) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setStatus("saving");
      try {
        await onSave(content, isPublic);
        setStatus("saved");
        setLastSavedAt(new Date());
      } catch {
        setStatus("error");
      }
    },
    [onSave]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    status,
    lastSavedAt,
    scheduleAutoSave,
    saveNow,
  };
}
