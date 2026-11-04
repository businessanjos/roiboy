import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  readTagNameTagsEnabled,
  subscribeTagNameTags,
  tagNameTagsKey,
  writeTagNameTagsEnabled,
} from "@/lib/zappTagNameTags";

/** Chavinha de exibição das etiquetas ao lado do nome (padrão: ligado). */
export function useZappTagNameTags() {
  const { currentUser } = useCurrentUser();
  const key = useMemo(
    () => tagNameTagsKey(currentUser?.account_id, currentUser?.id),
    [currentUser?.account_id, currentUser?.id],
  );

  const enabled = useSyncExternalStore(
    subscribeTagNameTags,
    () => readTagNameTagsEnabled(key),
    () => true,
  );

  const setEnabled = useCallback(
    (next: boolean) => writeTagNameTagsEnabled(key, next),
    [key],
  );

  return { enabled, setEnabled };
}

/** Só leitura, para os componentes que mostram as etiquetas. */
export function useZappTagNameTagsEnabled() {
  return useZappTagNameTags().enabled;
}
