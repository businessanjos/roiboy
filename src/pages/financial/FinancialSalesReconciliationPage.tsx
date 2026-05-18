import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileCheck,
  DollarSign,
  Clock,
  CheckCircle2,
  Receipt,
  Eye,
  Search,
  RefreshCw,
} from "lucide-react";
import { ContractDetailSheet } from "@/components/contracts/ContractDetailSheet";
import { FinancialPageHeader, FinancialKpiCard } from "@/components/financial/_shared";
import { formatBRLCompact } from "@/lib/financial-format";

interface Contract {
  id: string;
  client_id: string;
  account_id: string;
  product_id: string | null;
  value: number;
  currency: string;
  start_date: string;
  end_date: string | null;
  status: string;
  payment_method: string | null;
  installments_count: number | null;
  first_due_date: string | null;
  negotiation_type: string | null;
  negotiation_description: string | null;
  notes: string | null;
  receivables_generated: boolean | null;
  receivables_generated_at: string | null;
  created_at: string;
  client?: {
    full_name: string;
    phone_e164: string;
  };
  product?: {
    name: string;
    color: string | null;
  };
}

interface PaymentConfig {
  paymentMethod: string;
  installments: number;
  firstDueDate: string;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cheque", label: "Cheque" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
];

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12];

export default function FinancialSalesReconciliationPage() {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [pendingContracts, setPendingContracts] = useState<Contract[]>([]);
  const [processedContracts, setProcessedContracts] = useState<Contract[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    paymentMethod: "pix",
    installments: 1,
    firstDueDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [processing, setProcessing] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);

  const fetchContracts = async () => {
    if (!currentUser?.account_id) return;

    setLoading(true);
    try {
      // Fetch pending contracts
      const { data: pending, error: pendingError } = await supabase
        .from("client_contracts")
        .select(`
          *,
          client:clients(full_name, phone_e164),
          product:products(name, color)
        `)
        .eq("account_id", currentUser.account_id)
        .or("receivables_generated.is.null,receivables_generated.eq.false")
        .in("status", ["active", "pending", "a_iniciar"])
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;
      setPendingContracts((pending || []) as Contract[]);

      // Fetch processed contracts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: processed, error: processedError } = await supabase
        .from("client_contracts")
        .select(`
          *,
          client:clients(full_name, phone_e164),
          product:products(name, color)
        `)
        .eq("account_id", currentUser.account_id)
        .eq("receivables_generated", true)
        .gte("receivables_generated_at", thirtyDaysAgo.toISOString())
        .order("receivables_generated_at", { ascending: false });

      if (processedError) throw processedError;
      setProcessedContracts((processed || []) as Contract[]);
      
      // Sync detailContract with fresh data to prevent stale state
      if (detailContract) {
        const allContracts = [...(pending || []), ...(processed || [])];
        const updatedContract = allContracts.find(c => c.id === detailContract.id);
        if (updatedContract) {
          setDetailContract(updatedContract as Contract);
        }
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [currentUser?.account_id]);

  const filteredPending = useMemo(() => {
    if (!searchQuery) return pendingContracts;
    const q = searchQuery.toLowerCase();
    return pendingContracts.filter(
      (c) =>
        c.client?.full_name.toLowerCase().includes(q) ||
        c.product?.name?.toLowerCase().includes(q)
    );
  }, [pendingContracts, searchQuery]);

  const totalPendingValue = useMemo(
    () => pendingContracts.reduce((sum, c) => sum + (c.value || 0), 0),
    [pendingContracts]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredPending.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const openConfigDialog = (contract: Contract) => {
    setSelectedContract(contract);
    setPaymentConfig({
      paymentMethod: contract.payment_method || "pix",
      installments: contract.installments_count || 1,
      firstDueDate:
        contract.first_due_date || format(new Date(), "yyyy-MM-dd"),
    });
    setConfigDialogOpen(true);
  };

  const generateInstallmentsPreview = () => {
    if (!selectedContract) return [];
    const baseDate = new Date(paymentConfig.firstDueDate);
    const installmentValue = selectedContract.value / paymentConfig.installments;

    return Array.from({ length: paymentConfig.installments }, (_, i) => ({
      number: i + 1,
      dueDate: addMonths(baseDate, i),
      value: installmentValue,
    }));
  };

  const handleSaveConfig = async () => {
    if (!selectedContract) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("client_contracts")
        .update({
          payment_method: paymentConfig.paymentMethod,
          installments_count: paymentConfig.installments,
          first_due_date: paymentConfig.firstDueDate,
        })
        .eq("id", selectedContract.id);

      if (error) throw error;

      // Update local state
      setPendingContracts((prev) =>
        prev.map((c) =>
          c.id === selectedContract.id
            ? {
                ...c,
                payment_method: paymentConfig.paymentMethod,
                installments_count: paymentConfig.installments,
                first_due_date: paymentConfig.firstDueDate,
              }
            : c
        )
      );

      toast.success("Configuração de pagamento salva");
      setConfigDialogOpen(false);
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateReceivables = async (contract: Contract) => {
    if (!currentUser?.account_id) return;
    if (!contract.payment_method || !contract.installments_count || !contract.first_due_date) {
      toast.error("Configure o pagamento antes de gerar recebíveis");
      openConfigDialog(contract);
      return;
    }

    setProcessing(true);
    try {
      const baseDate = new Date(contract.first_due_date);
      const installmentValue = contract.value / contract.installments_count;

      const entries = Array.from({ length: contract.installments_count }, (_, i) => ({
        account_id: currentUser.account_id,
        client_id: contract.client_id,
        contract_id: contract.id,
        entry_type: "receivable",
        description: `Parcela ${i + 1}/${contract.installments_count} - ${contract.client?.full_name || "Cliente"}`,
        amount: Math.round(installmentValue * 100) / 100,
        due_date: format(addMonths(baseDate, i), "yyyy-MM-dd"),
        status: "pending",
        is_recurring: false,
        is_conciliated: false,
        currency: "BRL",
        payment_method: contract.payment_method,
      }));

      const { error: entriesError } = await supabase
        .from("financial_entries")
        .insert(entries);

      if (entriesError) throw entriesError;

      const { error: updateError } = await supabase
        .from("client_contracts")
        .update({
          receivables_generated: true,
          receivables_generated_at: new Date().toISOString(),
        })
        .eq("id", contract.id);

      if (updateError) throw updateError;

      // Remove from pending, add to processed
      setPendingContracts((prev) => prev.filter((c) => c.id !== contract.id));
      setProcessedContracts((prev) => [
        { ...contract, receivables_generated: true, receivables_generated_at: new Date().toISOString() },
        ...prev,
      ]);
      setSelectedIds((prev) => prev.filter((id) => id !== contract.id));

      toast.success(`${contract.installments_count} recebíveis gerados com sucesso`);
    } catch (error) {
      console.error("Error generating receivables:", error);
      toast.error("Erro ao gerar recebíveis");
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchGenerate = async () => {
    const contractsToProcess = pendingContracts.filter(
      (c) =>
        selectedIds.includes(c.id) &&
        c.payment_method &&
        c.installments_count &&
        c.first_due_date
    );

    if (contractsToProcess.length === 0) {
      toast.error("Nenhum contrato selecionado está configurado para gerar recebíveis");
      return;
    }

    setProcessing(true);
    let successCount = 0;

    for (const contract of contractsToProcess) {
      try {
        await handleGenerateReceivables(contract);
        successCount++;
      } catch (error) {
        console.error("Error processing contract:", contract.id, error);
      }
    }

    setProcessing(false);
    if (successCount > 0) {
      toast.success(`${successCount} contratos processados com sucesso`);
    }
  };

  const openContractDetail = (contract: Contract) => {
    setDetailContract(contract);
    setDetailSheetOpen(true);
  };

  const installmentsPreview = generateInstallmentsPreview();

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={FileCheck}
        title="Conciliação de Vendas"
        description="Confirme os contratos fechados e gere as parcelas a receber no fluxo financeiro."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FinancialKpiCard
          icon={Clock}
          label="Pendentes"
          value={String(pendingContracts.length)}
          hint="contratos aguardando conciliação"
          tone="warning"
        />
        <FinancialKpiCard
          icon={DollarSign}
          label="Valor a conciliar"
          value={formatBRLCompact(totalPendingValue)}
          hint="total dos pendentes"
        />
        <FinancialKpiCard
          icon={CheckCircle2}
          label="Processados (30d)"
          value={String(processedContracts.length)}
          hint="contratos já conciliados"
          tone="success"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes ({pendingContracts.length})
          </TabsTrigger>
          <TabsTrigger value="processed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Histórico ({processedContracts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchContracts}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBatchGenerate}
                  disabled={processing}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Gerar Recebíveis ({selectedIds.length})
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredPending.length > 0 &&
                        selectedIds.length === filteredPending.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>1ª Parcela</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredPending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum contrato pendente de conciliação
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPending.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(contract.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(contract.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {contract.client?.full_name || "—"}
                      </TableCell>
                      <TableCell>
                        {contract.product ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: contract.product.color || undefined,
                              color: contract.product.color || undefined,
                            }}
                          >
                            {contract.product.name}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(contract.value)}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {contract.negotiation_description ? (
                          <span 
                            className="text-sm line-clamp-2" 
                            title={contract.negotiation_description}
                          >
                            {contract.negotiation_description}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contract.payment_method ? (
                          <Badge variant="secondary">
                            {PAYMENT_METHODS.find((m) => m.value === contract.payment_method)?.label || contract.payment_method}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não definido</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contract.installments_count ? `${contract.installments_count}x` : "—"}
                      </TableCell>
                      <TableCell>
                        {contract.first_due_date
                          ? format(new Date(contract.first_due_date), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openContractDetail(contract)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openConfigDialog(contract)}
                          >
                            Configurar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleGenerateReceivables(contract)}
                            disabled={processing || !contract.payment_method}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Gerar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="processed" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Processado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : processedContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum contrato processado nos últimos 30 dias
                    </TableCell>
                  </TableRow>
                ) : (
                  processedContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        {contract.client?.full_name || "—"}
                      </TableCell>
                      <TableCell>
                        {contract.product ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: contract.product.color || undefined,
                              color: contract.product.color || undefined,
                            }}
                          >
                            {contract.product.name}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(contract.value)}
                      </TableCell>
                      <TableCell>{contract.installments_count}x</TableCell>
                      <TableCell>
                        {contract.receivables_generated_at
                          ? format(
                              new Date(contract.receivables_generated_at),
                              "dd/MM/yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openContractDetail(contract)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Pagamento</DialogTitle>
            <DialogDescription>
              {selectedContract?.client?.full_name} - {formatCurrency(selectedContract?.value || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={paymentConfig.paymentMethod}
                onValueChange={(value) =>
                  setPaymentConfig((prev) => ({ ...prev, paymentMethod: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Número de Parcelas</Label>
              <Select
                value={paymentConfig.installments.toString()}
                onValueChange={(value) =>
                  setPaymentConfig((prev) => ({ ...prev, installments: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}x {selectedContract && `de ${formatCurrency(selectedContract.value / n)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da 1ª Parcela</Label>
              <Input
                type="date"
                value={paymentConfig.firstDueDate}
                onChange={(e) =>
                  setPaymentConfig((prev) => ({ ...prev, firstDueDate: e.target.value }))
                }
              />
            </div>

            {/* Preview */}
            {installmentsPreview.length > 1 && (
              <div className="space-y-2">
                <Label>Prévia das Parcelas</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                  {installmentsPreview.map((inst) => (
                    <div
                      key={inst.number}
                      className="flex justify-between text-sm text-muted-foreground"
                    >
                      <span>Parcela {inst.number}</span>
                      <span>{format(inst.dueDate, "dd/MM/yyyy")}</span>
                      <span>{formatCurrency(inst.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfig} disabled={processing}>
              {processing ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Detail Sheet */}
      {detailContract && (
        <ContractDetailSheet
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          contract={detailContract as any}
          onUpdate={fetchContracts}
        />
      )}
    </div>
  );
}
