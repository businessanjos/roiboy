import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/financial-format";

type SyncIssue = {
  installment_id: string;
  contract_id: string | null;
  client_id: string | null;
  installment_number: number;
  due_date: string;
  installment_amount: number;
  installment_status: string;
  entry_id: string | null;
  entry_status: string | null;
  entry_amount: number | null;
  issue_type: string;
};

const ISSUE_LABELS: Record<string, { label: string; tone: "warning" | "danger" }> = {
  missing_entry: { label: "Lançamento ausente", tone: "danger" },
  installment_paid_entry_open: { label: "Parcela paga, lançamento em aberto", tone: "danger" },
  entry_paid_installment_open: { label: "Lançamento pago, parcela em aberto", tone: "danger" },
  installment_cancelled_entry_active: { label: "Parcela cancelada, lançamento ativo", tone: "warning" },
  entry_cancelled_installment_active: { label: "Lançamento cancelado, parcela ativa", tone: "warning" },
  installment_renegotiated_entry_active: { label: "Parcela renegociada, lançamento ativo", tone: "warning" },
  entry_renegotiated_installment_active: { label: "Lançamento renegociado, parcela ativa", tone: "warning" },
  amount_mismatch: { label: "Valores divergentes", tone: "warning" },
};

export function FinancialSyncIssuesAlert() {
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["financial-sync-issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_sync_issues_active" as any)
        .select("*")
        .order("due_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SyncIssue[];
    },
    staleTime: 60_000,
  });

  const summary = useMemo(() => {
    const total = data?.length ?? 0;
    const byType: Record<string, number> = {};
    (data ?? []).forEach((r) => {
      byType[r.issue_type] = (byType[r.issue_type] ?? 0) + 1;
    });
    return { total, byType };
  }, [data]);

  if (isLoading || summary.total === 0) return null;

  return (
    <>
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="rounded-full bg-warning/15 p-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {summary.total} divergência{summary.total > 1 ? "s" : ""} entre Parcelas e Lançamentos
              </span>
              {Object.entries(summary.byType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([type, count]) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className={
                      ISSUE_LABELS[type]?.tone === "danger"
                        ? "border-danger/40 text-danger-strong dark:text-danger"
                        : "border-warning/40 text-warning-strong dark:text-warning"
                    }
                  >
                    {count} · {ISSUE_LABELS[type]?.label ?? type}
                  </Badge>
                ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registros em que o status da parcela do contrato não bate com o do lançamento financeiro.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Recarregar"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Revisar
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Divergências Parcelas × Lançamentos</DialogTitle>
            <DialogDescription>
              Cada linha representa uma parcela de contrato cujo status ou valor não confere com o lançamento financeiro correspondente.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Cliente / Contrato</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status parcela</TableHead>
                  <TableHead>Status lançamento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Divergência</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r) => {
                  const meta = ISSUE_LABELS[r.issue_type];
                  return (
                    <TableRow key={r.installment_id}>
                      <TableCell className="max-w-[220px] truncate">
                        {r.client_id ? (
                          <Link
                            to={`/clients/${r.client_id}`}
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Abrir cliente <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>#{r.installment_number}</TableCell>
                      <TableCell>{new Date(r.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.installment_status}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.entry_status ? (
                          <Badge variant="outline">{r.entry_status}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-danger/40 text-danger-strong">
                            ausente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div>{formatBRL(r.installment_amount)}</div>
                        {r.entry_amount != null &&
                          Number(r.entry_amount).toFixed(2) !== Number(r.installment_amount).toFixed(2) && (
                            <div className="text-muted-foreground">lanç: {formatBRL(r.entry_amount)}</div>
                          )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            meta?.tone === "danger"
                              ? "border-danger/40 text-danger-strong dark:text-danger"
                              : "border-warning/40 text-warning-strong dark:text-warning"
                          }
                        >
                          {meta?.label ?? r.issue_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/financial/entries?installment=${r.installment_id}`}>Abrir</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
