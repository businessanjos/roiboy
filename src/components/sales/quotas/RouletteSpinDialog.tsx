import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dice5, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spiff: {
    id: string;
    name: string;
    roulette_min_prize?: number | null;
    roulette_max_prize?: number | null;
  };
  user: { uid: string; name: string };
  pendingSpins: number;
}

type Phase = "idle" | "spinning" | "result";

export function RouletteSpinDialog({ open, onOpenChange, spiff, user, pendingSpins }: Props) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const min = Number(spiff.roulette_min_prize ?? 0);
  const max = Number(spiff.roulette_max_prize ?? 100);

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayValue, setDisplayValue] = useState(min);
  const [finalPrize, setFinalPrize] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setDisplayValue(min);
      setFinalPrize(null);
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [open, min]);

  const startSpin = () => {
    if (phase !== "idle" || pendingSpins <= 0) return;
    setPhase("spinning");

    // Sorteio determinístico no frontend (por enquanto). Step de R$ 50.
    const step = 50;
    const range = Math.max(0, max - min);
    const steps = Math.floor(range / step) + 1;
    const randomIndex = Math.floor(Math.random() * steps);
    const prize = min + randomIndex * step;

    // Animação: roda valores aleatórios por ~2.5s, depois revela
    const startTime = Date.now();
    const duration = 2500;

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Desacelera ao longo do tempo (ease-out)
      const intervalMs = 50 + progress * 200;

      const randIdx = Math.floor(Math.random() * steps);
      setDisplayValue(min + randIdx * step);

      if (progress >= 1) {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDisplayValue(prize);
        setFinalPrize(prize);
        setPhase("result");
      } else {
        // Reagenda com interval crescente para dar sensação de desaceleração
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = window.setInterval(() => {}, intervalMs);
        }
      }
    }, 80);
  };

  const handleSave = async () => {
    if (finalPrize === null || !currentUser?.account_id) return;
    setSaving(true);
    const { error } = await supabase.from("spiff_spins").insert({
      account_id: currentUser.account_id,
      spiff_id: spiff.id,
      user_id: user.uid,
      prize_amount: finalPrize,
      created_by: currentUser.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao registrar giro: " + error.message);
      return;
    }
    toast.success(`Giro registrado! ${user.name} ganhou R$ ${formatBRL(finalPrize)}`);
    queryClient.invalidateQueries({ queryKey: ["spiff-spins"] });
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (phase === "spinning") return; // não pode cancelar durante animação
    onOpenChange(false);
  };

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
          {/* Display do valor */}
          <div
            className={cn(
              "relative mx-auto w-full max-w-xs rounded-2xl border-4 p-8 text-center transition-colors",
              phase === "spinning" && "border-amber-500 bg-amber-500/10 animate-pulse",
              phase === "result" && "border-emerald-500 bg-emerald-500/10",
              phase === "idle" && "border-border bg-muted/30",
            )}
          >
            {phase === "result" && (
              <Sparkles className="absolute -top-3 -right-3 h-6 w-6 text-amber-500 animate-bounce" />
            )}
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {phase === "result" ? "🎉 Você ganhou" : "Prêmio"}
            </p>
            <p
              className={cn(
                "text-5xl font-bold tabular-nums transition-all",
                phase === "spinning" && "text-amber-600 dark:text-amber-400 blur-[1px]",
                phase === "result" && "text-emerald-600 dark:text-emerald-400 scale-110",
              )}
            >
              R$ {formatBRL(displayValue)}
            </p>
            <Badge variant="outline" className="mt-3 text-[10px]">
              Faixa: R$ {formatBRL(min)} a R$ {formatBRL(max)}
            </Badge>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-2">
            {phase === "idle" && (
              <Button
                onClick={startSpin}
                size="lg"
                className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={pendingSpins <= 0}
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
            {phase === "result" && (
              <>
                <Button onClick={handleSave} size="lg" className="w-full gap-2" disabled={saving}>
                  <Trophy className="h-5 w-5" />
                  {saving ? "Salvando..." : `Confirmar prêmio de R$ ${formatBRL(finalPrize ?? 0)}`}
                </Button>
                <Button variant="ghost" onClick={() => { setPhase("idle"); setDisplayValue(min); setFinalPrize(null); }} disabled={saving}>
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
