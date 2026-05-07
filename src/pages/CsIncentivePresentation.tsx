import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCsIncentivePlans } from "@/hooks/useCsIncentivePlans";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Heart,
  Crown,
  HandHeart,
  Target,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Star,
  Flame,
  Gift,
  Users,
  Trophy,
  Rocket,
  CalendarCheck,
  Phone,
  ClipboardList,
  HeartHandshake,
  AlarmClock,
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmtBRL = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function CsIncentivePresentation() {
  const navigate = useNavigate();
  const { plans, tiers } = useCsIncentivePlans();

  // Pega o plano ativo de melhor referência (Pleno ou primeiro ativo)
  const activePlans = useMemo(
    () => plans.filter((p: any) => p.is_active),
    [plans],
  );
  const referencePlan = useMemo(() => {
    return (
      activePlans.find((p: any) => /pleno/i.test(p.role_label || "")) ||
      activePlans.find((p: any) => /s[eê]nior/i.test(p.role_label || "")) ||
      activePlans[0] ||
      null
    );
  }, [activePlans]);

  const refTiers = useMemo(
    () =>
      [...tiers.filter((t: any) => referencePlan && t.plan_id === referencePlan.id)].sort(
        (a: any, b: any) => Number(a.min_achievement_percent) - Number(b.min_achievement_percent),
      ),
    [tiers, referencePlan],
  );

  const [step, setStep] = useState(0);

  const slides = useMemo(
    () => [
      { id: "intro", render: () => <SlideIntro /> },
      { id: "historic", render: () => <SlideHistoric /> },
      { id: "responsibility", render: () => <SlideResponsibility /> },
      { id: "how", render: () => <SlideHow plan={referencePlan} /> },
      { id: "tiers", render: () => <SlideTiers tiers={refTiers} plan={referencePlan} /> },
      { id: "extras", render: () => <SlideExtras plans={activePlans} /> },
      { id: "rituals", render: () => <SlideRituals plan={referencePlan} /> },
      { id: "stepbystep", render: () => <SlideStepByStep /> },
      { id: "close", render: () => <SlideClose /> },
    ],
    [referencePlan, refTiers, activePlans],
  );

  const next = useCallback(
    () => setStep((s) => Math.min(s + 1, slides.length - 1)),
    [slides.length],
  );
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
        navigate("/operations/consultant-bonus");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, navigate]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-rose-950 via-slate-950 to-indigo-950 text-slate-50 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-rose-200/80">
          <Sparkles className="h-3.5 w-3.5 text-rose-300" />
          Plano de Incentivo CS · 2026
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 tabular-nums">
            {step + 1} / {slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/operations/consultant-bonus")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-h-full flex items-stretch justify-center px-6 py-8">
          <div className="w-full max-w-6xl">{slides[step].render()}</div>
        </div>
      </div>

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
                i === step ? "w-8 bg-rose-300" : "w-1.5 bg-white/20 hover:bg-white/40",
              )}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <Button
          onClick={next}
          disabled={step === slides.length - 1}
          className="bg-rose-400 hover:bg-rose-300 text-slate-950 font-semibold disabled:opacity-30"
        >
          Próximo <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ----------------- SLIDES ----------------- */

function SlideIntro() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-16">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-300/10 border border-rose-300/30 text-rose-200 text-xs uppercase tracking-[0.3em]">
        <Flame className="h-3.5 w-3.5" /> Marco histórico · Eternum 2026
      </div>
      <h1 className="text-6xl md:text-7xl font-black leading-tight">
        A renovação,<br />
        a partir de agora,{" "}
        <span className="bg-gradient-to-r from-rose-300 via-amber-200 to-rose-300 bg-clip-text text-transparent">
          é com vocês
        </span>
        .
      </h1>
      <p className="text-xl md:text-2xl text-slate-300 max-w-3xl">
        Pela primeira vez na história da Eternum, o time de{" "}
        <strong className="text-white">Customer Success</strong> assume a renovação dos clientes —
        e ganha bônus por isso.
      </p>
      <p className="text-sm text-slate-500 mt-12">
        Use as setas <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-xs">←</kbd>{" "}
        <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-xs">→</kbd> para navegar
      </p>
    </div>
  );
}

