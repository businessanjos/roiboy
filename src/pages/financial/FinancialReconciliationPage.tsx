import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, parse } from "date-fns";
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
  Loader2,
  X,
  Sparkles,
  Brain,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PendingClassifications } from "@/components/financial/PendingClassifications";
import { FinancialPageHeader, FinancialKpiCard } from "@/components/financial/_shared";
import { formatBRLCompact } from "@/lib/financial-format";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"pending" | "import" | "ai" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
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

  // Parse OFX file
  const parseOFX = (content: string): ParsedTransaction[] => {
    const transactions: ParsedTransaction[] = [];
    
    // Match STMTTRN blocks
    const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;
    
    while ((match = stmttrnRegex.exec(content)) !== null) {
      const block = match[1];
      
      const typeMatch = block.match(/<TRNTYPE>(\w+)/i);
      const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);
      const amountMatch = block.match(/<TRNAMT>([-\d.,]+)/i);
      const memoMatch = block.match(/<MEMO>([^<\n]+)/i);
      const nameMatch = block.match(/<NAME>([^<\n]+)/i);
      
      if (dateMatch && amountMatch) {
        const dateStr = dateMatch[1];
        const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        const amount = parseFloat(amountMatch[1].replace(",", "."));
        const description = memoMatch?.[1]?.trim() || nameMatch?.[1]?.trim() || "Sem descrição";
        const trnType = typeMatch?.[1]?.toUpperCase();
        
        transactions.push({
          date: formattedDate,
          description,
          amount: Math.abs(amount),
          type: amount > 0 || trnType === "CREDIT" ? "credit" : "debit",
        });
      }
    }
    
    return transactions;
  };

  // Parse CSV file
  const parseCSV = (content: string): ParsedTransaction[] => {
    const transactions: ParsedTransaction[] = [];
    const lines = content.split("\n").filter(line => line.trim());
    
    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes("data") || 
                      lines[0]?.toLowerCase().includes("date") ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Try different CSV formats
      const parts = line.split(/[;,]/).map(p => p.trim().replace(/^"|"$/g, ""));
      
      if (parts.length >= 3) {
        // Try to find date, description, and amount
        let date = "";
        let description = "";
        let amount = 0;
        
        for (const part of parts) {
          // Check if it's a date (dd/mm/yyyy or yyyy-mm-dd)
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(part)) {
            const [day, month, year] = part.split("/");
            date = `${year}-${month}-${day}`;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
            date = part;
          } else if (/^-?[\d.,]+$/.test(part.replace(/\s/g, ""))) {
            // It's a number
            const parsed = parseFloat(part.replace(/\./g, "").replace(",", "."));
            if (!isNaN(parsed) && parsed !== 0) {
              amount = parsed;
            }
          } else if (part.length > 3 && !description) {
            description = part;
          }
        }
        
        if (date && amount !== 0) {
          transactions.push({
            date,
            description: description || "Sem descrição",
            amount: Math.abs(amount),
            type: amount > 0 ? "credit" : "debit",
          });
        }
      }
    }
    
    return transactions;
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    
    const allowedTypes = [".ofx", ".csv"];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    
    if (!allowedTypes.includes(extension)) {
      toast({
        title: "Formato não suportado",
        description: "Por favor, selecione um arquivo OFX ou CSV.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    setUploadedFileName(file.name);
    
    try {
      const content = await file.text();
      let transactions: ParsedTransaction[] = [];
      
      if (extension === ".ofx") {
        transactions = parseOFX(content);
      } else if (extension === ".csv") {
        transactions = parseCSV(content);
      }
      
      if (transactions.length === 0) {
        toast({
          title: "Nenhuma transação encontrada",
          description: "O arquivo não contém transações válidas ou está em formato não reconhecido.",
          variant: "destructive",
        });
      } else {
        setParsedTransactions(transactions);
        toast({
          title: "Extrato importado",
          description: `${transactions.length} transações encontradas.`,
        });
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível ler o arquivo. Verifique se está no formato correto.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const clearParsedTransactions = () => {
    setParsedTransactions([]);
    setUploadedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Send transactions to AI classification
  const classifyWithAI = async () => {
    if (!accountId || parsedTransactions.length === 0) return;
    
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-transactions', {
        body: {
          account_id: accountId,
          bank_account_id: selectedBankAccount !== 'all' ? selectedBankAccount : null,
          transactions: parsedTransactions.map((tx, index) => ({
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
            type: tx.type,
            external_id: `ofx-${uploadedFileName}-${index}`,
          })),
        },
      });

      if (error) throw error;

      toast({
        title: "Classificação concluída",
        description: `${data.classified} transações classificadas. Verifique na aba "Classificação IA".`,
      });
      
      // Switch to AI tab and refresh
      setActiveTab('ai');
      queryClient.invalidateQueries({ queryKey: ['pending-classifications'] });
      clearParsedTransactions();
    } catch (error) {
      console.error('Classification error:', error);
      toast({
        title: "Erro na classificação",
        description: "Não foi possível classificar as transações.",
        variant: "destructive",
      });
    } finally {
      setIsClassifying(false);
    }
  };

  const parsedSummary = {
    total: parsedTransactions.length,
    credits: parsedTransactions.filter(t => t.type === "credit").reduce((sum, t) => sum + t.amount, 0),
    debits: parsedTransactions.filter(t => t.type === "debit").reduce((sum, t) => sum + t.amount, 0),
  };

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={Link2}
        title="Conciliação Bancária"
        description="Compare seus lançamentos pagos com o extrato do banco e marque o que confere. Em caso de dúvida, deixe pendente e revise depois."
      />

      <Card>
        <CardContent className="p-6 space-y-6">
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
            <FinancialKpiCard
              icon={AlertCircle}
              label="Pendentes de conciliação"
              value={String(summary.total)}
              hint="lançamentos aguardando confirmação"
            />
            <FinancialKpiCard
              icon={ArrowDownCircle}
              label="A receber"
              value={formatBRLCompact(summary.income)}
              tone="success"
            />
            <FinancialKpiCard
              icon={ArrowUpCircle}
              label="A pagar"
              value={formatBRLCompact(summary.expense)}
              tone="danger"
            />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pendentes ({summary.total})
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                Importar OFX
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Classificação IA
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

            <TabsContent value="import" className="mt-4 space-y-4">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.csv"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {parsedTransactions.length === 0 ? (
                <div 
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
                      <h3 className="font-medium mb-2">Processando arquivo...</h3>
                      <p className="text-sm text-muted-foreground">
                        {uploadedFileName}
                      </p>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-medium mb-2">Importar Extrato Bancário</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Arraste um arquivo OFX ou CSV aqui ou clique para selecionar
                      </p>
                      <Button 
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp className="h-4 w-4 mr-2" />
                        Selecionar Arquivo
                      </Button>
                      <p className="text-xs text-muted-foreground mt-4">
                        Formatos suportados: OFX, CSV (padrão bancário)
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Parsed file info */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{uploadedFileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {parsedTransactions.length} transações importadas
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearParsedTransactions}>
                      <X className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  </div>

                  {/* Summary of parsed transactions */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <FileSpreadsheet className="h-4 w-4" />
                          Total
                        </div>
                        <div className="text-2xl font-bold">{parsedSummary.total}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <ArrowDownCircle className="h-4 w-4" />
                          Créditos
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(parsedSummary.credits)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <ArrowUpCircle className="h-4 w-4" />
                          Débitos
                        </div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(parsedSummary.debits)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Action button to classify with AI */}
                  <div className="flex justify-end">
                    <Button
                      onClick={classifyWithAI}
                      disabled={isClassifying}
                      className="gap-2"
                    >
                      {isClassifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isClassifying ? "Classificando..." : "Classificar com IA"}
                    </Button>
                  </div>

                  {/* Parsed transactions table */}
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedTransactions.map((tx, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(tx.date), "dd/MM/yyyy")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium max-w-[300px] truncate" title={tx.description}>
                                {tx.description}
                              </div>
                            </TableCell>
                            <TableCell>
                              {tx.type === "credit" ? (
                                <Badge variant="outline" className="border-green-500 text-green-600">
                                  <ArrowDownCircle className="h-3 w-3 mr-1" />
                                  Crédito
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500 text-red-600">
                                  <ArrowUpCircle className="h-3 w-3 mr-1" />
                                  Débito
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(tx.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <PendingClassifications />
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
