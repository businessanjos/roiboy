import { createContext, useContext, useMemo, ReactNode } from "react";

export interface TvModeValue {
  /** Estamos renderizando dentro de um palco de TV (leitura à distância). */
  tv: boolean;
  /** Multiplicador aplicado a fontes, avatares e alturas de barra. */
  scale: number;
  /** Máximo de categorias exibidas antes de agrupar em "Outros". */
  maxCategories: number;
  /** Palco renderizado pequeno: densidade reduzida para continuar legível. */
  compact: boolean;
}

const DEFAULT_TV_MODE: TvModeValue = { tv: false, scale: 1, maxCategories: 0, compact: false };

const TvModeContext = createContext<TvModeValue>(DEFAULT_TV_MODE);

interface TvModeProviderProps {
  children: ReactNode;
  scale?: number;
  maxCategories?: number;
  enabled?: boolean;
  compact?: boolean;
}

export function TvModeProvider({
  children,
  scale = 1.45,
  maxCategories = 12,
  enabled = true,
  compact = false,
}: TvModeProviderProps) {
  const value = useMemo<TvModeValue>(
    () => (enabled ? { tv: true, scale, maxCategories, compact } : DEFAULT_TV_MODE),
    [enabled, scale, maxCategories, compact]
  );
  return <TvModeContext.Provider value={value}>{children}</TvModeContext.Provider>;
}

export function useTvMode(): TvModeValue {
  return useContext(TvModeContext);
}

/**
 * Multiplicador final de fonte: escala configurada no visual × escala do modo TV.
 */
export function useTvFontScale(baseMultiplier: number): number {
  const { scale } = useTvMode();
  return baseMultiplier * scale;
}
