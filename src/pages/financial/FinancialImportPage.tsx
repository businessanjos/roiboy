import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ImportSource = "cielo" | "cheques";

interface PreviewRow {
  id: string;
  parsed_date: string | null;
  parsed_amount: number | null;
  parsed_fee_amount: number | null;
  parsed_net_amount: number | null;
  parsed_brand: string | null;
  parsed_nsu: string | null;
  parsed_doc: string | null;
  parsed_payer_name: string | null;
  installment_id: string | null;
  status: string;
}

interface PreviewResult {
  batch_id: string;
  total: number;
  matched: number;
  unmatched: number;
  duplicate?: number;
  settled?: number;
  rows: PreviewRow[];
}

const HEADER_MAP_CIELO: Record<string, keyof CieloRow> = {
  data: "date",
  "data da venda": "date",
  "data do pagamento": "date",
  "data de pagamento": "date",
  valor: "amount",
  "valor bruto": "amount",
  "valor da venda": "amount",
  "valor liquido": "net_amount",
  "valor líquido": "net_amount",
  "valor da taxa": "fee_amount",
  taxa: "fee_amount",
  "taxa adm": "fee_amount",
  bandeira: "brand",
  nsu: "nsu",
  "código de autorização": "auth_code",
  autorizacao: "auth_code",
  autorização: "auth_code",
  comprovante: "doc",
  cliente: "payer_name",
};

const HEADER_MAP_CHEQUE: Record<string, keyof ChequeRow> = {
  data: "date",
  "data de vencimento": "date",
  vencimento: "date",
  valor: "amount",
  numero: "doc",
  "número do cheque": "doc",
  "nº cheque": "doc",
  cheque: "doc",
  banco: "bank",
  emitente: "payer_name",
  cliente: "payer_name",
  status: "status",
};

interface CieloRow {
  date?: string;
  amount?: number;
  fee_amount?: number;
  net_amount?: number;
  brand?: string;
  nsu?: string;
  auth_code?: string;
  doc?: string;
  payer_name?: string;
  raw?: Record<string, unknown>;
}
interface ChequeRow {
  date?: string;
  amount?: number;
  doc?: string;
  bank?: string;
  payer_name?: string;
  status?: string;
  raw?: Record<string, unknown>;
}

function normalizeKey(k: string): string {
  return String(k).toLowerCase().trim().replace(/\s+/g, " ");
}

function mapRow<T>(raw: Record<string, unknown>, map: Record<string, string>): T {
  const out: any = { raw };
  for (const [k, v] of Object.entries(raw)) {
    const norm = normalizeKey(k);
    const target = map[norm];
    if (target && v !== undefined && v !== null && v !== "") {
      out[target] = v;
    }
  }
  return out as T;
}

async function readFileToRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
}

function fmtBRL(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    matched: { label: "Conciliada", className: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
    unmatched: { label: "Sem match", className: "bg-amber-500/15 text-amber-700 border-amber-300" },
    duplicate: { label: "Duplicada", className: "bg-blue-500/15 text-blue-700 border-blue-300" },
    settled: { label: "Baixada", className: "bg-emerald-600/20 text-emerald-800 border-emerald-400" },
    error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/40" },
    ignored: { label: "Ignorada", className: "bg-muted text-muted-foreground" },
  };
  const v = variants[status] ?? { label: status, className: "" };
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function ImporterTab({ source }: { source: ImportSource }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const runPreview = async (apply = false) => {
    if (!file) return;
    apply ? setApplying(true) : setLoading(true);
    try {
      const raw = await readFileToRows(file);
      const map = source === "cielo" ? HEADER_MAP_CIELO : HEADER_MAP_CHEQUE;
      const rows = raw.map((r) => mapRow(r, map));
      const fnName = source === "cielo" ? "import-cielo-report" : "import-cheques";
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { rows, filename: file.name, apply },
      });
      if (error) throw error;
      setResult(data as PreviewResult);
      toast({
        title: apply ? "Baixa aplicada" : "Pré-visualização gerada",
        description: `${data.matched} conciliadas / ${data.unmatched} sem match${apply ? ` / ${data.settled} baixadas` : ""}`,
      });
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
      setApplying(false);
    }
  };

  const docLabel = source === "cielo" ? "NSU / Comprovante" : "Nº Cheque";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {source === "cielo" ? "Relatório Cielo" : "Planilha de Cheques"}
          </CardTitle>
          <CardDescription>
            {source === "cielo"
              ? "Importe o relatório de transações da Cielo (XLSX/CSV). O sistema concilia por NSU, valor e data, e calcula a taxa por parcela."
              : "Importe a planilha de cheques (XLSX/CSV). Conciliação por valor, data e número do cheque. Status muda para 'Cheque recebido' ao aplicar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="max-w-md"
            />
            <Button onClick={() => runPreview(false)} disabled={!file || loading || applying}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Gerar pré-visualização
            </Button>
            {result && result.matched > 0 && (
              <Button
                variant="default"
                onClick={() => runPreview(true)}
                disabled={applying || loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Aplicar baixa ({result.matched})
              </Button>
            )}
          </div>

          {result && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{result.total}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Conciliadas</p><p className="text-2xl font-bold text-emerald-600">{result.matched}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sem match</p><p className="text-2xl font-bold text-amber-600">{result.unmatched}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Baixadas</p><p className="text-2xl font-bold text-emerald-700">{result.settled ?? 0}</p></CardContent></Card>
            </div>
          )}

          {result && result.rows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Detalhamento</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        {source === "cielo" && <TableHead className="text-right">Taxa</TableHead>}
                        {source === "cielo" && <TableHead className="text-right">Líquido</TableHead>}
                        {source === "cielo" && <TableHead>Bandeira</TableHead>}
                        <TableHead>{docLabel}</TableHead>
                        <TableHead>Pagador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell className="text-xs">{r.parsed_date ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtBRL(r.parsed_amount)}</TableCell>
                          {source === "cielo" && <TableCell className="text-right font-mono text-xs text-amber-700">{fmtBRL(r.parsed_fee_amount)}</TableCell>}
                          {source === "cielo" && <TableCell className="text-right font-mono text-xs">{fmtBRL(r.parsed_net_amount)}</TableCell>}
                          {source === "cielo" && <TableCell className="text-xs">{r.parsed_brand ?? "—"}</TableCell>}
                          <TableCell className="text-xs">{(source === "cielo" ? r.parsed_nsu : r.parsed_doc) ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.parsed_payer_name ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {result && result.unmatched > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {result.unmatched} linha(s) sem match. Revise valores/datas no relatório original ou crie a parcela correspondente antes de aplicar.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FinancialImportPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Importar pagamentos</h1>
        <p className="text-sm text-muted-foreground">
          Conciliação automática de relatórios de cartão (Cielo) e cheques. Faça upload do arquivo, revise a pré-visualização e aplique a baixa em massa.
        </p>
      </div>

      <Tabs defaultValue="cielo">
        <TabsList>
          <TabsTrigger value="cielo">Cielo (Cartão)</TabsTrigger>
          <TabsTrigger value="cheques">Cheques</TabsTrigger>
        </TabsList>
        <TabsContent value="cielo" className="mt-4"><ImporterTab source="cielo" /></TabsContent>
        <TabsContent value="cheques" className="mt-4"><ImporterTab source="cheques" /></TabsContent>
      </Tabs>
    </div>
  );
}
