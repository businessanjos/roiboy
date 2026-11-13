import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ZappTransferDecision() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const suggested = params.get("d");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ztr-decision", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: r } = await (supabase as any).from("zapp_conversation_transfer_requests").select("*").eq("id", id).maybeSingle();
      if (!r) return null;
      const { data: u } = await supabase.from("users").select("name").eq("id", r.requester_id).maybeSingle();
      return { ...r, requester: u?.name };
    },
  });

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("decide_zapp_transfer", { _request_id: id, _approve: approve });
    if (!error) await supabase.functions.invoke("zapp-transfer-whatsapp", { body: { action: "decided", request_id: id } }).catch(() => null);
    setBusy(false);
    setResult(error ? error.message : approve ? "Aprovado. A conversa já foi transferida." : "Pedido recusado.");
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <Card>
        <CardHeader><CardTitle className="text-base">Pedido de transferência de conversa</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">Pedido não encontrado ou você não tem permissão para vê-lo.</p>
          ) : (
            <>
              <p className="text-sm"><strong>{data.requester}</strong> pediu a conversa com <strong>{data.contact_name || "—"}</strong>.</p>
              <p className="text-xs text-muted-foreground">Hoje com: {data.current_owner_name || "—"}</p>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
