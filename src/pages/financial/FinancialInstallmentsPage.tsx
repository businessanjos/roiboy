import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCompany } from "@/contexts/CompanyContext";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

import {
  Receipt,
  Search,
  Lock,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  XCircle,
  Gavel,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallmentTimelineDialog } from "@/components/financial/InstallmentTimelineDialog";
import { PaymentStatusBadge } from "@/components/financial/PaymentStatusSelect";
import { IssueFiscalInvoiceDialog } from "@/components/financial/IssueFiscalInvoiceDialog";
import { EmitirNFButton } from "@/components/financial/nfse/EmitirNFButton";
import { FileCheck, FilePlus2, Wallet, CheckCircle, Clock as ClockIcon } from "lucide-react";
import { FinancialPageHeader, FinancialKpiCard, FinancialEmptyState } from "@/components/financial/_shared";
import { formatBRLCompact } from "@/lib/financial-format";
import { resolveItemVendaToProductId } from "@/lib/sales/itemVendaResolver";

type InstallmentRow = {
  id: string;
  invoice_id: string;
  number: number;
  due_date: string;
  amount: number;
  payment_method: string | null;
  status: string;
  payment_status: string | null;
  paid_at: string | null;
  locked: boolean;
  invoices?: {
    id: string;
    company_id: string | null;
    account_id: string;
    client_id: string | null;
    contract_id: string | null;
    product_id: string | null;
    nf_number: string | null;
    nf_series: string | null;
    nf_status: string | null;
    nf_issued_at: string | null;
    nf_url: string | null;
    clients?: {
      id: string;
      full_name: string | null;
      cpf: string | null;
      cnpj: string | null;
      company_name: string | null;
    } | null;
    product?: {
      id: string;
      name: string;
      color: string | null;
    } | null;
    /**
     * Product resolved from the deal's "Item da Venda" custom field
     * (source of truth from the commercial pipeline). When present, this
     * overrides the product_id copied into the invoice/contract, which may
     * be stale if the deal's product changed after the contract was created.
     */
    deal_product?: {
      id: string;
      name: string;
      color: string | null;
    } | null;
  };
};


const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground", icon: Clock },
  scheduled: { label: "Agendada", className: "bg-blue-500/15 text-blue-600", icon: Clock },
  paid: { label: "Paga", className: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  overdue: { label: "Vencida", className: "bg-destructive/15 text-destructive", icon: AlertCircle },
  renegotiated: { label: "Renegociada", className: "bg-orange-500/15 text-orange-600", icon: RefreshCw },
  written_off: { label: "Baixada", className: "bg-zinc-500/15 text-zinc-600", icon: XCircle },
  judicial: { label: "Judicial", className: "bg-red-500/15 text-red-600", icon: Gavel },
  refunded: { label: "Estornada", className: "bg-pink-500/15 text-pink-600", icon: RefreshCw },
  partial: { label: "Parcial", className: "bg-amber-500/15 text-amber-600", icon: Clock },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  boletos: "Boleto",
  boleto_bancario: "Boleto bancário",
  cartao: "Cartão",
  card: "Cartão",
  credit_card: "Cartão de crédito",
  creditcard: "Cartão de crédito",
  "credit-card": "Cartão de crédito",
  credito: "Cartão de crédito",
  cartao_credito: "Cartão de crédito",
  cartao_de_credito: "Cartão de crédito",
  "cartão": "Cartão de crédito",
  "cartão de crédito": "Cartão de crédito",
  "cartão_credito": "Cartão de crédito",
  "cartão_de_crédito": "Cartão de crédito",
  debit_card: "Cartão de débito",
  debitcard: "Cartão de débito",
  debito: "Cartão de débito",
  cartao_debito: "Cartão de débito",
  cartao_de_debito: "Cartão de débito",
  "cartão de débito": "Cartão de débito",
  recurring_card: "Cartão recorrência",
  recurring: "Cartão recorrência",
  cartao_recorrencia: "Cartão recorrência",
  cheque: "Cheque",
  check: "Cheque",
  cheques: "Cheques",
  checks: "Cheques",
  dinheiro: "Dinheiro",
  cash: "Dinheiro",
  especie: "Dinheiro",
  "espécie": "Dinheiro",
  transferencia: "Transferência",
  "transferência": "Transferência",
  transfer: "Transferência",
  bank_transfer: "Transferência bancária",
  ted: "TED",
  doc: "DOC",
  permuta: "Permuta",
  barter: "Permuta",
  outro: "Outro",
  outros: "Outros",
  other: "Outro",
  others: "Outros",
  pix_cheques: "Pix + Cheques",
  pix_cartao_cheques: "Pix + Cartão + Cheques",
  pix_boleto_parcelado: "Pix + Boleto parcelado",
  cartao_cheques: "Cartão + Cheques",
  cartao_boleto_parcelado: "Cartão + Boleto parcelado",
};

