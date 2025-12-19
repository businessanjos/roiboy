import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Loader2, 
  Building2, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  Activity,
  RefreshCw,
  Eye,
  ExternalLink,
  CreditCard,
  Receipt,
  QrCode,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  Ban
} from "lucide-react";

interface AsaasPayment {
  id: string;
  customer: string;
  customerName?: string;
  accountName?: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  description?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  externalReference?: string;
}

interface AsaasPaymentsResponse {
  data: AsaasPayment[];
  hasMore: boolean;
  totalCount: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PENDING: { label: "Pendente", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock },
  RECEIVED: { label: "Recebido", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  CONFIRMED: { label: "Confirmado", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  OVERDUE: { label: "Vencido", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: AlertCircle },
  REFUNDED: { label: "Estornado", color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: RefreshCw },
  RECEIVED_IN_CASH: { label: "Recebido em Dinheiro", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  REFUND_REQUESTED: { label: "Estorno Solicitado", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", icon: RefreshCw },
  CHARGEBACK_REQUESTED: { label: "Chargeback Solicitado", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: AlertCircle },
  CHARGEBACK_DISPUTE: { label: "Em Disputa", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", icon: AlertCircle },
  AWAITING_CHARGEBACK_REVERSAL: { label: "Aguardando Reversão", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock },
  DUNNING_REQUESTED: { label: "Em Recuperação", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Activity },
  DUNNING_RECEIVED: { label: "Recuperado", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  AWAITING_RISK_ANALYSIS: { label: "Em Análise", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Activity },
};

const billingTypeLabels: Record<string, string> = {
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  PIX: "PIX",
  UNDEFINED: "Indefinido",
};

export function AdminPaymentsManager() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [billingTypeFilter, setBillingTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<AsaasPayment | null>(null);
  const limit = 20;

  // Fetch accounts with asaas_customer_id mapping
  const { data: accountsData } = useQuery({
    queryKey: ['admin-asaas-accounts-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, asaas_customer_id');
      
      if (error) throw error;
      return data || [];
    }
  });

  const accountsMap: Record<string, string> = {};
  const royCustomerIds: string[] = [];
  
  accountsData?.forEach((acc) => {
    if (acc.asaas_customer_id) {
      accountsMap[acc.asaas_customer_id] = acc.name;
      royCustomerIds.push(acc.asaas_customer_id);
    }
  });

  // Fetch payments from Asaas - only ROY customers
  const { data: paymentsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-asaas-payments', statusFilter, billingTypeFilter, offset, royCustomerIds],
    queryFn: async () => {
      // If no ROY customers exist yet, return empty
      if (royCustomerIds.length === 0) {
        return {
          data: [],
          hasMore: false,
          totalCount: 0
        } as AsaasPaymentsResponse;
      }

      // Fetch payments for each ROY customer and combine
      const allPayments: AsaasPayment[] = [];
      
      for (const customerId of royCustomerIds) {
        const params: Record<string, any> = {
          customer: customerId,
          limit: 100, // Fetch more per customer to ensure we get all
        };

        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }

        try {
          const { data, error } = await supabase.functions.invoke('asaas-api', {
            body: {
              action: 'listPayments',
              ...params
            }
          });

          if (!error && data?.data) {
            const enrichedPayments = data.data.map((payment: AsaasPayment) => ({
              ...payment,
              accountName: accountsMap[payment.customer] || 'Conta ROY'
            }));
            allPayments.push(...enrichedPayments);
          }
        } catch (err) {
          console.error(`Error fetching payments for customer ${customerId}:`, err);
        }
      }

      // Sort by due date descending
      allPayments.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

      // Apply pagination locally
      const paginatedPayments = allPayments.slice(offset, offset + limit);

      return {
        data: paginatedPayments,
        hasMore: offset + limit < allPayments.length,
        totalCount: allPayments.length
      } as AsaasPaymentsResponse;
    },
    enabled: !!accountsData,
    refetchInterval: 60000, // Refresh every minute
  });

  const payments = paymentsData?.data || [];
  const hasMore = paymentsData?.hasMore || false;
  const totalCount = paymentsData?.totalCount || 0;

  // Filter by search and billing type locally
  const filteredPayments = payments.filter((p: AsaasPayment) => {
    const matchesSearch = !search || 
      p.accountName?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    
    const matchesBillingType = billingTypeFilter === 'all' || p.billingType === billingTypeFilter;
    
    return matchesSearch && matchesBillingType;
  });

  // Calculate stats
  const stats = {
    received: payments.filter((p: AsaasPayment) => p.status === 'RECEIVED' || p.status === 'CONFIRMED').length,
    pending: payments.filter((p: AsaasPayment) => p.status === 'PENDING').length,
    overdue: payments.filter((p: AsaasPayment) => p.status === 'OVERDUE').length,
    totalValue: payments
      .filter((p: AsaasPayment) => p.status === 'RECEIVED' || p.status === 'CONFIRMED')
      .reduce((sum: number, p: AsaasPayment) => sum + (p.netValue || p.value), 0)
  };

  const handleViewDetails = async (payment: AsaasPayment) => {
    try {
      // Fetch additional details if needed
      const { data, error } = await supabase.functions.invoke('asaas-api', {
        body: {
          action: 'getPayment',
          paymentId: payment.id
        }
      });

      if (error) throw error;

      setSelectedPayment({
        ...payment,
        ...data,
        accountName: payment.accountName
      });
    } catch (error) {
      console.error('Error fetching payment details:', error);
      setSelectedPayment(payment);
    }
  };

  const handleGetPixQrCode = async (paymentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-api', {
        body: {
          action: 'getPixQrCode',
          paymentId
        }
      });

      if (error) throw error;

      if (data.encodedImage) {
        // Open in new window
        const win = window.open();
        if (win) {
          win.document.write(`
            <html>
              <head><title>PIX QR Code</title></head>
              <body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5;">
                <div style="text-align:center;padding:20px;background:white;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                  <img src="data:image/png;base64,${data.encodedImage}" style="max-width:300px;" />
                  <p style="margin-top:16px;font-family:monospace;font-size:12px;word-break:break-all;max-width:300px;">${data.payload || ''}</p>
                </div>
              </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Error fetching PIX QR code:', error);
      toast.error('Erro ao gerar QR Code PIX');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold">
                  R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Recebido (página)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{stats.received}</p>
                <p className="text-xs text-muted-foreground">Recebidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Vencidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-medium">Cobranças Asaas</CardTitle>
              <CardDescription className="text-sm">
                {totalCount > 0 ? `${totalCount} cobranças encontradas` : 'Listagem de cobranças da plataforma'}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Input 
              placeholder="Buscar por conta ou descrição..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="h-9 flex-1"
            />
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setOffset(0); }}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="RECEIVED">Recebido</SelectItem>
                <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                <SelectItem value="OVERDUE">Vencido</SelectItem>
                <SelectItem value="REFUNDED">Estornado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={billingTypeFilter} onValueChange={setBillingTypeFilter}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue placeholder="Forma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas formas</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="BOLETO">Boleto</SelectItem>
                <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search || statusFilter !== 'all' || billingTypeFilter !== 'all' 
                  ? 'Nenhuma cobrança encontrada com os filtros aplicados' 
                  : 'Nenhuma cobrança encontrada'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-medium">Conta</TableHead>
                      <TableHead className="font-medium">Valor</TableHead>
                      <TableHead className="font-medium">Forma</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium">Vencimento</TableHead>
                      <TableHead className="font-medium">Pagamento</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment: AsaasPayment) => {
                      const statusInfo = statusConfig[payment.status] || { 
                        label: payment.status, 
                        color: "bg-muted text-muted-foreground",
                        icon: Activity
                      };
                      const StatusIcon = statusInfo.icon;

                      return (
                        <TableRow key={payment.id} className="group">
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{payment.accountName}</p>
                              {payment.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {payment.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">
                              R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {payment.netValue && payment.netValue !== payment.value && (
                              <p className="text-xs text-muted-foreground">
                                Líquido: R$ {payment.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs gap-1">
                              {payment.billingType === 'PIX' && <QrCode className="h-3 w-3" />}
                              {payment.billingType === 'CREDIT_CARD' && <CreditCard className="h-3 w-3" />}
                              {payment.billingType === 'BOLETO' && <Receipt className="h-3 w-3" />}
                              {billingTypeLabels[payment.billingType] || payment.billingType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs gap-1 ${statusInfo.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(payment.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {payment.paymentDate 
                              ? format(new Date(payment.paymentDate), "dd/MM/yyyy", { locale: ptBR })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => handleViewDetails(payment)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {payment.billingType === 'PIX' && payment.status === 'PENDING' && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => handleGetPixQrCode(payment.id)}
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {payment.invoiceUrl && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => window.open(payment.invoiceUrl, '_blank')}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Mostrando {offset + 1} - {Math.min(offset + limit, totalCount)} de {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={!hasMore}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gateway Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Gateway Configurado</CardTitle>
          <CardDescription className="text-sm">
            Integração ativa para processamento de pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏦</div>
              <div>
                <h3 className="font-medium">Asaas</h3>
                <p className="text-xs text-muted-foreground">Boleto, PIX e Cartão de Crédito</p>
              </div>
            </div>
            <Badge className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Conectado
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Cobrança</DialogTitle>
            <DialogDescription>
              ID: {selectedPayment?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Conta</p>
                  <p className="font-medium">{selectedPayment.accountName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-medium">
                    R$ {selectedPayment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Líquido</p>
                  <p className="font-medium">
                    R$ {(selectedPayment.netValue || selectedPayment.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                  <p className="font-medium">{billingTypeLabels[selectedPayment.billingType]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`text-xs ${statusConfig[selectedPayment.status]?.color || ''}`}>
                    {statusConfig[selectedPayment.status]?.label || selectedPayment.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">
                    {format(new Date(selectedPayment.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                {selectedPayment.paymentDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Data Pagamento</p>
                    <p className="font-medium">
                      {format(new Date(selectedPayment.paymentDate), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}
                {selectedPayment.description && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Descrição</p>
                    <p className="font-medium">{selectedPayment.description}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                {selectedPayment.billingType === 'PIX' && selectedPayment.status === 'PENDING' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => handleGetPixQrCode(selectedPayment.id)}
                  >
                    <QrCode className="h-4 w-4" />
                    Ver QR Code
                  </Button>
                )}
                {selectedPayment.invoiceUrl && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1"
                    onClick={() => window.open(selectedPayment.invoiceUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver Fatura
                  </Button>
                )}
                {selectedPayment.bankSlipUrl && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1"
                    onClick={() => window.open(selectedPayment.bankSlipUrl, '_blank')}
                  >
                    <Receipt className="h-4 w-4" />
                    Ver Boleto
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
