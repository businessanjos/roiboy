import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingDown, CalendarX } from "lucide-react";

interface LostContract {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  cancelled_at: string | null;
  status_changed_at: string | null;
  value: number;
  client_id: string;
  product_id: string | null;
  cancellation_reason: string | null;
  cancellation_justification: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: LostContract[];
  clientsMap: Record<string, string>;
  productsMap: Record<string, { name: string; color: string | null }>;
  totalLost: number;
  cancelledValue: number;
  endedValue: number;
  periodLabel: string;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancelado",
  dismissed: "Dispensado",
  dropout_7d: "Desistência 7d",
  ended: "Encerrado",
};

export function LostValueBreakdownDialog({
  open,
  onOpenChange,
  contracts,
  clientsMap,
  productsMap,
  totalLost,
  cancelledValue,
  endedValue,
  periodLabel,
}: Props) {
  const sorted = useMemo(
    () =>
      [...contracts].sort((a, b) => {
        const da = a.cancelled_at || a.status_changed_at || a.end_date || "";
        const db = b.cancelled_at || b.status_changed_at || b.end_date || "";
        return db.localeCompare(da);
      }),
    [contracts],
  );

  const reasonStats = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const c of contracts) {
      const isChurn = ["cancelled", "dismissed", "dropout_7d"].includes(c.status);
      const key = isChurn
        ? c.cancellation_reason?.trim() || "Sem motivo informado"
        : "Encerramento natural (fim do contrato)";
      const cur = map.get(key) || { count: 0, value: 0 };
      cur.count += 1;
      cur.value += c.value || 0;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([reason, v]) => ({ reason, ...v }))
      .sort((a, b) => b.value - a.value);
  }, [contracts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-danger" />
            Valor Perdido — {periodLabel}
          </DialogTitle>
          <DialogDescription>
            Detalhamento dos contratos que saíram da base no período selecionado, somando{" "}
            <strong className="text-danger">{fmtBRL(totalLost)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2">
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
            <p className="text-xs text-muted-foreground font-medium">Cancelamentos / Desistências</p>
            <p className="text-xl font-bold text-danger">{fmtBRL(cancelledValue)}</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs text-muted-foreground font-medium">Encerramentos Naturais</p>
            <p className="text-xl font-bold text-amber-600">{fmtBRL(endedValue)}</p>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground font-medium">Total de Contratos</p>
            <p className="text-xl font-bold text-foreground">{contracts.length}</p>
          </div>
        </div>

        {reasonStats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Principais motivos</h4>
            <div className="space-y-1.5">
              {reasonStats.slice(0, 5).map((r) => {
                const pct = totalLost > 0 ? (r.value / totalLost) * 100 : 0;
                return (
                  <div key={r.reason} className="flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 mb-1">
                        <span className="truncate font-medium">{r.reason}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {r.count}× · {fmtBRL(r.value)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-danger rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <h4 className="text-sm font-semibold mt-3 mb-2">Contratos ({sorted.length})</h4>
          <ScrollArea className="flex-1 border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum contrato perdido no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((c) => {
                    const exitRaw = c.cancelled_at || c.status_changed_at || c.end_date;
                    const exitDate = exitRaw ? parseISO(exitRaw) : null;
                    const isChurn = ["cancelled", "dismissed", "dropout_7d"].includes(c.status);
                    const product = c.product_id ? productsMap[c.product_id] : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {clientsMap[c.client_id] || "—"}
                        </TableCell>
                        <TableCell>
                          {product ? (
                            <Badge
                              style={{
                                backgroundColor: `${product.color || "#6b7280"}20`,
                                color: product.color || "#6b7280",
                                borderColor: `${product.color || "#6b7280"}40`,
                              }}
                              variant="outline"
                            >
                              {product.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isChurn
                                ? "border-danger/40 text-danger bg-danger/5"
                                : "border-amber-500/40 text-amber-600 bg-amber-500/5"
                            }
                          >
                            {isChurn ? <TrendingDown className="h-3 w-3 mr-1" /> : <CalendarX className="h-3 w-3 mr-1" />}
                            {STATUS_LABELS[c.status] || c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {exitDate ? format(exitDate, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {fmtBRL(c.value || 0)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[260px]">
                          {isChurn ? (
                            <div>
                              <div className="font-medium">{c.cancellation_reason || "—"}</div>
                              {c.cancellation_justification && (
                                <div className="text-muted-foreground line-clamp-2">
                                  {c.cancellation_justification}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Encerramento natural</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
