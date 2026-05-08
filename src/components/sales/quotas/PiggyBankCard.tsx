import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

interface PiggyBankCardProps {
  value: number;
  salesCount: number;
  loading?: boolean;
}

// Mood escalonado por NÚMERO DE VENDAS no mês
const TIERS = [
  { min: 0, label: "MUITO PUTO",       emoji: "🐷", scale: 1.18, glow: "drop-shadow(0 0 22px rgba(239,68,68,0.95)) hue-rotate(-30deg) saturate(2.4) brightness(0.9)",  anger: 3 },
  { min: 1, label: "Puto",             emoji: "🐷", scale: 1.12, glow: "drop-shadow(0 0 16px rgba(239,68,68,0.7)) hue-rotate(-20deg) saturate(1.8) brightness(0.95)", anger: 2 },
  { min: 2, label: "Decepcionado",     emoji: "😒🐷", scale: 1.05, glow: "drop-shadow(0 0 10px rgba(148,163,184,0.5)) saturate(0.7)", anger: 0 },
  { min: 3, label: "Triste",           emoji: "😢🐷", scale: 1.02, glow: "drop-shadow(0 0 10px rgba(96,165,250,0.55))", anger: 0 },
  { min: 4, label: "Ok",               emoji: "🐷",   scale: 1.0,  glow: "drop-shadow(0 0 8px rgba(148,163,184,0.4))", anger: 0 },
  { min: 5, label: "Esperançoso",      emoji: "🤞🐷", scale: 1.05, glow: "drop-shadow(0 0 12px rgba(125,211,252,0.55))", anger: 0 },
  { min: 6, label: "Animado",          emoji: "🐽",   scale: 1.08, glow: "drop-shadow(0 0 14px rgba(244,114,182,0.55))", anger: 0 },
  { min: 7, label: "Feliz",            emoji: "😊🐷", scale: 1.12, glow: "drop-shadow(0 0 18px rgba(244,114,182,0.6))", anger: 0 },
  { min: 8, label: "Muito feliz",      emoji: "🥰🐷", scale: 1.20, glow: "drop-shadow(0 0 24px rgba(251,191,36,0.7))", anger: 0 },
  { min: 9, label: "HIPER MEGA BLASTER", emoji: "🤩🐷👑", scale: 1.32, glow: "drop-shadow(0 0 36px rgba(234,179,8,0.9))", anger: 0 },
] as const;

function getTier(salesCount: number) {
  let t = TIERS[0];
  for (const tier of TIERS) if (salesCount >= tier.min) t = tier;
  return t;
}

function nextTier(salesCount: number) {
  for (const tier of TIERS) if (tier.min > salesCount) return tier;
  return null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function PiggyBankCard({ value, salesCount, loading }: PiggyBankCardProps) {
  const tier = getTier(salesCount);
  const next = nextTier(salesCount);
  const remaining = next ? next.min - salesCount : 0;
  const isAngry = tier.anger > 0;
  const isMaxAngry = tier.anger >= 3;

  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-pink-500" />
          Cofrinho de Bônus & SPIFFs
        </CardTitle>
        <CardDescription>
          Quanto mais vendas você fecha, mais feliz seu porquinho fica 🐷
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="flex flex-col items-center justify-center py-2">
          {/* Piggy */}
          <div className="relative">
            {isAngry && (
              <>
                <span className="absolute -top-1 -left-3 text-2xl animate-pulse">💢</span>
                <span className="absolute -top-2 -right-3 text-2xl animate-pulse">💢</span>
                {isMaxAngry && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xl animate-pulse">💢</span>
                )}
              </>
            )}
            <div
              className={cn(
                "text-7xl select-none transition-all duration-700 ease-out",
                isAngry
                  ? "animate-angry-shake"
                  : "animate-[bounce_2.4s_ease-in-out_infinite]",
              )}
              style={{
                transform: `scale(${tier.scale})`,
                filter: tier.glow,
              }}
              aria-label={`Porquinho ${tier.label}`}
            >
              {tier.emoji}
            </div>
          </div>

          {/* Sales count + value */}
          <div className="mt-4 text-center space-y-1">
            {loading ? (
              <div className="h-9 w-32 bg-muted animate-pulse rounded mx-auto" />
            ) : (
              <>
                <div className="text-3xl font-bold tabular-nums bg-gradient-to-r from-pink-500 via-amber-500 to-emerald-500 bg-clip-text text-transparent">
                  {salesCount} {salesCount === 1 ? "venda" : "vendas"}
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  Cofrinho: <span className="font-semibold text-foreground">{fmtBRL(value)}</span>
                </p>
              </>
            )}
            <p
              className={cn(
                "text-xs mt-1 font-medium",
                isMaxAngry
                  ? "text-red-600 dark:text-red-400"
                  : isAngry
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-muted-foreground",
              )}
            >
              {isMaxAngry
                ? "🔥 Porquinho MUITO PUTO! 🔥"
                : `Porquinho ${tier.label}`}
            </p>
          </div>

          {/* Progress to next tier */}
          {next && !loading && (
            <div className="w-full mt-5 space-y-1.5">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-400 to-amber-400 transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (salesCount / next.min) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                {remaining === 1 ? "Falta " : "Faltam "}
                <span className="font-semibold text-foreground">
                  {remaining} {remaining === 1 ? "venda" : "vendas"}
                </span>{" "}
                para deixar o porquinho{" "}
                <span className="font-semibold">{next.label}</span>
              </p>
            </div>
          )}
          {!next && !loading && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-4 font-medium text-center">
              👑 Nível máximo desbloqueado!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
