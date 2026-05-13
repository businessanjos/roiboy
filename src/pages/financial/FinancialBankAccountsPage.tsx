import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MoreHorizontal, Building2, Check, ChevronsUpDown, MapPin, Calendar, FileText, Link as LinkIcon, Unlink } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { OpenFinanceLinkDialog } from "@/components/financial/OpenFinanceLinkDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { brazilianBanks, findBankByName } from "@/data/brazilian-banks";
import { format, parseISO } from "date-fns";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  bank_code: string | null;
  agency: string | null;
  agency_digit: string | null;
  account_number: string | null;
  account_digit: string | null;
  account_type: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  color: string;
  notes: string | null;
  // New fields
  initial_balance_date: string | null;
  credit_limit: number | null;
  linked_account_id: string | null;
  exclude_from_reports: boolean;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  agency_street: string | null;
  agency_number: string | null;
  agency_neighborhood: string | null;
  agency_complement: string | null;
  agency_city: string | null;
  agency_state: string | null;
  agency_zip_code: string | null;
  // Credit card specific fields
  card_brand: string | null;
  card_last_digits: string | null;
  closing_day: number | null;
  due_day: number | null;
  // Open Finance
  openfinance_account_id?: string | null;
  openfinance_connection_id?: string | null;
  openfinance_institution?: string | null;
  last_balance_sync_at?: string | null;
  last_transactions_sync_at?: string | null;
}

const cardBrands = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "diners", label: "Diners Club" },
  { value: "discover", label: "Discover" },
  { value: "jcb", label: "JCB" },
  { value: "other", label: "Outra" },
];

// Expanded account types based on reference UI
const accountTypes: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Conta Poupança",
  investment: "Investimentos",
  cash: "Caixa/Caixinha",
  credit_card: "Cartão de Crédito",
  payment: "Conta de Pagamento",
  loan: "Conta Empréstimo",
  guaranteed: "Conta Garantida",
  application: "Conta Aplicação",
  advance: "Adiantamento",
  card_admin: "Administradora de Cartões",
  virtual_wallet: "Carteira Virtual",
  installment: "Crediário/Carnê",
  mutual: "Mútuo",
};