function SlideHistoric() {
  return (
    <div className="space-y-12 py-8">
      <div>
        <p className="text-rose-300 text-sm uppercase tracking-[0.3em] mb-3">O que muda</p>
        <h2 className="text-5xl font-black leading-tight">
          Antes era do Comercial.
          <br />
          <span className="text-rose-300">Agora é nosso.</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 p-8 space-y-3 text-slate-200">
          <p className="text-xs uppercase tracking-wider text-slate-400">Antes</p>
          <p className="text-2xl font-bold text-slate-300">
            Comercial fechava, entregava à operação, e voltava no fim do contrato pra renovar.
          </p>
          <p className="text-sm text-slate-400">
            CS cuidava do cliente. Comercial colhia a renovação.
          </p>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-700 border-emerald-300/50 p-8 space-y-3 text-white shadow-2xl">
          <p className="text-xs uppercase tracking-wider text-emerald-50 font-semibold">Agora</p>
          <p className="text-2xl font-bold text-white">
            Quem viveu a jornada com a cliente é quem renova.{" "}
            <span className="text-amber-200">Você.</span>
          </p>
          <p className="text-sm text-emerald-50">
            Faz sentido. Você tem a relação, o contexto e a autoridade pra continuar.
          </p>
        </Card>
      </div>
      <p className="text-center text-lg text-slate-300 italic">
        Confiamos a peça mais importante do nosso negócio nas mãos de quem mais entende a cliente.
      </p>
    </div>
  );
}

