import { useEffect } from "react";

/**
 * Publica a altura visível real em `--app-vh` (px).
 *
 * No Safari/iPhone o teclado não encolhe o layout viewport (e
 * `interactive-widget=resizes-content` é ignorado), então `100dvh` continua
 * contando a área atrás do teclado e o campo de mensagem fica escondido.
 * `window.visualViewport.height` reflete a área de fato visível.
 * Sem suporte, a variável não é definida e o CSS cai para `100dvh`.
 */
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--app-vh", `${Math.round(vv.height)}px`);
        // O iOS rola a janela ao focar um campo; mantemos o shell ancorado.
        if (vv.offsetTop > 0 && window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--app-vh");
    };
  }, []);
}
