import { useEffect, useRef, useState } from "react";

/**
 * Mede o tamanho real do container do gráfico.
 * Usado para adaptar densidade de eixos/labels ao espaço disponível
 * (evita rótulos sobrepostos e valores cortados).
 */
export function useChartSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1
          ? prev
          : { width: rect.width, height: rect.height }
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}

/** Largura aproximada de um texto (px) para uma dada altura de fonte. */
export function approxTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.58;
}

/** Trunca no meio preservando o começo e o fim do rótulo. */
export function truncateLabel(label: string, maxChars: number) {
  if (maxChars <= 1 || label.length <= maxChars) return label;
  if (maxChars <= 4) return `${label.slice(0, maxChars - 1)}…`;
  return `${label.slice(0, maxChars - 1)}…`;
}
