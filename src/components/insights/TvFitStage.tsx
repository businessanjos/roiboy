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
  /**
   * Altura mínima confortável do conteúdo (px). Quando informada, o palco é
   * renderizado nessa altura e reduzido proporcionalmente para caber na tela —
   * assim gráficos não ficam espremidos nem cortados.
   */
  requiredHeight?: number;
}

/**
 * O palco ocupa o espaço real disponível (sem o antigo canvas fixo de 1920x1080,
 * que deixava tudo minúsculo em telas menores). As fontes crescem conforme a
 * largura da tela e, se o conteúdo precisar de mais altura do que a TV tem,
 * reduzimos proporcionalmente até caber tudo sem rolagem.
 */
export function TvFitStage({ children, title, subtitle, requiredHeight }: TvFitStageProps) {
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

  const { width, height } = size;

  // Altura em que o painel será desenhado antes de encolher para caber.
  const headerAllowance = title || subtitle ? 64 : 0;
  const contentAvailable = Math.max(1, height - headerAllowance);
  const targetContent = Math.max(contentAvailable, requiredHeight || 0);
  const fit = height ? Math.min(1, Math.max(0.45, contentAvailable / targetContent)) : 1;

  // Escala tipográfica: quanto maior a tela, maiores os números e rótulos.
  // Quando o palco encolhe, compensamos um pouco para manter a leitura à distância.
  const baseScale = width ? Math.min(1.3, Math.max(1, 1 + (width - 1200) / 2000)) : 1.1;
  const fontScale = Math.min(1.45, baseScale / Math.max(fit, 0.6));

  const stageWidth = width ? width / fit : undefined;
  const stageHeight = height ? headerAllowance / fit + targetContent : undefined;

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
        <div className="flex-1 min-h-0 px-3 py-3 overflow-hidden">
          <TvModeProvider enabled scale={fontScale} maxCategories={10}>
            {children}
          </TvModeProvider>
        </div>
      </div>
    </div>
  );
}
