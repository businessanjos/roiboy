import { useQuery } from "@tanstack/react-query";

/**
 * Cotação do dia entre uma moeda estrangeira e o BRL.
 * Fonte: AwesomeAPI (gratuita, sem chave). Ex.: USD-BRL, EUR-BRL.
 *
 * Retorna a quantidade de BRL equivalente a 1 unidade da moeda informada.
 * Ex.: USD → ~5.20 (1 USD = 5,20 BRL)
 *
 * Para BRL → BRL retorna 1 sem chamar a API.
 */
export function useExchangeRate(currencyCode: string | null | undefined) {
  const code = (currencyCode || "BRL").toUpperCase();

  return useQuery({
    queryKey: ["exchange-rate", code, "BRL"],
    enabled: !!code,
    staleTime: 1000 * 60 * 60, // 1h
    queryFn: async (): Promise<{ rate: number; updatedAt: string }> => {
      if (code === "BRL") return { rate: 1, updatedAt: new Date().toISOString() };
      try {
        const res = await fetch(`https://economia.awesomeapi.com.br/last/${code}-BRL`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const key = `${code}BRL`;
        const item = json?.[key];
        const rate = Number(item?.bid || item?.ask);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("invalid rate");
        return { rate, updatedAt: item?.create_date || new Date().toISOString() };
      } catch (err) {
        console.warn(`Falha ao buscar cotação ${code}-BRL:`, err);
        return { rate: 0, updatedAt: new Date().toISOString() };
      }
    },
  });
}

export const formatBRL = (value: number): string =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const formatCurrency = (value: number, currency: string): string => {
  try {
    return value.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return `${currency} ${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }
};
