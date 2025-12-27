import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, parseISO, addMonths, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  MoreHorizontal,
  Edit2,
  Trash2,
  RefreshCw,
  Building2,
  User,
  FileText,
  Repeat,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { FinancialCategoriesDialog } from "@/components/financial/FinancialCategoriesDialog";

interface FinancialEntry {
  id: string;
  entry_type: "payable" | "receivable";
  description: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled" | "partially_paid";
  category_id: string | null;
  bank_account_id: string | null;
  client_id: string | null;
  contract_id: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_end_date: string | null;
  is_conciliated: boolean;
  document_number: string | null;
  notes: string | null;
  currency: string;
  created_at: string;
  category?: { id: string; name: string; color: string } | null;
  bank_account?: { id: string; name: string; bank_name: string } | null;
  client?: { id: string; full_name: string } | null;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  current_balance: number;
}

interface Client {
  id: string;
  full_name: string;
}

const statusConfig = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  paid: { label: "Pago", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  overdue: { label: "Atrasado", color: "bg-red-100 text-red-800", icon: AlertCircle },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-800", icon: XCircle },
  partially_paid: { label: "Parcial", color: "bg-blue-100 text-blue-800", icon: DollarSign },
};

const recurrenceLabels: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export default function FinancialEntries() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"payable" | "receivable">("receivable");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [payingEntry, setPayingEntry] = useState<FinancialEntry | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    due_date: format(new Date(), "yyyy-MM-dd"),
    category_id: "",
    bank_account_id: "",
    client_id: "",
    is_recurring: false,
    recurrence_type: "monthly",
    recurrence_end_date: "",
    document_number: "",
    notes: "",
  });

  // Fetch entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["financial-entries", accountId, activeTab, currentMonth],
    queryFn: async () => {
      if (!accountId) return [];
      
      const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          *,
          category:financial_categories(id, name, color),
          bank_account:bank_accounts(id, name, bank_name),
          client:clients(id, full_name)
        `)
        .eq("account_id", accountId)
        .eq("entry_type", activeTab)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });
      
      if (error) throw error;
      return data as FinancialEntry[];
    },
    enabled: !!accountId,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["financial-categories", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FinancialCategory[];
    },
    enabled: !!accountId,
  });

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!accountId,
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("account_id", accountId)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!accountId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { entry_type: string }) => {
      const payload = {
        account_id: accountId,
        entry_type: data.entry_type,
        description: data.description,
        amount: parseFloat(data.amount.replace(",", ".")),
        due_date: data.due_date,
        category_id: data.category_id || null,
        bank_account_id: data.bank_account_id || null,
        client_id: data.client_id || null,
        is_recurring: data.is_recurring,
        recurrence_type: data.is_recurring ? data.recurrence_type : null,
        recurrence_end_date: data.is_recurring && data.recurrence_end_date ? data.recurrence_end_date : null,
        document_number: data.document_number || null,
        notes: data.notes || null,
      };

      if (editingEntry) {
        const { error } = await supabase
          .from("financial_entries")
          .update(payload)
          .eq("id", editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_entries")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingEntry ? "Lançamento atualizado" : "Lançamento criado",
        description: editingEntry ? "O lançamento foi atualizado com sucesso." : "O lançamento foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o lançamento.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Pay mutation
  const payMutation = useMutation({
    mutationFn: async ({ entryId, bankAccountId, paymentDate }: { entryId: string; bankAccountId: string; paymentDate: string }) => {
      const { error } = await supabase
        .from("financial_entries")
        .update({
          status: "paid",
          payment_date: paymentDate,
          bank_account_id: bankAccountId,
        })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setIsPayDialogOpen(false);
      setPayingEntry(null);
      toast({ title: "Pagamento registrado", description: "O lançamento foi marcado como pago." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível registrar o pagamento.", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      toast({ title: "Lançamento excluído" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir o lançamento.", variant: "destructive" });
    },
  });

  // Conciliate mutation
  const conciliateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.from("users").select("id").single();
      const { error } = await supabase
        .from("financial_entries")
        .update({
          is_conciliated: true,
          conciliated_at: new Date().toISOString(),
          conciliated_by: userData?.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      toast({ title: "Lançamento conciliado" });
    },
  });

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      due_date: format(new Date(), "yyyy-MM-dd"),
      category_id: "",
      bank_account_id: "",
      client_id: "",
      is_recurring: false,
      recurrence_type: "monthly",
      recurrence_end_date: "",
      document_number: "",
      notes: "",
    });
    setEditingEntry(null);
  };

  const handleEdit = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setFormData({
      description: entry.description,
      amount: entry.amount.toString(),
      due_date: entry.due_date,
      category_id: entry.category_id || "",
      bank_account_id: entry.bank_account_id || "",
      client_id: entry.client_id || "",
      is_recurring: entry.is_recurring,
      recurrence_type: entry.recurrence_type || "monthly",
      recurrence_end_date: entry.recurrence_end_date || "",
      document_number: entry.document_number || "",
      notes: entry.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handlePay = (entry: FinancialEntry) => {
    setPayingEntry(entry);
    setIsPayDialogOpen(true);
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || entry.category_id === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Calculate totals
  const totals = filteredEntries.reduce(
    (acc, entry) => {
      if (entry.status === "paid") {
        acc.paid += entry.amount;
      } else if (entry.status === "pending" || entry.status === "overdue") {
        acc.pending += entry.amount;
      }
      acc.total += entry.amount;
      return acc;
    },
    { paid: 0, pending: 0, total: 0 }
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const filteredCategories = categories.filter(
    (cat) => cat.type === "both" || cat.type === (activeTab === "payable" ? "expense" : "income")
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">Gerencie contas a pagar e receber</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCategoriesOpen(true)}>
            <Filter className="h-4 w-4 mr-2" />
            Categorias
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-lg font-medium min-w-[180px] text-center">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "payable" | "receivable")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="receivable" className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
            A Receber
          </TabsTrigger>
          <TabsTrigger value="payable" className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-red-600" />
            A Pagar
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {activeTab === "receivable" ? "Recebido" : "Pago"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totals.pending)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {entriesLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum lançamento encontrado</p>
                  <Button variant="link" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    Criar primeiro lançamento
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => {
                      const StatusIcon = statusConfig[entry.status]?.icon || Clock;
                      const isOverdue = entry.status === "pending" && isBefore(parseISO(entry.due_date), new Date());
                      
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {entry.is_recurring && (
                                <Repeat className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <div className="font-medium">{entry.description}</div>
                                {entry.document_number && (
                                  <div className="text-xs text-muted-foreground">
                                    Doc: {entry.document_number}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {entry.category ? (
                              <Badge variant="outline" style={{ borderColor: entry.category.color, color: entry.category.color }}>
                                {entry.category.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.client ? (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {entry.client.full_name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(entry.due_date), "dd/MM/yyyy")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={isOverdue && entry.status === "pending" ? statusConfig.overdue.color : statusConfig[entry.status]?.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {isOverdue && entry.status === "pending" ? "Atrasado" : statusConfig[entry.status]?.label}
                            </Badge>
                            {entry.is_conciliated && (
                              <Badge variant="outline" className="ml-1 text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Conciliado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {entry.status === "pending" && (
                                  <DropdownMenuItem onClick={() => handlePay(entry)}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Registrar Pagamento
                                  </DropdownMenuItem>
                                )}
                                {entry.status === "paid" && !entry.is_conciliated && (
                                  <DropdownMenuItem onClick={() => conciliateMutation.mutate(entry.id)}>
                                    <Check className="h-4 w-4 mr-2" />
                                    Conciliar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleEdit(entry)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm("Deseja excluir este lançamento?")) {
                                      deleteMutation.mutate(entry.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Editar Lançamento" : `Novo ${activeTab === "receivable" ? "Recebimento" : "Pagamento"}`}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({ ...formData, entry_type: activeTab });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Mensalidade Janeiro"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select value={formData.bank_account_id} onValueChange={(v) => setFormData({ ...formData, bank_account_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} - {acc.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Número do Documento</Label>
              <Input
                value={formData.document_number}
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                placeholder="NF, boleto, etc."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_recurring}
                onCheckedChange={(v) => setFormData({ ...formData, is_recurring: v })}
              />
              <Label>Lançamento recorrente</Label>
            </div>

            {formData.is_recurring && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select value={formData.recurrence_type} onValueChange={(v) => setFormData({ ...formData, recurrence_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(recurrenceLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Até</Label>
                  <Input
                    type="date"
                    value={formData.recurrence_end_date}
                    onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingEntry ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {payingEntry?.description} - {payingEntry && formatCurrency(payingEntry.amount)}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              if (payingEntry) {
                payMutation.mutate({
                  entryId: payingEntry.id,
                  bankAccountId: formData.get("bank_account_id") as string,
                  paymentDate: formData.get("payment_date") as string,
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Data do Pagamento *</Label>
              <Input
                type="date"
                name="payment_date"
                defaultValue={format(new Date(), "yyyy-MM-dd")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Conta Bancária *</Label>
              <Select name="bank_account_id" defaultValue={payingEntry?.bank_account_id || ""} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} - {acc.bank_name} ({formatCurrency(acc.current_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPayDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={payMutation.isPending}>
                {payMutation.isPending ? "Salvando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Categories Dialog */}
      <FinancialCategoriesDialog
        open={isCategoriesOpen}
        onOpenChange={setIsCategoriesOpen}
      />
    </div>
  );
}
