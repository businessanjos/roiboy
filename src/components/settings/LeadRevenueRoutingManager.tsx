import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, GitBranch, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const FATURAMENTO_FIELD_ID = "ed5c7c0e-0740-4945-b982-70a593ffae0c";
const DEFAULT = "__default__";

/** Valor máximo (em mil) da faixa, para ordenar e explicar a regra padrão. */
function rangeTop(label: string): number {
  const l = label.toLowerCase();
  const nums = (l.match(/\d+/g) || []).map(Number);
  if (!nums.length) return 0;
  if (l.includes("abaixo")) return nums[0];
  if (l.includes("acima")) return nums[0] + 0.5;
  return Math.max(...nums);
}

export function LeadRevenueRoutingManager() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["lead-revenue-routing", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const [field, pipes, rules] = await Promise.all([
        supabase.from("custom_fields").select("options").eq("id", FATURAMENTO_FIELD_ID).maybeSingle(),
        supabase.from("pipelines").select("id, name").eq("account_id", accountId!).eq("is_active", true).order("created_at"),
        supabase.from("lead_revenue_routing").select("revenue_value, pipeline_id").eq("account_id", accountId!),
      ]);
      const options = ((field.data?.options as any[]) || [])
        .map((o) => ({ value: String(o.value), label: String(o.label) }))
        .sort((a, b) => rangeTop(a.label) - rangeTop(b.label));
      return { options, pipelines: pipes.data || [], rules: rules.data || [] };
    },
  });

  const pipeName = (id?: string | null) => data?.pipelines.find((p) => p.id === id)?.name;
  const defaultPipe = (label: string) => {
    const mql = rangeTop(label) > 30;
    return data?.pipelines.find((p) => (mql ? /^closer$/i.test(p.name) : /e-pass|eternum pass/i.test(p.name)))?.name
      ?? (mql ? "Closer" : "E-Pass / Clinica Ryka");
  };

  const save = useMutation({
    mutationFn: async ({ value, pipelineId }: { value: string; pipelineId: string | null }) => {
      if (!pipelineId) {
        const { error } = await supabase.from("lead_revenue_routing").delete()
          .eq("account_id", accountId!).eq("revenue_value", value);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("lead_revenue_routing").upsert(
        { account_id: accountId!, revenue_value: value, pipeline_id: pipelineId, updated_by: currentUser?.id, updated_at: new Date().toISOString() },
        { onConflict: "account_id,revenue_value" },
      );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead-revenue-routing", accountId] }); toast.success("Destino salvo"); },
    onError: () => toast.error("Não foi possível salvar. Só gestores podem alterar o roteamento."),
  });

  const rows = useMemo(() => (data?.options || []).map((o) => {
    const rule = data!.rules.find((r) => r.revenue_value === o.value);
    const custom = rule?.pipeline_id ? pipeName(rule.pipeline_id) : null;
    return { ...o, ruleId: rule?.pipeline_id ?? null, custom, fallback: defaultPipe(o.label) };
  }), [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />Roteamento de leads por faturamento</CardTitle>
        <CardDescription>
          Defina para qual funil cada faixa de faturamento do formulário abre o negócio. Vale para leads novos e para quem preenche de novo sem negócio aberto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong className="text-foreground">Padrão:</strong> até R$ 30 mil vai para E-Pass / Clinica Ryka e acima de R$ 30 mil vai para Closer.
            Escolher um funil aqui substitui o padrão só daquela faixa. A etiqueta MQL do lead não muda.
          </p>
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {rows.map((r) => (
              <div key={r.value} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto_15rem] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Hoje vai para <strong className="text-foreground">{r.custom ?? r.fallback}</strong>
                    {r.custom ? <Badge variant="outline" className="ml-2 border-primary/40 text-primary">definido pelo gestor</Badge> : <span className="ml-1">(padrão)</span>}
                  </p>
                </div>
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
                <Select
                  value={r.ruleId ?? DEFAULT}
                  onValueChange={(v) => save.mutate({ value: r.value, pipelineId: v === DEFAULT ? null : v })}
                  disabled={save.isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT}>Padrão ({r.fallback})</SelectItem>
                    {data!.pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
