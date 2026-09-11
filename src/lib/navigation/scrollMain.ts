/**
 * Rola a área principal de conteúdo para o topo.
 * Usado ao trocar de seção nos menus laterais e abas, para que a seção
 * escolhida apareça imediatamente em vez de ficar abaixo da dobra.
 */
export const MAIN_SCROLL_ID = "app-main-scroll";

export function scrollMainToTop(behavior: ScrollBehavior = "smooth") {
  if (typeof document === "undefined") return;
  const el = document.getElementById(MAIN_SCROLL_ID);
  if (el) {
    el.scrollTo({ top: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, behavior });
}
