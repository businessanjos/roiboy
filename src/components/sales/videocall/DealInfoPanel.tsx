import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface DealInfo {
  id: string;
  title: string | null;
  value: number | null;
  status: string | null;
  stage: string | null;
  fields: { name: string; value: string }[];
}

function formatValue(row: Record<string, unknown>): string {
  if (row.value_text) return String(row.value_text);
  if (row.value_number !== null && row.value_number !== undefined)
    return Number(row.value_number).toLocaleString("pt-BR");
  if (row.value_date) return new Date(String(row.value_date)).toLocaleDateString("pt-BR");
  if (row.value_boolean !== null && row.value_boolean !== undefined)
    return row.value_boolean ? "Sim" : "Não";
  if (row.value_json) {
    const j = row.value_json;
    if (Array.isArray(j)) return j.join(", ");
    return typeof j === "string" ? j : JSON.stringify(j);
  }
  return "";
}

export function DealInfoPanel({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: d }, { data: fv }] = await Promise.all([
        supabase
          .from("deals")
          .select("id, title, value, status, deal_stages(name)")
          .eq("id", dealId)
          .maybeSingle(),
        supabase
          .from("deal_field_values")
          .select(
            "value_text, value_number, value_boolean, value_date, value_json, custom_fields(name, display_order, is_active)"
          )
          .eq("deal_id", dealId),
      ]);
      if (cancelled) return;
      if (!d) {
        setDeal(null);
        setLoading(false);
        return;
      }
      const row = d as Record<string, unknown>;
      const stageRel = row.deal_stages as { name?: string } | null;
      const fields = ((fv as Record<string, unknown>[]) ?? [])
        .map((f) => {
          const cf = f.custom_fields as { name?: string; display_order?: number; is_active?: boolean } | null;
          return {
            name: cf?.name ?? "",
            order: cf?.display_order ?? 999,
            active: cf?.is_active !== false,
            value: formatValue(f),
          };
        })
        .filter((f) => f.name && f.value && f.active)
        .sort((a, b) => a.order - b.order)
        .map(({ name, value }) => ({ name, value }));

      setDeal({
        id: row.id as string,
        title: (row.title as string) ?? null,
        value: (row.value as number) ?? null,
        status: (row.status as string) ?? null,
        stage: stageRel?.name ?? null,
        fields,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando dados do negócio...
      </div>
    );
  }

  if (!deal) return null;

  return (
    <div className="rounded-lg border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{deal.title ?? "Negócio"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {deal.stage && (
              <Badge variant="secondary" className="text-[11px]">
                {deal.stage}
              </Badge>
            )}
            {deal.status && (
              <Badge variant="outline" className="text-[11px]">
                {deal.status}
              </Badge>
            )}
            {deal.value ? (
              <Badge variant="outline" className="text-[11px]">
                {Number(deal.value).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 text-xs"
          onClick={() => window.open(`/deals/${deal.id}`, "_blank", "noopener")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir
        </Button>
      </div>

      {deal.fields.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {deal.fields.map((f) => (
            <div key={f.name} className="rounded-md bg-muted/40 px-2.5 py-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.name}</p>
              <p className="text-xs font-medium break-words">{f.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
