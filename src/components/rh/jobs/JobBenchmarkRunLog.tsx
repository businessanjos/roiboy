import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, ChevronDown, User, Sparkles, Gift } from "lucide-react";

interface Props {
  jobId?: string | null;
  refreshKey?: number;
}

interface RunRow {
  id: string;
  created_at: string;
  trigger_source: string;
  offered_salary_min: number | null;
  offered_salary_max: number | null;
  market_p25: number | null;
  market_p50: number | null;
  market_p75: number | null;
  offered_benefits: string[] | null;
  catalog_benefits: string[] | null;
  catalog_benefits_matched: number | null;
  typical_benefits: string[] | null;
  covered_benefits: string[] | null;
  missing_benefits: string[] | null;
  extra_benefits: string[] | null;
  score_total: number | null;
  score_tier: string | null;
  score_salary: number | null;
  score_benefits: number | null;
  score_location: number | null;
  triggered_by: string | null;
}

const fmtBRL = (n?: number | null) =>
  typeof n === "number" && !isNaN(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  auto: "Automático",
  job_created: "Criação da vaga",
};

export function JobBenchmarkRunLog({ jobId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("hr_job_benchmark_runs")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const list = (data ?? []) as unknown as RunRow[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.triggered_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: users } = await supabase.from("users").select("id, name").in("id", ids);
        if (!cancelled) {
          setNames(Object.fromEntries((users ?? []).map((u: any) => [u.id, u.name || "—"])));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, refreshKey]);

  if (!jobId || rows.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8">
          <span className="flex items-center gap-2 text-xs">
            <History className="h-3.5 w-3.5" />
            Log de recálculo ({rows.length})
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 space-y-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-xs">
                {new Date(r.created_at).toLocaleString("pt-BR")}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {SOURCE_LABEL[r.trigger_source] ?? r.trigger_source}
              </Badge>
              {r.triggered_by && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3" />
                  {names[r.triggered_by] ?? "—"}
                </span>
              )}
              {typeof r.score_total === "number" && (
                <Badge className="ml-auto text-[10px]">
                  Score {r.score_total}/100{r.score_tier ? ` · ${r.score_tier}` : ""}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-muted-foreground">
              <div>
                <p className="uppercase tracking-wide text-[9px]">Salário ofertado</p>
                <p className="text-foreground">
                  {fmtBRL(r.offered_salary_min)}
                  {r.offered_salary_max ? ` – ${fmtBRL(r.offered_salary_max)}` : ""}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-[9px]">Mercado (P25/P50/P75)</p>
                <p className="text-foreground">
                  {fmtBRL(r.market_p25)} / {fmtBRL(r.market_p50)} / {fmtBRL(r.market_p75)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-[9px]">Eixos</p>
                <p className="text-foreground">
                  Sal {r.score_salary ?? "—"} · Ben {r.score_benefits ?? "—"} · Loc {r.score_location ?? "—"}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-[9px]">Catálogo aplicado</p>
                <p className="text-foreground inline-flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  {r.catalog_benefits_matched ?? 0}/{r.catalog_benefits?.length ?? 0} benefícios
                </p>
              </div>
            </div>

            {!!r.offered_benefits?.length && (
              <div>
                <p className="uppercase tracking-wide text-[9px] text-muted-foreground mb-1">
                  Benefícios considerados no score
                </p>
                <div className="flex flex-wrap gap-1">
                  {r.offered_benefits.map((b, i) => {
                    const fromCatalog = (r.catalog_benefits ?? []).some(
                      (c) =>
                        c.toLowerCase().includes(b.toLowerCase()) ||
                        b.toLowerCase().includes(c.toLowerCase()),
                    );
                    return (
                      <Badge
                        key={`${b}-${i}`}
                        variant={fromCatalog ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {fromCatalog && <Sparkles className="h-2.5 w-2.5 mr-1" />}
                        {b}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>
                Cobertos: {r.covered_benefits?.length ?? 0}/{r.typical_benefits?.length ?? 0}
              </span>
              {!!r.missing_benefits?.length && <span>Faltantes: {r.missing_benefits.join(", ")}</span>}
              {!!r.extra_benefits?.length && <span>Diferenciais: {r.extra_benefits.join(", ")}</span>}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
