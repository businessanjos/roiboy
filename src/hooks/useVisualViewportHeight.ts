import { useEffect } from "react";

/**
 * Altura do shell móvel quando o teclado encolhe a área visível.
 *
 * No Safari/iPhone o teclado não encolhe o layout viewport (e
 * `interactive-widget=resizes-content` é ignorado), então `100dvh` conta a
 * área atrás do teclado. Aqui publicamos `--app-vh` (px) só quando
 * `visualViewport.height` fica menor que a janela; fora disso a variável é
 * removida e o CSS volta a `100dvh`.
 *
 * Zoom (scale ≠ 1): não mexe em nada — evita reflow e preserva pinch/pan.
 * Nunca força scroll da janela.
 */
export function computeAppHeight(
  vv: { height: number; scale: number },
  innerHeight: number,
  innerWidth: number,
): "keep" | "clear" | number {
  if (innerWidth >= 1024) return "clear";
  if (Math.abs(vv.scale - 1) > 0.01) return "keep";
  const h = Math.round(vv.height);
  return h < innerHeight - 1 ? h : "clear";
}

export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const apply = () => {
      const r = computeAppHeight(vv, window.innerHeight, window.innerWidth);
      if (r === "keep") return;
      if (r === "clear") root.style.removeProperty("--app-vh");
      else root.style.setProperty("--app-vh", `${r}px`);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--app-vh");
    };
  }, []);
}
