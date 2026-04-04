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

export type DatePreset = "today" | "week" | "month" | "quarter" | "year" | "last_month" | "custom";

export interface InsightsFilters {
  startDate: string;
  endDate: string;
  userId: string;
  stageId: string;
  productId: string;
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
      getDateRangeLabel,
      resetFilters,
      setAccountIdOverride,
    }),
    [filters, setPreset, setDateRange, setUserId, setStageId, setProductId, getDateRangeLabel, resetFilters, setAccountIdOverride]
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
