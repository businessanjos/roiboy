import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FieldValueBadge } from "@/components/custom-fields/FieldValueBadge";
import type { CustomField } from "@/components/custom-fields/CustomFieldsManager";

interface DealInfo {
  id: string;
  title: string | null;
  value: number | null;
  status: string | null;
  stage: string | null;
}

interface FieldEntry {
  field: CustomField;
  value: unknown;
}

function pickValue(field: CustomField, row: Record<string, unknown>): unknown {
  switch (field.field_type) {
    case "boolean":
      return row.value_boolean;
    case "number":
    case "currency":
      return row.value_number;
    case "date":
      return row.value_date;
    case "multi_select":
    case "user":
    case "multi_instagram":
    case "location":
      return row.value_json;
    default:
      return row.value_text ?? row.value_json;
  }
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function DealInfoPanel({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealInfo | null>(null);
  const [entries, setEntries] = useState<FieldEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: d }, { data: fv }, { data: cf }] = await Promise.all([
        supabase
          .from("deals")
          .select("id, title, value, status, stage_id")
          .eq("id", dealId)
          .maybeSingle(),
        supabase
          .from("deal_field_values")
          .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
          .eq("deal_id", dealId),
        supabase
          .from("custom_fields")
          .select("*")
          .eq("show_in_deals", true)
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
      ]);
      if (cancelled) return;
      if (!d) {
        setDeal(null);
        setLoading(false);
        return;
      }
      const row = d as Record<string, unknown>;

      let stage: string | null = null;
      if (row.stage_id) {
        const { data: st } = await supabase
          .from("deal_stages")
          .select("name")
          .eq("id", row.stage_id as string)
          .maybeSingle();
        stage = (st as { name?: string } | null)?.name ?? null;
      }
      if (cancelled) return;

      const byId = new Map<string, Record<string, unknown>>();
      ((fv as Record<string, unknown>[]) ?? []).forEach((f) =>
        byId.set(f.field_id as string, f)
      );

      const list: FieldEntry[] = ((cf as unknown as CustomField[]) ?? [])
        .map((field) => {
          const raw = byId.get(field.id);
          return raw ? { field, value: pickValue(field, raw) } : null;
        })
        .filter((e): e is FieldEntry => !!e && hasValue(e.value));

      setDeal({
        id: row.id as string,
        title: (row.title as string) ?? null,
        value: (row.value as number) ?? null,
        status: (row.status as string) ?? null,
        stage,
      });
      setEntries(list);
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
          onClick={() => window.open(`/deals?deal=${deal.id}`, "_blank", "noopener")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir
        </Button>
      </div>

      {entries.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {entries.map(({ field, value }) => (
            <div key={field.id} className="rounded-md bg-muted/40 px-2.5 py-1.5 min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {field.name}
              </p>
              <div className="mt-0.5">
                <FieldValueBadge field={field} value={value} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
