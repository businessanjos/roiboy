import { useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function usePersistedFilter<T>(
  page: string,
  field: string,
  defaultValue: T
): [T, (value: T) => void] {
  const { currentUser } = useCurrentUser();
  const storageKey = `roy_filters_${currentUser?.id}_${page}_${field}`;

  const [value, setValue] = useState<T>(() => {
    if (!currentUser?.id) return defaultValue;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedValue = useCallback((newValue: T) => {
    setValue(newValue);
    if (currentUser?.id) {
      const key = `roy_filters_${currentUser.id}_${page}_${field}`;
      if (newValue === defaultValue) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    }
  }, [currentUser?.id, page, field, defaultValue]);

  return [value, setPersistedValue];
}