const defaultColors = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function FinancialBankAccountsPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [bankPopoverOpen, setBankPopoverOpen] = useState(false);
  const [linkedAccountPopoverOpen, setLinkedAccountPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [linkDialogFor, setLinkDialogFor] = useState<BankAccount | null>(null);

  const unlinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_accounts")
        .update({
          openfinance_account_id: null,
          openfinance_connection_id: null,
          openfinance_institution: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-all"] });
      toast({ title: "Conta desvinculada do Open Finance" });
    },
  });

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
    initial_balance_date: "",
    credit_limit: "",
    linked_account_id: "",
    is_active: true,
    exclude_from_reports: false,
    color: defaultColors[0],
    notes: "",
    // Agency info
    manager_name: "",
    manager_email: "",
    manager_phone: "",
    agency_street: "",
    agency_number: "",
    agency_neighborhood: "",
    agency_complement: "",
    agency_city: "",
    agency_state: "",
    agency_zip_code: "",
    // Credit card specific
    card_brand: "",
    card_last_digits: "",
    closing_day: "",
    due_day: "",
  });

  const { data: bankAccounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts-all", accountId],
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

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
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
        initial_balance: parseFloat(data.initial_balance.replace(",", ".")) || 0,
        initial_balance_date: data.initial_balance_date || null,
        credit_limit: parseFloat(data.credit_limit.replace(",", ".")) || 0,
        linked_account_id: data.linked_account_id || null,
        is_active: data.is_active,
        exclude_from_reports: data.exclude_from_reports,
        color: data.color,
        notes: data.notes || null,
        // Agency info
        manager_name: data.manager_name || null,
        manager_email: data.manager_email || null,
        manager_phone: data.manager_phone || null,
        agency_street: data.agency_street || null,
        agency_number: data.agency_number || null,
        agency_neighborhood: data.agency_neighborhood || null,
        agency_complement: data.agency_complement || null,
        agency_city: data.agency_city || null,
        agency_state: data.agency_state || null,
        agency_zip_code: data.agency_zip_code || null,
        // Credit card specific
        card_brand: data.card_brand || null,
        card_last_digits: data.card_last_digits || null,
        closing_day: data.closing_day ? parseInt(data.closing_day) : null,
        due_day: data.due_day ? parseInt(data.due_day) : null,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("bank_accounts")
          .update(payload)
          .eq("id", editingAccount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bank_accounts")
          .insert({ ...payload, current_balance: payload.initial_balance });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: editingAccount ? "Conta atualizada" : "Conta criada" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a conta.", variant: "destructive" });
    },
  });

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
      toast({ title: "Erro", description: "Não foi possível excluir a conta.", variant: "destructive" });
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
      initial_balance_date: "",
      credit_limit: "",
      linked_account_id: "",
      is_active: true,
      exclude_from_reports: false,
      color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
      notes: "",
      manager_name: "",
      manager_email: "",
      manager_phone: "",
      agency_street: "",
      agency_number: "",
      agency_neighborhood: "",
      agency_complement: "",
      agency_city: "",
      agency_state: "",
      agency_zip_code: "",
      // Credit card specific
      card_brand: "",
      card_last_digits: "",
      closing_day: "",
      due_day: "",
    });
    setEditingAccount(null);
    setActiveTab("basic");
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
      initial_balance_date: account.initial_balance_date || "",
      credit_limit: account.credit_limit?.toString() || "",
      linked_account_id: account.linked_account_id || "",
      is_active: account.is_active,
      exclude_from_reports: account.exclude_from_reports || false,
      color: account.color,
      notes: account.notes || "",
      manager_name: account.manager_name || "",
      manager_email: account.manager_email || "",
      manager_phone: account.manager_phone || "",
      agency_street: account.agency_street || "",
      agency_number: account.agency_number || "",
      agency_neighborhood: account.agency_neighborhood || "",
      agency_complement: account.agency_complement || "",
      agency_city: account.agency_city || "",
      agency_state: account.agency_state || "",
      agency_zip_code: account.agency_zip_code || "",
      // Credit card specific
      card_brand: account.card_brand || "",
      card_last_digits: account.card_last_digits || "",
      closing_day: account.closing_day?.toString() || "",
      due_day: account.due_day?.toString() || "",
    });
    setActiveTab("basic");
    setIsDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const fetchCepData = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          agency_street: data.logradouro || prev.agency_street,
          agency_neighborhood: data.bairro || prev.agency_neighborhood,
          agency_city: data.localidade || prev.agency_city,
          agency_state: data.uf || prev.agency_state,
        }));
      }
    } catch (error) {
      console.error("Error fetching CEP:", error);
    }
  };

  const totalBalance = bankAccounts.filter(a => a.is_active).reduce((acc, a) => acc + a.current_balance, 0);

  // Get other accounts for linked account selector (excluding current account being edited)
  const availableLinkedAccounts = bankAccounts.filter(a => a.id !== editingAccount?.id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie suas contas e saldos</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totalBalance)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma conta cadastrada</p>
              <Button variant="link" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                Criar primeira conta
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: account.color }}
                        />
                        <span className="font-medium">{account.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {findBankByName(account.bank_name)?.logo ? (
                          <img 
                            src={findBankByName(account.bank_name)?.logo} 
                            alt={account.bank_name}
                            className="w-5 h-5 rounded object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span>{account.bank_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {accountTypes[account.account_type] || account.account_type}
                        </Badge>
                        {account.account_type === 'credit_card' && account.card_last_digits && (
                          <span className="text-xs text-muted-foreground">
                            •••• {account.card_last_digits}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${account.current_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(account.current_balance)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? "default" : "secondary"}>
                        {account.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <RouterLink to={`/financial/bank-accounts/${account.id}/extrato`}>
                              <FileText className="h-4 w-4 mr-2" />
                              Ver extrato
                            </RouterLink>
                          </DropdownMenuItem>
                          {account.openfinance_account_id ? (
                            <DropdownMenuItem onClick={() => unlinkMutation.mutate(account.id)}>
                              <Unlink className="h-4 w-4 mr-2" />
                              Desvincular Open Finance
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setLinkDialogFor(account)}>
                              <LinkIcon className="h-4 w-4 mr-2" />
                              Conectar Open Finance
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEdit(account)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            {/* Basic Info Header */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Conta *</Label>
                <Select value={formData.account_type} onValueChange={(v) => setFormData({ ...formData, account_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(accountTypes).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Instituição *</Label>
                <Popover open={bankPopoverOpen} onOpenChange={setBankPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={bankPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {formData.bank_name || "Selecione um banco..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar banco..." />
                      <CommandList>
                        <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
                        <CommandGroup>
                          {brazilianBanks.map((bank) => (
                            <CommandItem
                              key={bank.code}
                              value={`${bank.name} ${bank.code}`}
                              onSelect={() => {
                                setFormData({ 
                                  ...formData, 
                                  bank_name: bank.name,
                                  bank_code: bank.code === "000" ? "" : bank.code
                                });
                                setBankPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.bank_name === bank.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {bank.logo ? (
                                <img 
                                  src={bank.logo} 
                                  alt={bank.name}
                                  className="w-5 h-5 rounded object-contain mr-2"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <Building2 className="w-5 h-5 text-muted-foreground mr-2" />
                              )}
                              <span className="font-medium">{bank.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {bank.code !== "000" && bank.code}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label>Agência</Label>
                <div className="flex gap-1">
                  <Input
                    value={formData.agency}
                    onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                    placeholder="0001"
                    className="flex-1"
                  />
                  <Input
                    value={formData.agency_digit}
                    onChange={(e) => setFormData({ ...formData, agency_digit: e.target.value })}
                    placeholder="0"
                    className="w-14"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conta (com dígito)</Label>
                <div className="flex gap-1">
                  <Input
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="12345"
                    className="flex-1"
                  />
                  <Input
                    value={formData.account_digit}
                    onChange={(e) => setFormData({ ...formData, account_digit: e.target.value })}
                    placeholder="6"
                    className="w-14"
                  />
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Outras Informações</TabsTrigger>
                <TabsTrigger value="agency">Sobre a Agência</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Saldo Inicial</Label>
                    <Input
                      value={formData.initial_balance}
                      onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Saldo Inicial</Label>
                    <Input
                      type="date"
                      value={formData.initial_balance_date}
                      onChange={(e) => setFormData({ ...formData, initial_balance_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de Crédito</Label>
                    <Input
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta Vinculada</Label>
                    <Popover open={linkedAccountPopoverOpen} onOpenChange={setLinkedAccountPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal text-sm"
                        >
                          {formData.linked_account_id
                            ? availableLinkedAccounts.find(a => a.id === formData.linked_account_id)?.name || "Selecione..."
                            : "Selecione..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar conta..." />
                          <CommandList>
                            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value=""
                                onSelect={() => {
                                  setFormData({ ...formData, linked_account_id: "" });
                                  setLinkedAccountPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", !formData.linked_account_id ? "opacity-100" : "opacity-0")} />
                                Nenhuma
                              </CommandItem>
                              {availableLinkedAccounts.map((account) => (
                                <CommandItem
                                  key={account.id}
                                  value={account.name}
                                  onSelect={() => {
                                    setFormData({ ...formData, linked_account_id: account.id });
                                    setLinkedAccountPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.linked_account_id === account.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {account.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Credit Card Specific Fields */}
                {formData.account_type === 'credit_card' && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      💳 Informações do Cartão de Crédito
                    </h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Bandeira</Label>
                        <Select 
                          value={formData.card_brand} 
                          onValueChange={(v) => setFormData({ ...formData, card_brand: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {cardBrands.map((brand) => (
                              <SelectItem key={brand.value} value={brand.value}>
                                {brand.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Últimos 4 dígitos</Label>
                        <Input
                          value={formData.card_last_digits}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setFormData({ ...formData, card_last_digits: value });
                          }}
                          placeholder="1234"
                          maxLength={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Dia do Fechamento</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={formData.closing_day}
                          onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
                          placeholder="15"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Dia do Vencimento</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={formData.due_day}
                          onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                          placeholder="25"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 py-2">
                  <Switch
                    id="exclude-reports"
                    checked={formData.exclude_from_reports}
                    onCheckedChange={(checked) => setFormData({ ...formData, exclude_from_reports: checked })}
                  />
                  <Label htmlFor="exclude-reports" className="text-sm">
                    Não considerar esta conta no "Resumo", no "Fluxo de Caixa" e no "Orçamento de Caixa"
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2 flex-wrap">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          formData.color === color ? "border-foreground scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="active">Conta ativa</Label>
                </div>

                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observações sobre esta conta..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="agency" className="space-y-4 mt-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Gerente da Conta</Label>
                    <Input
                      value={formData.manager_name}
                      onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                      placeholder="Nome do gerente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={formData.manager_email}
                      onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
                      placeholder="email@banco.com"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.manager_phone}
                      onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-2">
                    <Label>Endereço</Label>
                    <Input
                      value={formData.agency_street}
                      onChange={(e) => setFormData({ ...formData, agency_street: e.target.value })}
                      placeholder="Rua, Avenida..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={formData.agency_number}
                      onChange={(e) => setFormData({ ...formData, agency_number: e.target.value })}
                      placeholder="123"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.agency_neighborhood}
                      onChange={(e) => setFormData({ ...formData, agency_neighborhood: e.target.value })}
                      placeholder="Bairro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={formData.agency_complement}
                      onChange={(e) => setFormData({ ...formData, agency_complement: e.target.value })}
                      placeholder="Sala, Andar..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select 
                      value={formData.agency_state} 
                      onValueChange={(v) => setFormData({ ...formData, agency_state: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.agency_city}
                      onChange={(e) => setFormData({ ...formData, agency_city: e.target.value })}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={formData.agency_zip_code}
                      onChange={(e) => setFormData({ ...formData, agency_zip_code: e.target.value })}
                      onBlur={(e) => fetchCepData(e.target.value)}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
