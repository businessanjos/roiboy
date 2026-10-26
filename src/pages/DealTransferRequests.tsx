import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRightLeft, Check, X, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isManagementUser } from "@/lib/access/managementRoles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Req {
  id: string;
  deal_id: string;
  requester_id: string;
  current_owner_id: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Aguardando", variant: "outline" },
  approved: { label: "Aprovada", variant: "default" },
  rejected: { label: "Recusada", variant: "destructive" },
};

export default function DealTransferRequests() {
  const { currentUser } = useCurrentUser();
  const isManager = isManagementUser(currentUser as any);
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deal-transfer-requests"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: reqs, error } = await (supabase as any)
        .from("deal_transfer_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (reqs || []) as Req[];
      const userIds = [...new Set(list.flatMap((r) => [r.requester_id, r.current_owner_id]).filter(Boolean))] as string[];
      const dealIds = [...new Set(list.map((r) => r.deal_id))];
      const [{ data: users }, { data: deals }] = await Promise.all([
        userIds.length ? supabase.from("users").select("id, name").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
        dealIds.length ? supabase.from("deals").select("id, title").in("id", dealIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const uName = new Map((users || []).map((u: any) => [u.id, u.name]));
      const dTitle = new Map((deals || []).map((d: any) => [d.id, d.title]));
      return list.map((r) => ({
        ...r,
        requester: uName.get(r.requester_id) || "—",
        owner: r.current_owner_id ? uName.get(r.current_owner_id) || "—" : "Sem responsável",
        title: dTitle.get(r.deal_id) || "Negócio",
      }));
    },
  });

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await (supabase as any).rpc("decide_deal_transfer", {
      _request_id: id,
      _approve: approve,
      _note: notes[id] || null,
    });
    setBusy(null);
    if (error) return toast.error(error.message || "Não foi possível concluir");
    toast.success(approve ? "Transferência aprovada" : "Solicitação recusada");
    qc.invalidateQueries({ queryKey: ["deal-transfer-requests"] });
  };

  const pending = (data || []).filter((r) => r.status === "pending");
  const history = (data || []).filter((r) => r.status !== "pending");

  const renderItem = (r: any, actionable: boolean) => (
    <div key={r.id} className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm">{r.title}</p>
          <p className="text-xs text-muted-foreground">
            <strong>{r.requester}</strong> pediu · hoje com <strong>{r.owner}</strong> ·{" "}
            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
          </p>
          {r.reason && <p className="text-sm mt-1">“{r.reason}”</p>}
          {r.decision_note && <p className="text-xs text-muted-foreground mt-1">Observação: {r.decision_note}</p>}
        </div>
        <Badge variant={STATUS[r.status]?.variant || "outline"}>{STATUS[r.status]?.label || r.status}</Badge>
      </div>
      {actionable && isManager && (
        <div className="space-y-2">
          <Textarea
            rows={2}
            placeholder="Observação (opcional)"
            value={notes[r.id] || ""}
            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r.id, false)}>
              <X className="h-4 w-4 mr-1" /> Recusar
            </Button>
            <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, true)}>
              <Check className="h-4 w-4 mr-1" /> Aprovar e transferir
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" /> Pedidos de transferência
        </h1>
        <p className="text-sm text-muted-foreground">
          {isManager ? "Aprove ou recuse os pedidos dos vendedores." : "Acompanhe seus pedidos de transferência."}
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
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Inbox className="h-4 w-4" /> Nenhum pedido pendente.</p>
          ) : (
            pending.map((r) => renderItem(r, true))
          )}
        </CardContent>
      </Card>
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
            <CardDescription>Últimos pedidos decididos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">{history.map((r) => renderItem(r, false))}</CardContent>
        </Card>
      )}
    </div>
  );
}
