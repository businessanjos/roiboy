import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatValueWithScale } from "@/lib/formula-evaluator";
import { FormatType, DisplayScale, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { VisualConfig } from "../visual-builder/types";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { prorateGoalsInRange } from "@/lib/monthRange";
import { useTvMode } from "../TvModeContext";


interface ConfigurableScorecardProps {
  data: Array<{ name: string; value: number; count?: number }>;
  formatting: {
    type: FormatType;
    decimals: number;
    displayScale?: DisplayScale;
  };
  title?: string;
  config?: VisualConfig;
}

export function ConfigurableScorecard({ data, formatting, title, config }: ConfigurableScorecardProps) {
  const { filters } = useInsightsFilters();
  
  // Check if this is a "Meta" scorecard
  const isMetaScorecard = !!config?.gaugeConfig?.monthlyGoals && config?.measure?.aggregation === 'sum' && config?.measure?.field === 'meta';
  
  // Sum all values for scorecard
  const totalValue = isMetaScorecard
    ? prorateGoalsInRange(config?.gaugeConfig?.monthlyGoals, filters.startDate, filters.endDate)
    : data.reduce((acc, item) => acc + item.value, 0);
  const totalCount = data.reduce((acc, item) => acc + (item.count || 0), 0);
  
  const isSalesCycle = config?.measure?.aggregation === 'sales_cycle';
  
  // Use new formatting function with scale support
  const formattedValue = isSalesCycle
    ? `${totalValue}`
    : formatValueWithScale(
        totalValue, 
        isMetaScorecard ? 'currency' : formatting.type, 
        formatting.decimals,
        formatting.displayScale || 'auto'
      );

  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[config?.appearance?.fontScale || 'normal'] * tv.scale;

  // Font size derived from the real container width (not the string length)
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const MAX_FONT = (tv.tv ? 40 : 28) * m;
  const MIN_FONT = Math.max(11, 12 * m);
  const suffixSize = Math.round(14 * m);
  const subtitleSize = Math.round(11 * m);
  const hasSubtitle = isMetaScorecard || totalCount > 0;

  const [fittedFontSize, setFittedFontSize] = useState(MAX_FONT);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !containerWidth) return;
    const available = Math.max(containerWidth - 12 - (isSalesCycle ? suffixSize * 2.6 : 0), 40);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = getComputedStyle(el).fontFamily || "sans-serif";
    ctx.font = `700 100px ${family}`;
    const widthAt100 = ctx.measureText(formattedValue).width || 1;
    const ideal = Math.floor((available / widthAt100) * 100);
    // Também limita pela altura real do card (evita estourar o cartão na TV)
    const boxHeight = el.clientHeight || containerHeight;
    const verticalBudget = boxHeight
      ? Math.max(
          MIN_FONT,
          (boxHeight - 10 - (hasSubtitle ? subtitleSize * 1.7 + 4 : 0)) / 1.2
        )
      : MAX_FONT;
    const cap = Math.min(MAX_FONT, verticalBudget);
    const next = Math.max(MIN_FONT, Math.min(cap, ideal));
    setFittedFontSize(next);
    setIsTruncated(ideal < MIN_FONT);
  }, [formattedValue, containerWidth, containerHeight, MAX_FONT, MIN_FONT, isSalesCycle, suffixSize, subtitleSize, hasSubtitle]);

  const valueColor = config?.appearance?.valueColor;

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center h-full py-1 px-1 overflow-hidden">
      <p
        className={`font-bold mb-1 text-center w-full whitespace-nowrap tabular-nums ${isTruncated ? "truncate" : ""}`}
        title={isTruncated ? formattedValue : undefined}
        style={{ fontSize: `${Math.round(fittedFontSize)}px`, lineHeight: 1.1, color: valueColor || undefined }}
      >
        {formattedValue}
        {isSalesCycle && <span className="font-normal text-muted-foreground ml-1" style={{ fontSize: `${suffixSize}px` }}>dias</span>}
      </p>

      {isMetaScorecard && (
        <p className="text-muted-foreground text-center" style={{ fontSize: `${subtitleSize}px` }}>
          {(() => {
            const p = filters.preset;
            if (p === 'year') return 'Ano';
            if (p === 'month') return 'Mês';
            if (p === 'last_month') return 'Mês Passado';
            if (p === 'quarter') return 'Trimestre';
            if (p === 'week') return 'Semana';
            if (p === 'today') return 'Dia';
            return 'Período';
          })()}
        </p>
      )}
      {totalCount > 0 && !isMetaScorecard && (
        <p className="text-muted-foreground text-center" style={{ fontSize: `${subtitleSize}px` }}>
          {totalCount.toLocaleString('pt-BR')} {(() => {
            const src = config?.dataSource as string | undefined;
            const status = (config as any)?.statusFilter as string | undefined;
            const dealStatuses = (config as any)?.dealStatusFilter as string[] | undefined;
            const onlyWon = status === 'won' || (dealStatuses?.length === 1 && dealStatuses[0] === 'won');
            const isWonSource = src === 'deals_won' || (src === 'deals' && onlyWon);
            if (isWonSource) return totalCount === 1 ? 'venda' : 'vendas';
            if (src === 'deals') return totalCount === 1 ? 'negócio' : 'negócios';
            return totalCount === 1 ? 'registro' : 'registros';
          })()}
        </p>
      )}
    </div>
  );
}
