import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { FieldFilter, DEAL_CREATED_AT_FIELD_ID } from "@/components/insights/visual-builder/types";

export type DatePreset = "today" | "week" | "month" | "quarter" | "year" | "last_month" | "custom";

export type GlobalFieldFilterSource = "deal" | "lead";

export interface GlobalFieldFilter {
  source: GlobalFieldFilterSource;
  filter: FieldFilter;
}

/**
 * Returns true when the filter has enough info to actually restrict results.
 * Applied by every insights hook before injecting it into query pipelines.
 */
export function isGlobalFieldFilterActive(g?: GlobalFieldFilter | null): boolean {
  if (!g) return false;
  const f = g.filter;
  if (!f?.fieldId) return false;
  if (f.fieldId === DEAL_CREATED_AT_FIELD_ID) {
    return !!(f.dateFrom || f.dateTo);
  }
  return (f.selectedValues?.length ?? 0) > 0;
}

/**
 * Merges the global deal field filter into a per-visual deal filter list.
 * Duplicate-by-fieldId collisions keep the per-visual filter (more specific wins).
 */
export function mergeGlobalDealFilter(
  local: FieldFilter[],
  global?: GlobalFieldFilter | null,
): FieldFilter[] {
  if (!isGlobalFieldFilterActive(global) || global!.source !== "deal") return local;
  const localIds = new Set(local.map((f) => f.fieldId));
  if (localIds.has(global!.filter.fieldId)) return local;
  return [...local, global!.filter];
}

/**
 * Merges the global lead field filter into a per-visual lead filter list.
 */
export function mergeGlobalLeadFilter(
  local: FieldFilter[],
  global?: GlobalFieldFilter | null,
): FieldFilter[] {
  if (!isGlobalFieldFilterActive(global) || global!.source !== "lead") return local;
  const localIds = new Set(local.map((f) => f.fieldId));
  if (localIds.has(global!.filter.fieldId)) return local;
  return [...local, global!.filter];
}

export interface InsightsFilters {
  startDate: string;
  endDate: string;
  userId: string;
  stageId: string;
  productId: string;
  pipelineId: string;
  preset: DatePreset;
  accountIdOverride?: string;
}

interface InsightsFiltersContextType {
  filters: InsightsFilters;
  setFilters: React.Dispatch<React.SetStateAction<InsightsFilters>>;
  setPreset: (preset: DatePreset) => void;
  setDateRange: (start: Date, end: Date) => void;
  setUserId: (userId: string) => void;
  setStageId: (stageId: string) => void;
  setProductId: (productId: string) => void;
  setPipelineId: (pipelineId: string) => void;
  getDateRangeLabel: () => string;
  resetFilters: () => void;
  setAccountIdOverride: (accountId: string) => void;
}

const InsightsFiltersContext = createContext<InsightsFiltersContextType | null>(null);

const getDefaultFilters = (): InsightsFilters => {
  const now = new Date();
  return {
    startDate: startOfYear(now).toISOString(),
    endDate: endOfYear(now).toISOString(),
    userId: "all",
    stageId: "all",
    productId: "all",
    pipelineId: "",
    preset: "year",
  };
};

export function InsightsFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<InsightsFilters>(getDefaultFilters);

  const setPreset = useCallback((preset: DatePreset) => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case "week":
        start = startOfWeek(now, { weekStartsOn: 0 });
        end = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case "month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "quarter":
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        break;
      case "year":
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case "last_month":
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      default:
        return;
    }

    setFilters((prev) => ({
      ...prev,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      preset,
    }));
  }, []);

  const setDateRange = useCallback((start: Date, end: Date) => {
    setFilters((prev) => ({
      ...prev,
      startDate: startOfDay(start).toISOString(),
      endDate: endOfDay(end).toISOString(),
      preset: "custom",
    }));
  }, []);

  const setUserId = useCallback((userId: string) => {
    setFilters((prev) => ({ ...prev, userId }));
  }, []);

  const setStageId = useCallback((stageId: string) => {
    setFilters((prev) => ({ ...prev, stageId }));
  }, []);

  const setProductId = useCallback((productId: string) => {
    setFilters((prev) => ({ ...prev, productId }));
  }, []);

  const setPipelineId = useCallback((pipelineId: string) => {
    setFilters((prev) => ({ ...prev, pipelineId }));
  }, []);

  const getDateRangeLabel = useCallback(() => {
    const presetLabels: Record<DatePreset, string> = {
      today: "Hoje",
      week: "Esta Semana",
      month: "Este Mês",
      quarter: "Este Trimestre",
      year: "Este Ano",
      last_month: "Mês Passado",
      custom: "Personalizado",
    };

    if (filters.preset !== "custom") {
      return presetLabels[filters.preset];
    }

    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    return `${format(start, "dd/MM/yy", { locale: ptBR })} - ${format(end, "dd/MM/yy", { locale: ptBR })}`;
  }, [filters.preset, filters.startDate, filters.endDate]);

  const resetFilters = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

  const setAccountIdOverride = useCallback((accountId: string) => {
    setFilters((prev) => ({ ...prev, accountIdOverride: accountId }));
  }, []);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      setPreset,
      setDateRange,
      setUserId,
      setStageId,
      setProductId,
      setPipelineId,
      getDateRangeLabel,
      resetFilters,
      setAccountIdOverride,
    }),
    [filters, setPreset, setDateRange, setUserId, setStageId, setProductId, setPipelineId, getDateRangeLabel, resetFilters, setAccountIdOverride]
  );

  return (
    <InsightsFiltersContext.Provider value={value}>
      {children}
    </InsightsFiltersContext.Provider>
  );
}

const fallbackFilters: InsightsFilters = getDefaultFilters();

const fallbackContext: InsightsFiltersContextType = {
  filters: fallbackFilters,
  setFilters: () => {},
  setPreset: () => {},
  setDateRange: () => {},
  setUserId: () => {},
  setStageId: () => {},
  setProductId: () => {},
  setPipelineId: () => {},
  getDateRangeLabel: () => "Este Ano",
  resetFilters: () => {},
  setAccountIdOverride: () => {},
};

export function useInsightsFilters() {
  const context = useContext(InsightsFiltersContext);
  if (!context) {
    return fallbackContext;
  }
  return context;
}
