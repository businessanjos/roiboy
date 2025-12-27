import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Building2,
  Wallet,
  PiggyBank,
  TrendingUp,
  Banknote,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  bank_code: string | null;
  agency: string | null;
  agency_digit: string | null;
  account_number: string | null;
  account_digit: string | null;
  account_type: "checking" | "savings" | "investment" | "cash";
  initial_balance: number;
  current_balance: number;
  currency: string;
  is_active: boolean;
  color: string;
  notes: string | null;
  created_at: string;
}

const accountTypeConfig = {
  checking: { label: "Conta Corrente", icon: Wallet, color: "bg-blue-100 text-blue-800" },
  savings: { label: "Poupança", icon: PiggyBank, color: "bg-green-100 text-green-800" },
  investment: { label: "Investimento", icon: TrendingUp, color: "bg-purple-100 text-purple-800" },
  cash: { label: "Caixa", icon: Banknote, color: "bg-yellow-100 text-yellow-800" },
};

const bankColors = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export default function BankAccounts() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showBalances, setShowBalances] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    bank_name: "",
    bank_code: "",
    agency: "",
    agency_digit: "",
    account_number: "",
    account_digit: "",
    account_type: "checking",
    initial_balance: "",
    color: bankColors[0],
    notes: "",
  });

  // Fetch bank accounts
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!accountId,
  });

  // Fetch recent transactions for each account
  const { data: recentTransactions = [] } = useQuery({
    queryKey: ["recent-transactions", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, entry_type, description, amount, payment_date, bank_account_id")
        .eq("account_id", accountId)
        .eq("status", "paid")
        .not("bank_account_id", "is", null)
        .order("payment_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const initialBalance = parseFloat(data.initial_balance.replace(",", ".") || "0");
      const payload = {
        account_id: accountId,
        name: data.name,
        bank_name: data.bank_name,
        bank_code: data.bank_code || null,
        agency: data.agency || null,
        agency_digit: data.agency_digit || null,
        account_number: data.account_number || null,
        account_digit: data.account_digit || null,
        account_type: data.account_type,
        initial_balance: initialBalance,
        current_balance: editingAccount ? editingAccount.current_balance : initialBalance,
        color: data.color,
        notes: data.notes || null,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("bank_accounts")
          .update(payload)
          .eq("id", editingAccount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingAccount ? "Conta atualizada" : "Conta criada",
        description: editingAccount ? "A conta bancária foi atualizada." : "A conta bancária foi criada.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a conta bancária.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("bank_accounts")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({ title: "Conta excluída" });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir. Verifique se não há lançamentos vinculados.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      bank_name: "",
      bank_code: "",
      agency: "",
      agency_digit: "",
      account_number: "",
      account_digit: "",
      account_type: "checking",
      initial_balance: "",
      color: bankColors[0],
      notes: "",
    });
    setEditingAccount(null);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      bank_name: account.bank_name,
      bank_code: account.bank_code || "",
      agency: account.agency || "",
      agency_digit: account.agency_digit || "",
      account_number: account.account_number || "",
      account_digit: account.account_digit || "",
      account_type: account.account_type,
      initial_balance: account.initial_balance.toString(),
      color: account.color,
      notes: account.notes || "",
    });
    setIsDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Calculate total balance
  const totalBalance = accounts
    .filter((acc) => acc.is_active)
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  // Get transactions for an account
  const getAccountTransactions = (accountId: string) => {
    return recentTransactions.filter((t) => t.bank_account_id === accountId).slice(0, 5);
  };

  const activeAccounts = accounts.filter((acc) => acc.is_active);
  const inactiveAccounts = accounts.filter((acc) => !acc.is_active);

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie suas contas e acompanhe saldos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBalances(!showBalances)}>
            {showBalances ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showBalances ? "Ocultar Saldos" : "Mostrar Saldos"}
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Total Balance Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Saldo Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {showBalances ? formatCurrency(totalBalance) : "••••••"}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {activeAccounts.length} {activeAccounts.length === 1 ? "conta ativa" : "contas ativas"}
          </p>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : activeAccounts.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">Nenhuma conta bancária cadastrada</p>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Primeira Conta
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeAccounts.map((account) => {
            const TypeIcon = accountTypeConfig[account.account_type]?.icon || Wallet;
            const transactions = getAccountTransactions(account.id);
            
            return (
              <Card key={account.id} className="relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: account.color }}
                />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${account.color}20` }}
                      >
                        <TypeIcon className="h-5 w-5" style={{ color: account.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{account.name}</CardTitle>
                        <CardDescription>{account.bank_name}</CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(account)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleActiveMutation.mutate({ id: account.id, is_active: false })}
                        >
                          <EyeOff className="h-4 w-4 mr-2" />
                          Desativar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Deseja excluir esta conta?")) {
                              deleteMutation.mutate(account.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Account Info */}
                  {(account.agency || account.account_number) && (
                    <div className="text-sm text-muted-foreground">
                      {account.agency && <span>Ag: {account.agency}{account.agency_digit && `-${account.agency_digit}`}</span>}
                      {account.agency && account.account_number && " • "}
                      {account.account_number && <span>Cc: {account.account_number}{account.account_digit && `-${account.account_digit}`}</span>}
                    </div>
                  )}

                  {/* Balance */}
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Atual</p>
                    <p className={`text-2xl font-bold ${account.current_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {showBalances ? formatCurrency(account.current_balance) : "••••••"}
                    </p>
                  </div>

                  {/* Recent Transactions */}
                  {transactions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Últimas Movimentações</p>
                      <div className="space-y-1">
                        {transactions.map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {t.entry_type === "receivable" ? (
                                <ArrowDownLeft className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3 text-red-600" />
                              )}
                              <span className="truncate max-w-[120px]">{t.description}</span>
                            </div>
                            <span className={t.entry_type === "receivable" ? "text-green-600" : "text-red-600"}>
                              {showBalances ? formatCurrency(t.amount) : "••••"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Badge className={accountTypeConfig[account.account_type]?.color}>
                    {accountTypeConfig[account.account_type]?.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inactive Accounts */}
      {inactiveAccounts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-muted-foreground">Contas Inativas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveAccounts.map((account) => (
              <Card key={account.id} className="opacity-60">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base">{account.name}</CardTitle>
                      <CardDescription>{account.bank_name}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({ id: account.id, is_active: true })}
                    >
                      Ativar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium text-muted-foreground">
                    {showBalances ? formatCurrency(account.current_balance) : "••••••"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
            <DialogDescription>
              {editingAccount ? "Atualize os dados da conta bancária." : "Cadastre uma nova conta bancária para controle financeiro."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Conta *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Conta Principal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Banco *</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Ex: Itaú, Bradesco"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Conta *</Label>
                <Select value={formData.account_type} onValueChange={(v) => setFormData({ ...formData, account_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(accountTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código do Banco</Label>
                <Input
                  value={formData.bank_code}
                  onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                  placeholder="Ex: 341"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input
                  value={formData.agency}
                  onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                  placeholder="0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Dígito</Label>
                <Input
                  value={formData.agency_digit}
                  onChange={(e) => setFormData({ ...formData, agency_digit: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="00000"
                />
              </div>
              <div className="space-y-2">
                <Label>Dígito</Label>
                <Input
                  value={formData.account_digit}
                  onChange={(e) => setFormData({ ...formData, account_digit: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <Input
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {bankColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre a conta..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingAccount ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
