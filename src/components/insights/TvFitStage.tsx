import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * O palco ocupa o espaço real disponível (sem o antigo canvas fixo de 1920x1080,
 * que deixava tudo minúsculo em telas menores). As fontes crescem conforme a
 * largura da tela e, se o conteúdo ainda não couber na altura (ex.: muitos
 * cards numa TV de 49"), reduzimos proporcionalmente até caber tudo sem rolagem.
 */
export function TvFitStage({ children, title, subtitle }: TvFitStageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fit, setFit] = useState(1);

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

  // Escala tipográfica: quanto maior a tela, maiores os números e rótulos.
  const { width, height } = size;
  const fontScale = width
    ? Math.min(1.3, Math.max(1, 1 + (width - 1200) / 2000))
    : 1.1;

  // Ajuste final de encaixe: se o conteúdo (mínimos de altura dos cards) passar
  // da altura disponível, encolhe o palco inteiro até caber.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || !height) return;
    let raf = 0;
    const measure = () => {
      const needed = el.scrollHeight;
      const available = el.clientHeight;
      if (!needed || !available) return;
      setFit((prev) => {
        const target =
          needed > available + 4
            ? Math.max(0.6, prev * (available / needed))
            : prev < 1 && needed < available * 0.92
              ? Math.min(1, prev * 1.03)
              : prev;
        return Math.abs(target - prev) < 0.01 ? prev : target;
      });
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [height, width, fit, children]);

  const stageWidth = width ? width / fit : undefined;
  const stageHeight = height ? height / fit : undefined;

  return (
    <div ref={wrapperRef} className="w-full h-full overflow-hidden">
      <div
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: fit < 1 ? `scale(${fit})` : undefined,
          transformOrigin: "top left",
        }}
        className="flex flex-col rounded-2xl border border-border/60 bg-card/40 shadow-2xl overflow-hidden"
      >
        {(title || subtitle) && (
          <div className="flex items-baseline justify-between gap-6 px-6 pt-4 pb-2 shrink-0">
            <h2 className="text-3xl font-bold tracking-tight text-foreground truncate">{title}</h2>
            {subtitle && (
              <span className="text-lg text-muted-foreground tabular-nums shrink-0">{subtitle}</span>
            )}
          </div>
        )}
        <div ref={contentRef} className="flex-1 min-h-0 px-3 py-3 overflow-hidden">
          <TvModeProvider enabled scale={fontScale} maxCategories={10}>
            {children}
          </TvModeProvider>
        </div>
      </div>
    </div>
  );
}
