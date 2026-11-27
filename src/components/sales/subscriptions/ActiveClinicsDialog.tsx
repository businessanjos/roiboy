import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatBRL, type PortfolioActiveClinic } from "@/lib/sales/payPortfolio";

const dayBR = (day: string | null) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : null);
const plain = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
};

/** Quem são as clínicas contadas em "Clínicas Ativas"; cada linha abre o negócio no card lateral. */
export function ActiveClinicsDialog({ open, onOpenChange, clinics, onOpenDeal }: {
  open: boolean; onOpenChange: (open: boolean) => void; clinics: PortfolioActiveClinic[]; onOpenDeal: (dealId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const q = plain(search.trim());
    return q ? clinics.filter(c => plain(`${c.clinic} ${c.seller ?? ""}`).includes(q)) : clinics;
  }, [clinics, search]);
  const totalMrr = clinics.reduce((s, c) => s + c.mrrCents, 0);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) setSearch(""); onOpenChange(o); }}>
      <DialogContent className="flex max-h-[86vh] w-[calc(100vw-1.5rem)] max-w-xl flex-col gap-3 p-4 sm:p-5" data-testid="active-clinics-dialog">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 rounded-lg bg-muted/50 p-3 pr-10 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><CheckCircle2 className="h-5 w-5" strokeWidth={1.5} /></span>
          <div className="min-w-0">
            <DialogTitle className="text-base">Clínicas ativas</DialogTitle>
            <DialogDescription className="text-xs">
              {clinics.length} {clinics.length === 1 ? "clínica" : "clínicas"} · {formatBRL(totalMrr)} de receita mensal
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clínica ou vendedor" aria-label="Buscar clínica ou vendedor"
              className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {search && (
              <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {search.trim() && <span className="shrink-0 text-xs text-muted-foreground">{shown.length} de {clinics.length}</span>}
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              Nenhuma clínica encontrada.
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSearch("")}>Limpar busca</button>
            </div>
          ) : (
            <ul className="divide-y">
              {shown.map((c, i) => (
                <li key={c.dealId}>
                  <button
                    type="button" onClick={() => onOpenDeal(c.dealId)} title="Abrir o negócio"
                    className="group grid h-[58px] w-full grid-cols-[1.5rem_2.25rem_minmax(0,1fr)_auto_1rem] items-center gap-2.5 rounded-md px-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-right text-xs tabular-nums text-muted-foreground/70">{i + 1}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initials(c.clinic)}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{c.clinic}</span>
                        {c.overdue && <Badge variant="outline" className="shrink-0 border-destructive/40 px-1.5 py-0 text-[10px] font-normal text-destructive">Em atraso</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.kind, dayBR(c.since) ? `desde ${dayBR(c.since)}` : null, c.seller || "Sem vendedor"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums">{formatBRL(c.mrrCents)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                      <span className="block text-xs text-muted-foreground">{formatBRL(c.receivedCents)} recebidos</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
