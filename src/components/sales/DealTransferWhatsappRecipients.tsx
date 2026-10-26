import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Gestores que recebem o aviso de pedido de transferência no WhatsApp (somente leitura aqui; gravação via RPC). */
export function DealTransferWhatsappRecipients() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");

  const { data } = useQuery({
    queryKey: ["dtr-whatsapp-recipients"],
    queryFn: async () => {
      const [{ data: recs }, { data: managers }] = await Promise.all([
        (supabase as any).from("deal_transfer_whatsapp_recipients").select("id, user_id, phone_e164"),
        (supabase as any).rpc("list_deal_transfer_managers"),
      ]);
      return { recs: (recs || []) as any[], managers: (managers || []) as { id: string; name: string }[] };
    },
  });
  const names = new Map((data?.managers || []).map((m) => [m.id, m.name]));

  const save = async () => {
    const { error } = await (supabase as any).rpc("set_deal_transfer_whatsapp_recipient", { _user_id: userId, _phone: phone });
    if (error) return toast.error(error.message || "Não foi possível salvar");
    setPhone("");
    setUserId("");
    toast.success("Gestor adicionado ao aviso do WhatsApp");
    qc.invalidateQueries({ queryKey: ["dtr-whatsapp-recipients"] });
  };
  const remove = async (uid: string) => {
    const { error } = await (supabase as any).rpc("set_deal_transfer_whatsapp_recipient", { _user_id: uid, _phone: null });
    if (error) return toast.error(error.message || "Não foi possível remover");
    qc.invalidateQueries({ queryKey: ["dtr-whatsapp-recipients"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Aviso no WhatsApp</CardTitle>
        <CardDescription>Gestores que recebem os pedidos com botões Aprovar e Recusar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data?.recs || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum gestor cadastrado ainda.</p>}
        {(data?.recs || []).map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span><strong>{names.get(r.user_id) || "Gestor"}</strong> · {r.phone_e164}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(r.user_id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm flex-1"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Escolha o gestor</option>
            {(data?.managers || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Input className="flex-1" placeholder="WhatsApp com DDD, ex: 11 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button disabled={!userId || phone.replace(/\D/g, "").length < 10} onClick={save}>Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
