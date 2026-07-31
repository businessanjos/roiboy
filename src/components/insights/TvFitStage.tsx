import { ReactNode, useEffect, useRef, useState } from "react";
import { TvModeProvider } from "./TvModeContext";


/** Canvas nominal de uma TV 42" Full HD (16:9). */
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
 * Renderiza o conteúdo dentro de um palco fixo de 1920x1080 (16:9) e escala
 * proporcionalmente para caber no espaço disponível — o que aparece aqui é
 * exatamente o que aparece na TV, sem cortes nem barras de rolagem.
 */
export function TvFitStage({ children, title, subtitle }: TvFitStageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const next = Math.min(width / TV_STAGE_WIDTH, height / TV_STAGE_HEIGHT);
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Largura real (em px de tela) que o palco 1920x1080 ocupa depois da escala.
  // Abaixo de ~1100px os rótulos ficam pequenos demais: entramos em modo compacto
  // (fontes levemente maiores e menos categorias) automaticamente.
  const renderedWidth = TV_STAGE_WIDTH * scale;
  const compact = renderedWidth > 0 && renderedWidth < 1100;

  return (
    <div ref={wrapperRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      <div
        style={{
          width: TV_STAGE_WIDTH,
          height: TV_STAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        className="shrink-0"
      >
        <div className="w-full h-full flex flex-col rounded-2xl border border-border/60 bg-card/40 shadow-2xl overflow-hidden">
          {(title || subtitle) && (
            <div className="flex items-baseline justify-between gap-6 px-8 pt-6 pb-4 shrink-0">
              <h2 className="text-4xl font-bold tracking-tight text-foreground truncate">{title}</h2>
              {subtitle && (
                <span className="text-xl text-muted-foreground tabular-nums shrink-0">{subtitle}</span>
              )}
            </div>
          )}
          <div className="flex-1 min-h-0 px-6 pb-6">
            {/* Palco 1920x1080. Em telas amplas os visuais renderizam exatamente
                como fora do modo TV; quando o palco encolhe muito, ativamos o
                modo compacto para manter tudo legível. */}
            <TvModeProvider enabled={compact} compact scale={1.2} maxCategories={8}>
              {children}
            </TvModeProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

