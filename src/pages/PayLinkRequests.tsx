import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Inbox, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isManagementUser } from "@/lib/access/managementRoles";
import { PAY_RELATIONSHIP_LABEL, payRelationshipLabel, type PayRelationship } from "@/lib/rykaPay";
import { approvePayLink, orphanDay, orphanKey, orphanMoney, usePayOrphans } from "@/hooks/usePayOrphans";
import { PayOrphanList } from "@/components/sales/PayOrphanList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS: Record<string, { label: string; variant: "default" | "destructive" | "outline" }> = {
  pending: { label: "Aguardando", variant: "outline" },
  approved: { label: "Vinculada", variant: "default" },
  rejected: { label: "Recusada", variant: "destructive" },
};
const RELATIONSHIPS = Object.keys(PAY_RELATIONSHIP_LABEL) as PayRelationship[];

type Row = {
  id: string;
  deal_id: string;
  requester_id: string;
  suggested_source: string | null;
  suggested_external_id: string | null;
  suggested_label: string | null;
  note: string | null;
  status: string;
  decision_reason: string | null;
  created_at: string;
  title: string;
  requester: string;
  link: { payer_name: string | null; amount_cents: number | null; paid_on: string | null } | null;
  payer: { relationship: PayRelationship; relationship_other: string | null } | null;
};

