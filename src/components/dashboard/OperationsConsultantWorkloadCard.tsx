import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Clock, MessagesSquare, Loader2, PhoneIncoming, Info } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Row {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  active_clients: number;
  clients_who_messaged: number;
  inbound_msgs: number;
  outbound_msgs: number;
  conversations: number;
  avg_first_response_min: number;
  responded_inbound: number;
  total_inbound_with_window: number;
}

const RANGES = [7, 15, 30, 60, 90];

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("");
}

function fmtDuration(min: number) {
  if (!min || min <= 0) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function OperationsConsultantWorkloadCard() {
  const [days, setDays] = useState<number>(7);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase.rpc("get_ops_consultant_workload", { p_days: days });
      if (cancelled) return;
      if (error) {
        console.error("[OpsConsultantWorkload]", error);
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data || []) as Row[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [days]);

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({
      clients: a.clients + r.active_clients,
      who: a.who + r.clients_who_messaged,
      inbound: a.inbound + r.inbound_msgs,
      outbound: a.outbound + r.outbound_msgs,
      convs: a.convs + r.conversations,
    }),
    { clients: 0, who: 0, inbound: 0, outbound: 0, convs: 0 }
  ), [rows]);

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Demanda dos Consultores de Operações
            </CardTitle>
            <CardDescription className="max-w-2xl">
              Atribuição via cliente responsável (cobre instâncias de WhatsApp compartilhadas).
              Mensagens, conversas e clientes contados sobre conversas vinculadas ao cliente do consultor.
            </CardDescription>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map(d => <SelectItem key={d} value={String(d)}>Últimos {d} dias</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculando métricas...
            </div>
          ) : err ? (
            <div className="text-center py-8 text-destructive text-sm">Erro: {err}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum consultor de Operações encontrado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <Metric label="Carteira ativa" value={totals.clients} />
                <Metric label="Clientes que chamaram" value={totals.who} />
                <Metric label="Mensagens recebidas" value={totals.inbound} />
                <Metric label="Mensagens enviadas" value={totals.outbound} />
                <Metric label="Conversas no período" value={totals.convs} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Consultora</th>
                      <Th icon={<Users className="h-3.5 w-3.5" />}>Carteira</Th>
                      <Th icon={<PhoneIncoming className="h-3.5 w-3.5" />} tip="Clientes distintos que enviaram ao menos 1 msg no período">
                        Clientes ativos chamaram
                      </Th>
                      <Th icon={<MessageSquare className="h-3.5 w-3.5" />} tip="Mensagens recebidas dos clientes da carteira">
                        Recebidas
                      </Th>
                      <Th icon={<MessageSquare className="h-3.5 w-3.5" />} tip="Mensagens enviadas em conversas de clientes da carteira (atribuído via cliente, não via remetente)">
                        Enviadas
                      </Th>
                      <Th icon={<MessagesSquare className="h-3.5 w-3.5" />}>Conversas</Th>
                      <Th icon={<Clock className="h-3.5 w-3.5" />} tip="Tempo médio entre msg recebida do cliente e a 1ª resposta enviada (janela de 12h)">
                        1ª resposta
                      </Th>
                      <Th tip="% de msgs recebidas que tiveram resposta em até 12h">Resp%</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const heavy = r.active_clients >= 40;
                      const respRate = r.total_inbound_with_window > 0
                        ? Math.round((r.responded_inbound / r.total_inbound_with_window) * 100)
                        : 0;
                      return (
                        <tr key={r.user_id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={r.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">{initials(r.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium leading-tight">{r.name}</div>
                                <div className="text-xs text-muted-foreground leading-tight">{r.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Badge variant={heavy ? "destructive" : "secondary"}>{r.active_clients}</Badge>
                          </td>
                          <td className="py-2 px-2 text-right">
                            {r.clients_who_messaged}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({r.active_clients > 0 ? Math.round((r.clients_who_messaged / r.active_clients) * 100) : 0}%)
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right">{r.inbound_msgs}</td>
                          <td className="py-2 px-2 text-right">{r.outbound_msgs}</td>
                          <td className="py-2 px-2 text-right">{r.conversations}</td>
                          <td className="py-2 px-2 text-right">{fmtDuration(r.avg_first_response_min)}</td>
                          <td className="py-2 px-2 text-right">
                            {r.total_inbound_with_window > 0 ? `${respRate}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>
                  Atribuição por <code>clients.responsible_user_id</code> — captura mensagens
                  enviadas pela instância compartilhada mesmo quando o remetente individual
                  não é registrado. Não inclui conversas avulsas sem cliente vinculado.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function Th({ children, icon, tip }: { children: React.ReactNode; icon?: React.ReactNode; tip?: string }) {
  const content = (
    <div className="flex items-center justify-end gap-1">
      {icon}
      <span>{children}</span>
    </div>
  );
  return (
    <th className="py-2 px-2 font-medium text-right">
      {tip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help underline decoration-dotted underline-offset-2">{content}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{tip}</TooltipContent>
        </Tooltip>
      ) : content}
    </th>
  );
}
