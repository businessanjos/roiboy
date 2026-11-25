import { useMemo } from "react";
import { useAccelerometerSales } from "./useAccelerometerSales";
import type { AccelerometerScope } from "@/lib/sales/accelerometer";

export type TierKey =
  | "Latão"
  | "Níquel"
  | "Bronze"
  | "Prata"
  | "Ouro"
  | "Platinum"
  | "Diamond"
  | "Black"
  | "Elite";

export type TierDef = {
  key: TierKey;
  label: string;
  minSales: number;
  /** Tailwind gradient `from-x to-y [via-z]` (used for backgrounds) */
  gradient: string;
  /** Solid accent color for borders / text glow */
  accent: string;
  /** Soft page-background overlay */
  pageBg: string;
  emoji: string;
};

// Tier ladder: Latão (0–3 vendas, sem bônus). A partir de 4 vendas começa Níquel,
// e cada venda adicional sobe um nível. Closer cota = 8 vendas (Platinum).
export const TIER_LADDER: TierDef[] = [
  {
    key: "Latão",
    label: "Latão",
    minSales: 0,
    gradient: "from-amber-700 to-yellow-900",
    accent: "text-amber-200",
    pageBg: "from-amber-50/60 via-background to-background dark:from-amber-950/30 dark:via-background dark:to-background",
    emoji: "🟫",
  },
  {
    key: "Níquel",
    label: "Níquel",
    minSales: 4,
    gradient: "from-slate-400 to-slate-600",
    accent: "text-slate-100",
    pageBg: "from-slate-100/70 via-background to-background dark:from-slate-800/40 dark:via-background dark:to-background",
    emoji: "⚙️",
  },
  {
    key: "Bronze",
    label: "Bronze",
    minSales: 5,
    gradient: "from-orange-600 to-amber-800",
    accent: "text-orange-100",
    pageBg: "from-orange-50/70 via-background to-background dark:from-orange-950/30 dark:via-background dark:to-background",
    emoji: "🥉",
  },
  {
    key: "Prata",
    label: "Prata",
    minSales: 6,
    gradient: "from-slate-300 to-slate-500",
    accent: "text-white",
    pageBg: "from-slate-100/80 via-background to-background dark:from-slate-700/30 dark:via-background dark:to-background",
    emoji: "🥈",
  },
  {
    key: "Ouro",
    label: "Ouro",
    minSales: 7,
    gradient: "from-yellow-300 via-amber-400 to-amber-600",
    accent: "text-amber-950",
    pageBg: "from-amber-100/80 via-background to-background dark:from-amber-900/30 dark:via-background dark:to-background",
    emoji: "🥇",
  },
  {
    key: "Platinum",
    label: "Platinum",
    minSales: 8,
    gradient: "from-cyan-200 via-sky-300 to-blue-500",
    accent: "text-blue-950",
    pageBg: "from-sky-100/80 via-background to-background dark:from-sky-900/30 dark:via-background dark:to-background",
    emoji: "💠",
  },
  {
    key: "Diamond",
    label: "Diamond",
    minSales: 9,
    gradient: "from-sky-300 via-indigo-400 to-violet-600",
    accent: "text-white",
    pageBg: "from-indigo-100/80 via-background to-background dark:from-indigo-900/30 dark:via-background dark:to-background",
    emoji: "💎",
  },
  {
    key: "Black",
    label: "Black",
    minSales: 10,
    gradient: "from-zinc-800 via-zinc-900 to-black",
    accent: "text-amber-300",
    pageBg: "from-zinc-100 via-background to-background dark:from-zinc-900 dark:via-background dark:to-background",
    emoji: "🖤",
  },
  {
    key: "Elite",
    label: "Elite",
    minSales: 11,
    gradient: "from-fuchsia-500 via-purple-600 to-indigo-700",
    accent: "text-white",
    pageBg: "from-fuchsia-100/80 via-background to-background dark:from-fuchsia-950/40 dark:via-background dark:to-background",
    emoji: "👑",
  },
];

export function tierForSales(sales: number): TierDef {
  let current = TIER_LADDER[0];
  for (const t of TIER_LADDER) {
    if (sales >= t.minSales) current = t;
  }
  return current;
}

export function nextTier(current: TierDef): TierDef | null {
  const idx = TIER_LADDER.findIndex((t) => t.key === current.key);
  return idx >= 0 && idx < TIER_LADDER.length - 1 ? TIER_LADDER[idx + 1] : null;
}

/**
 * Returns the user's current tier based on won deals in the current month.
 * Counts deals where the user is the responsible_user_id (closer).
 */
export function useUserMonthlyTier(year?: number, month?: number, userIdOverride?: string, scope: AccelerometerScope = "mentorias") {

  const { start, end, monthLabel } = useMemo(() => {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth();
    const s = new Date(y, m, 1);
    const e = new Date(y, m + 1, 1);
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      monthLabel: s.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    };
  }, [year, month]);

  const selected = new Date(start);
  const q = useAccelerometerSales(selected.getFullYear(), selected.getMonth(), userIdOverride, scope);
  const sales = q.sales;
  const tier = tierForSales(sales);
  const next = nextTier(tier);

  return {
    ...q,
    sales,
    tier,
    nextTier: next,
    salesToNext: next ? Math.max(0, next.minSales - sales) : 0,
    isLoading: q.isLoading,
    monthLabel,
  };
}
