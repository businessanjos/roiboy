import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dice5, Trophy, Volume2, VolumeX, Tv, X, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RouletteCardShuffle, ShuffleCard } from "./RouletteCardShuffle";

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

type Phase = "idle" | "spinning" | "result";

export function RouletteSpinDialog({ open, onOpenChange, spiff, user, pendingSpins }: Props) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

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

  const buildOptions = (): ShuffleCard[] => {
    if (spiff.roulette_pool_id && prizesQuery.data && prizesQuery.data.length > 0) {
      return prizesQuery.data.map((p: any) => ({
        id: p.id,
        label: p.label,
        cash_value: Number(p.cash_value || 0),
        color: p.color,
      }));
    }
    const min = Number(spiff.roulette_min_prize ?? 0);
    const max = Number(spiff.roulette_max_prize ?? 100);
    const step = 50;
    const range = Math.max(0, max - min);
    const steps = Math.floor(range / step) + 1;
    return Array.from({ length: steps }, (_, i) => {
      const v = min + i * step;
      return { id: null, label: `R$ ${formatBRL(v)}`, cash_value: v, color: null };
    });
  };

  const [phase, setPhase] = useState<Phase>("idle");
  const [finalOption, setFinalOption] = useState<ShuffleCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tvMode, setTvMode] = useState(false);
  const optionsRef = useRef<ShuffleCard[]>([]);

  // Aprovação do gestor
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalEmail, setApprovalEmail] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approver, setApprover] = useState<{ id: string; name: string } | null>(null);

  const min = Number(spiff.roulette_min_prize ?? 0);
  const max = Number(spiff.roulette_max_prize ?? 100);
  const usingPool = !!spiff.roulette_pool_id;

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setFinalOption(null);
      setTvMode(false);
      setApprover(null);
      setApprovalOpen(false);
      setApprovalEmail("");
      setApprovalPassword("");
    }
  }, [open]);

  const pickWeighted = (options: { weight?: number }[]) => {
    const weights = options.map((o: any) => Number(o.weight ?? 1));
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return options.length - 1;
  };

  const requestApproval = () => {
    if (phase !== "idle" || pendingSpins <= 0) return;
    if (usingPool && (prizesQuery.data?.length ?? 0) === 0) {
      toast.error("Nenhum prêmio configurado nesta roleta.");
      return;
    }
    setApprovalEmail("");
    setApprovalPassword("");
    setApprovalOpen(true);
  };

  const submitApproval = async () => {
    if (!approvalEmail || !approvalPassword) {
      toast.error("Informe email e senha do gestor");
      return;
    }
    setApprovalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-manager-approval", {
        body: { email: approvalEmail.trim(), password: approvalPassword },
      });
      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || "Aprovação falhou");
        return;
      }
      setApprover(data.manager);
      setApprovalOpen(false);
      setApprovalPassword("");
      toast.success(`Aprovado por ${data.manager.name}`);
      // Inicia o giro
      const baseData: { weight?: number }[] = spiff.roulette_pool_id
        ? (prizesQuery.data ?? []).map((p: any) => ({ weight: Number(p.weight ?? 1) }))
        : [];
      const options = buildOptions();
      if (options.length === 0) {
        toast.error("Nenhum prêmio configurado nesta roleta.");
        return;
      }
      optionsRef.current = options;
      const winnerIdx = pickWeighted(spiff.roulette_pool_id ? baseData : options.map(() => ({ weight: 1 })));
      setFinalOption(options[winnerIdx]);
      setPhase("spinning");
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleSave = async () => {
    if (!finalOption || !currentUser?.account_id) return;
    if (!approver) {
      toast.error("Aprovação do gestor é obrigatória");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("spiff_spins").insert({
      account_id: currentUser.account_id,
      spiff_id: spiff.id,
      user_id: user.uid,
      prize_amount: finalOption.cash_value,
      prize_id: finalOption.id,
      prize_label: finalOption.label,
      created_by: currentUser.id,
      approved_by: approver.id,
      approved_at: new Date().toISOString(),
    } as any);
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

  const approvalDialog = (
    <Dialog open={approvalOpen} onOpenChange={(o) => !approvalLoading && setApprovalOpen(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            Aprovação do Gestor
          </DialogTitle>
          <DialogDescription>
            Para girar a roleta de <strong>{user.name}</strong>, um gestor (Head, Gerente, Diretor, Sócio ou Admin) precisa aprovar com suas credenciais.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="approver-email" className="text-xs">Email do gestor</Label>
            <Input
              id="approver-email"
              type="email"
              autoComplete="off"
              value={approvalEmail}
              onChange={(e) => setApprovalEmail(e.target.value)}
              placeholder="gestor@empresa.com"
              disabled={approvalLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approver-pass" className="text-xs">Senha</Label>
            <Input
              id="approver-pass"
              type="password"
              autoComplete="new-password"
              value={approvalPassword}
              onChange={(e) => setApprovalPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitApproval(); }}
              disabled={approvalLoading}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setApprovalOpen(false)} disabled={approvalLoading}>
            Cancelar
          </Button>
          <Button onClick={submitApproval} disabled={approvalLoading} className="gap-1.5">
            <Lock className="h-4 w-4" />
            {approvalLoading ? "Verificando..." : "Aprovar e Girar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ───────────── TV Mode (fullscreen) ─────────────
  if (tvMode && open) {
    return (
      <>
      {approvalDialog}
      <div className="fixed inset-0 z-[200] bg-gradient-to-br from-background via-background to-primary/10 flex flex-col items-center justify-center p-8">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 h-10 w-10"
          onClick={() => setTvMode(false)}
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-3 text-sm">
            🎰 Roleta da Sorte
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold mb-2">{spiff.name}</h1>
          <p className="text-2xl md:text-3xl text-muted-foreground">{user.name}</p>
        </div>

        <div className="flex-1 w-full max-w-5xl flex items-center justify-center">
          {phase === "spinning" && finalOption ? (
            <RouletteCardShuffle
              key={`tv-${finalOption.id}-${Date.now()}`}
              options={optionsRef.current}
              winner={finalOption}
              soundEnabled={soundEnabled}
              cardCount={9}
              size="xl"
              onRevealComplete={() => setPhase("result")}
            />
          ) : phase === "idle" ? (
            <Button
              onClick={requestApproval}
              size="lg"
              className="h-24 px-12 text-3xl gap-3 bg-amber-500 hover:bg-amber-600 text-white"
              disabled={pendingSpins <= 0 || (usingPool && prizesQuery.isLoading)}
            >
              <Dice5 className="h-10 w-10" />
              GIRAR ROLETA
            </Button>
          ) : null}
        </div>

        {phase === "result" && finalOption && (
          <div className="flex gap-3 mt-6">
            <Button onClick={handleSave} size="lg" className="h-14 px-8 text-lg gap-2" disabled={saving}>
              <Trophy className="h-6 w-6" />
              {saving ? "Salvando..." : "Confirmar Prêmio"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 text-lg"
              onClick={() => {
                setPhase("idle");
                setFinalOption(null);
              }}
              disabled={saving}
            >
              Girar novamente
            </Button>
          </div>
        )}
      </div>
      </>
    );
  }

  // ───────────── Modal padrão ─────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Dice5 className="h-5 w-5 text-amber-500" />
              Roleta da Sorte — {spiff.name}
            </DialogTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSoundEnabled((s) => !s)}
                title={soundEnabled ? "Silenciar" : "Ativar som"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              {phase === "idle" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setTvMode(true)}
                  title="Exibir em tela cheia (TV)"
                >
                  <Tv className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <DialogDescription>
            {user.name} • {pendingSpins} {pendingSpins === 1 ? "giro pendente" : "giros pendentes"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {phase === "idle" && (
            <div className="rounded-2xl border-2 border-dashed bg-muted/30 p-8 text-center min-h-[240px] flex flex-col items-center justify-center">
              <Dice5 className="h-16 w-16 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Pronto para sortear
              </p>
              <Badge variant="outline" className="mt-3 text-[10px]">
                {usingPool
                  ? `${(prizesQuery.data?.length ?? 0)} prêmios disponíveis`
                  : `Faixa: R$ ${formatBRL(min)} a R$ ${formatBRL(max)}`}
              </Badge>
            </div>
          )}

          {phase !== "idle" && finalOption && (
            <RouletteCardShuffle
              key={`modal-${finalOption.id}-${finalOption.label}`}
              options={optionsRef.current}
              winner={finalOption}
              soundEnabled={soundEnabled}
              cardCount={7}
              size="normal"
              onRevealComplete={() => setPhase("result")}
            />
          )}

          <div className="flex flex-col gap-2">
            {phase === "idle" && (
              <Button
                onClick={requestApproval}
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
                Embaralhando cartas...
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
