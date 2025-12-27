import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Upload, Sparkles, Check, X, FileText, Image } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Transaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  installment?: string;
  selected?: boolean;
}

interface CreditCardInvoiceImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditCardInvoiceImport({ open, onOpenChange }: CreditCardInvoiceImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'input' | 'review' | 'importing'>('input');
  const [inputType, setInputType] = useState<'text' | 'file'>('file');
  const [invoiceText, setInvoiceText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>("");

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts-for-import'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      
      const { data: userRecord } = await supabase
        .from('users')
        .select('account_id')
        .eq('id', userData.user.id)
        .single();
      
      if (!userRecord) return [];

      const { data } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('account_id', userRecord.account_id)
        .eq('is_active', true)
        .order('name');
      
      return data || [];
    }
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const getFileType = (file: File): string => {
    const type = file.type.toLowerCase();
    if (type === 'application/pdf') return 'pdf';
    if (type === 'image/png') return 'png';
    if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
    if (type === 'text/csv' || file.name.endsWith('.csv')) return 'csv';
    if (file.name.endsWith('.ofx')) return 'ofx';
    return 'unknown';
  };

  const parseOFX = (content: string): string => {
    // Basic OFX parsing - extract transaction data as text
    const transactions: string[] = [];
    const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const trn = match[1];
      const date = trn.match(/<DTPOSTED>(\d{8})/)?.[1] || '';
      const amount = trn.match(/<TRNAMT>([-\d.]+)/)?.[1] || '';
      const memo = trn.match(/<MEMO>([^<]+)/)?.[1] || '';
      const name = trn.match(/<NAME>([^<]+)/)?.[1] || '';
      
      if (date && amount) {
        const formattedDate = `${date.slice(6,8)}/${date.slice(4,6)}/${date.slice(0,4)}`;
        transactions.push(`${formattedDate} ${name || memo} ${amount}`);
      }
    }
    
    return transactions.join('\n');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileType = getFileType(file);
      if (!['pdf', 'png', 'jpg', 'csv', 'ofx'].includes(fileType)) {
        toast({
          title: "Formato não suportado",
          description: "Use PDF, imagem (PNG/JPG), CSV ou OFX",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleProcessInvoice = async () => {
    if (inputType === 'text' && !invoiceText.trim()) {
      toast({
        title: "Erro",
        description: "Cole o texto da fatura para continuar",
        variant: "destructive"
      });
      return;
    }

    if (inputType === 'file' && !selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo para continuar",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Não autenticado');
      
      const { data: userRecord } = await supabase
        .from('users')
        .select('account_id')
        .eq('id', userData.user.id)
        .single();
      
      if (!userRecord) throw new Error('Usuário não encontrado');

      let requestBody: any = {
        account_id: userRecord.account_id,
        bank_account_id: selectedBankAccount || undefined
      };

      if (inputType === 'text') {
        requestBody.invoice_text = invoiceText;
      } else if (selectedFile) {
        const fileType = getFileType(selectedFile);
        
        if (fileType === 'csv') {
          // Read CSV as text
          const text = await selectedFile.text();
          requestBody.invoice_text = text;
          requestBody.file_type = 'csv';
        } else if (fileType === 'ofx') {
          // Parse OFX and send as text
          const content = await selectedFile.text();
          requestBody.invoice_text = parseOFX(content);
          requestBody.file_type = 'ofx';
        } else {
          // PDF or image - send as base64
          const base64 = await fileToBase64(selectedFile);
          requestBody.invoice_base64 = base64;
          requestBody.file_type = fileType;
        }
      }

      const { data, error } = await supabase.functions.invoke('parse-credit-card-invoice', {
        body: requestBody
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.transactions && data.transactions.length > 0) {
        setTransactions(data.transactions.map((t: Transaction) => ({ ...t, selected: true })));
        setTotalAmount(data.total_amount);
        setDueDate(data.due_date || "");
        setStep('review');
        toast({
          title: "Fatura processada",
          description: `${data.transactions.length} transações encontradas`
        });
      } else {
        toast({
          title: "Nenhuma transação encontrada",
          description: "Verifique se o arquivo/texto da fatura está correto",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error processing invoice:', error);
      toast({
        title: "Erro ao processar fatura",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleTransaction = (index: number) => {
    setTransactions(prev => prev.map((t, i) => 
      i === index ? { ...t, selected: !t.selected } : t
    ));
  };

  const handleSelectAll = (selected: boolean) => {
    setTransactions(prev => prev.map(t => ({ ...t, selected })));
  };

  const handleImportTransactions = async () => {
    const selectedTransactions = transactions.filter(t => t.selected);
    if (selectedTransactions.length === 0) {
      toast({
        title: "Nenhuma transação selecionada",
        description: "Selecione pelo menos uma transação para importar",
        variant: "destructive"
      });
      return;
    }

    setStep('importing');
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Não autenticado');
      
      const { data: userRecord } = await supabase
        .from('users')
        .select('account_id')
        .eq('id', userData.user.id)
        .single();
      
      if (!userRecord) throw new Error('Usuário não encontrado');

      // Import transactions as financial entries
      const entries = selectedTransactions.map(t => ({
        account_id: userRecord.account_id,
        bank_account_id: selectedBankAccount || null,
        description: t.description + (t.installment ? ` (${t.installment})` : ''),
        amount: t.amount,
        type: 'expense' as const,
        status: 'pending' as const,
        due_date: dueDate || t.date,
        notes: `Importado de fatura de cartão - Categoria: ${t.category || 'Não categorizado'}`,
        source: 'credit_card_invoice'
      }));

      const { error } = await supabase
        .from('financial_entries')
        .insert(entries);

      if (error) throw error;

      toast({
        title: "Importação concluída",
        description: `${selectedTransactions.length} transações importadas com sucesso`
      });

      queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      handleClose();
    } catch (error) {
      console.error('Error importing transactions:', error);
      toast({
        title: "Erro ao importar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive"
      });
      setStep('review');
    }
  };

  const handleClose = () => {
    setStep('input');
    setInputType('file');
    setInvoiceText("");
    setSelectedFile(null);
    setTransactions([]);
    setTotalAmount(null);
    setDueDate("");
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const selectedTotal = transactions.filter(t => t.selected).reduce((sum, t) => sum + t.amount, 0);

  const canProcess = inputType === 'text' ? invoiceText.trim().length > 0 : selectedFile !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Importar Fatura de Cartão
            <Badge variant="secondary" className="ml-2">
              <Sparkles className="h-3 w-3 mr-1" />
              IA
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <Label>Conta Bancária (opcional)</Label>
              <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta do cartão" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts?.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {account.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={inputType} onValueChange={(v) => setInputType(v as 'text' | 'file')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Arquivo
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-2">
                  <Image className="h-4 w-4" />
                  Texto
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4 mt-4">
                <div>
                  <Label>Upload de Arquivo</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Envie PDF, imagem (PNG/JPG), CSV ou OFX da fatura
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.csv,.ofx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <FileText className="h-10 w-10 mx-auto text-primary" />
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                        <Button variant="outline" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}>
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="font-medium">Clique para selecionar</p>
                        <p className="text-sm text-muted-foreground">
                          PDF, PNG, JPG, CSV ou OFX
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div>
                  <Label>Texto da Fatura</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Cole o texto da fatura copiado do PDF ou app do banco
                  </p>
                  <Textarea
                    placeholder="Cole aqui o texto da fatura...&#10;&#10;Exemplo:&#10;10/12 MERCADO LIVRE 150,00&#10;11/12 UBER *TRIP 25,90&#10;12/12 AMAZON.COM.BR 89,99"
                    value={invoiceText}
                    onChange={(e) => setInvoiceText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleProcessInvoice} disabled={isProcessing || !canProcess}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Processar com IA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedCount} de {transactions.length} transações selecionadas
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Selecionar Todas
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleSelectAll(false)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Desmarcar Todas
                </Button>
              </div>
            </div>

            {dueDate && (
              <div className="flex items-center gap-2">
                <Label>Vencimento:</Label>
                <Input 
                  type="date" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-auto"
                />
              </div>
            )}

            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {transactions.map((t, index) => (
                  <div 
                    key={index}
                    className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer ${
                      t.selected ? 'bg-muted/30' : ''
                    }`}
                    onClick={() => handleToggleTransaction(index)}
                  >
                    <Checkbox 
                      checked={t.selected} 
                      onCheckedChange={() => handleToggleTransaction(index)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.description}</div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <span>{t.date}</span>
                        {t.category && <Badge variant="outline" className="text-xs">{t.category}</Badge>}
                        {t.installment && <span className="text-primary">({t.installment})</span>}
                      </div>
                    </div>
                    <div className="font-semibold text-destructive">
                      {formatCurrency(t.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-lg font-semibold">
                Total selecionado: <span className="text-destructive">{formatCurrency(selectedTotal)}</span>
              </div>
              {totalAmount && (
                <div className="text-sm text-muted-foreground">
                  Total da fatura: {formatCurrency(totalAmount)}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('input')}>
                Voltar
              </Button>
              <Button onClick={handleImportTransactions} disabled={selectedCount === 0}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {selectedCount} Transações
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p>Importando transações...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
