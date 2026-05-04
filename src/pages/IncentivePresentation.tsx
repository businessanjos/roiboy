import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CommissionSimulator } from "@/components/sales/quotas/CommissionSimulator";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Trophy,
  Target,
  Zap,
  Gift,
  TrendingUp,
  DollarSign,
  Sparkles,
  Rocket,
  Crown,
  Calculator,
  ShieldAlert,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmtBRL = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Closer: 100% da meta = 8 vendas no mês. Sempre falamos em nº de vendas.
const SALES_AT_QUOTA = 8;
const pctToSales = (pct: number) => Math.round((Number(pct) / 100) * SALES_AT_QUOTA);
const fmtSales = (n: number) => `${n} ${n === 1 ? "venda" : "vendas"}`;

const TIER_COLORS: Record<string, string> = {
  Latão: "from-zinc-500 to-zinc-700",
  Níquel: "from-slate-400 to-slate-600",
  Bronze: "from-orange-700 to-amber-800",
  Prata: "from-slate-300 to-slate-500",
  Ouro: "from-yellow-400 to-amber-500",
  Platinum: "from-cyan-300 to-blue-500",
  Diamond: "from-sky-300 to-indigo-500",
  Black: "from-zinc-800 to-black",
  Elite: "from-fuchsia-500 via-purple-600 to-indigo-700",
};

export default function IncentivePresentation() {
  const navigate = useNavigate();
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { plans, tiers } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);

  // Resolve plan: Plano Executivo de Vendas (or first active sales plan)
  const { data: salesPositionIds = [] } = useQuery({
    queryKey: ["incentive-pres-positions", accountId],
    queryFn: async () => {
      const { data: depts } = await supabase
        .from("hr_departments")
        .select("id, name")
        .eq("account_id", accountId!);
      const ids = (depts ?? [])
        .filter((d) => /comercial|vendas|sales/i.test(d.name))
        .map((d) => d.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("hr_positions")
        .select("id")
        .in("department_id", ids);
      return (data ?? []).map((p) => p.id);
    },
    enabled: !!accountId,
  });

  const plan = useMemo(
    () =>
      plans.find(
        (p) => p.is_active && p.position_id && salesPositionIds.includes(p.position_id),
      ) ?? null,
    [plans, salesPositionIds],
  );

  const planTiers = useMemo(
    () =>
      [...tiers.filter((t) => plan && t.plan_id === plan.id)].sort(
        (a, b) => Number(a.min_achievement_percent) - Number(b.min_achievement_percent),
      ),
    [tiers, plan],
  );

  const [step, setStep] = useState(0);

  const slides = useMemo(
    () => [
      { id: "intro", render: () => <SlideIntro /> },
      { id: "why", render: () => <SlideWhy /> },
      { id: "components", render: () => <SlideComponents plan={plan} /> },
      { id: "tiers", render: () => <SlideTiers tiers={planTiers} bonusBase={Number(plan?.bonus_base_value || 0)} /> },
      { id: "uncapped", render: () => <SlideUncapped plan={plan} /> },
      { id: "complementares", render: () => <SlideExtras plan={plan} /> },
      { id: "exemplo", render: () => <SlideExample tiers={planTiers} plan={plan} /> },
      { id: "calc", render: () => <SlideCalculator /> },
    ],
    [plan, planTiers],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        navigate("/sales-team");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, navigate]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Plano de Incentivo Comercial · 2026
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 tabular-nums">
            {step + 1} / {slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/sales-team")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Slide */}
      <div className="flex-1 overflow-auto">
        <div className="min-h-full flex items-stretch justify-center px-6 py-8">
          <div className="w-full max-w-6xl">{slides[step].render()}</div>
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-white/5">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={step === 0}
          className="text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-8 bg-amber-400" : "w-1.5 bg-white/20 hover:bg-white/40",
              )}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <Button
          onClick={next}
          disabled={step === slides.length - 1}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold disabled:opacity-30"
        >
          Próximo <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ----------------------- SLIDES ----------------------- */

