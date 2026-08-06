import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, CalendarClock, Link2, Sparkles, ArrowRight } from "lucide-react";
import { TIER_TICKET, tierLabel, formatTicketRange } from "./tierTicket";

const DEFAULT_SOURCE_URL =
  "https://drive.google.com/file/d/1ElUYqvydwXi1z2kgFJKkAVyjaiZ4wf2-/view";

type SyncConfig = {
  id: string;
  source_url: string;
  auto_enabled: boolean;
  interval_days: number;
  last_run_at: string | null;
  next_run_at: string;
};

type SyncRun = {
  id: string;
  status: string;
  trigger_source: string;
  started_at: string;
  finished_at: string | null;
  clubs_found: number;
  new_count: number;
  tier_changed_count: number;
  missing_count: number;
  changes: any;
  error: string | null;
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export function CompetitorsSyncPanel() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [urlDraft, setUrlDraft] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ["mi-competitor-sync-config", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_competitor_sync_config")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SyncConfig | null;
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["mi-competitor-sync-runs", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_competitor_sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as unknown as SyncRun[];
    },
  });

  const sourceUrl = urlDraft ?? config?.source_url ?? DEFAULT_SOURCE_URL;

  const saveConfig = useMutation({
    mutationFn: async (patch: Partial<SyncConfig>) => {
      if (!currentUser?.account_id) throw new Error("Sem conta");
      if (config?.id) {
        const { error } = await supabase
          .from("mi_competitor_sync_config")
          .update(patch as never)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mi_competitor_sync_config").insert({
          account_id: currentUser.account_id,
          source_url: sourceUrl,
          interval_days: 30,
          ...patch,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      setUrlDraft(null);
      qc.invalidateQueries({ queryKey: ["mi-competitor-sync-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("mi-competitors-refresh", {
        body: { sourceUrl },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = (data as any)?.results?.[0];
      toast.success(
        r
          ? `${r.clubs_found} clubes lidos · ${r.new_count} novos · ${r.tier_changed_count} mudaram de categoria`
          : "Atualização concluída",
      );
      qc.invalidateQueries({ queryKey: ["mi-competitors"] });
      qc.invalidateQueries({ queryKey: ["mi-competitor-sync-runs"] });
      qc.invalidateQueries({ queryKey: ["mi-competitor-sync-config"] });
    } catch (e: any) {
      toast.error(e.message || "Falha na atualização");
    } finally {
      setRunning(false);
    }
  };

  const lastRun = runs[0];
  const lastChanges: any[] = Array.isArray(lastRun?.changes) ? lastRun!.changes : [];

  const nextLabel = useMemo(() => {
    if (!config?.auto_enabled) return "Atualização automática desligada";
    if (!config?.next_run_at) return "—";
    const days = Math.max(
      0,
      Math.ceil((new Date(config.next_run_at).getTime() - Date.now()) / 86400000),
    );
    return `${fmt(config.next_run_at)} (em ${days} dia${days === 1 ? "" : "s"})`;
  }, [config]);

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Atualização automática do Members Book</h3>
              <Badge variant="outline">a cada {config?.interval_days ?? 30} dias</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              O link é republicado 1x por mês. A cada ciclo relemos o PDF, cadastramos clubes novos e
              registramos quem mudou de categoria (Bronze → Prata → Ouro → Platinum).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={config?.auto_enabled ?? true}
                onCheckedChange={(v) => saveConfig.mutate({ auto_enabled: v })}
              />
              <span className="text-xs text-muted-foreground">Automático</span>
            </div>
            <Button size="sm" onClick={runNow} disabled={running}>
              {running ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Regenerar agora
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            className="h-8 text-xs"
            value={sourceUrl}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="Link do Members Book no Google Drive"
          />
          {urlDraft !== null && urlDraft !== config?.source_url && (
            <Button size="sm" variant="outline" onClick={() => saveConfig.mutate({ source_url: sourceUrl })}>
              Salvar link
            </Button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <div className="p-2 rounded bg-muted">
            <p className="text-muted-foreground">Última leitura</p>
            <p className="font-medium">{fmt(config?.last_run_at)}</p>
          </div>
          <div className="p-2 rounded bg-muted">
            <p className="text-muted-foreground inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Próxima leitura
            </p>
            <p className="font-medium">{nextLabel}</p>
          </div>
          <div className="p-2 rounded bg-muted">
            <p className="text-muted-foreground">Último resultado</p>
            <p className="font-medium">
              {lastRun
                ? lastRun.status === "error"
                  ? `Erro: ${lastRun.error?.slice(0, 60)}`
                  : `${lastRun.clubs_found} clubes · ${lastRun.new_count} novos · ${lastRun.tier_changed_count} mudanças de categoria`
                : "Nunca executada"}
            </p>
          </div>
        </div>

        {lastChanges.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold">Mudanças detectadas na última leitura</p>
            <div className="flex flex-wrap gap-1.5">
              {lastChanges.slice(0, 20).map((ch, i) => (
                <Badge key={i} variant="outline" className="text-[11px] font-normal">
                  {ch.type === "novo" && `Novo: ${ch.name}`}
                  {ch.type === "ausente" && `Saiu do book: ${ch.name}`}
                  {ch.type === "tier" && (
                    <span className="inline-flex items-center gap-1">
                      {ch.name}: {tierLabel(ch.from)} <ArrowRight className="h-3 w-3" /> {tierLabel(ch.to)}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
          <span className="text-[11px] text-muted-foreground mt-1.5">Ticket por categoria:</span>
          {Object.keys(TIER_TICKET).map((t) => (
            <Badge key={t} variant="outline" className="text-[11px] font-normal mt-1">
              {tierLabel(t)}: {formatTicketRange(t)}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