function formatPaymentMethod(value: string | null): string {
  if (!value) return "—";
  const raw = value.toLowerCase().trim();
  if (PAYMENT_METHOD_LABELS[raw]) return PAYMENT_METHOD_LABELS[raw];
  const normalized = raw.replace(/[\s-]+/g, "_");
  if (PAYMENT_METHOD_LABELS[normalized]) return PAYMENT_METHOD_LABELS[normalized];
  const noAccents = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (PAYMENT_METHOD_LABELS[noAccents]) return PAYMENT_METHOD_LABELS[noAccents];
  // Capitalize first letter as fallback (sem underscores)
  const pretty = raw.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}


export default function FinancialInstallmentsPage() {
  const { currentUser } = useCurrentUser();
  const { currentCompanyId } = useCompany();
  const accountId = currentUser?.account_id;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all"); // all | cnpj | cpf
  const [datePreset, setDatePreset] = useState<string>("all"); // all | month | quarter | year | custom
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [nfInvoice, setNfInvoice] = useState<InstallmentRow["invoices"] | null>(null);
  const [nfOpen, setNfOpen] = useState(false);


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["financial-installments", accountId, currentCompanyId],
    enabled: !!accountId,
    queryFn: async (): Promise<InstallmentRow[]> => {
      let query = supabase
        .from("installments")
        .select(
          "id, invoice_id, number, due_date, amount, payment_method, status, payment_status, paid_at, locked, invoices!inner(id, company_id, account_id, client_id, contract_id, product_id, nf_number, nf_series, nf_status, nf_issued_at, nf_url)"
        )
        .order("due_date", { ascending: true })
        .limit(3000);

      if (currentCompanyId) {
        query = query.eq("invoices.company_id", currentCompanyId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[FinancialInstallments]", error);
        return [];
      }

      const list = (data ?? []) as any as InstallmentRow[];

      // Batch-fetch clients (avoids PostgREST nested embed edge cases).
      const clientIds = Array.from(
        new Set(list.map((r) => r.invoices?.client_id).filter((v): v is string => !!v))
      );
      const contractIds = Array.from(
        new Set(list.map((r) => r.invoices?.contract_id).filter((v): v is string => !!v))
      );

      // Resolve "Item da Venda" custom field id for this account (source of
      // truth for the deal's product).
      const itemVendaFieldRes = await supabase
        .from("custom_fields")
        .select("id")
        .eq("account_id", accountId!)
        .eq("name", "Item da Venda")
        .maybeSingle();
      const itemVendaFieldId = itemVendaFieldRes.data?.id as string | undefined;

      // 1. contracts → deal_id
      const contractsRes = contractIds.length
        ? await supabase
            .from("client_contracts")
            .select("id, deal_id, product_id")
            .in("id", contractIds)
        : ({ data: [], error: null } as any);
      if (contractsRes.error)
        console.error("[FinancialInstallments] contracts batch error:", contractsRes.error);
      const contractsById = new Map<string, any>(
        (contractsRes.data ?? []).map((c: any) => [c.id, c])
      );

      const dealIds: string[] = Array.from(
        new Set(
          ((contractsRes.data ?? []) as any[])
            .map((c) => c.deal_id as string | null)
            .filter((v): v is string => !!v)
        )
      );

      // 2. deal_field_values → Item da Venda value (usually a product UUID)
      const dealFieldRes =
        dealIds.length && itemVendaFieldId
          ? await supabase
              .from("deal_field_values")
              .select("deal_id, value_text")
              .eq("field_id", itemVendaFieldId)
              .in("deal_id", dealIds)
          : ({ data: [], error: null } as any);
      if (dealFieldRes.error)
        console.error("[FinancialInstallments] deal_field_values error:", dealFieldRes.error);

      const dealProductIdByDeal = new Map<string, string>();
      (dealFieldRes.data ?? []).forEach((row: any) => {
        const resolved = resolveItemVendaToProductId(row.value_text);
        if (resolved) {
          dealProductIdByDeal.set(row.deal_id, resolved);
        }
      });


      // 3. Collect ALL product ids to fetch (invoice's own + deal-resolved)
      const productIds = Array.from(
        new Set([
          ...list.map((r) => r.invoices?.product_id).filter((v): v is string => !!v),
          ...Array.from(dealProductIdByDeal.values()),
        ])
      );

      const [clientsRes, productsRes] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, full_name, cpf, cnpj, company_name").in("id", clientIds)
          : Promise.resolve({ data: [], error: null } as any),
        productIds.length
          ? supabase.from("products").select("id, name, color").in("id", productIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (clientsRes.error) console.error("[FinancialInstallments] clients batch error:", clientsRes.error);
      if (productsRes.error) console.error("[FinancialInstallments] products batch error:", productsRes.error);

      const clientsById = new Map<string, any>((clientsRes.data ?? []).map((c: any) => [c.id, c]));
      const productsById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));

      list.forEach((r) => {
        if (!r.invoices) return;
        if (r.invoices.client_id) r.invoices.clients = clientsById.get(r.invoices.client_id) ?? null;
        if (r.invoices.product_id) r.invoices.product = productsById.get(r.invoices.product_id) ?? null;

        // Rota completa: parcelas → contrato → deal → Item da Venda
        const contract = r.invoices.contract_id ? contractsById.get(r.invoices.contract_id) : null;
        const dealProductId = contract?.deal_id ? dealProductIdByDeal.get(contract.deal_id) : null;
        if (dealProductId) {
          const dp = productsById.get(dealProductId) ?? null;
          r.invoices.deal_product = dp;
          // Override: deal (comercial) is the source of truth
          if (dp) r.invoices.product = dp;
        }
      });

      return list;
    },
  });



  // Product options for the filter — pulled from the products catalog so the
  // list matches the rest of the app (Sales, Contracts, etc.) even when the
  // current installments view has 0 rows for a product.
  const { data: availableProducts = [] } = useQuery({
    queryKey: ["financial-installments-products", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, is_active")
        .eq("account_id", accountId!)
        .order("name", { ascending: true });
      if (error) {
        console.error("[FinancialInstallments] products list error:", error);
        return [];
      }
      return (data ?? [])
        .filter((p: any) => p.is_active !== false)
        .map((p: any) => ({ id: p.id, name: p.name }));
    },
  });


  const dateInterval = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      case "custom":
        if (customRange?.from && customRange?.to) {
          return { start: customRange.from, end: customRange.to };
        }
        return null;
      default:
        return null;
    }
  }, [datePreset, customRange]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      if (productFilter !== "all") {
        if (productFilter === "none") {
          if (r.invoices?.product_id) return false;
        } else if (r.invoices?.product_id !== productFilter) {
          return false;
        }
      }

      if (billingFilter !== "all") {
        const isCnpj = !!r.invoices?.clients?.cnpj;
        if (billingFilter === "cnpj" && !isCnpj) return false;
        if (billingFilter === "cpf" && isCnpj) return false;
      }

      if (dateInterval) {
        try {
          const d = parseISO(r.due_date);
          if (!isWithinInterval(d, dateInterval)) return false;
        } catch {
          return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        const client = r.invoices?.clients;
        const hay = [
          r.invoice_id,
          String(r.number),
          client?.full_name,
          client?.company_name,
          client?.cpf,
          client?.cnpj,
          r.invoices?.product?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, productFilter, billingFilter, dateInterval]);


  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.total += Number(r.amount || 0);
        if (r.status === "paid") acc.paid += Number(r.amount || 0);
        else acc.open += Number(r.amount || 0);
        return acc;
      },
      { total: 0, paid: 0, open: 0 }
    );
  }, [filtered]);

  const openTimeline = (id: string) => {
    setSelectedId(id);
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={Receipt}
        title="Parcelas"
        description="Todas as parcelas das faturas. Clique em uma linha para ver o histórico da régua e renegociações."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FinancialKpiCard
          icon={Wallet}
          label="Total no filtro atual"
          value={formatBRLCompact(totals.total)}
          hint={`${filtered.length} parcelas`}
        />
        <FinancialKpiCard
          icon={CheckCircle}
          label="Pago"
          value={formatBRLCompact(totals.paid)}
          tone="success"
        />
        <FinancialKpiCard
          icon={ClockIcon}
          label="Em aberto"
          value={formatBRLCompact(totals.open)}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, CPF/CNPJ, produto, nº ou fatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            <SelectItem value="none">Sem produto</SelectItem>
            {availableProducts.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={billingFilter} onValueChange={setBillingFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Faturamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">CPF e CNPJ</SelectItem>
            <SelectItem value="cnpj">Apenas CNPJ</SelectItem>
            <SelectItem value="cpf">Apenas CPF</SelectItem>
          </SelectContent>
        </Select>

        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="quarter">Este trimestre</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {datePreset === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal min-w-[240px]",
                  !customRange?.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customRange?.from ? (
                  customRange.to ? (
                    <>
                      {format(customRange.from, "dd/MM/yy", { locale: ptBR })} –{" "}
                      {format(customRange.to, "dd/MM/yy", { locale: ptBR })}
                    </>
                  ) : (
                    format(customRange.from, "dd/MM/yy", { locale: ptBR })
                  )
                ) : (
                  <span>Selecionar intervalo</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={setCustomRange}
                numberOfMonths={2}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16" title="Número da parcela dentro da fatura (ex: 1/12, 2/12)">Parcela</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Faturamento</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Forma de pagamento</TableHead>
                <TableHead>NF Fiscal</TableHead>
                <TableHead className="text-right">Histórico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                    Nenhuma parcela encontrada para esta empresa.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                  const Icon = meta.icon;
                  const client = r.invoices?.clients;
                  const isCnpj = !!client?.cnpj;
                  const clientName = client?.company_name || client?.full_name || "—";
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => openTimeline(r.id)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">{r.number}</TableCell>
                      <TableCell className="font-medium">{clientName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={isCnpj ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "bg-purple-500/10 text-purple-600 border-purple-500/30"}>
                          {isCnpj ? "CNPJ" : "CPF"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {isCnpj ? formatCnpj(client!.cnpj!) : "—"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(r.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(r.amount))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={meta.className}>
                            <Icon className="h-3 w-3 mr-1" />
                            {meta.label}
                          </Badge>
                          {r.locked && (
                            <Lock className="inline h-3 w-3 text-muted-foreground" />
                          )}
                          <PaymentStatusBadge value={r.payment_status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPaymentMethod(r.payment_method)}
                      </TableCell>

                      <TableCell>
                        {r.invoices?.nf_number && r.invoices?.nf_status === "issued" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNfInvoice(r.invoices!);
                              setNfOpen(true);
                            }}
                          >
                            <Badge variant="default" className="font-mono text-xs gap-1">
                              <FileCheck className="h-3 w-3" />
                              NF {r.invoices.nf_series ? `${r.invoices.nf_series}-` : ""}
                              {r.invoices.nf_number}
                            </Badge>
                          </Button>
                        ) : (
                          <div onClick={(e) => e.stopPropagation()} className="inline-block">
                            <EmitirNFButton installmentId={r.id} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTimeline(r.id);
                          }}
                        >
                          <History className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InstallmentTimelineDialog
        installmentId={selectedId}
        open={open}
        onOpenChange={setOpen}
      />
      <IssueFiscalInvoiceDialog
        invoiceId={nfInvoice?.id ?? null}
        open={nfOpen}
        onOpenChange={setNfOpen}
        existing={nfInvoice}
      />
    </div>
  );
}