function SlideIntro() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-16">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs uppercase tracking-[0.3em]">
        <Flame className="h-3.5 w-3.5" /> Novo Plano · Em vigor agora
      </div>
      <h1 className="text-6xl md:text-7xl font-black leading-tight">
        Quanto <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">você quer</span>
        <br />
        ganhar este mês?
      </h1>
      <p className="text-xl md:text-2xl text-slate-300 max-w-2xl">
        Um plano feito pra recompensar quem entrega <strong className="text-white">resultado de verdade</strong>.
        Sem teto. Sem desculpa.
      </p>
      <p className="text-sm text-slate-500 mt-12">
        Use as setas <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-xs">←</kbd>{" "}
        <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-xs">→</kbd> para navegar
      </p>
    </div>
  );
}

function SlideWhy() {
  const cards = [
    {
      icon: Target,
      title: "Meta clara",
      text: "Você sabe exatamente onde mira e quanto cada faixa paga.",
    },
    {
      icon: Rocket,
      title: "Aceleradores reais",
      text: "Bater 8 vendas paga bem. Bater 11 paga MUITO bem.",
    },
    {
      icon: Crown,
      title: "Sem teto",
      text: "Estourou as 8 vendas? Cada venda extra continua pagando bônus.",
    },
  ];
  return (
    <div className="space-y-12 py-8">
      <div>
        <p className="text-amber-400 text-sm uppercase tracking-[0.3em] mb-3">Por quê?</p>
        <h2 className="text-5xl font-black leading-tight">
          Mais simples, mais agressivo,
          <br />
          mais <span className="text-amber-400">seu</span>.
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {cards.map((c) => (
          <Card
            key={c.title}
            className="bg-white/5 border-white/10 backdrop-blur p-6 space-y-3 text-slate-100"
          >
            <div className="h-10 w-10 rounded-lg bg-amber-400/15 flex items-center justify-center">
              <c.icon className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold">{c.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlideComponents({ plan }: { plan: any }) {
  const items = [
    {
      icon: DollarSign,
      label: "Salário Base (CLT)",
      value: "Garantido todo mês",
      color: "text-slate-300",
    },
    {
      icon: TrendingUp,
      label: "Bônus de Faixa",
      value: `Até ${fmtBRL(Number(plan?.bonus_base_value || 0) * 2.1)} no Elite`,
      color: "text-emerald-400",
    },
    {
      icon: Zap,
      label: "Bônus Sem Teto",
      value: `${fmtBRL(Number(plan?.uncapped_bonus_per_sale || 0))} por venda extra`,
      color: "text-amber-400",
    },
    {
      icon: Gift,
      label: "SPIFFs & Roletas",
      value: "Campanhas relâmpago",
      color: "text-pink-400",
    },
    {
      icon: Trophy,
      label: "Bônus Trimestral",
      value: fmtBRL(Number(plan?.quarterly_bonus_value || 0)),
      color: "text-cyan-400",
    },
    {
      icon: Crown,
      label: "Bônus Anual",
      value: fmtBRL(Number(plan?.annual_bonus_value || 0)),
      color: "text-fuchsia-400",
    },
  ];
  return (
    <div className="space-y-10 py-8">
      <div>
        <p className="text-amber-400 text-sm uppercase tracking-[0.3em] mb-3">Como você ganha</p>
        <h2 className="text-5xl font-black">6 fontes de renda</h2>
        <p className="text-slate-400 mt-2 text-lg">Tudo soma no seu contracheque.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center">
                <it.icon className={cn("h-4.5 w-4.5", it.color)} />
              </div>
              <span className="text-xs uppercase tracking-wider text-slate-400">{it.label}</span>
            </div>
            <p className={cn("text-xl font-bold", it.color)}>{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideTiers({ tiers, bonusBase }: { tiers: any[]; bonusBase: number }) {
  return (
    <div className="space-y-8 py-6">
      <div>
        <p className="text-amber-400 text-sm uppercase tracking-[0.3em] mb-3">Faixas de Bônus</p>
        <h2 className="text-5xl font-black">Quanto mais entrega, mais ganha</h2>
        <p className="text-slate-400 mt-2">
          Base do bônus: <strong className="text-white">{fmtBRL(bonusBase)}</strong> · multiplicado pela sua faixa.
        </p>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-9 gap-2.5">
        {tiers.map((t) => {
          const grad = TIER_COLORS[t.label] || "from-slate-600 to-slate-800";
          const value = bonusBase * Number(t.bonus_multiplier);
          return (
            <div
              key={t.id || t.label}
              className={cn(
                "rounded-xl p-3 bg-gradient-to-br text-white shadow-lg flex flex-col justify-between min-h-[150px]",
                grad,
              )}
            >
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-80">
                  {pctToSales(Number(t.min_achievement_percent))}{t.max_achievement_percent ? `–${pctToSales(Number(t.max_achievement_percent))}` : "+"} vendas
                </p>
                <p className="text-base font-black mt-1 leading-tight">{t.label}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-75">Bônus</p>
                <p className="text-lg font-black tabular-nums">
                  {value > 0 ? fmtBRL(value) : "—"}
                </p>
                <p className="text-[10px] opacity-75 mt-0.5">{Number(t.bonus_multiplier)}x</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-sm text-slate-400 italic">
        💡 Fechou <strong className="text-white">8 vendas = Platinum</strong>. A partir daí o jogo só fica melhor.
      </div>
    </div>
  );
}

function SlideUncapped({ plan }: { plan: any }) {
  const threshold = Number(plan?.uncapped_threshold_percent || 0);
  const perSale = Number(plan?.uncapped_bonus_per_sale || 0);
  return (
    <div className="space-y-10 py-8">
      <div>
        <p className="text-amber-400 text-sm uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" /> O Acelerador
        </p>
        <h2 className="text-5xl font-black">
          Bônus <span className="text-amber-400">Sem Teto</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-amber-600 to-orange-700 border-amber-400/50 p-8 text-white space-y-4 shadow-xl">
          <p className="text-sm uppercase tracking-wider text-amber-100 font-semibold">A regra é simples</p>
          <p className="text-2xl leading-snug text-white">
            A partir da <strong className="text-yellow-200 text-3xl">{pctToSales(threshold)}ª venda</strong> do mês,
            <br />
            <strong className="text-white">cada venda extra</strong> paga
          </p>
          <p className="text-6xl font-black text-white drop-shadow-lg">
            {fmtBRL(perSale)}
          </p>
          <p className="text-sm text-amber-50">por venda inteira fechada acima do limite.</p>
        </Card>
        <div className="space-y-4">
          <Card className="bg-white/5 border-white/10 p-6 text-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Exemplo prático</p>
            <p className="text-base leading-relaxed text-slate-200">
              Bateu <strong className="text-amber-400">3 vendas extras</strong> acima do limite?
            </p>
            <p className="text-3xl font-black mt-3 text-emerald-400">
              + {fmtBRL(perSale * 3)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              somados ao seu salário, faixa, spiffs e bônus complementares.
            </p>
          </Card>
          <Card className="bg-white/5 border-white/10 p-6 text-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Por que isso muda o jogo?</p>
            <p className="text-base text-slate-200 leading-relaxed">
              Em planos antigos, depois da meta o esforço extra valia pouco.
              <br />
              <strong className="text-white">Aqui, vendedor topo de linha leva muito mais pra casa.</strong>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SlideExtras({ plan }: { plan: any }) {
  return (
    <div className="space-y-10 py-8">
      <div>
        <p className="text-amber-400 text-sm uppercase tracking-[0.3em] mb-3">Bônus Complementares</p>
        <h2 className="text-5xl font-black">Quem mantém constância, ganha mais</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-cyan-600 to-blue-700 border-cyan-400/50 p-8 text-white space-y-3 shadow-xl">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-cyan-100" />
            <p className="text-sm uppercase tracking-wider text-cyan-100 font-semibold">Trimestral</p>
          </div>
          <p className="text-5xl font-black text-white">{fmtBRL(Number(plan?.quarterly_bonus_value || 0))}</p>
          <p className="text-cyan-50">
            Pago no fechamento do trimestre se você bater <strong className="text-white">a meta de vendas</strong> no período.
          </p>
        </Card>
        <Card className="bg-gradient-to-br from-fuchsia-600 to-purple-700 border-fuchsia-400/50 p-8 text-white space-y-3 shadow-xl">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-fuchsia-100" />
            <p className="text-sm uppercase tracking-wider text-fuchsia-100 font-semibold">Anual</p>
          </div>
          <p className="text-5xl font-black text-white">{fmtBRL(Number(plan?.annual_bonus_value || 0))}</p>
          <p className="text-fuchsia-50">
            Pago no fechamento do ano se você atingir <strong className="text-white">90%+</strong> da meta anual.
          </p>
        </Card>
      </div>
      <Card className="bg-gradient-to-r from-pink-600 to-rose-600 border-pink-400/50 p-6 text-white shadow-xl">
        <div className="flex items-start gap-4">
          <Gift className="h-6 w-6 text-pink-100 flex-shrink-0 mt-1" />
          <div>
            <p className="text-sm uppercase tracking-wider text-pink-100 font-semibold mb-1">SPIFFs & Roletas</p>
            <p className="text-pink-50">
              Campanhas relâmpago acontecem o tempo todo — bônus por forma de pagamento,
              giros de roleta, prêmios em dinheiro ou experiências. <strong className="text-white">Tudo extra</strong>.
            </p>
          </div>
        </div>
      </Card>
      {plan?.clawback_enabled && (
        <Card className="bg-white/5 border-white/10 p-4 text-slate-300 text-sm flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong className="text-white">Clawback:</strong> cancelamento em até {plan.clawback_days} dias devolve {plan.clawback_percent}% do bônus referente.
          </span>
        </Card>
      )}
    </div>
  );
}

function SlideExample({ tiers, plan }: { tiers: any[]; plan: any }) {
  const bonusBase = Number(plan?.bonus_base_value || 0);
  const platinum = tiers.find((t) => t.label === "Platinum");
  const elite = tiers.find((t) => t.label === "Elite");
  const platinumBonus = platinum ? bonusBase * Number(platinum.bonus_multiplier) : 0;
  const eliteBonus = elite ? bonusBase * Number(elite.bonus_multiplier) : 0;
  const uncappedExtra = Number(plan?.uncapped_bonus_per_sale || 0) * 3; // Elite ~3 extras
  const baseSalary = 3000; // illustrative

  const scenarios = [
    {
      label: "Bate 100% (Platinum)",
      pct: 100,
      tier: "Platinum",
      grad: TIER_COLORS.Platinum,
      breakdown: [
        { name: "Salário", value: baseSalary },
        { name: "Bônus Faixa", value: platinumBonus },
      ],
    },
    {
      label: "Bate 142% (Elite + Sem Teto)",
      pct: 142,
      tier: "Elite",
      grad: TIER_COLORS.Elite,
      breakdown: [
        { name: "Salário", value: baseSalary },
        { name: "Bônus Faixa", value: eliteBonus },
        { name: "Sem Teto (3 extras)", value: uncappedExtra },
      ],
    },
  ];

  return (
    <div className="space-y-8 py-6">
      <div>
        <p className="text-amber-400 text-sm uppercase tracking-[0.3em] mb-3">Na prática</p>
        <h2 className="text-5xl font-black">Dois cenários, dois ganhos</h2>
        <p className="text-slate-400 mt-2 text-sm">
          Salário base ilustrativo de {fmtBRL(baseSalary)}. SPIFFs e bônus tri/anual não incluídos abaixo.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {scenarios.map((s) => {
          const total = s.breakdown.reduce((a, b) => a + b.value, 0);
          return (
            <div
              key={s.label}
              className={cn(
                "rounded-2xl p-6 bg-gradient-to-br text-white shadow-2xl space-y-4",
                s.grad,
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-wider opacity-80">{s.label}</p>
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/20">{s.tier}</Badge>
              </div>
              <div className="space-y-2">
                {s.breakdown.map((b) => (
                  <div key={b.name} className="flex items-center justify-between text-sm opacity-90">
                    <span>{b.name}</span>
                    <span className="tabular-nums font-semibold">{fmtBRL(b.value)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/30 pt-3">
                <p className="text-xs uppercase tracking-wider opacity-80">Ganho mensal bruto</p>
                <p className="text-5xl font-black tabular-nums mt-1">{fmtBRL(total)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlideCalculator() {
  return (
    <div className="space-y-6 py-2">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs uppercase tracking-[0.3em]">
          <Calculator className="h-3.5 w-3.5" /> Sua vez
        </div>
        <h2 className="text-4xl md:text-5xl font-black">Quanto você vai ganhar?</h2>
        <p className="text-slate-400">
          Escolha o vendedor, ajuste o atingimento e veja em tempo real.
        </p>
      </div>
      <div className="bg-white text-slate-900 rounded-2xl p-2 shadow-2xl">
        <CommissionSimulator />
      </div>
    </div>
  );
}
