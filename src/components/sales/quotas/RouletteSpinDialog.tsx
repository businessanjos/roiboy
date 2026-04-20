import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dice5, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spiff: {
    id: string;
    name: string;
    roulette_min_prize?: number | null;
    roulette_max_prize?: number | null;
    roulette_pool_id?: string | null;
  };
  user: { uid: string; name: string };
  pendingSpins: number;
}

interface PrizeOption {
  id: string | null; // null = sorteio por faixa numérica
  label: string;
  cash_value: number;
  weight: number;
  color: string | null;
}

type Phase = "idle" | "spinning" | "result";

export function RouletteSpinDialog({ open, onOpenChange, spiff, user, pendingSpins }: Props) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  // Carrega prêmios do pool (se houver)
  const prizesQuery = useQuery({
    queryKey: ["roulette-prizes-pool", spiff.roulette_pool_id],
    queryFn: async () => {
      if (!spiff.roulette_pool_id) return [];
      const { data, error } = await supabase
        .from("roulette_prizes")
        .select("*")
        .eq("pool_id", spiff.roulette_pool_id)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!spiff.roulette_pool_id && open,
  });

  // Constrói lista de opções de prêmios
  const buildOptions = (): PrizeOption[] => {
    if (spiff.roulette_pool_id && prizesQuery.data && prizesQuery.data.length > 0) {
      return prizesQuery.data.map((p: any) => ({
        id: p.id,
        label: p.label,
        cash_value: Number(p.cash_value || 0),
        weight: Number(p.weight || 1),
        color: p.color,
      }));
    }
    // Fallback: faixa numérica
    const min = Number(spiff.roulette_min_prize ?? 0);
    const max = Number(spiff.roulette_max_prize ?? 100);
    const step = 50;
    const range = Math.max(0, max - min);
    const steps = Math.floor(range / step) + 1;
    return Array.from({ length: steps }, (_, i) => {
      const v = min + i * step;
      return { id: null, label: `R$ ${formatBRL(v)}`, cash_value: v, weight: 1, color: null };
    });
  };

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayOption, setDisplayOption] = useState<PrizeOption | null>(null);
  const [finalOption, setFinalOption] = useState<PrizeOption | null>(null);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const min = Number(spiff.roulette_min_prize ?? 0);
  const max = Number(spiff.roulette_max_prize ?? 100);
  const usingPool = !!spiff.roulette_pool_id;

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setDisplayOption(null);
      setFinalOption(null);
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [open]);

  const pickWeighted = (options: PrizeOption[]): PrizeOption => {
    const total = options.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total;
    for (const o of options) {
      r -= o.weight;
      if (r <= 0) return o;
    }
    return options[options.length - 1];
  };

  const startSpin = () => {
    if (phase !== "idle" || pendingSpins <= 0) return;
    const options = buildOptions();
    if (options.length === 0) {
      toast.error("Nenhum prêmio configurado nesta roleta.");
      return;
    }
    setPhase("spinning");

    const winner = pickWeighted(options);
    const startTime = Date.now();
    const duration = 2500;

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Mostra opção aleatória durante a animação
      setDisplayOption(options[Math.floor(Math.random() * options.length)]);

      if (progress >= 1) {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDisplayOption(winner);
        setFinalOption(winner);
        setPhase("result");
      }
    }, 80);
  };

  const handleSave = async () => {
    if (!finalOption || !currentUser?.account_id) return;
    setSaving(true);
    const { error } = await supabase.from("spiff_spins").insert({
      account_id: currentUser.account_id,
      spiff_id: spiff.id,
      user_id: user.uid,
      prize_amount: finalOption.cash_value,
      prize_id: finalOption.id,
      prize_label: finalOption.label,
      created_by: currentUser.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao registrar giro: " + error.message);
      return;
    }
    toast.success(`Giro registrado! ${user.name} ganhou ${finalOption.label}`);
    queryClient.invalidateQueries({ queryKey: ["spiff-spins"] });
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (phase === "spinning") return;
    onOpenChange(false);
  };

  const currentColor = displayOption?.color || (phase === "result" ? "#10b981" : "#f59e0b");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dice5 className="h-5 w-5 text-amber-500" />
            Roleta da Sorte — {spiff.name}
          </DialogTitle>
          <DialogDescription>
            {user.name} • {pendingSpins} {pendingSpins === 1 ? "giro pendente" : "giros pendentes"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div
            className={cn(
              "relative mx-auto w-full max-w-xs rounded-2xl border-4 p-8 text-center transition-colors",
              phase === "spinning" && "animate-pulse",
              phase === "idle" && "border-border bg-muted/30",
            )}
            style={
              phase !== "idle" && displayOption
                ? {
                    borderColor: currentColor,
                    backgroundColor: `${currentColor}15`,
                  }
                : undefined
            }
          >
            {phase === "result" && (
              <Sparkles className="absolute -top-3 -right-3 h-6 w-6 text-amber-500 animate-bounce" />
            )}
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {phase === "result" ? "🎉 Você ganhou" : phase === "spinning" ? "Sorteando..." : "Prêmio"}
            </p>
            <p
              className={cn(
                "font-bold tabular-nums transition-all break-words",
                phase === "spinning" && "blur-[1px]",
                phase === "result" && "scale-110",
                (displayOption?.label?.length || 0) > 20 ? "text-2xl" : "text-4xl",
              )}
              style={phase !== "idle" ? { color: currentColor } : undefined}
            >
              {displayOption ? displayOption.label : "—"}
            </p>
            {displayOption && displayOption.cash_value > 0 && displayOption.label !== `R$ ${formatBRL(displayOption.cash_value)}` && (
              <p className="text-sm text-muted-foreground mt-1 tabular-nums">
                Valor: R$ {formatBRL(displayOption.cash_value)}
              </p>
            )}
            <Badge variant="outline" className="mt-3 text-[10px]">
              {usingPool
                ? `${(prizesQuery.data?.length ?? 0)} prêmios disponíveis`
                : `Faixa: R$ ${formatBRL(min)} a R$ ${formatBRL(max)}`}
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            {phase === "idle" && (
              <Button
                onClick={startSpin}
                size="lg"
                className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={pendingSpins <= 0 || (usingPool && prizesQuery.isLoading)}
              >
                <Dice5 className="h-5 w-5" />
                Girar Roleta
              </Button>
            )}
            {phase === "spinning" && (
              <Button size="lg" className="w-full" disabled>
                Girando...
              </Button>
            )}
            {phase === "result" && finalOption && (
              <>
                <Button onClick={handleSave} size="lg" className="w-full gap-2" disabled={saving}>
                  <Trophy className="h-5 w-5" />
                  {saving ? "Salvando..." : `Confirmar: ${finalOption.label}`}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPhase("idle");
                    setDisplayOption(null);
                    setFinalOption(null);
                  }}
                  disabled={saving}
                >
                  Girar novamente
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
