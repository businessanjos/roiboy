import { useState } from "react";
import { useTablePagination } from "@/hooks/useTablePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter,
  Calendar,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreditCardInvoiceImport } from "@/components/financial/CreditCardInvoiceImport";
import { FinancialPageHeader, FinancialKpiCard } from "@/components/financial/_shared";
import { formatBRLCompact } from "@/lib/financial-format";

interface InvoiceEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  bank_account_id: string | null;
  notes: string | null;
  created_at: string;
  bank_accounts?: {
    name: string;
    bank_name: string;
    color: string;
  } | null;
}

export default function FinancialInvoicesPage() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<InvoiceEntry | null>(null);

  const accountId = currentUser?.account_id;
  const monthStart = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), 'yyyy-MM-dd');
  const monthEnd = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

  // Fetch credit card entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['credit-card-invoices', accountId, monthStart, monthEnd],
    queryFn: async (): Promise<InvoiceEntry[]> => {
      if (!accountId) return [];
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/financial_entries`);
      url.searchParams.set('account_id', `eq.${accountId}`);
      url.searchParams.set('source', 'eq.credit_card_invoice');
      url.searchParams.set('due_date', `gte.${monthStart}`);
      url.searchParams.append('due_date', `lte.${monthEnd}`);
      url.searchParams.set('order', 'due_date.asc');
      url.searchParams.set('select', 'id,description,amount,due_date,status,bank_account_id,notes,created_at');

      const response = await fetch(url.toString(), {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) throw new Error('Erro ao buscar faturas');
      
      const data = await response.json();
      return data.map((entry: any) => ({ ...entry, bank_accounts: null })) as InvoiceEntry[];
    },
    enabled: !!accountId
  });

  // Simpler query for bank accounts
  const { data: allBankAccounts = [] } = useQuery({
    queryKey: ['all-bank-accounts', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data } = await supabase
        .from('bank_accounts')
        .select('id, name, bank_name, color')
        .eq('account_id', accountId)
        .eq('is_active', true);

      return data || [];
    },
    enabled: !!accountId
  });
  
  // Map bank accounts to entries
  const entriesWithBankAccounts = entries.map(entry => ({
    ...entry,
    bank_accounts: entry.bank_account_id 
      ? allBankAccounts.find(b => b.id === entry.bank_account_id) || null 
      : null
  }));

  // Fetch bank accounts for filter
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts-filter', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, name, bank_name, color')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!accountId
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('financial_entries')
        .delete()
        .eq('id', entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lançamento excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
      setDeleteDialogOpen(false);
      setSelectedEntry(null);
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao excluir", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('financial_entries')
        .update({ 
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lançamento marcado como pago" });
      queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao atualizar", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Filter entries
  const filteredEntries = entriesWithBankAccounts.filter(entry => {
    const matchesSearch = entry.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBankAccount = selectedBankAccount === "all" || entry.bank_account_id === selectedBankAccount;
    const matchesStatus = selectedStatus === "all" || entry.status === selectedStatus;
    return matchesSearch && matchesBankAccount && matchesStatus;
  });

  const {
    paginatedItems: paginatedEntries,
    currentPage: invoicePage,
    pageSize: invoicePageSize,
    totalPages: invoiceTotalPages,
    totalItems: invoiceTotalItems,
    handlePageChange: handleInvoicePageChange,
    handlePageSizeChange: handleInvoicePageSizeChange,
  } = useTablePagination(filteredEntries);

  // Calculate totals
  const totals = filteredEntries.reduce((acc, entry) => {
    acc.total += entry.amount;
    if (entry.status === 'paid') acc.paid += entry.amount;
    else acc.pending += entry.amount;
    return acc;
  }, { total: 0, paid: 0, pending: 0 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Pago</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Vencido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Faturas de Cartão
          </h1>
          <p className="text-muted-foreground">
            Gerencie e concilie faturas de cartão de crédito da empresa
          </p>
        </div>
        <Button onClick={() => setImportDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Importar Fatura
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-[200px] justify-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <Button variant="outline" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-muted-foreground">{filteredEntries.length} lançamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totals.pending)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os cartões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cartões</SelectItem>
            {bankAccounts.map(account => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Cartão</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>Nenhuma fatura encontrada</p>
                      <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Importar Fatura
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(new Date(entry.due_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {entry.description}
                    </TableCell>
                    <TableCell>
                      {entry.bank_accounts ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: entry.bank_accounts.color }}
                          />
                          <span className="text-sm">{entry.bank_accounts.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-red-600">
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {entry.status === 'pending' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => markAsPaidMutation.mutate(entry.id)}
                            title="Marcar como pago"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setSelectedEntry(entry);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setSelectedEntry(entry);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={invoicePage}
            totalPages={invoiceTotalPages}
            totalItems={invoiceTotalItems}
            pageSize={invoicePageSize}
            onPageChange={handleInvoicePageChange}
            onPageSizeChange={handleInvoicePageSizeChange}
          />
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <CreditCardInvoiceImport 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Lançamento</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="font-medium">{selectedEntry.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-medium text-red-600">{formatCurrency(selectedEntry.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{format(new Date(selectedEntry.due_date), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedEntry.status)}
                </div>
                {selectedEntry.bank_accounts && (
                  <div>
                    <p className="text-sm text-muted-foreground">Cartão</p>
                    <p className="font-medium">{selectedEntry.bank_accounts.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Importado em</p>
                  <p className="font-medium">{format(new Date(selectedEntry.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </div>
              {selectedEntry.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{selectedEntry.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedEntry?.description}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedEntry && deleteMutation.mutate(selectedEntry.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
