import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileUp,
  Link2,
  CheckCircle2,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  FileSpreadsheet,
  Search,
  Calendar,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  current_balance: number;
}

interface UnreconciledEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  entry_type: string;
  status: string;
}

export default function FinancialReconciliationPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"pending" | "import" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

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

  const { data: pendingEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["unreconciled-entries", accountId, selectedBankAccount],
    queryFn: async () => {
      if (!accountId) return [];
      
      let query = supabase
        .from("financial_entries")
        .select("id, description, amount, due_date, payment_date, entry_type, status")
        .eq("account_id", accountId)
        .eq("status", "paid")
        .eq("is_conciliated", false)
        .order("payment_date", { ascending: false });
      
      if (selectedBankAccount && selectedBankAccount !== "all") {
        query = query.eq("bank_account_id", selectedBankAccount);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UnreconciledEntry[];
    },
    enabled: !!accountId,
  });

  const reconcileMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { data: userData } = await supabase.from("users").select("id").maybeSingle();
      
      const { error } = await supabase
        .from("financial_entries")
        .update({
          is_conciliated: true,
          conciliated_at: new Date().toISOString(),
          conciliated_by: userData?.id,
        })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreconciled-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      toast({ title: "Lançamento conciliado com sucesso" });
    },
    onError: () => {
      toast({ 
        title: "Erro", 
        description: "Não foi possível conciliar o lançamento.",
        variant: "destructive" 
      });
    },
  });

  const batchReconcileMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const { data: userData } = await supabase.from("users").select("id").maybeSingle();
      
      const { error } = await supabase
        .from("financial_entries")
        .update({
          is_conciliated: true,
          conciliated_at: new Date().toISOString(),
          conciliated_by: userData?.id,
        })
        .in("id", entryIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreconciled-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      setSelectedTransactions(new Set());
      toast({ title: "Lançamentos conciliados com sucesso" });
    },
    onError: () => {
      toast({ 
        title: "Erro", 
        description: "Não foi possível conciliar os lançamentos.",
        variant: "destructive" 
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const filteredEntries = pendingEntries.filter((entry) =>
    entry.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedTransactions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTransactions(newSet);
  };

  const selectAll = () => {
    if (selectedTransactions.size === filteredEntries.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const summary = {
    total: pendingEntries.length,
    income: pendingEntries.filter(e => e.entry_type === "receivable").reduce((sum, e) => sum + e.amount, 0),
    expense: pendingEntries.filter(e => e.entry_type === "payable").reduce((sum, e) => sum + e.amount, 0),
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            <div>
              <CardTitle>Conciliação Bancária</CardTitle>
              <CardDescription>
                Concilie os lançamentos pagos com o extrato bancário
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bank Account Selector */}
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground">Conta Bancária</Label>
              <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {account.name} - {account.bank_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Pendentes
                </div>
                <div className="text-2xl font-bold">{summary.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <ArrowDownCircle className="h-4 w-4" />
                  A Receber
                </div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.income)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <ArrowUpCircle className="h-4 w-4" />
                  A Pagar
                </div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.expense)}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pendentes ({summary.total})
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                Importar Extrato
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lançamentos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {selectedTransactions.size > 0 && (
                  <Button 
                    onClick={() => batchReconcileMutation.mutate(Array.from(selectedTransactions))}
                    disabled={batchReconcileMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Conciliar {selectedTransactions.size} selecionados
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[400px]">
                {entriesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="font-medium">Tudo conciliado!</p>
                    <p className="text-sm mt-2">
                      Não há lançamentos pagos pendentes de conciliação.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={selectedTransactions.size === filteredEntries.length && filteredEntries.length > 0}
                            onCheckedChange={selectAll}
                          />
                        </TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedTransactions.has(entry.id)}
                              onCheckedChange={() => toggleSelection(entry.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{entry.description}</div>
                          </TableCell>
                          <TableCell>
                            {entry.entry_type === "receivable" ? (
                              <Badge variant="outline" className="border-green-500 text-green-600">
                                <ArrowDownCircle className="h-3 w-3 mr-1" />
                                Receita
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-500 text-red-600">
                                <ArrowUpCircle className="h-3 w-3 mr-1" />
                                Despesa
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.payment_date && (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(entry.payment_date), "dd/MM/yyyy")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${entry.entry_type === "receivable" ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reconcileMutation.mutate(entry.id)}
                              disabled={reconcileMutation.isPending}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Conciliar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="import" className="mt-4">
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Importar Extrato Bancário</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Arraste um arquivo OFX ou CSV aqui ou clique para selecionar
                </p>
                <Button variant="outline">
                  <FileUp className="h-4 w-4 mr-2" />
                  Selecionar Arquivo
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Formatos suportados: OFX, CSV (padrão bancário)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="p-12 text-center text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma importação de extrato realizada</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
