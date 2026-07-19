import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Info, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRLPrecise } from "@/lib/financial-format";

interface Props {
  contractId: string | null;
  clientId: string | null;
  clientName?: string;
  productName?: string | null;
  productColor?: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  pending: { label: "A vencer", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  overdue: { label: "Vencido", className: "bg-red-500/15 text-red-700 border-red-500/30" },
  partially_paid: { label: "Parcial", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
};

export function ActiveClientContractSheet({
  contractId,
  clientId,
  clientName,
  productName,
  productColor,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const open = !!contractId;

  const { data, isLoading } = useQuery({
    enabled: !!contractId,
    queryKey: ["active-client-contract-detail", contractId],
    queryFn: async () => {
      const { data: contract } = await supabase
        .from("client_contracts")
        .select(
          "id, value, status, start_date, end_date, payment_method, installments_count, installments_detail, payment_groups, receivables_generated, receivables_generated_at, deal_id, product_id, notes"
        )
        .eq("id", contractId!)
        .maybeSingle();

      const { data: entries } = await supabase
        .from("financial_entries")
        .select(
          "id, description, amount, due_date, payment_date, status, installment_number, total_installments, is_conciliated, conciliated_at, bank_account_id, source"
        )
        .eq("contract_id", contractId!)
        .order("due_date", { ascending: true });

      return { contract, entries: entries || [] };
    },
  });

  const totalReceived = (data?.entries || [])
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalPending = (data?.entries || [])
    .filter((e) => ["pending", "overdue", "partially_paid"].includes(e.status))
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const conciliated = (data?.entries || []).filter((e) => e.is_conciliated).length;

  // ---- Balance audit: contract.value vs financial entries ----
  const contractValue = Number(data?.contract?.value || 0);
  const entriesSum = (data?.entries || []).reduce(
    (s, e) => s + (e.status === "cancelled" ? 0 : Number(e.amount || 0)),
    0
  );
  const paymentGroups = Array.isArray(data?.contract?.payment_groups)
    ? (data!.contract!.payment_groups as any[])
    : [];
  const pendingGroupsSum = paymentGroups
    .filter((g) => g && g.status === "pending")
    .reduce((s, g) => s + Number(g.amount || 0), 0);
  const expectedInEntries = contractValue - pendingGroupsSum;
  const balanceDiff = Number((entriesSum - expectedInEntries).toFixed(2));
  const hasDivergence = data?.contract && Math.abs(balanceDiff) > 0.01;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {clientName || "Contrato"}
          </SheetTitle>
          <SheetDescription>
            {productName ? (
              <Badge
                variant="outline"
                style={{
                  borderColor: productColor || "#6b7280",
                  color: productColor || "#6b7280",
                }}
              >
                {productName}
              </Badge>
            ) : (
              "Detalhes financeiros do contrato"
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-2 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryTile label="Valor total" value={formatBRLPrecise(Number(data?.contract?.value || 0))} />
              <SummaryTile
                label="Parcelas"
                value={data?.contract?.installments_count?.toString() ?? "—"}
              />
              <SummaryTile label="Recebido" value={formatBRLPrecise(totalReceived)} tone="ok" />
              <SummaryTile label="A receber" value={formatBRLPrecise(totalPending)} tone="warn" />
            </div>

            {/* Auditoria de saldo — flag para revisão antes de aprovar pagamento */}
            {data?.contract && data.entries.length > 0 && (
              hasDivergence ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-red-700">
                      Divergência de {formatBRLPrecise(Math.abs(balanceDiff))} — revisar antes de aprovar pagamento
                    </p>
                    <p className="text-xs text-red-700/80">
                      Contrato: {formatBRLPrecise(contractValue)}
                      {pendingGroupsSum > 0 && ` · Grupos pendentes: ${formatBRLPrecise(pendingGroupsSum)}`}
                      {` · Esperado nas parcelas: ${formatBRLPrecise(expectedInEntries)}`}
                      {` · Soma atual: ${formatBRLPrecise(entriesSum)}`}
                      {` · Diferença: ${balanceDiff > 0 ? "+" : ""}${formatBRLPrecise(balanceDiff)}`}
                    </p>
                    <p className="text-xs text-red-700/80">
                      Use o botão <strong>Regenerar (🔄)</strong> em Clientes Ativos ou revise os grupos de pagamento na aba Negociação.
                    </p>
                  </div>
                </div>
              ) : pendingGroupsSum > 0 ? (
                <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-700">
                      {formatBRLPrecise(pendingGroupsSum)} pendente de definição em grupos de pagamento
                    </p>
                    <p className="text-xs text-blue-700/80">
                      Parcelas confirmadas ({formatBRLPrecise(entriesSum)}) batem com o esperado. Feche o grupo pendente na aba Negociação para gerar o restante.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 flex gap-2 items-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-700">
                    Saldo conferido: parcelas somam exatamente {formatBRLPrecise(contractValue)}.
                  </p>
                </div>
              )
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Início">
                {data?.contract?.start_date
                  ? format(new Date(data.contract.start_date), "dd/MM/yyyy", { locale: ptBR })
                  : "—"}
              </InfoRow>
              <InfoRow label="Fim">
                {data?.contract?.end_date
                  ? format(new Date(data.contract.end_date), "dd/MM/yyyy", { locale: ptBR })
                  : "—"}
              </InfoRow>
              <InfoRow label="Recebíveis gerados">
                {data?.contract?.receivables_generated ? (
                  <span className="text-emerald-600">
                    Sim
                    {data.contract.receivables_generated_at &&
                      ` — ${format(new Date(data.contract.receivables_generated_at), "dd/MM/yyyy", { locale: ptBR })}`}
                  </span>
                ) : (
                  <span className="text-amber-600">Pendente — gerar na ficha do cliente</span>
                )}
              </InfoRow>
              <InfoRow label="Conciliados">
                {conciliated} / {data?.entries.length || 0}
              </InfoRow>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Parcelas / Recebíveis</h3>
                <span className="text-xs text-muted-foreground">{data?.entries.length || 0} lançamento(s)</span>
              </div>
              {data?.entries.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Nenhum recebível gerado para este contrato ainda.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (clientId) navigate(`/clients/${clientId}?tab=contracts`);
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Gerar recebíveis no contrato
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.entries.map((e) => {
                        const st = STATUS_LABEL[e.status] || {
                          label: e.status,
                          className: "bg-muted text-muted-foreground border-border",
                        };
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {e.installment_number ?? "—"}
                              {e.total_installments ? `/${e.total_installments}` : ""}
                            </TableCell>
                            <TableCell className="text-sm">
                              {e.description}
                              {e.is_conciliated && (
                                <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4 bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                                  Conciliado
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(e.due_date), "dd/MM/yy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {e.payment_date
                                ? format(new Date(e.payment_date), "dd/MM/yy", { locale: ptBR })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatBRLPrecise(Number(e.amount || 0))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={st.className}>
                                {st.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => navigate(`/contracts?open=${contractId}&tab=negociacao`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Editar grupos de pagamento (Negociação)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clientId && navigate(`/clients/${clientId}?tab=contracts`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir na ficha do cliente
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/financial/parcelas?contract_id=${contractId}`)}
              >
                Ver todas as parcelas
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold mt-1 tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}
