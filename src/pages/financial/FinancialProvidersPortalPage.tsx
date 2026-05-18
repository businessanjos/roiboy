import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Download, Check, X, Search } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Em análise", cls: "bg-amber-500/15 text-amber-700 border-amber-500/40" },
  approved: { label: "Aprovada", cls: "bg-blue-500/15 text-blue-700 border-blue-500/40" },
  paid: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" },
  rejected: { label: "Rejeitada", cls: "bg-rose-500/15 text-rose-700 border-rose-500/40" },
};

const fmtBRL = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtMonth = (s: string) => {
  const [y, m] = s.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function FinancialProvidersPortalPage() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-portal-list", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_service_providers")
        .select("id, full_name, company_name, cnpj, email, portal_token, status, bank_pix_key, bank_account, preferred_payment_day, fee_amount")
        .eq("account_id", currentUser!.account_id)
        .order("full_name");
      return data ?? [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["provider-invoices", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_provider_invoices")
        .select("*, provider:hr_service_providers(full_name, company_name, cnpj, bank_pix_key)")
        .eq("account_id", currentUser!.account_id)
        .order("uploaded_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const buildLink = (token: string) => `${window.location.origin}/portal/prestador/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildLink(token));
    toast({ title: "Link copiado!" });
  };

  const downloadFile = async (path: string, name?: string | null) => {
    const { data, error } = await supabase.storage.from("provider-invoices").createSignedUrl(path, 60 * 10);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name || "nota-fiscal";
    a.target = "_blank";
    a.click();
  };

  const updateStatus = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("hr_provider_invoices").update({ ...patch, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Atualizado." });
    qc.invalidateQueries({ queryKey: ["provider-invoices"] });
  };

  const filteredProviders = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter((p) =>
      [p.full_name, p.company_name, p.cnpj, p.email].some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [providers, q]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portal de Prestadores</h1>
        <p className="text-sm text-muted-foreground">Gere links para que seus prestadores enviem NFs e dados bancários, e aprove os pagamentos.</p>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">NFs recebidas</TabsTrigger>
          <TabsTrigger value="providers">Prestadores & links</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader><CardTitle className="text-base">NFs enviadas pelos prestadores</CardTitle></CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma NF recebida ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prestador</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv: any) => {
                      const st = STATUS_LABEL[inv.status] ?? STATUS_LABEL.pending;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="font-medium">{inv.provider?.company_name || inv.provider?.full_name}</div>
                            <div className="text-xs text-muted-foreground">{inv.provider?.cnpj}</div>
                          </TableCell>
                          <TableCell className="capitalize">{fmtMonth(inv.competence_month)}</TableCell>
                          <TableCell>{inv.invoice_number || "—"}</TableCell>
                          <TableCell className="text-right">{fmtBRL(Number(inv.amount))}</TableCell>
                          <TableCell>{inv.payment_due_date ? new Date(inv.payment_due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                          <TableCell><Badge variant="outline" className={st.cls}>{st.label}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => downloadFile(inv.file_url, inv.file_name)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              {inv.status === "pending" && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => updateStatus(inv.id, { status: "approved" })}>
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setRejectOpen(inv.id); setRejectReason(""); }}>
                                    <X className="h-4 w-4 text-rose-600" />
                                  </Button>
                                </>
                              )}
                              {inv.status === "approved" && (
                                <Button size="sm" variant="outline" onClick={() => updateStatus(inv.id, { status: "paid", paid_at: new Date().toISOString().slice(0, 10) })}>
                                  Marcar paga
                                </Button>
                              )}
                            </div>
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

        <TabsContent value="providers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Prestadores cadastrados</CardTitle>
              <div className="relative w-64">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-7" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestador</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Honorário</TableHead>
                    <TableHead className="text-right">Link do portal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.company_name || p.full_name}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </TableCell>
                      <TableCell>{p.cnpj || "—"}</TableCell>
                      <TableCell>
                        {p.bank_pix_key || p.bank_account ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40">Completo</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/40">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(p.fee_amount))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => copyLink(p.portal_token)}>
                            <Copy className="h-3 w-3 mr-1" />Copiar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => window.open(buildLink(p.portal_token), "_blank")}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectOpen} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar NF</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo (será mostrado ao prestador)</Label>
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={async () => {
                await updateStatus(rejectOpen!, { status: "rejected", rejection_reason: rejectReason.trim() });
                setRejectOpen(null);
              }}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
