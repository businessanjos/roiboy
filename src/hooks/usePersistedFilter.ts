import { useState, useCallback, useEffect, useRef } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function usePersistedFilter<T>(
  page: string,
  field: string,
  defaultValue: T
): [T, (value: T) => void] {
  const { currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  const hasRestoredRef = useRef(false);

  const [value, setValue] = useState<T>(() => {
    if (!userId) return defaultValue;
    try {
      const key = `roy_filters_${userId}_${page}_${field}`;
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        hasRestoredRef.current = true;
        return JSON.parse(saved);
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // Re-read from localStorage once currentUser becomes available
  useEffect(() => {
    if (!userId || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const key = `roy_filters_${userId}_${page}_${field}`;
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        setValue(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [userId, page, field]);

  const setPersistedValue = useCallback((newValue: T) => {
    setValue(newValue);
    if (userId) {
      const key = `roy_filters_${userId}_${page}_${field}`;
      if (newValue === defaultValue) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    }
  }, [userId, page, field, defaultValue]);

  return [value, setPersistedValue];
}
