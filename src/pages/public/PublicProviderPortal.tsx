import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText, Save } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Provider = {
  id: string;
  full_name: string;
  company_name?: string | null;
  trade_name?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_pix_key?: string | null;
  preferred_payment_day?: number | null;
  fee_amount?: number | null;
};

type Invoice = {
  id: string;
  competence_month: string;
  invoice_number: string | null;
  amount: number | null;
  file_name: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  payment_due_date: string | null;
  paid_at: string | null;
  uploaded_at: string;
  rejection_reason: string | null;
};

const STATUS_LABEL: Record<Invoice["status"], { label: string; cls: string }> = {
  pending: { label: "Em análise", cls: "bg-amber-500/15 text-amber-700 border-amber-500/40" },
  approved: { label: "Aprovada", cls: "bg-blue-500/15 text-blue-700 border-blue-500/40" },
  paid: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" },
  rejected: { label: "Rejeitada", cls: "bg-rose-500/15 text-rose-700 border-rose-500/40" },
};

const fmtBRL = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const fmtMonth = (s: string) => {
  const [y, m] = s.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function PublicProviderPortal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  // form
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [pix, setPix] = useState("");
  const [payDay, setPayDay] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // invoice form
  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const [competence, setCompetence] = useState(defaultMonth.slice(0, 7));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const call = async (action: string, method: "GET" | "POST", body?: unknown) => {
    const url = `${SUPABASE_URL}/functions/v1/provider-portal?token=${encodeURIComponent(token!)}&action=${action}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Erro inesperado");
    return data;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await call("get", "GET");
      setProvider(data.provider);
      setInvoices(data.invoices ?? []);
      const p: Provider = data.provider;
      setBankName(p.bank_name ?? "");
      setBankAgency(p.bank_agency ?? "");
      setBankAccount(p.bank_account ?? "");
      setPix(p.bank_pix_key ?? "");
      setPayDay(p.preferred_payment_day ? String(p.preferred_payment_day) : "");
      setPhone(p.phone ?? "");
      setEmail(p.email ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); /* eslint-disable-line */ }, [token]);

  const firstAccess = !provider?.bank_pix_key && !provider?.bank_account;

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await call("update_profile", "POST", {
        bank_name: bankName || null,
        bank_agency: bankAgency || null,
        bank_account: bankAccount || null,
        bank_pix_key: pix || null,
        preferred_payment_day: payDay ? Number(payDay) : null,
        phone: phone || null,
        email: email || null,
      });
      toast({ title: "Dados salvos com sucesso." });
      await load();
    } catch (e: unknown) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = () => reject(new Error("Falha ao ler arquivo"));
      r.readAsDataURL(f);
    });

  const submitInvoice = async () => {
    if (!file) return toast({ title: "Selecione o arquivo da NF.", variant: "destructive" });
    const amt = Number(String(amount).replace(",", "."));
    if (!amt || amt <= 0) return toast({ title: "Informe o valor da NF.", variant: "destructive" });
    if (file.size > 15 * 1024 * 1024) return toast({ title: "Arquivo maior que 15MB.", variant: "destructive" });

    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      await call("upload_invoice", "POST", {
        competence_month: `${competence}-01`,
        invoice_number: invoiceNumber || null,
        amount: amt,
        file_base64: b64,
        file_name: file.name,
        notes: notes || null,
      });
      toast({ title: "NF enviada!", description: "Seu financeiro foi notificado." });
      setInvoiceNumber(""); setAmount(""); setNotes(""); setFile(null);
      await load();
    } catch (e: unknown) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-rose-500" />Não foi possível abrir o portal</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{error}</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portal do Prestador</h1>
          <p className="text-sm text-muted-foreground">
            Olá, <strong>{provider?.full_name || provider?.company_name}</strong>. Envie sua NF mensal e mantenha seus dados de pagamento atualizados.
          </p>
        </div>

        {firstAccess && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-4 text-sm flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>Este é seu <strong>primeiro acesso</strong>. Preencha os dados de pagamento abaixo antes de enviar a primeira NF.</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Dados de pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Banco</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Agência</Label><Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Conta</Label><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Chave PIX</Label><Input value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF/CNPJ, email, telefone ou aleatória" /></div>
              <div className="space-y-1.5"><Label>Dia preferido de pagamento</Label><Input type="number" min={1} max={31} value={payDay} onChange={(e) => setPayDay(e.target.value)} placeholder="Ex.: 10" /></div>
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-1.5 md:col-span-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Salvar dados
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Enviar NF do mês</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Competência</Label><Input type="month" value={competence} onChange={(e) => setCompetence(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Nº da NF</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="opcional" /></div>
              <div className="space-y-1.5"><Label>Valor (R$)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Arquivo (PDF, JPG ou PNG, até 15MB)</Label>
              <Input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <p className="text-xs text-muted-foreground"><FileText className="h-3 w-3 inline mr-1" />{file.name} • {(file.size / 1024).toFixed(0)} KB</p>}
            </div>
            <div className="flex justify-end">
              <Button onClick={submitInvoice} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Enviar NF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma NF enviada ainda.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => {
                  const st = STATUS_LABEL[inv.status];
                  return (
                    <div key={inv.id} className="flex items-center justify-between border rounded-md p-3">
                      <div className="text-sm">
                        <div className="font-medium capitalize">{fmtMonth(inv.competence_month)}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.invoice_number && <>NF {inv.invoice_number} • </>}
                          {fmtBRL(Number(inv.amount))}
                          {inv.payment_due_date && <> • Vence {new Date(inv.payment_due_date).toLocaleDateString("pt-BR")}</>}
                          {inv.paid_at && <> • Pago em {new Date(inv.paid_at).toLocaleDateString("pt-BR")}</>}
                        </div>
                        {inv.status === "rejected" && inv.rejection_reason && (
                          <div className="text-xs text-rose-600 mt-1">Motivo: {inv.rejection_reason}</div>
                        )}
                      </div>
                      <Badge variant="outline" className={st.cls}>
                        {inv.status === "paid" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {st.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
