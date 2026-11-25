import { ReactNode, useEffect, useRef, useState } from "react";
import { TvModeProvider } from "./TvModeContext";
import { tvStageSizing } from "@/lib/insights/tvLayout";
import type { CSSProperties } from "react";
import './TvPresentation.css';

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
  /** Requested display zoom; fitting may reduce it further to keep all rows visible. */
  zoom?: number;
  /** Wider seller presentation requested only by the focus overlay. */
  presentation?: boolean;
}

/**
 * O palco ocupa o espaço real disponível (sem o antigo canvas fixo de 1920x1080,
 * que deixava tudo minúsculo em telas menores). As fontes crescem conforme a
 * largura da tela e, se o conteúdo precisar de mais altura do que a TV tem,
 * reduzimos proporcionalmente até caber tudo sem rolagem.
 */
export function TvFitStage({ children, title, subtitle, requiredHeight, zoom = 100, presentation = false }: TvFitStageProps) {
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
  const { fit, fontScale, stageWidth, stageHeight } = tvStageSizing(width, height, requiredHeight, headerAllowance, zoom);
  const pixelScale = Math.min(1, Math.max(0.5, zoom / 100));

  return (
    <div ref={wrapperRef} className="w-full h-full overflow-hidden">
      <div
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: fit < 1 ? `scale(${fit})` : undefined,
          transformOrigin: "top left",
          ...(presentation ? { '--tv-pixel-ratio': 1 / pixelScale } : {}),
        } as CSSProperties}
        className={`flex flex-col overflow-hidden ${presentation ? 'insights-tv-presentation' : ''}`}
      >
        {(title || subtitle) && (
          <div className="flex items-baseline justify-between gap-6 px-6 pt-4 pb-2 shrink-0">
            <h2 className="text-3xl font-bold tracking-normal text-foreground truncate">{title}</h2>
            {subtitle && (
              <span className="text-lg text-muted-foreground tabular-nums shrink-0">{subtitle}</span>
            )}
          </div>
        )}
        <div className="flex-1 min-h-0 p-0.5 overflow-hidden">
          <TvModeProvider enabled fitted scale={fontScale} maxCategories={10} presentation={presentation} pixelScale={pixelScale}>
            {children}
          </TvModeProvider>
        </div>
      </div>
    </div>
  );
}
