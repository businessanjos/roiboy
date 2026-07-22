import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  Building2,
  Store,
  Boxes,
  Home,
  Stethoscope,
  Smile,
  ChevronRight,
} from "lucide-react";
import { benchmarkQueries, extractHeadline, type BenchmarkQuery } from "./marketBenchmarks";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const iconMap = {
  clinics: Building2,
  franchise: Store,
  units: Boxes,
  solo: Home,
  derm: Stethoscope,
  hof: Smile,
} as const;

const accentMap = {
  clinics: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" },
  franchise: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" },
  units: { bg: "bg-cyan-500/10", text: "text-cyan-600", border: "border-cyan-500/20" },
  solo: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20" },
  derm: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" },
  hof: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/20" },
} as const;

type Row = { id: string; query: string; answer: string; created_at: string };

interface Props {
  onOpenDetail?: (query: string) => void;
}

export function MarketSnapshotCards({ onOpenDetail }: Props) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mi-market-snapshot", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_market_research")
        .select("id, query, answer, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: !!currentUser?.account_id,
  });

  const latestByQuery = useMemo(() => {
    const map = new Map<string, Row>();
    (data ?? []).forEach((r) => {
      if (!map.has(r.query)) map.set(r.query, r);
    });
    return map;
  }, [data]);

  async function runOne(item: BenchmarkQuery) {
    setRunning(item.key);
    try {
      const { data, error } = await supabase.functions.invoke("mi-market-research", {
        body: { query: item.query, focus: item.focus, recency: "year" },
      });
      if (error) throw new Error(await extractEdgeFunctionError(error, "Falha na pesquisa"));
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`✓ ${item.label} atualizado`);
      qc.invalidateQueries({ queryKey: ["mi-market-snapshot", currentUser?.account_id] });
      qc.invalidateQueries({ queryKey: ["mi-market-research", currentUser?.account_id] });
    } catch (e: any) {
      toast.error(`${item.label}: ${e?.message || "erro"}`);
    } finally {
      setRunning(null);
    }
  }

  const runAllMutation = useMutation({
    mutationFn: async () => {
      for (const item of benchmarkQueries) {
        if (latestByQuery.has(item.query)) continue; // não regera automaticamente
        await runOne(item);
      }
    },
    onSuccess: () => toast.success("Panorama atualizado"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" /> Panorama do mercado brasileiro
          </h2>
          <p className="text-xs text-muted-foreground">
            Números-chave que servem de referência para comparar com a operação Eternum.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => runAllMutation.mutate()}
          disabled={!!running || runAllMutation.isPending}
        >
          {runAllMutation.isPending || running ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-2" />
          )}
          Preencher faltantes
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {benchmarkQueries.map((item) => {
          const Icon = iconMap[item.icon];
          const accent = accentMap[item.icon];
          const latest = latestByQuery.get(item.query);
          const { value, snippet } = extractHeadline(latest?.answer);
          const isRunning = running === item.key;

          return (
            <Card
              key={item.key}
              className={`relative overflow-hidden border ${accent.border} hover:shadow-md transition-shadow`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`p-2 rounded-lg ${accent.bg}`}>
                    <Icon className={`h-4 w-4 ${accent.text}`} />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => runOne(item)}
                    disabled={isRunning || !!running}
                    title={latest ? "Atualizar" : "Coletar dado"}
                  >
                    {isRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground line-clamp-1">
                  {item.label}
                </p>

                <div className="mt-1 min-h-[2.5rem]">
                  {isLoading ? (
                    <div className="h-7 w-24 rounded bg-muted animate-pulse" />
                  ) : value ? (
                    <p className={`text-2xl font-bold tabular-nums leading-tight ${accent.text}`}>
                      {value}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sem dado ainda</p>
                  )}
                </div>

                {snippet ? (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {snippet}
                  </p>
                ) : (
                  item.hint && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.hint}
                    </p>
                  )
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  {latest ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Atualizado {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: ptBR })}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Nunca coletado</span>
                  )}
                  {latest && onOpenDetail && (
                    <button
                      type="button"
                      onClick={() => onOpenDetail(item.query)}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Ver análise <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
