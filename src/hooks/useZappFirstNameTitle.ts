import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { firstNameTitleKey, readKeepTitle, subscribeKeepTitle, writeKeepTitle } from "@/lib/zappFirstNameTitle";

/** Manter título (Dr., Dra.) em {primeiro_nome}. Padrão: ligado. */
export function useZappFirstNameTitle() {
  const { currentUser } = useCurrentUser();
  const key = useMemo(
    () => firstNameTitleKey(currentUser?.account_id, currentUser?.id),
    [currentUser?.account_id, currentUser?.id],
  );
  const enabled = useSyncExternalStore(subscribeKeepTitle, () => readKeepTitle(key), () => true);
  const setEnabled = useCallback((next: boolean) => writeKeepTitle(key, next), [key]);
  return { enabled, setEnabled };
}
