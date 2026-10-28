import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildEducationOptions, educationMatches } from "@/lib/dashboard/clientEducation";

interface Props {
  /** Clientes já filtrados pelo dashboard (produto). */
  clients: Array<{ id: string; full_name: string; hasActiveContract?: boolean }>;
  educationById: Map<string, string | null>;
  /** Clientes sob contrato no início do período selecionado. Sem isso, usa hasActiveContract. */
  activeClientIds?: Set<string>;
  /** Formação selecionada no filtro do topo: recebe destaque. */
  highlightValue?: string;
}

const TOP_COUNT = 8;

export function ClientsByEducationChart({ clients, educationById, activeClientIds, highlightValue }: Props) {
  const [selected, setSelected] = useState<{ value: string; label: string } | null>(null);
  const [search, setSearch] = useState("");
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
    const q = search.trim().toLowerCase();
    return active
      .filter((c) => educationMatches(educationById.get(c.id) ?? null, selected.value))
      .filter((c) => !q || c.full_name?.toLowerCase().includes(q))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"));
  }, [selected, search, active, educationById]);

  const open = (entry: { value: string; label: string }) => {
    setSearch("");
    setSelected(entry);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Clientes por Formação
        </CardTitle>
        <CardDescription>
          {active.length} clientes com contrato vigente no período selecionado. Clique numa formação para ver quem são.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente ativo.</p>
        ) : (
          <div className="space-y-1">
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
                  className={`group w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-muted/60 ${isHighlighted ? "bg-primary/10 ring-1 ring-primary/40" : ""} ${dimmed ? "opacity-50 hover:opacity-100" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                    {i + 1}º
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{d.label}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        <span className="text-sm font-semibold text-foreground">{d.count}</span>
                        {" · "}
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-300 group-hover:from-primary group-hover:to-primary"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full text-xs text-muted-foreground"
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
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.label}</DialogTitle>
            <DialogDescription>{people.length} cliente(s) sob contrato no período</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y rounded-md border">
            {people.map((c) => (
              <Link
                key={c.id}
                to={`/clients/${c.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{c.full_name}</span>
                <span className="text-xs text-muted-foreground">{educationById.get(c.id) || "Sem formação"}</span>
              </Link>
            ))}
            {people.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum cliente encontrado.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
