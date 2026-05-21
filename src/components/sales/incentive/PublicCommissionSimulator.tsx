import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Trophy, Zap, DollarSign, TrendingUp } from "lucide-react";

const fmt = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const QUOTA = 8; // 100% da meta = 8 vendas
const QUARTERLY_THRESHOLD = 100;
const ANNUAL_THRESHOLD = 90;

interface Tier {
  id: string;
  label: string | null;
  min_achievement_percent: number;
  max_achievement_percent: number | null;
  bonus_multiplier: number;
}

interface Plan {
  bonus_base_value: number;
  uncapped_bonus_enabled: boolean;
  uncapped_threshold_percent: number;
  uncapped_bonus_per_sale: number;
  quarterly_bonus_enabled: boolean;
  quarterly_bonus_value: number;
  annual_bonus_enabled: boolean;
  annual_bonus_value: number;
}

export function PublicCommissionSimulator({
  plan,
  tiers,
}: {
  plan: Plan;
  tiers: Tier[];
}) {
  const [sales, setSales] = useState(8);
  const [baseSalary, setBaseSalary] = useState(3000);

  const sortedTiers = useMemo(
    () =>
      [...tiers].sort(
        (a, b) => Number(a.min_achievement_percent) - Number(b.min_achievement_percent),
      ),
    [tiers],
  );

  const sim = useMemo(() => {
    const pct = (sales / QUOTA) * 100;
    let activeTier = sortedTiers
      .slice()
      .reverse()
      .find(
        (t) =>
          pct >= Number(t.min_achievement_percent) &&
          (t.max_achievement_percent == null || pct <= Number(t.max_achievement_percent)),
      );
    const topTier = sortedTiers[sortedTiers.length - 1];
    if (!activeTier && topTier) activeTier = topTier;

    const bonusBase = Number(plan.bonus_base_value) || 0;
    const multiplier = activeTier ? Number(activeTier.bonus_multiplier) : 0;
    const tierBonus = bonusBase * multiplier;

    // Sem teto: por venda inteira acima do limite
    const salesAtThreshold = Math.round(
      (QUOTA * Number(plan.uncapped_threshold_percent || 0)) / 100,
    );
    const extra = Math.max(0, sales - salesAtThreshold);
    const uncapped = plan.uncapped_bonus_enabled
      ? extra * Number(plan.uncapped_bonus_per_sale || 0)
      : 0;

    const quarterly =
      plan.quarterly_bonus_enabled && pct >= QUARTERLY_THRESHOLD
        ? Number(plan.quarterly_bonus_value || 0)
        : 0;
    const annual =
      plan.annual_bonus_enabled && pct >= ANNUAL_THRESHOLD
        ? Number(plan.annual_bonus_value || 0)
        : 0;

    const total = baseSalary + tierBonus + uncapped;

    return {
      pct,
      activeTier,
      tierBonus,
      uncapped,
      extra,
      salesAtThreshold,
      quarterly,
      annual,
      total,
      totalWithComplementary: total + quarterly + annual,
    };
  }, [sales, baseSalary, sortedTiers, plan]);

  return (
    <Card className="p-6 space-y-6 bg-white border-slate-200 shadow-sm">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-amber-600" />
        <div>
          <h3 className="text-lg font-bold text-slate-900">Simulador</h3>
          <p className="text-sm text-slate-600">
            Ajuste o nº de vendas e o salário para simular ganhos mensais.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-700">
              Nº de vendas no mês:{" "}
              <span className="font-bold text-slate-900">{sales}</span>
            </Label>
            <Badge variant="outline" className="text-xs border-slate-300 text-slate-700 bg-white">
              {Math.round(sim.pct)}% da meta
            </Badge>
          </div>
          <Slider
            value={[sales]}
            onValueChange={([v]) => setSales(v)}
            min={0}
            max={20}
            step={1}
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0</span>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700">Salário base mensal (R$)</Label>
          <Input
            type="number"
            min={0}
            step={500}
            value={baseSalary}
            onChange={(e) => setBaseSalary(Number(e.target.value || 0))}
            className="text-slate-900 bg-white border-slate-300 placeholder:text-slate-400"
          />
          <p className="text-[11px] text-slate-500">
            Valor ilustrativo — substitua pelo CLT real do vendedor.
          </p>
        </div>
      </div>


      {/* Quick buttons */}
      <div className="flex flex-wrap gap-2">
        {[4, 6, 8, 9, 10, 11, 12, 15].map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={sales === n ? "default" : "outline"}
            onClick={() => setSales(n)}
            className="h-7 px-2.5 text-xs"
          >
            {n} vendas
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Faixa" value={sim.activeTier?.label ?? "—"} accent="text-slate-900" big />
        <Metric label="Salário" value={fmt(baseSalary)} icon={DollarSign} />
        <Metric
          label="Bônus de Faixa"
          value={fmt(sim.tierBonus)}
          icon={TrendingUp}
          accent="text-emerald-600"
        />
        <Metric
          label={`Sem Teto (${sim.extra} venda${sim.extra === 1 ? "" : "s"} extra)`}
          value={fmt(sim.uncapped)}
          icon={Zap}
          accent="text-amber-600"
        />
      </div>

      <div className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white p-5 shadow-lg">
        <p className="text-xs uppercase tracking-wider opacity-90">
          Ganho mensal bruto estimado
        </p>
        <p className="text-5xl font-black tabular-nums mt-1">{fmt(sim.total)}</p>
        <p className="text-xs opacity-90 mt-2">
          Não inclui SPIFFs, roletas ou bônus complementares.
        </p>
      </div>

      {(plan.quarterly_bonus_enabled || plan.annual_bonus_enabled) && (
        <div className="grid md:grid-cols-2 gap-3">
          {plan.quarterly_bonus_enabled && (
            <Card className="p-4 bg-cyan-50 border-cyan-200">
              <div className="flex items-center gap-2 text-cyan-700 text-xs uppercase tracking-wide font-semibold">
                <Trophy className="h-4 w-4" /> Bônus Trimestral
              </div>
              <p className="text-2xl font-black text-cyan-900 mt-1">
                {fmt(sim.quarterly)}
              </p>
              <p className="text-[11px] text-cyan-700/70">
                Pago se atingir {QUARTERLY_THRESHOLD}% da meta no trimestre.
              </p>
            </Card>
          )}
          {plan.annual_bonus_enabled && (
            <Card className="p-4 bg-fuchsia-50 border-fuchsia-200">
              <div className="flex items-center gap-2 text-fuchsia-700 text-xs uppercase tracking-wide font-semibold">
                <Trophy className="h-4 w-4" /> Bônus Anual
              </div>
              <p className="text-2xl font-black text-fuchsia-900 mt-1">
                {fmt(sim.annual)}
              </p>
              <p className="text-[11px] text-fuchsia-700/70">
                Pago se atingir {ANNUAL_THRESHOLD}% da meta acumulada anual.
              </p>
            </Card>
          )}
        </div>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  accent = "text-slate-900",
  big = false,
}: {
  label: string;
  value: string;
  icon?: any;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <p className={`${big ? "text-xl" : "text-lg"} font-black ${accent} mt-1 tabular-nums`}>
        {value}
      </p>
    </div>
  );
}