export default function PayLinkRequests() {
  const { currentUser } = useCurrentUser();
  const isManager = isManagementUser(currentUser as any);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<PayRelationship | null>(null);
  const [other, setOther] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pay-link-requests"],
    refetchInterval: 30000,
    queryFn: async (): Promise<Row[]> => {
      const { data: reqs, error } = await supabase.from("pay_link_requests").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const list = reqs ?? [];
      const dealIds = [...new Set(list.map((r) => r.deal_id))];
      const userIds = [...new Set(list.map((r) => r.requester_id))];
      const [{ data: users }, { data: deals }, { data: links }, { data: payers }] = await Promise.all([
        userIds.length ? supabase.from("users").select("id, name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        dealIds.length ? supabase.from("deals").select("id, title").in("id", dealIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        dealIds.length ? supabase.from("pay_sale_links").select("request_id, payer_name, amount_cents, paid_on").in("deal_id", dealIds) : Promise.resolve({ data: [] as any[] }),
        dealIds.length ? supabase.from("pay_third_party_payers").select("origin_deal_id, relationship, relationship_other").in("origin_deal_id", dealIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const uName = new Map((users ?? []).map((u) => [u.id, u.name]));
      const dTitle = new Map((deals ?? []).map((d) => [d.id, d.title]));
      return list.map((r) => ({
        ...r,
        title: dTitle.get(r.deal_id) || "Negócio",
        requester: uName.get(r.requester_id) || "—",
        link: (links ?? []).find((l: any) => l.request_id === r.id) ?? null,
        payer: ((payers ?? []).find((p: any) => p.origin_deal_id === r.deal_id) as Row["payer"]) ?? null,
      }));
    },
  });

  const current = (data ?? []).find((r) => r.id === openId && r.status === "pending") ?? null;
  const orphans = usePayOrphans(Boolean(current && isManager));
  const suggestedKey = current?.suggested_source && current.suggested_external_id
    ? `${current.suggested_source}:${current.suggested_external_id}` : null;

  // The notification link opens the request straight away.
  const fromLink = params.get("pedido");
  useEffect(() => {
    if (!fromLink || !data || !isManager) return;
    if (data.some((r) => r.id === fromLink && r.status === "pending")) setOpenId(fromLink);
    setParams((p) => { p.delete("pedido"); return p; }, { replace: true });
  }, [fromLink, data, isManager, setParams]);

  const reset = () => {
    setOpenId(null); setSelected(null); setRelationship(null); setOther(""); setDocument(""); setEmail(""); setReason("");
  };
  const done = (message: string) => {
    toast.success(message);
    qc.invalidateQueries({ queryKey: ["pay-link-requests"] });
    qc.invalidateQueries({ queryKey: ["pay-orphans"] });
    reset();
  };

  const picked = orphans.data?.orphans.find((o) => orphanKey(o) === selected) ?? null;
  const canApprove = Boolean(picked && relationship && (relationship !== "other" || other.trim()));

  const approve = async () => {
    if (!current || !picked || !relationship) return;
    setBusy("approve");
    try {
      await approvePayLink({ requestId: current.id, orphan: picked, relationship, relationshipOther: other, payerDocument: document, payerEmail: email });
      done("Pagamento vinculado. O vendedor já pode dar o ganho.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível vincular.");
    } finally {
      setBusy(null);
    }
  };
  const reject = async () => {
    if (!current) return;
    if (!reason.trim()) return toast.error("Escreva o motivo da recusa.");
    setBusy("reject");
    const { error } = await supabase.rpc("decide_pay_link", { _request_id: current.id, _approve: false, _reason: reason.trim() });
    setBusy(null);
    if (error) return toast.error(error.message || "Não foi possível recusar.");
    done("Solicitação recusada.");
  };

  const pending = (data ?? []).filter((r) => r.status === "pending");
  const history = (data ?? []).filter((r) => r.status !== "pending");

  const renderItem = (r: Row) => (
    <div key={r.id} className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{r.title}</p>
          <p className="text-xs text-muted-foreground">
            <strong>{r.requester}</strong> pediu · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
          </p>
          {r.suggested_label && <p className="mt-1 text-xs text-muted-foreground">Sugestão do vendedor: {r.suggested_label}</p>}
          {r.note && <p className="mt-1 text-sm">“{r.note}”</p>}
          {r.status === "approved" && r.link && (
            <p className="mt-1 text-xs text-primary">
              Pago por <strong>{r.link.payer_name}</strong>
              {r.payer ? ` (${payRelationshipLabel({ relationship: r.payer.relationship, relationshipOther: r.payer.relationship_other })})` : ""}
              {" · "}{orphanMoney(r.link.amount_cents)} · {orphanDay(r.link.paid_on)}
            </p>
          )}
          {r.decision_reason && <p className="mt-1 text-xs text-muted-foreground">Motivo: {r.decision_reason}</p>}
        </div>
        <Badge variant={STATUS[r.status]?.variant || "outline"}>{STATUS[r.status]?.label || r.status}</Badge>
      </div>
      {r.status === "pending" && isManager && (
        <div className="flex justify-end">
          <Button size="sm" className="min-h-11" onClick={() => setOpenId(r.id)}>
            <Link2 className="mr-1 h-4 w-4" /> Ver vendas e vincular
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Link2 className="h-5 w-5" /> Pagamentos sem dono
        </h1>
        <p className="text-sm text-muted-foreground">
          {isManager
            ? "Vincule ao negócio a venda paga por outra pessoa. Só vendas pagas do Programa Clínica Ryka aparecem."
            : "Acompanhe seus pedidos de vínculo de pagamento."}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aguardando decisão ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : pending.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Inbox className="h-4 w-4" /> Nenhum pedido pendente.</p>
          ) : (
            pending.map(renderItem)
          )}
        </CardContent>
      </Card>
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
            <CardDescription>Últimos pedidos decididos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">{history.map(renderItem)}</CardContent>
        </Card>
      )}

      <Dialog open={Boolean(current)} onOpenChange={(open) => !open && !busy && reset()}>
        <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="truncate">{current?.title}</DialogTitle>
            <DialogDescription>
              {current?.requester} pediu o vínculo{current?.note ? ` · “${current.note}”` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label>Qual venda pertence a este negócio?</Label>
              <PayOrphanList
                orphans={orphans.data?.orphans}
                loading={orphans.isPending}
                error={orphans.isError ? orphans.error.message : null}
                partial={orphans.data?.partial}
                selected={selected}
                onSelect={setSelected}
                suggestedKey={suggestedKey}
              />
            </div>
            <div className="space-y-2">
              <Label>Quem pagou é o quê do cliente?</Label>
              <div role="radiogroup" aria-label="Relação de quem pagou" className="grid grid-cols-2 gap-2">
                {RELATIONSHIPS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={relationship === value}
                    variant={relationship === value ? "default" : "outline"}
                    className="min-h-11"
                    onClick={() => setRelationship(value)}
                  >
                    {PAY_RELATIONSHIP_LABEL[value]}
                  </Button>
                ))}
              </div>
              {relationship === "other" && (
                <Input value={other} maxLength={120} placeholder="Escreva a relação (ex.: mãe)" aria-label="Outra relação" onChange={(e) => setOther(e.target.value)} />
              )}
            </div>
            {picked?.source === "rykapay" && (
              <div className="space-y-2">
                <Label>CPF/CNPJ ou e-mail de quem pagou (opcional)</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={document} inputMode="numeric" maxLength={18} placeholder="CPF ou CNPJ" aria-label="CPF ou CNPJ de quem pagou" onChange={(e) => setDocument(e.target.value)} />
                  <Input value={email} type="email" maxLength={254} placeholder="E-mail" aria-label="E-mail de quem pagou" onChange={(e) => setEmail(e.target.value)} />
                </div>
                <p className="text-xs text-muted-foreground">Com isso, as próximas vendas desse pagador são reconhecidas sozinhas.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pay-link-reason">Motivo, se for recusar</Label>
              <Textarea id="pay-link-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="outline" className="min-h-11" disabled={Boolean(busy)} onClick={reject}>
              {busy === "reject" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />} Recusar
            </Button>
            <Button type="button" className="min-h-11" disabled={Boolean(busy) || !canApprove} onClick={approve}>
              {busy === "approve" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Vincular ao negócio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
