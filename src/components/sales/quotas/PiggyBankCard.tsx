import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

interface PiggyBankCardProps {
  value: number;
  loading?: boolean;
}

const TIERS = [
  { min: 0, label: "Vazio", emoji: "🐷", mood: "neutro", scale: 1.0, glow: "" },
  { min: 1, label: "Animado", emoji: "🐽", mood: "animado", scale: 1.05, glow: "drop-shadow(0 0 12px rgba(244,114,182,0.45))" },
  { min: 500, label: "Feliz", emoji: "😊🐷", mood: "feliz", scale: 1.1, glow: "drop-shadow(0 0 18px rgba(244,114,182,0.55))" },
  { min: 1500, label: "Empolgado", emoji: "🤩🐷", mood: "empolgado", scale: 1.18, glow: "drop-shadow(0 0 24px rgba(251,191,36,0.6))" },
  { min: 3000, label: "Eufórico", emoji: "🥳🐷", mood: "eufórico", scale: 1.25, glow: "drop-shadow(0 0 30px rgba(34,197,94,0.65))" },
  { min: 6000, label: "RICO!", emoji: "💰🐷👑", mood: "rico", scale: 1.32, glow: "drop-shadow(0 0 36px rgba(234,179,8,0.85))" },
];

function getTier(v: number) {
  let t = TIERS[0];
  for (const tier of TIERS) if (v >= tier.min) t = tier;
  return t;
}

function nextTier(v: number) {
  for (const tier of TIERS) if (tier.min > v) return tier;
  return null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function PiggyBankCard({ value, loading }: PiggyBankCardProps) {
  const tier = getTier(value);
  const next = nextTier(value);
  const remaining = next ? next.min - value : 0;

  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-pink-500" />
          Cofrinho de Bônus & SPIFFs
        </CardTitle>
        <CardDescription>
          Quanto mais você fecha, mais feliz seu porquinho fica 🐷
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="flex flex-col items-center justify-center py-2">
          {/* Piggy */}
          <div
            className={cn(
              "text-7xl select-none transition-all duration-700 ease-out",
              value > 0 && "animate-[bounce_2.4s_ease-in-out_infinite]",
            )}
            style={{
              transform: `scale(${tier.scale})`,
              filter: tier.glow,
            }}
            aria-label={`Porquinho ${tier.mood}`}
          >
            {tier.emoji}
          </div>

          {/* Value */}
          <div className="mt-4 text-center">
            {loading ? (
              <div className="h-9 w-32 bg-muted animate-pulse rounded mx-auto" />
            ) : (
              <div className="text-3xl font-bold tabular-nums bg-gradient-to-r from-pink-500 via-amber-500 to-emerald-500 bg-clip-text text-transparent">
                {fmtBRL(value)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {tier.mood === "neutro" ? "Cofrinho ainda vazio" : `Porquinho ${tier.mood}`}
            </p>
          </div>

          {/* Progress to next tier */}
          {next && !loading && (
            <div className="w-full mt-5 space-y-1.5">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-400 to-amber-400 transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (value / next.min) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Faltam <span className="font-semibold text-foreground">{fmtBRL(remaining)}</span> para deixar o porquinho{" "}
                <span className="font-semibold capitalize">{next.mood}</span>
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
