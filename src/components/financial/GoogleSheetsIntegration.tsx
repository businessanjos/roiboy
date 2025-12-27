import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Sheet, Copy, Check, ExternalLink, Code } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GoogleSheetsIntegrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleSheetsIntegration({ open, onOpenChange }: GoogleSheetsIntegrationProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: userData } = useQuery({
    queryKey: ['user-account-for-webhook'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      
      const { data: userRecord } = await supabase
        .from('users')
        .select('account_id')
        .eq('id', user.user.id)
        .single();
      
      return userRecord;
    }
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-webhook`;

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(null), 2000);
  };

  const appsScriptCode = `// Cole este código no Google Apps Script
// Acesse: Extensões > Apps Script

function onEdit(e) {
  // Trigger quando a planilha é editada
  // Customize conforme necessário
}

function sendToBTGIntegration(transactions) {
  const WEBHOOK_URL = '${webhookUrl}';
  const ACCOUNT_ID = '${userData?.account_id || 'SEU_ACCOUNT_ID'}';
  
  const payload = {
    account_id: ACCOUNT_ID,
    event_type: 'transaction',
    transactions: transactions
  };
  
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('Response: ' + response.getContentText());
    return JSON.parse(response.getContentText());
  } catch (error) {
    Logger.log('Error: ' + error);
    throw error;
  }
}

// Função para processar nova linha na planilha BTG
function processNewTransaction(row) {
  // Ajuste os índices conforme sua planilha
  const transaction = {
    date: formatDate(row[0]),  // Coluna A: Data
    description: row[1],        // Coluna B: Descrição
    amount: parseFloat(String(row[2]).replace(',', '.')), // Coluna C: Valor
    type: row[3] === 'Entrada' ? 'credit' : 'debit', // Coluna D: Tipo
    external_id: row[4] || generateId() // Coluna E: ID (opcional)
  };
  
  return sendToBTGIntegration([transaction]);
}

function formatDate(date) {
  if (date instanceof Date) {
    return Utilities.formatDate(date, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  return date;
}

function generateId() {
  return Utilities.getUuid();
}

// Trigger para rodar automaticamente quando nova linha é adicionada
function onNewRow(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  
  // Verifica se é uma nova linha completa
  if (range.getRow() > 1 && range.getColumn() === 1) {
    const row = sheet.getRange(range.getRow(), 1, 1, 5).getValues()[0];
    if (row[0] && row[1] && row[2]) {
      processNewTransaction(row);
    }
  }
}

// Para processar múltiplas transações de uma vez
function processAllPendingTransactions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const transactions = [];
  
  // Pula o cabeçalho
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[1] && row[2]) {
      transactions.push({
        date: formatDate(row[0]),
        description: row[1],
        amount: parseFloat(String(row[2]).replace(',', '.')),
        type: row[3] === 'Entrada' ? 'credit' : 'debit',
        external_id: row[4] || generateId()
      });
    }
  }
  
  if (transactions.length > 0) {
    return sendToBTGIntegration(transactions);
  }
}
`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sheet className="h-5 w-5 text-green-600" />
            Integração Google Sheets
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="setup" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setup">Configuração</TabsTrigger>
            <TabsTrigger value="code">Código Apps Script</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Configure as Integrações no BTG</CardTitle>
                <CardDescription>
                  No app do BTG, ative as integrações com Google Sheets que você deseja usar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>✓ Movimentações de entrada/saída</p>
                <p>✓ Pix recebido</p>
                <p>✓ Boletos pagos/emitidos</p>
                <p>✓ Atualizações de saldo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. URL do Webhook</CardTitle>
                <CardDescription>
                  Use esta URL para enviar dados do Google Sheets para o Roy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  >
                    {copied === 'webhook' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Seu Account ID</CardTitle>
                <CardDescription>
                  Use este ID no código do Apps Script
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input 
                    value={userData?.account_id || 'Carregando...'} 
                    readOnly 
                    className="font-mono text-xs" 
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(userData?.account_id || '', 'account')}
                    disabled={!userData?.account_id}
                  >
                    {copied === 'account' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">4. Configure o Apps Script</CardTitle>
                <CardDescription>
                  Adicione o código na aba "Código Apps Script" à sua planilha
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a 
                    href="https://script.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Google Apps Script
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="code" className="mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Código para Google Apps Script</Label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(appsScriptCode, 'code')}
                >
                  {copied === 'code' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copiar Código
                </Button>
              </div>
              <ScrollArea className="h-[400px] border rounded-md">
                <pre className="p-4 text-xs font-mono bg-muted/50">
                  {appsScriptCode}
                </pre>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                Cole este código em Extensões {'>'} Apps Script na sua planilha do Google Sheets.
                Configure os triggers para executar automaticamente quando novas linhas forem adicionadas.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