function SlideResponsibility() {
  const cards = [
    {
      icon: HandHeart,
      title: "A relação é sua",
      text: "Você é o rosto da Eternum pra cliente. A renovação começa no primeiro contato, não no fim do contrato.",
    },
    {
      icon: ShieldCheck,
      title: "O resultado é seu",
      text: "Cliente que entrega resultado renova. Cliente que se sente cuidada renova. Isso depende de você.",
    },
    {
      icon: Crown,
      title: "O bônus é seu",
      text: "Pela primeira vez, parte do que vem da renovação volta pra quem trabalhou pra que ela acontecesse.",
    },
  ];
  return (
    <div className="space-y-12 py-8">
      <div>
        <p className="text-rose-300 text-sm uppercase tracking-[0.3em] mb-3">Por que vocês</p>
        <h2 className="text-5xl font-black leading-tight">
          Responsabilidade que <span className="text-rose-300">só vocês</span> podem honrar.
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {cards.map((c) => (
          <Card
            key={c.title}
            className="bg-white/5 border-white/10 backdrop-blur p-6 space-y-3 text-slate-100"
          >
            <div className="h-10 w-10 rounded-lg bg-rose-300/15 flex items-center justify-center">
              <c.icon className="h-5 w-5 text-rose-300" />
            </div>
            <h3 className="text-xl font-bold">{c.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function useDashboardKpis() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { data: goals } = useQuery({
    queryKey: ["cs-pres-goals", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("account_settings")
        .select("dashboard_churn_goal, dashboard_renewal_goal, dashboard_nps_goal")
        .eq("account_id", accountId!)
        .maybeSingle();
      return {
        churn: Number(data?.dashboard_churn_goal ?? 18),
        renewal: Number(data?.dashboard_renewal_goal ?? 40),
        nps: Number(data?.dashboard_nps_goal ?? 80),
      };
    },
  });

  const { data: renewal } = useQuery({
    queryKey: ["cs-pres-renewal", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const start = new Date(); start.setMonth(start.getMonth() - 12);
      const { data } = await supabase
        .from("renewal_outcomes")
        .select("outcome, resolved_at")
        .eq("account_id", accountId!)
        .gte("resolved_at", start.toISOString());
      let renewed = 0, lost = 0;
      for (const r of (data ?? []) as any[]) {
        if (r.outcome === "renewed") renewed++;
        else if (r.outcome === "lost") lost++;
      }
      const total = renewed + lost;
      return { rate: total > 0 ? (renewed / total) * 100 : 0, renewed, lost, total };
    },
  });

  const { data: churn } = useQuery({
    queryKey: ["cs-pres-churn", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_dashboard_contract_counts", {
        p_account_id: accountId!,
      });
      const stats = (data ?? {}) as any;
      const activeCount = Number(stats.active ?? 0);
      const cancelCount = Number(stats.cancelled ?? 0);
      const denom = activeCount + cancelCount;
      return { rate: denom > 0 ? (cancelCount / denom) * 100 : 0, cancelCount, activeCount };
    },
  });

  const { data: nps } = useQuery({
    queryKey: ["cs-pres-nps", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("vnps_snapshots")
        .select("client_id, vnps_class, computed_at")
        .eq("account_id", accountId!)
        .order("computed_at", { ascending: false })
        .limit(5000);
      const latest = new Map<string, string>();
      for (const r of (data ?? []) as any[]) {
        if (!latest.has(r.client_id)) latest.set(r.client_id, r.vnps_class);
      }
      let p = 0, d = 0;
      latest.forEach((c) => { if (c === "promoter") p++; else if (c === "detractor") d++; });
      const total = latest.size;
      return { score: total > 0 ? Math.round(((p - d) / total) * 100) : 0, total };
    },
  });

  return { goals, renewal, churn, nps };
}

function SlideHow({ plan }: { plan: any }) {
  const { goals, renewal, churn, nps } = useDashboardKpis();

  const renewalRate = renewal?.rate ?? 0;
  const renewalGoal = goals?.renewal ?? 40;
  const renewalOk = renewalRate >= renewalGoal;

  const churnRate = churn?.rate ?? 0;
  const churnGoal = goals?.churn ?? 18;
  const churnOk = churnRate <= churnGoal;

  const npsScore = nps?.score ?? 0;
  const npsGoal = goals?.nps ?? 80;
  const npsOk = npsScore >= npsGoal;

  const cards = [
    {
      icon: RefreshCw,
      label: "Taxa de Renovação",
      weight: plan?.weight_renewal,
      current: `${renewalRate.toFixed(1)}%`,
      goal: `≥ ${renewalGoal}%`,
      ok: renewalOk,
      tone: "emerald",
      desc: "Quanto da sua carteira renova.",
    },
    {
      icon: TrendingDown,
      label: "Churn",
      weight: plan?.weight_churn,
      current: `${churnRate.toFixed(1)}%`,
      goal: `≤ ${churnGoal}%`,
      ok: churnOk,
      tone: "rose",
      desc: "Quanto da carteira vai embora.",
    },
    {
      icon: Heart,
      label: "NPS",
      weight: plan?.weight_nps,
      current: `${npsScore}`,
      goal: `≥ ${npsGoal}`,
      ok: npsOk,
      tone: "amber",
      desc: "O quanto a cliente recomenda.",
    },
  ];

  const toneMap: Record<string, { ring: string; icon: string; chip: string }> = {
    emerald: { ring: "border-emerald-400/40", icon: "text-emerald-300 bg-emerald-400/10", chip: "bg-emerald-400/15 text-emerald-200" },
    rose: { ring: "border-rose-400/40", icon: "text-rose-300 bg-rose-400/10", chip: "bg-rose-400/15 text-rose-200" },
    amber: { ring: "border-amber-400/40", icon: "text-amber-300 bg-amber-400/10", chip: "bg-amber-400/15 text-amber-200" },
  };

  return (
    <div className="space-y-8 py-6">
      <div>
        <p className="text-rose-300 text-sm uppercase tracking-[0.3em] mb-3">Como você é avaliada</p>
        <h2 className="text-5xl font-black">3 indicadores. Nada mais.</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Os mesmos números que aparecem no dashboard — atual e a meta.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const t = toneMap[c.tone];
          return (
            <div
              key={c.label}
              className={cn("rounded-2xl border-2 bg-white/[0.04] p-5 space-y-4", t.ring)}
            >
              <div className="flex items-center justify-between">
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", t.icon)}>
                  <c.icon className="h-5 w-5" />
                </div>
                <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold", t.chip)}>
                  Peso {c.weight ? `${Number(c.weight)}%` : "—"}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{c.label}</p>
                <p className="text-5xl font-black tabular-nums text-white mt-1">{c.current}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Meta</p>
                  <p className="text-base font-bold text-slate-200 tabular-nums">{c.goal}</p>
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold",
                    c.ok ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200",
                  )}
                >
                  {c.ok ? "Na meta" : "Fora"}
                </span>
              </div>
              <p className="text-xs text-slate-400">{c.desc}</p>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-slate-400 italic text-center">
        Os pesos somam 100%. Cada mês compõe seu desempenho final.
      </p>
    </div>
  );
}



function SlideTiers({ tiers, plan }: { tiers: any[]; plan: any }) {
  const monthlyBonus = Number(plan?.monthly_bonus_value || 0);
  const fallback = [
    { label: "Abaixo", min: 0, max: 79, mult: 0 },
    { label: "Esperado", min: 80, max: 89, mult: 0.5 },
    { label: "Bom", min: 90, max: 99, mult: 0.8 },
    { label: "Excelente", min: 100, max: 109, mult: 1 },
    { label: "Excepcional", min: 110, max: null, mult: 1.3 },
  ];
  const list =
    tiers.length > 0
      ? tiers.map((t: any) => ({
          label: t.label,
          min: Number(t.min_achievement_percent),
          max: t.max_achievement_percent ? Number(t.max_achievement_percent) : null,
          mult: Number(t.bonus_multiplier),
        }))
      : fallback;

  const palette = [
    "from-zinc-600 to-zinc-800",
    "from-slate-500 to-slate-700",
    "from-amber-700 to-amber-900",
    "from-rose-400 to-rose-600",
    "from-fuchsia-500 via-rose-500 to-amber-400",
  ];

  return (
    <div className="space-y-8 py-6">
      <div>
        <p className="text-rose-300 text-sm uppercase tracking-[0.3em] mb-3">Faixas de bônus</p>
        <h2 className="text-5xl font-black">Quanto melhor a entrega, maior o bônus</h2>
        <p className="text-slate-400 mt-2">
          Bônus base: <strong className="text-white">{fmtBRL(monthlyBonus)}</strong> · multiplicado pela faixa atingida.
        </p>
        <p className="text-slate-500 mt-1 text-sm">
          % de atingimento = média ponderada de Renovação ({Number(plan?.weight_renewal ?? 0)}%) + Churn ({Number(plan?.weight_churn ?? 0)}%) + NPS ({Number(plan?.weight_nps ?? 0)}%).
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {list.map((t, i) => {
          const value = monthlyBonus * t.mult;
          return (
            <div
              key={t.label + i}
              className={cn(
                "rounded-xl p-4 bg-gradient-to-br text-white shadow-lg flex flex-col justify-between min-h-[170px]",
                palette[i % palette.length],
              )}
            >
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-80">
                  {t.min}%{t.max ? `–${t.max}%` : "+"} de atingimento
                </p>
                <p className="text-lg font-black mt-1 leading-tight">{t.label}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-75">Bônus do mês</p>
                <p className="text-xl font-black tabular-nums">
                  {value > 0 ? fmtBRL(value) : "—"}
                </p>
                <p className="text-[10px] opacity-75 mt-0.5">{t.mult}x</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-slate-400 italic">
        💡 100% de atingimento = bônus cheio. Acima disso, bônus turbinado.
      </p>
    </div>
  );
}

function SlideExtras({ plans }: { plans: any[] }) {
  const annual = plans.find((p: any) => p.annual_bonus_enabled);
  return (
    <div className="space-y-10 py-8">
      <div>
        <p className="text-rose-300 text-sm uppercase tracking-[0.3em] mb-3">Bônus complementares</p>
        <h2 className="text-5xl font-black">
          Constância vira <span className="text-rose-300">recompensa</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-1 gap-6">
        <Card className="bg-gradient-to-br from-fuchsia-600 to-rose-700 border-fuchsia-400/50 p-10 text-white space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-fuchsia-100" />
            <p className="text-sm uppercase tracking-wider text-fuchsia-100 font-semibold">Anual</p>
          </div>
          <p className="text-6xl font-black text-white">
            {fmtBRL(Number(annual?.annual_bonus_value || 0))}
          </p>
          <p className="text-fuchsia-50 text-lg max-w-2xl">
            Pago no fechamento do ano — pra coroar quem manteve carteira saudável o ano inteiro.
          </p>
        </Card>
      </div>
      <Card className="bg-gradient-to-r from-rose-600 to-amber-500 border-rose-300/50 p-6 text-white shadow-xl">
        <div className="flex items-start gap-4">
          <Gift className="h-6 w-6 text-rose-50 flex-shrink-0 mt-1" />
          <div>
            <p className="text-sm uppercase tracking-wider text-rose-50 font-semibold mb-1">
              Campanhas e prêmios
            </p>
            <p className="text-rose-50">
              Ao longo do ano, campanhas relâmpago premiam quem se destaca em renovação, NPS ou recuperação de churn —{" "}
              <strong className="text-white">tudo extra ao bônus mensal</strong>.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SlideRituals({ plan }: { plan: any }) {
  const routines: string[] = Array.isArray(plan?.routines) ? plan.routines : [];
  const fallback = [
    "Check-in semanal estruturado com cada cliente da carteira",
    "Acompanhamento de evolução por indicadores de resultado",
    "Reunião mensal de saúde de carteira com o time",
    "Plano de renovação iniciado no 9º mês de contrato",
  ];
  const list = routines.length > 0 ? routines : fallback;

  // ícones rotativos para cada item, com tonalidades diferentes
  const visuals = [
    { icon: CalendarCheck, gradient: "from-rose-500 to-rose-700", glow: "shadow-rose-500/30" },
    { icon: LineChart, gradient: "from-amber-500 to-orange-600", glow: "shadow-amber-500/30" },
    { icon: HeartHandshake, gradient: "from-fuchsia-500 to-pink-600", glow: "shadow-fuchsia-500/30" },
    { icon: AlarmClock, gradient: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
    { icon: ClipboardList, gradient: "from-indigo-500 to-violet-600", glow: "shadow-indigo-500/30" },
    { icon: Phone, gradient: "from-sky-500 to-cyan-600", glow: "shadow-sky-500/30" },
  ];

  return (
    <div className="space-y-10 py-6">
      <div>
        <p className="text-rose-300 text-sm uppercase tracking-[0.3em] mb-3">O que se espera de vocês</p>
        <h2 className="text-5xl font-black">
          O bônus vem do <span className="text-rose-300">ritual</span>, não do milagre
        </h2>
        <p className="text-slate-400 mt-2 text-lg">
          Renovação não acontece no último mês. Acontece todos os dias.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {list.map((r, i) => {
          const v = visuals[i % visuals.length];
          const Icon = v.icon;
          return (
            <div
              key={i}
              className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6 flex items-start gap-5 hover:border-white/20 transition-all overflow-hidden"
            >
              <div
                className={cn(
                  "h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg",
                  v.gradient,
                  v.glow,
                )}
              >
                <Icon className="h-7 w-7 text-white" strokeWidth={2.2} />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300/80 font-bold mb-1.5">
                  Ritual {String(i + 1).padStart(2, "0")}
                </p>
                <p className="text-slate-100 leading-relaxed text-base font-medium">{r}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-rose-300/30 bg-rose-300/5 p-5 flex items-center gap-3">
        <Flame className="h-5 w-5 text-rose-300 flex-shrink-0" />
        <p className="text-rose-100 text-sm">
          <strong className="text-white">Disciplina é o atalho.</strong> Quem segue o ritual entrega resultado, e quem entrega resultado bate o bônus.
        </p>
      </div>
    </div>
  );
}

function SlideStepByStep() {
  const days = [
    {
      tag: "Toda segunda",
      title: "Abra a carteira e olhe cliente por cliente",
      color: "from-rose-500 to-rose-700",
      icon: ClipboardList,
      steps: [
        "Entre em Operações › Minhas Clientes.",
        "Filtre por status Ativo e ordene por 'próximo do vencimento'.",
        "Marque na sua agenda quem precisa de check-in nesta semana.",
        "Sinalize no card quem está em risco (vermelho) ou atenção (amarelo).",
      ],
    },
    {
      tag: "Todo dia",
      title: "Faça os check-ins agendados — sem pular",
      color: "from-amber-500 to-orange-600",
      icon: Phone,
      steps: [
        "Abra a cliente do dia e leia o histórico antes de chamar.",
        "Pergunte sobre evolução, dificuldade e expectativa do mês.",
        "Registre TUDO no Timeline da cliente (mesmo áudio rápido vale).",
        "Agende a próxima conversa antes de encerrar a atual.",
      ],
    },
    {
      tag: "Toda sexta",
      title: "Atualize os indicadores da carteira",
      color: "from-fuchsia-500 to-pink-600",
      icon: LineChart,
      steps: [
        "Marque NPS coletado da semana em cada cliente.",
        "Atualize status de risco/saúde com base no que viveu.",
        "Liste no grupo do time quem entrou em risco e por quê.",
        "Comemore as vitórias da semana — toda renovação merece festa.",
      ],
    },
    {
      tag: "Mês 9 do contrato",
      title: "Comece o plano de renovação",
      color: "from-emerald-500 to-teal-600",
      icon: CalendarCheck,
      steps: [
        "A plataforma avisa: cliente entrou na janela de renovação.",
        "Marque uma conversa de 'balanço do ano' — não fale de venda ainda.",
        "Mapeie resultados, dores que sumiram e novas ambições.",
        "No mês 10, apresente a proposta de renovação com base nesse balanço.",
      ],
    },
    {
      tag: "Toda virada de mês",
      title: "Confira seu bônus na plataforma",
      color: "from-indigo-500 to-violet-600",
      icon: Trophy,
      steps: [
        "Vá em Financeiro › Comissões › aba Operações.",
        "Veja sua apuração: renovação, churn e NPS do mês.",
        "Clique em cada métrica para entender o cálculo (transparência total).",
        "Se algo parecer errado, fale com a liderança ANTES de aprovar.",
      ],
    },
    {
      tag: "Quando bater dúvida",
      title: "Não invente — pergunte",
      color: "from-sky-500 to-cyan-600",
      icon: HeartHandshake,
      steps: [
        "Dúvida de cliente: chame no grupo das consultoras primeiro.",
        "Dúvida de regra ou bônus: chame a Bruna direto.",
        "Caso delicado: registre o caso no Timeline e escala pra liderança.",
        "Tudo que ficou combinado vira nota no card da cliente.",
      ],
    },
  ];

  return (
    <div className="space-y-8 py-6">
      <div>
        <p className="text-rose-300 text-sm uppercase tracking-[0.3em] mb-3">Passo a passo · beabá</p>
        <h2 className="text-5xl font-black">
          O dia a dia, <span className="text-rose-300">no detalhe</span>
        </h2>
        <p className="text-slate-400 mt-2 text-lg">
          Sem mistério. Se seguir esse roteiro, o bônus acontece.
        </p>
      </div>

      <div className="space-y-4">
        {days.map((d, i) => {
          const Icon = d.icon;
          return (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-6 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-5">
                <div
                  className={cn(
                    "h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg",
                    d.color,
                  )}
                >
                  <Icon className="h-7 w-7 text-white" strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300/80 font-bold mb-1">
                    {d.tag}
                  </p>
                  <p className="text-xl font-black text-white mb-3">{d.title}</p>
                  <ol className="space-y-2">
                    {d.steps.map((s, j) => (
                      <li key={j} className="flex gap-3 text-slate-200 text-sm leading-relaxed">
                        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-rose-200">
                          {j + 1}
                        </span>
                        <span className="pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-5 flex items-start gap-3">
        <Star className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
        <p className="text-amber-50 text-sm leading-relaxed">
          <strong className="text-white">Regra de ouro:</strong> registrou no sistema, aconteceu. Não registrou, não conta — nem pra cliente, nem pro bônus.
        </p>
      </div>
    </div>
  );
}

function SlideClose() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-10 py-16">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-300/10 border border-rose-300/30 text-rose-200 text-xs uppercase tracking-[0.3em]">
        <Heart className="h-3.5 w-3.5" /> Vocês foram escolhidas
      </div>
      <h1 className="text-6xl md:text-7xl font-black leading-tight max-w-4xl">
        Cuidem das clientes
        <br />
        como ninguém cuidaria.
        <br />
        <span className="bg-gradient-to-r from-rose-300 via-amber-200 to-rose-300 bg-clip-text text-transparent">
          O resto é consequência.
        </span>
      </h1>
      <div className="grid grid-cols-3 gap-6 max-w-3xl w-full pt-6">
        <Stat icon={Users} label="Confiança" value="Total" />
        <Stat icon={Rocket} label="Autonomia" value="Real" />
        <Stat icon={Trophy} label="Recompensa" value="Sem teto" />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
      <Icon className="h-5 w-5 text-rose-300 mx-auto" />
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}
