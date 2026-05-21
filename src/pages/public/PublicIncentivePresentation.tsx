import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SlideIntro,
  SlideWhy,
  SlideComponents,
  SlideTiers,
  SlideUncapped,
  SlideExtras,
  SlideExample,
} from "@/pages/IncentivePresentation";
import { PublicCommissionSimulator } from "@/components/sales/incentive/PublicCommissionSimulator";

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-incentive-plan`;

type State =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ok"; plan: any; tiers: any[]; label: string | null };

export default function PublicIncentivePresentation() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ status: "loading" });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!token) {
      setState({ status: "error", reason: "invalid_token" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${FUNCTIONS_URL}?token=${encodeURIComponent(token)}`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", reason: body?.error || `http_${res.status}` });
          return;
        }
        setState({
          status: "ok",
          plan: body.plan,
          tiers: body.tiers ?? [],
          label: body.label ?? null,
        });
      } catch (e) {
        if (!cancelled) setState({ status: "error", reason: "network" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const slides = useMemo(() => {
    if (state.status !== "ok") return [];
    const { plan, tiers } = state;
    const sortedTiers = [...tiers].sort(
      (a, b) => Number(a.min_achievement_percent) - Number(b.min_achievement_percent),
    );
    return [
      { id: "intro", render: () => <SlideIntro /> },
      { id: "why", render: () => <SlideWhy /> },
      { id: "components", render: () => <SlideComponents plan={plan} /> },
      {
        id: "tiers",
        render: () => (
          <SlideTiers tiers={sortedTiers} bonusBase={Number(plan.bonus_base_value || 0)} />
        ),
      },
      { id: "uncapped", render: () => <SlideUncapped plan={plan} /> },
      { id: "extras", render: () => <SlideExtras plan={plan} /> },
      { id: "example", render: () => <SlideExample tiers={sortedTiers} plan={plan} /> },
      {
        id: "simulator",
        render: () => (
          <div className="space-y-6 py-2">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs uppercase tracking-[0.3em]">
                <Sparkles className="h-3.5 w-3.5" /> Sua vez
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white">
                Quanto você vai ganhar?
              </h2>
              <p className="text-slate-400">
                Ajuste o nº de vendas e veja em tempo real.
              </p>
            </div>
            <div className="bg-white text-slate-900 rounded-2xl p-2 shadow-2xl">
              <PublicCommissionSimulator plan={plan} tiers={sortedTiers} />
            </div>
          </div>
        ),
      },
    ];
  }, [state]);

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (state.status === "loading") {
    return (
      <FullScreen>
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400 mx-auto" />
          <p className="text-slate-400 text-sm">Carregando apresentação…</p>
        </div>
      </FullScreen>
    );
  }

  if (state.status === "error") {
    const messages: Record<string, string> = {
      not_found: "Link inválido ou não encontrado.",
      revoked: "Este link foi revogado por quem o gerou.",
      expired: "Este link expirou. Solicite um novo a quem o compartilhou.",
      invalid_token: "Link inválido.",
      no_plan: "Nenhum plano de incentivo encontrado.",
      network: "Não foi possível carregar. Verifique sua conexão.",
    };
    return (
      <FullScreen>
        <Card className="bg-white/5 border-white/10 p-8 text-center max-w-md space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Acesso indisponível</h1>
          <p className="text-slate-400 text-sm">
            {messages[state.reason] || `Erro: ${state.reason}`}
          </p>
        </Card>
      </FullScreen>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Plano de Incentivo Comercial · 2026
          {state.label && (
            <span className="text-slate-500 normal-case tracking-normal">
              · {state.label}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 tabular-nums">
          {step + 1} / {slides.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-h-full flex items-stretch justify-center px-6 py-8">
          <div className="w-full max-w-6xl">{slides[step]?.render()}</div>
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

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      {children}
    </div>
  );
}
