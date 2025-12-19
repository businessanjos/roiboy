import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAsaas, BILLING_TYPE_LABELS, PAYMENT_STATUS_LABELS } from "@/hooks/useAsaas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Loader2, 
  Search, 
  Building2, 
  CreditCard, 
  Receipt, 
  Plus,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  QrCode,
  FileText
} from "lucide-react";

interface AccountWithAsaas {
  id: string;
  name: string;
  subscription_status: string | null;
  plan_id: string | null;
  plan_name?: string;
  asaas_customer_id?: string;
  asaas_subscription_id?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  trial: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  overdue: "bg-red-500/10 text-red-500 border-red-500/20",
  cancelled: "bg-muted text-muted-foreground border-muted",
  pending: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  suspended: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  trial: "Trial",
  overdue: "Inadimplente",
  cancelled: "Cancelada",
  pending: "Pendente",
  suspended: "Suspensa",
};

export function AdminAsaasManager() {
  const queryClient = useQueryClient();
  const { loading: asaasLoading, createCustomer, createSubscription, listPayments } = useAsaas();
  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountWithAsaas | null>(null);
  const [isPaymentsDialogOpen, setIsPaymentsDialogOpen] = useState(false);
  const [accountPayments, setAccountPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Fetch all accounts with plan info
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['admin-asaas-accounts'],
    queryFn: async () => {
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name, subscription_status, plan_id')
        .order('name');
      
      if (accountsError) throw accountsError;

      // Get plan names
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('id, name');

      const planMap: Record<string, string> = {};
      plansData?.forEach((p: { id: string; name: string }) => {
        planMap[p.id] = p.name;
      });

      return accountsData.map((acc: any) => ({
        ...acc,
        plan_name: acc.plan_id ? planMap[acc.plan_id] : 'Sem plano'
      })) as AccountWithAsaas[];
    }
  });

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewPayments = async (account: AccountWithAsaas) => {
    setSelectedAccount(account);
    setIsPaymentsDialogOpen(true);
    setLoadingPayments(true);
    
    // For now, show a placeholder - in production, you'd fetch from Asaas using the customer ID
    // This would require storing asaas_customer_id in the accounts table
    setAccountPayments([]);
    setLoadingPayments(false);
    
    toast.info("Para ver pagamentos, vincule primeiro o cliente no Asaas");
  };

  // Stats
  const activeCount = accounts.filter(a => a.subscription_status === 'active').length;
  const trialCount = accounts.filter(a => a.subscription_status === 'trial').length;
  const overdueCount = accounts.filter(a => a.subscription_status === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
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
                <p className="text-2xl font-semibold">{trialCount}</p>
                <p className="text-xs text-muted-foreground">Em Trial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">Inadimplentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-medium">Assinaturas por Conta</CardTitle>
              <CardDescription className="text-sm">Gerencie pagamentos e assinaturas de cada conta</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar contas..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? 'Nenhuma conta encontrada' : 'Nenhuma conta cadastrada'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-medium">Conta</TableHead>
                    <TableHead className="font-medium">Plano</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map(account => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {account.plan_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${STATUS_COLORS[account.subscription_status || 'trial']}`}
                        >
                          {STATUS_LABELS[account.subscription_status || 'trial']}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewPayments(account)}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Pagamentos
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Dialog */}
      <Dialog open={isPaymentsDialogOpen} onOpenChange={setIsPaymentsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pagamentos - {selectedAccount?.name}</DialogTitle>
            <DialogDescription>
              Histórico de pagamentos e cobranças da conta
            </DialogDescription>
          </DialogHeader>
          
          {loadingPayments ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : accountPayments.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vincule um cliente no Asaas para gerenciar cobranças
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {format(new Date(payment.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {BILLING_TYPE_LABELS[payment.billingType] || payment.billingType}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
