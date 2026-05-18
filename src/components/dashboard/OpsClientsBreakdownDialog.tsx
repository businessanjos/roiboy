import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, PhoneOff, Flame } from "lucide-react";

interface ClientRow {
  client_id: string;
  client_name: string;
  logo_url: string | null;
  inbound_msgs: number;
  outbound_msgs: number;
  last_inbound_at: string | null;
  conversations: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consultantId: string | null;
  consultantName: string;
  periodLabel: string;
  rpcParams: Record<string, any> | null;
}

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("");
}

export function OpsClientsBreakdownDialog({
  open, onOpenChange, consultantId, consultantName, periodLabel, rpcParams,
}: Props) {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !consultantId || !rpcParams) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      const { data, error } = await supabase.rpc("get_ops_consultant_clients_breakdown", {
        p_user_id: consultantId,
        ...rpcParams,
      } as any);
      if (cancelled) return;
      if (error) { setErr(error.message); setRows([]); }
      else setRows((data || []) as ClientRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, consultantId, rpcParams]);

  const messaged = rows.filter(r => r.inbound_msgs > 0);
  const silent = rows.filter(r => r.inbound_msgs === 0);
  const totalIn = messaged.reduce((a, r) => a + r.inbound_msgs, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Carteira de {consultantName}</DialogTitle>
          <DialogDescription>
            Detalhe por cliente — período: {periodLabel}. Total da carteira: {rows.length} ·
            Chamaram: {messaged.length} · Em silêncio: {silent.length} · Msgs recebidas: {totalIn}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : err ? (
          <div className="text-destructive text-sm py-8 text-center">Erro: {err}</div>
        ) : (
          <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="active" className="gap-2">
                <Flame className="h-4 w-4" /> Mais chamam ({messaged.length})
              </TabsTrigger>
              <TabsTrigger value="silent" className="gap-2">
                <PhoneOff className="h-4 w-4" /> Nunca chamaram ({silent.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="overflow-y-auto mt-3">
              {messaged.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhum cliente desta carteira enviou mensagem no período.
                </p>
              ) : (
                <ul className="divide-y">
                  {messaged.map((c, i) => (
                    <li key={c.client_id} className="flex items-center gap-3 py-2">
                      <div className="w-6 text-xs text-muted-foreground text-right">#{i + 1}</div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.logo_url || undefined} />
                        <AvatarFallback className="text-xs">{initials(c.client_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <a
                          href={`/clients/${c.client_id}`}
                          className="font-medium text-sm hover:underline truncate block"
                        >
                          {c.client_name}
                        </a>
                        <div className="text-xs text-muted-foreground">
                          {c.conversations} conv · última msg{" "}
                          {c.last_inbound_at
                            ? formatDistanceToNow(new Date(c.last_inbound_at), { addSuffix: true, locale: ptBR })
                            : "—"}
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <MessageSquare className="h-3 w-3" /> {c.inbound_msgs}
                      </Badge>
                      <div className="text-xs text-muted-foreground w-16 text-right">
                        ↩ {c.outbound_msgs}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="silent" className="overflow-y-auto mt-3">
              {silent.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Todos os clientes desta carteira enviaram mensagens no período.
                </p>
              ) : (
                <ul className="divide-y">
                  {silent.map((c) => (
                    <li key={c.client_id} className="flex items-center gap-3 py-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.logo_url || undefined} />
                        <AvatarFallback className="text-xs">{initials(c.client_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <a
                          href={`/clients/${c.client_id}`}
                          className="font-medium text-sm hover:underline truncate block"
                        >
                          {c.client_name}
                        </a>
                        <div className="text-xs text-muted-foreground">
                          Sem mensagens recebidas neste período
                          {c.outbound_msgs > 0 && ` · ${c.outbound_msgs} enviadas pela consultora`}
                        </div>
                      </div>
                      {c.outbound_msgs === 0 && (
                        <Badge variant="outline" className="text-xs">silêncio total</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
