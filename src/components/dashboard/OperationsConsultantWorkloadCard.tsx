import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, MessageSquare, Clock, MessagesSquare, Loader2, PhoneIncoming, Info, CalendarIcon, Headphones, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { OpsClientsBreakdownDialog } from "./OpsClientsBreakdownDialog";
import { OpsWorkloadAiDialog } from "./OpsWorkloadAiDialog";

interface Row {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  active_clients: number;
  clients_who_messaged: number;
  clients_attended: number;
  inbound_msgs: number;
  outbound_msgs: number;
  conversations: number;
  conversations_total: number;
  avg_first_response_min: number;
  median_first_response_min: number;
  total_response_time_min: number;
  responded_inbound: number;
  total_inbound_with_window: number;
}

type PresetKey = "today" | "7" | "15" | "30" | "60" | "90" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7", label: "Últimos 7 dias" },
  { key: "15", label: "Últimos 15 dias" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "60", label: "Últimos 60 dias" },
  { key: "90", label: "Últimos 90 dias" },
  { key: "custom", label: "Personalizado" },
];

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

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export function OperationsConsultantWorkloadCard() {
  const [preset, setPreset] = useState<PresetKey>("7");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const { params, label } = useMemo(() => {
    if (preset === "today") {
      const s = startOfDay(new Date());
      const e = endOfDay(new Date());
      return { params: { p_start: s.toISOString(), p_end: e.toISOString() }, label: "hoje" };
    }
    if (preset === "custom") {
      if (customRange?.from) {
        const s = startOfDay(customRange.from);
        const e = endOfDay(customRange.to || customRange.from);
        return {
          params: { p_start: s.toISOString(), p_end: e.toISOString() },
          label: `${format(s, "dd/MM/yy", { locale: ptBR })} – ${format(e, "dd/MM/yy", { locale: ptBR })}`,
        };
      }
      return { params: null, label: "selecione um período" };
    }
    return { params: { p_days: Number(preset) }, label: `últimos ${preset} dias` };
  }, [preset, customRange]);

  useEffect(() => {
    let cancelled = false;
    if (!params) { setRows([]); return; }
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase.rpc("get_ops_consultant_workload", params as any);
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
  }, [params]);

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({
      clients: a.clients + r.active_clients,
      who: a.who + r.clients_who_messaged,
      attended: a.attended + r.clients_attended,
      inbound: a.inbound + r.inbound_msgs,
      outbound: a.outbound + r.outbound_msgs,
      convs: a.convs + r.conversations,
    }),
    { clients: 0, who: 0, attended: 0, inbound: 0, outbound: 0, convs: 0 }
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={() => setAiOpen(true)}
              disabled={loading || rows.length === 0}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              Resumo IA
            </Button>
            <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {preset === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("justify-start text-left font-normal min-w-[220px]",
                      !customRange?.from && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRange?.from
                      ? customRange.to
                        ? `${format(customRange.from, "dd/MM/yy")} – ${format(customRange.to, "dd/MM/yy")}`
                        : format(customRange.from, "dd/MM/yy")
                      : "Selecionar período"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={setCustomRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
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
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                <Metric label="Carteira ativa" value={totals.clients} />
                <Metric label="Clientes que chamaram" value={totals.who} />
                <Metric
                  label="Clientes atendidos"
                  value={totals.attended}
                  hint={totals.clients > 0 ? `${Math.round((totals.attended / totals.clients) * 100)}% da carteira` : undefined}
                />
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
                        Chamaram
                      </Th>
                      <Th icon={<Headphones className="h-3.5 w-3.5" />} tip="Clientes distintos que receberam ao menos 1 mensagem da consultora no período (efetivamente atendidos)">
                        Atendidos
                      </Th>
                      <Th icon={<MessageSquare className="h-3.5 w-3.5" />} tip="Mensagens recebidas dos clientes da carteira">
                        Recebidas
                      </Th>
                      <Th icon={<MessageSquare className="h-3.5 w-3.5" />} tip="Mensagens enviadas em conversas de clientes da carteira (atribuído via cliente, não via remetente)">
                        Enviadas
                      </Th>
                      <Th icon={<MessagesSquare className="h-3.5 w-3.5" />} tip="Conversas com clientes da carteira que possuem contrato ativo no período">Conversas</Th>
                      <Th icon={<MessagesSquare className="h-3.5 w-3.5" />} tip="Total de conversas no período, incluindo clientes sem contrato ativo (ex.: trial, cancelados, pré-venda)">Conv. (total)</Th>
                      <Th icon={<Clock className="h-3.5 w-3.5" />} tip="Tempo médio entre msg recebida do cliente e a 1ª resposta enviada (janela de 12h). Mediana entre parênteses é mais robusta contra outliers.">
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
                            <button
                              type="button"
                              onClick={() => setSelected({ id: r.user_id, name: r.name })}
                              className="hover:underline underline-offset-2 decoration-dotted text-primary font-medium"
                              title="Ver clientes que chamaram e que estão em silêncio"
                            >
                              {r.clients_who_messaged}
                            </button>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({r.active_clients > 0 ? Math.round((r.clients_who_messaged / r.active_clients) * 100) : 0}%)
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <span className="font-medium">{r.clients_attended}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({r.active_clients > 0 ? Math.round((r.clients_attended / r.active_clients) * 100) : 0}%)
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right">{r.inbound_msgs}</td>
                          <td className="py-2 px-2 text-right">{r.outbound_msgs}</td>
                          <td className="py-2 px-2 text-right">{r.conversations}</td>
                          <td className="py-2 px-2 text-right">
                            <div>{fmtDuration(r.avg_first_response_min)}</div>
                            {r.median_first_response_min > 0 && (
                              <div className="text-xs text-muted-foreground">med {fmtDuration(r.median_first_response_min)}</div>
                            )}
                          </td>
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
      <OpsClientsBreakdownDialog
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        consultantId={selected?.id || null}
        consultantName={selected?.name || ""}
        periodLabel={label}
        rpcParams={params}
      />
      <OpsWorkloadAiDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        rows={rows}
        periodLabel={label}
        rpcParams={params}
      />

    </TooltipProvider>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
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
