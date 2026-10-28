import { useMemo, useState } from "react";
import { GraduationCap, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientListDialog } from "@/components/dashboard/ClientListDialog";
import { buildEducationOptions, educationMatches } from "@/lib/dashboard/clientEducation";

interface Props {
  /** Clientes já filtrados pelo dashboard (produto). */
  clients: Array<{ id: string; full_name: string; hasActiveContract?: boolean }>;
  educationById: Map<string, string | null>;
  /** Clientes sob contrato no início do período selecionado. Sem isso, usa hasActiveContract. */
  activeClientIds?: Set<string>;
  /** Formação selecionada no filtro do topo: recebe destaque. */
  highlightValue?: string;
  /** Rótulo secundário de cada cliente na lista (ex.: produto). */
  metaById?: Map<string, string | null>;
  /** Períodos curtos (mês, 7 dias) partem praticamente da carteira de hoje. */
  shortPeriod?: boolean;
  periodLabel?: string;
}

const TOP_COUNT = 8;

export function ClientsByEducationChart({ clients, educationById, activeClientIds, highlightValue, metaById, shortPeriod, periodLabel }: Props) {
  const [selected, setSelected] = useState<{ value: string; label: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Clientes sob contrato no início do período filtrado (ou ativos agora, sem o conjunto).
  const active = useMemo(
    () =>
      clients.filter((c) =>
        activeClientIds ? activeClientIds.has(c.id) : c.hasActiveContract === true,
      ),
    [clients, activeClientIds],
  );

  const data = useMemo(
    () => buildEducationOptions(active.map((c) => educationById.get(c.id) ?? null)),
    [active, educationById],
  );

  const max = data[0]?.count ?? 1;
  const visible = expanded
    ? data
    : data.filter((d, i) => i < TOP_COUNT || d.value === highlightValue);
  const hiddenCount = Math.max(data.length - TOP_COUNT, 0);

  const people = useMemo(() => {
    if (!selected) return [];
    return active
      .filter((c) => educationMatches(educationById.get(c.id) ?? null, selected.value))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"));
  }, [selected, active, educationById]);

  const open = (entry: { value: string; label: string }) => {
    setSelected(entry);
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="space-y-1 p-4 pb-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
            Clientes por Formação
          </CardTitle>
          <span className="text-xs tabular-nums text-muted-foreground">
            {active.length} sob contrato no período
          </span>
        </div>
        <CardDescription className="text-xs">
          Clique numa formação para ver quem são.
        </CardDescription>
      </CardHeader>
        <CardContent className="p-4 pt-2">
          {shortPeriod && (
            <p className="mb-2.5 flex items-start gap-1.5 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
              <Info className="mt-[1px] h-3.5 w-3.5 shrink-0 text-primary/70" />
              <span>
                Período curto{periodLabel ? ` (${periodLabel})` : ""}: quase todos esses clientes
                também estão ativos hoje, então o total fica próximo do anual. Use{" "}
                <span className="font-medium text-foreground">"Este ano"</span> ou{" "}
                <span className="font-medium text-foreground">"Últimos 12 meses"</span> para
                comparar.
              </span>
            </p>
          )}
        {data.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Nenhum cliente ativo.</p>
        ) : (
          <>
            <div
              className="grid gap-x-8 sm:grid-flow-col sm:grid-cols-2 sm:[grid-template-rows:repeat(var(--edu-rows),auto)]"
              style={{ ["--edu-rows" as any]: Math.ceil(visible.length / 2) }}
            >
              {visible.map((d, i) => {
                const pct = active.length > 0 ? Math.round((d.count / active.length) * 100) : 0;
                const width = Math.max((d.count / max) * 100, 4);
                const isHighlighted = d.value === highlightValue;
                const dimmed = !!highlightValue && !isHighlighted;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => open({ value: d.value, label: d.label })}
                    className={`group flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isHighlighted ? "bg-primary/10 ring-1 ring-primary/40" : ""
                    } ${dimmed ? "opacity-45 hover:opacity-100" : ""}`}
                  >
                    <span className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {i + 1}º
                    </span>
                    <span
                      title={d.label}
                      className="w-32 shrink-0 truncate text-[13px] font-medium text-foreground lg:w-44 xl:w-52"
                    >
                      {d.label}
                    </span>
                    <span className="h-2 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-300 group-hover:from-primary/80 group-hover:to-primary"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      <span className="text-[13px] font-semibold text-foreground">{d.count}</span>
                      {" · "}
                      {pct}%
                    </span>
                  </button>
                );
              })}
            </div>
            {hiddenCount > 0 && (
              <div className="mt-1 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs text-muted-foreground"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="mr-1 h-3.5 w-3.5" />
                      Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3.5 w-3.5" />
                      Ver todas as {data.length} formações
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <ClientListDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.label ?? ""}
        description={`${people.length} cliente(s) sob contrato no período`}
        clients={people}
        metaById={metaById}
        metaFallback="Sem produto"
        icon={GraduationCap}
      />
    </Card>
  );
}
