import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dice5, Trophy, Volume2, VolumeX, Tv, X, ShieldCheck, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

type Phase = "idle" | "awaiting_approval" | "spinning" | "result";

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

  // Aprovação assíncrona
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
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
      setRequestId(null);
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

  const startSpinAfterApproval = (approverInfo: { id: string; name: string }) => {
    setApprover(approverInfo);
    const baseData: { weight?: number }[] = spiff.roulette_pool_id
      ? (prizesQuery.data ?? []).map((p: any) => ({ weight: Number(p.weight ?? 1) }))
      : [];
    const options = buildOptions();
    if (options.length === 0) {
      toast.error("Nenhum prêmio configurado nesta roleta.");
      setPhase("idle");
      return;
    }
    optionsRef.current = options;
    const winnerIdx = pickWeighted(spiff.roulette_pool_id ? baseData : options.map(() => ({ weight: 1 })));
    setFinalOption(options[winnerIdx]);
    setPhase("spinning");
  };

  const requestApproval = async () => {
    if (phase !== "idle" || pendingSpins <= 0) return;
    if (!currentUser?.account_id) return;
    if (usingPool && (prizesQuery.data?.length ?? 0) === 0) {
      toast.error("Nenhum prêmio configurado nesta roleta.");
      return;
    }
    setRequesting(true);
    const { data, error } = await supabase
      .from("spiff_spin_requests" as any)
      .insert({
        account_id: currentUser.account_id,
        spiff_id: spiff.id,
        user_id: user.uid,
        requested_by: currentUser.id,
        status: "pending",
      })
      .select("id")
      .single();
    setRequesting(false);
    if (error || !data) {
      toast.error("Erro ao solicitar aprovação: " + (error?.message ?? ""));
      return;
    }
    setRequestId((data as any).id);
    setPhase("awaiting_approval");
    toast.success("Solicitação enviada ao gestor. Aguardando aprovação...");
  };

  // Realtime: ouvir status do request
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`spin-req-${requestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "spiff_spin_requests", filter: `id=eq.${requestId}` },
        async (payload: any) => {
          const row = payload.new;
          if (row.status === "approved") {
            // Buscar nome do aprovador
            let approverName = "Gestor";
            if (row.reviewed_by) {
              const { data: u } = await supabase
                .from("users")
                .select("name")
                .eq("id", row.reviewed_by)
                .maybeSingle();
              approverName = u?.name ?? approverName;
            }
            toast.success(`Aprovado por ${approverName}!`);
            startSpinAfterApproval({ id: row.reviewed_by, name: approverName });
          } else if (row.status === "rejected") {
            toast.error(
              row.rejection_reason
                ? `Solicitação rejeitada: ${row.rejection_reason}`
                : "Solicitação rejeitada pelo gestor."
            );
            setPhase("idle");
            setRequestId(null);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const cancelRequest = async () => {
    if (!requestId) return;
    await supabase
      .from("spiff_spin_requests" as any)
      .update({ status: "cancelled" })
      .eq("id", requestId);
    setRequestId(null);
    setPhase("idle");
  };

  const handleSave = async () => {
    if (!finalOption || !currentUser?.account_id) return;
    if (!approver) {
      toast.error("Aprovação do gestor é obrigatória");
      return;
    }
    setSaving(true);
    const { data: spinRow, error } = await supabase
      .from("spiff_spins")
      .insert({
        account_id: currentUser.account_id,
        spiff_id: spiff.id,
        user_id: user.uid,
        prize_amount: finalOption.cash_value,
        prize_id: finalOption.id,
        prize_label: finalOption.label,
        created_by: currentUser.id,
        approved_by: approver.id,
        approved_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      toast.error("Erro ao registrar giro: " + error.message);
      return;
    }
    // Marcar request como consumed
    if (requestId && spinRow) {
      await supabase
        .from("spiff_spin_requests" as any)
        .update({ status: "consumed", spin_id: (spinRow as any).id })
        .eq("id", requestId);
    }
    setSaving(false);
    toast.success(`Giro registrado! ${user.name} ganhou ${finalOption.label}`);
    queryClient.invalidateQueries({ queryKey: ["spiff-spins"] });
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (phase === "spinning") return;
    if (phase === "awaiting_approval") {
      cancelRequest();
    }
    onOpenChange(false);
  };

  const renderIdleOrAwaiting = () => {
    if (phase === "awaiting_approval") {
      return (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-500/5 p-8 text-center min-h-[240px] flex flex-col items-center justify-center">
          <div className="relative">
            <Clock className="h-16 w-16 text-amber-500 mb-3" />
            <Loader2 className="absolute -top-1 -right-1 h-5 w-5 animate-spin text-amber-600" />
          </div>
          <p className="text-base font-medium text-foreground">Aguardando aprovação do gestor</p>
          <p className="text-xs text-muted-foreground mt-1">
            O gestor receberá esta solicitação na fila de aprovações.
          </p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={cancelRequest}>
            Cancelar solicitação
          </Button>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border-2 border-dashed bg-muted/30 p-8 text-center min-h-[240px] flex flex-col items-center justify-center">
        <Dice5 className="h-16 w-16 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Pronto para sortear</p>
        <Badge variant="outline" className="mt-3 text-[10px]">
          {usingPool
            ? `${prizesQuery.data?.length ?? 0} prêmios disponíveis`
            : `Faixa: R$ ${formatBRL(min)} a R$ ${formatBRL(max)}`}
        </Badge>
        <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-amber-500" />
          Requer aprovação do gestor
        </p>
      </div>
    );
  };

  // ───────────── TV Mode (fullscreen) ─────────────
  if (tvMode && open) {
    return (
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
          ) : phase === "awaiting_approval" ? (
            <div className="text-center">
              <Loader2 className="h-20 w-20 animate-spin text-amber-500 mx-auto mb-4" />
              <p className="text-3xl font-semibold">Aguardando aprovação do gestor...</p>
              <Button variant="ghost" className="mt-6" onClick={cancelRequest}>
                Cancelar solicitação
              </Button>
            </div>
          ) : phase === "idle" ? (
            <Button
              onClick={requestApproval}
              size="lg"
              className="h-24 px-12 text-3xl gap-3 bg-amber-500 hover:bg-amber-600 text-white"
              disabled={pendingSpins <= 0 || requesting || (usingPool && prizesQuery.isLoading)}
            >
              <ShieldCheck className="h-10 w-10" />
              {requesting ? "Enviando..." : "SOLICITAR GIRO"}
            </Button>
          ) : null}
        </div>

        {phase === "result" && finalOption && (
          <div className="flex gap-3 mt-6">
            <Button onClick={handleSave} size="lg" className="h-14 px-8 text-lg gap-2" disabled={saving}>
              <Trophy className="h-6 w-6" />
              {saving ? "Salvando..." : "Confirmar Prêmio"}
            </Button>
          </div>
        )}
      </div>
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
          {(phase === "idle" || phase === "awaiting_approval") && renderIdleOrAwaiting()}

          {(phase === "spinning" || phase === "result") && finalOption && (
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
                disabled={pendingSpins <= 0 || requesting || (usingPool && prizesQuery.isLoading)}
              >
                <ShieldCheck className="h-5 w-5" />
                {requesting ? "Enviando solicitação..." : "Solicitar Giro ao Gestor"}
              </Button>
            )}
            {phase === "spinning" && (
              <Button size="lg" className="w-full" disabled>
                Embaralhando cartas...
              </Button>
            )}
            {phase === "result" && finalOption && (
              <Button onClick={handleSave} size="lg" className="w-full gap-2" disabled={saving}>
                <Trophy className="h-5 w-5" />
                {saving ? "Salvando..." : `Confirmar: ${finalOption.label}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
