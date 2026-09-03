import { ReactNode, useEffect, useRef, useState } from "react";
import { TvModeProvider } from "./TvModeContext";

/** Canvas nominal de uma TV 42" Full HD (16:9) — mantido por compatibilidade. */
export const TV_STAGE_WIDTH = 1920;
export const TV_STAGE_HEIGHT = 1080;

interface TvFitStageProps {
  children: ReactNode;
  /** Título opcional exibido no topo do palco. */
  title?: string;
  /** Legenda opcional (ex.: período aplicado). */
  subtitle?: string;
}

/**
 * O palco ocupa exatamente o espaço disponível (sem downscale). Antes o conteúdo
 * era renderizado num canvas fixo de 1920x1080 e reduzido por transform — em
 * telas menores que Full HD isso deixava todos os textos minúsculos.
 * Agora usamos o tamanho real e ampliamos as fontes conforme a área disponível.
 */
export function TvFitStage({ children, title, subtitle }: TvFitStageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.width - width) < 2 && Math.abs(prev.height - height) < 2
          ? prev
          : { width, height }
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escala tipográfica: quanto maior a tela (TV), maiores os números e rótulos.
  // Notebooks (~1300px) ficam em 1.1; Full HD em ~1.3; 4K/TVs grandes até 1.6.
  const { width } = size;
  const scale = width
    ? Math.min(1.6, Math.max(1.05, 1.05 + (width - 1200) / 1600))
    : 1.15;

  return (
    <div ref={wrapperRef} className="w-full h-full overflow-hidden">
      <div className="w-full h-full flex flex-col rounded-2xl border border-border/60 bg-card/40 shadow-2xl overflow-hidden">
        {(title || subtitle) && (
          <div className="flex items-baseline justify-between gap-6 px-6 pt-4 pb-2 shrink-0">
            <h2 className="text-3xl font-bold tracking-tight text-foreground truncate">{title}</h2>
            {subtitle && (
              <span className="text-lg text-muted-foreground tabular-nums shrink-0">{subtitle}</span>
            )}
          </div>
        )}
        <div className="flex-1 min-h-0 px-3 py-3">
          <TvModeProvider enabled scale={scale} maxCategories={10}>
            {children}
          </TvModeProvider>
        </div>
      </div>
    </div>
  );
}
