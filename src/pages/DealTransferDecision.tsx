import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DealTransferDecision() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const suggested = params.get("d");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dtr-decision", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: r } = await (supabase as any).from("deal_transfer_requests").select("*").eq("id", id).maybeSingle();
      if (!r) return null;
      const [{ data: users }, { data: deal }] = await Promise.all([
        supabase.from("users").select("id, name").in("id", [r.requester_id, r.current_owner_id].filter(Boolean)),
        supabase.from("deals").select("title").eq("id", r.deal_id).maybeSingle(),
      ]);
      const n = new Map((users || []).map((u: any) => [u.id, u.name]));
      return { ...r, requester: n.get(r.requester_id), owner: n.get(r.current_owner_id), title: deal?.title };
    },
  });

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("decide_deal_transfer", { _request_id: id, _approve: approve, _note: null });
    setBusy(false);
    setResult(error ? error.message : approve ? "Aprovado. O negócio já foi transferido." : "Pedido recusado.");
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedido de transferência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">Pedido não encontrado ou você não tem permissão para vê-lo.</p>
          ) : (
            <>
              <p className="text-sm"><strong>{data.requester}</strong> pediu o negócio <strong>{data.title || "—"}</strong>.</p>
              <p className="text-xs text-muted-foreground">Hoje com: {data.owner || "Sem responsável"}</p>
              {data.reason && <p className="text-sm">“{data.reason}”</p>}
              {result ? (
                <p className="text-sm font-medium">{result}</p>
              ) : data.status !== "pending" ? (
                <p className="text-sm font-medium">Esse pedido já foi {data.status === "approved" ? "aprovado" : "recusado"}.</p>
              ) : (
                <div className="flex gap-2">
                  <Button className="flex-1" variant={suggested === "nao" ? "default" : "outline"} disabled={busy} onClick={() => decide(false)}>
                    <X className="h-4 w-4 mr-1" /> Recusar
                  </Button>
                  <Button className="flex-1" variant={suggested === "nao" ? "outline" : "default"} disabled={busy} onClick={() => decide(true)}>
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                </div>
              )}
              <Link to="/sales-team/transfer-requests" className="text-xs underline">Ver todos os pedidos</Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
