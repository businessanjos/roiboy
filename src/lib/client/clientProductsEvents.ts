import { useEffect } from "react";

export const CLIENT_PRODUCTS_CHANGED = "client-products-changed";

export interface ClientProductsChangedDetail {
  clientId?: string;
}

/** Avisa a aplicação que vínculos/status de produtos de um cliente mudaram. */
export function emitClientProductsChanged(clientId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ClientProductsChangedDetail>(CLIENT_PRODUCTS_CHANGED, {
      detail: { clientId },
    })
  );
  // Propaga para outras abas abertas
  try {
    localStorage.setItem(CLIENT_PRODUCTS_CHANGED, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Executa o callback sempre que produtos de clientes mudarem (mesma aba ou outra). */
export function useClientProductsChanged(
  handler: (detail: ClientProductsChangedDetail) => void
) {
  useEffect(() => {
    const onCustom = (event: Event) => {
      handler((event as CustomEvent<ClientProductsChangedDetail>).detail || {});
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CLIENT_PRODUCTS_CHANGED) handler({});
    };
    window.addEventListener(CLIENT_PRODUCTS_CHANGED, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CLIENT_PRODUCTS_CHANGED, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [handler]);
}
