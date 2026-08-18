import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, TrendingUp, Upload } from "lucide-react";
import { toast } from "sonner";

interface ParsedRow {
  line: number;
  rawClient: string;
  rawMonth: string;
  rawRevenue: string;
  clientId: string | null;
  clientName: string | null;
  month: string | null;
  revenue: number | null;
  error: string | null;
}

interface ClientRef {
  id: string;
  full_name: string;
  cpf: string | null;
  cnpj: string | null;
  emails: string[] | null;
}

const MONTH_NAMES: Record<string, string> = {
  jan: "01", janeiro: "01", fev: "02", fevereiro: "02", mar: "03", marco: "03", março: "03",
  abr: "04", abril: "04", mai: "05", maio: "05", jun: "06", junho: "06",
  jul: "07", julho: "07", ago: "08", agosto: "08", set: "09", setembro: "09",
  out: "10", outubro: "10", nov: "11", novembro: "11", dez: "12", dezembro: "12",
};

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

function parseMonth(raw: unknown): string | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}`;
  }
  const s = norm(raw);
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^([a-z]+)[\s/-]+(\d{2,4})$/);
  if (m && MONTH_NAMES[m[1]]) {
    const year = m[2].length === 2 ? `20${m[2]}` : m[2];
    return `${year}-${MONTH_NAMES[m[1]]}`;
  }
  return null;
}

function parseRevenue(raw: unknown): number | null {
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  let s = String(raw ?? "").trim();
  if (!s) return null;
  s = s.replace(/[R$\s]/gi, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of Object.keys(row)) {
    if (keys.includes(norm(k))) return row[k];
  }
  return undefined;
}

export function RevenueImportDialog({ onImported }: { onImported?: () => void }) {
  const { currentUser } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = useMemo(() => rows.filter((r) => !r.error), [rows]);
  const invalid = useMemo(() => rows.filter((r) => r.error), [rows]);

  const reset = () => {
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["cliente", "mes", "faturamento"],
      ["Fernanda Pierin Dubay", "2026-01", 350000],
      ["06234066917", "fev/2026", "R$ 380.000,00"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "faturamento");
    XLSX.writeFile(wb, "modelo-faturamento-mensal.xlsx");
  };

  const handleFile = async (file: File) => {
    if (!currentUser?.account_id) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const { data: clients, error } = await supabase
        .from("clients")
        .select("id, full_name, cpf, cnpj, emails")
        .eq("account_id", currentUser.account_id);
      if (error) throw error;

      const list = (clients ?? []) as ClientRef[];
      const byName = new Map<string, ClientRef[]>();
      const byDoc = new Map<string, ClientRef>();
      const byEmail = new Map<string, ClientRef>();
      const byId = new Map<string, ClientRef>();
      for (const c of list) {
        byId.set(c.id, c);
        const n = norm(c.full_name);
        byName.set(n, [...(byName.get(n) ?? []), c]);
        if (c.cpf) byDoc.set(onlyDigits(c.cpf), c);
        if (c.cnpj) byDoc.set(onlyDigits(c.cnpj), c);
        (c.emails ?? []).forEach((e) => e && byEmail.set(norm(e), c));
      }

      const parsed: ParsedRow[] = data.map((row, i) => {
        const rawClientVal = pick(row, ["cliente", "client", "nome", "name", "cliente_id", "client_id", "id", "cpf", "cnpj", "email"]);
        const rawMonthVal = pick(row, ["mes", "mês", "month", "competencia", "competência", "periodo", "período", "data"]);
        const rawRevVal = pick(row, ["faturamento", "revenue", "valor", "receita", "faturamento_mensal"]);

        const rawClient = String(rawClientVal ?? "").trim();
        const month = parseMonth(rawMonthVal);
        const revenue = parseRevenue(rawRevVal);

        let clientId: string | null = null;
        let clientName: string | null = null;
        let error: string | null = null;

        const key = norm(rawClient);
        const digits = onlyDigits(rawClient);
        let match: ClientRef | undefined;
        if (byId.has(rawClient)) match = byId.get(rawClient);
        else if (rawClient.includes("@") && byEmail.has(key)) match = byEmail.get(key);
        else if (digits.length >= 11 && byDoc.has(digits)) match = byDoc.get(digits);
        else {
          const hits = byName.get(key) ?? [];
          if (hits.length === 1) match = hits[0];
          else if (hits.length > 1) error = "Nome duplicado — use CPF/CNPJ ou ID";
        }

        if (!rawClient) error = "Cliente não informado";
        else if (!match && !error) error = "Cliente não encontrado";
        else if (!month) error = "Mês inválido (use AAAA-MM)";
        else if (revenue === null) error = "Faturamento inválido";
        else if (revenue < 0) error = "Faturamento negativo";

        if (match) {
          clientId = match.id;
          clientName = match.full_name;
        }

        return {
          line: i + 2,
          rawClient,
          rawMonth: rawMonthVal instanceof Date ? rawMonthVal.toISOString().slice(0, 7) : String(rawMonthVal ?? ""),
          rawRevenue: String(rawRevVal ?? ""),
          clientId,
          clientName,
          month,
          revenue,
          error,
        };
      });

      // Duplicated client+month inside the file: keep the last occurrence
      const seen = new Map<string, number>();
      parsed.forEach((r, idx) => {
        if (r.error || !r.clientId || !r.month) return;
        const k = `${r.clientId}|${r.month}`;
        const prev = seen.get(k);
        if (prev !== undefined) parsed[prev].error = "Duplicado na planilha (linha posterior prevalece)";
        seen.set(k, idx);
      });

      setRows(parsed);
      if (!parsed.length) toast.error("Planilha vazia ou sem colunas reconhecidas");
    } catch (e) {
      console.error("[RevenueImportDialog] parse error", e);
      toast.error("Não foi possível ler a planilha");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!currentUser?.account_id || !valid.length) return;
    setImporting(true);
    try {
      const payload = valid.map((r) => ({
        client_id: r.clientId!,
        account_id: currentUser.account_id,
        month: r.month!,
        revenue: r.revenue!,
        created_by: currentUser.id,
      }));

      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error } = await supabase
          .from("client_revenue_history")
          .upsert(chunk, { onConflict: "client_id,month" });
        if (error) throw error;
      }

      // Sync clients.current_revenue with the latest month registered
      const latestByClient = new Map<string, { month: string; revenue: number }>();
      valid.forEach((r) => {
        const cur = latestByClient.get(r.clientId!);
        if (!cur || r.month! > cur.month) latestByClient.set(r.clientId!, { month: r.month!, revenue: r.revenue! });
      });
      await Promise.all(
        Array.from(latestByClient.entries()).map(async ([clientId, v]) => {
          const { data: latest } = await supabase
            .from("client_revenue_history")
            .select("month, revenue")
            .eq("client_id", clientId)
            .order("month", { ascending: false })
            .limit(1);
          const top = latest?.[0] ?? v;
          await supabase
            .from("clients")
            .update({ current_revenue: Number(top.revenue), current_revenue_month: top.month })
            .eq("id", clientId);
        }),
      );

      toast.success(`${payload.length} registro(s) de faturamento importado(s)`);
      onImported?.();
      setOpen(false);
      reset();
    } catch (e) {
      console.error("[RevenueImportDialog] import error", e);
      toast.error("Erro ao importar faturamento");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="sm:size-default">
          <TrendingUp className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Importar faturamento</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar faturamento mensal
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">
              Colunas: <strong>cliente</strong> (nome, CPF/CNPJ, e-mail ou ID), <strong>mes</strong> (AAAA-MM, MM/AAAA ou jan/2026) e{" "}
              <strong>faturamento</strong>.
            </span>
            <span className="block text-xs text-muted-foreground">
              Registros já existentes para o mesmo cliente/mês são atualizados. Aceita .xlsx e .csv.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="flex-1"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Modelo
            </Button>
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo planilha...
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {valid.length} válida(s)
                </Badge>
                {invalid.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> {invalid.length} com erro
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[320px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Linha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-28">Mês</TableHead>
                      <TableHead className="w-32">Faturamento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.line} className={r.error ? "bg-destructive/5" : undefined}>
                        <TableCell className="text-xs text-muted-foreground">{r.line}</TableCell>
                        <TableCell className="text-sm">{r.clientName ?? r.rawClient || "—"}</TableCell>
                        <TableCell className="text-sm">{r.month ?? r.rawMonth || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {r.revenue !== null
                            ? r.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : r.rawRevenue || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.error ? (
                            <span className="text-destructive">{r.error}</span>
                          ) : (
                            <span className="text-muted-foreground">Pronto para importar</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!valid.length || importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar {valid.length} registro(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
