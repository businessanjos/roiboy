import { useMemo, useState } from "react";
import { Bug, CheckCircle2, XCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Deal } from "@/hooks/useDeals";
import type { ActivityStatus } from "@/hooks/useBatchDealActivityStatus";
import { explainDealActivityFilters, normalizeForSearch } from "@/hooks/usePipelineFilters";

interface PipelineDebugDialogProps {
  deals: Deal[];
  activityStatusMap: Record<string, ActivityStatus>;
  isLoading?: boolean;
}

const EMPTY_STATUS: ActivityStatus = {
  pendingCount: 0,
  hasOverdue: false,
  totalActivities: 0,
  nextDueDate: null,
};

function getDealLabel(deal: Deal): string {
  return (
    deal.title ||
    deal.contact_name ||
    (deal as any).client?.full_name ||
    (deal as any).lead?.full_name ||
    "(sem título)"
  );
}

export function PipelineDebugDialog({ deals, activityStatusMap, isLoading }: PipelineDebugDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const results = useMemo(() => {
    const term = normalizeForSearch(search.trim());
    if (!term) return deals.slice(0, 30);
    return deals
      .filter((d) => normalizeForSearch(getDealLabel(d)).includes(term))
      .slice(0, 30);
  }, [deals, search]);

  const selected = selectedId ? deals.find((d) => d.id === selectedId) ?? null : null;
  const selectedStatus = selected ? activityStatusMap[selected.id] ?? EMPTY_STATUS : null;
  const explanations = selectedStatus ? explainDealActivityFilters(selectedStatus) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" title="Inspecionar filtros">
          <Bug className="h-4 w-4" />
          Inspecionar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-4 w-4" /> Modo Inspeção — por que um lead aparece (ou não) em cada filtro?
          </DialogTitle>
          <DialogDescription>
            Busque um negócio deste funil e veja as métricas do backend
            (<code>totalActivities</code>, <code>pendingCount</code>, <code>hasOverdue</code>,
            <code> nextDueDate</code>) e a decisão de cada filtro recomendado com a razão exata.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          {/* Lista de deals */}
          <div className="flex flex-col gap-2 border rounded-md p-2 min-h-[380px]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título / cliente…"
                className="pl-7 h-8 text-sm"
              />
            </div>
            <ScrollArea className="h-[340px]">
              <div className="flex flex-col gap-1 pr-2">
                {isLoading && (
                  <div className="text-xs text-muted-foreground p-2">Carregando métricas do backend…</div>
                )}
                {!isLoading && results.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">Nenhum negócio encontrado neste funil.</div>
                )}
                {results.map((d) => {
                  const s = activityStatusMap[d.id] ?? EMPTY_STATUS;
                  const isSel = d.id === selectedId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      className={`text-left rounded-md px-2 py-1.5 text-xs border transition-colors ${
                        isSel ? "bg-accent border-accent-foreground/20" : "hover:bg-muted border-transparent"
                      }`}
                    >
                      <div className="font-medium line-clamp-1">{getDealLabel(d)}</div>
                      <div className="flex gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                        <span>total: <b>{s.totalActivities}</b></span>
                        <span>·</span>
                        <span>pendentes: <b>{s.pendingCount}</b></span>
                        {s.hasOverdue && <span className="text-destructive">· ⚠︎ vencida</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="text-[10px] text-muted-foreground pt-1">
              Mostrando {results.length} de {deals.length}. Refine a busca para ver mais.
            </div>
          </div>

          {/* Detalhe */}
          <div className="border rounded-md p-3 min-h-[380px]">
            {!selected && (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center">
                Selecione um negócio à esquerda para inspecionar por que ele aparece
                (ou não) em cada filtro recomendado.
              </div>
            )}
            {selected && selectedStatus && (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-sm font-semibold">{getDealLabel(selected)}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{selected.id}</div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <MetricCard label="totalActivities" value={selectedStatus.totalActivities} />
                  <MetricCard label="pendingCount" value={selectedStatus.pendingCount} />
                  <MetricCard
                    label="hasOverdue"
                    value={selectedStatus.hasOverdue ? "sim" : "não"}
                    tone={selectedStatus.hasOverdue ? "danger" : "neutral"}
                  />
                  <MetricCard label="nextDueDate" value={selectedStatus.nextDueDate ?? "—"} />
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  {explanations.map((exp) => (
                    <div
                      key={exp.filterId}
                      className={`rounded-md border p-2.5 ${
                        exp.matches ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {exp.matches ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{exp.filterName}</span>
                        <Badge variant={exp.matches ? "default" : "secondary"} className="ml-auto text-[10px]">
                          {exp.matches ? "match" : "no match"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{exp.reason}</p>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-muted-foreground leading-relaxed">
                  As métricas vêm da RPC <code>get_deal_activity_stats</code> — mesma fonte
                  usada pelos filtros do pipeline em todos os funis. Se um número aqui
                  divergir do card, é bug no card, não no filtro.
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={`rounded-md border p-2 ${
        tone === "danger" ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
