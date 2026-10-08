import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";

interface QueueRow {
  id: string;
  client_id: string;
  event_type: string;
  title: string;
  message: string | null;
  event_date: string | null;
  scheduled_send_at: string | null;
  send_status: string | null;
  send_error: string | null;
  force_send: boolean;
  clients: { full_name: string; status: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  pending: "Pendente",
  sent: "Enviado",
  cancelled: "Fora da fila",
  failed: "Falhou",
};

/** Next 08:00 (São Paulo) for the event's day/month, from today on. */
function nextSendAt(eventDate: string | null): string {
  const now = new Date();
  const [, m, d] = (eventDate || "").split("-").map(Number);
  let y = now.getFullYear();
  let at = new Date(Date.UTC(y, (m || now.getMonth() + 1) - 1, d || now.getDate(), 11, 0, 0));
  if (at.getTime() < now.getTime() - 12 * 3600 * 1000) at = new Date(Date.UTC(++y, at.getUTCMonth(), at.getUTCDate(), 11));
  return at.toISOString();
}

export default function CxSendQueue() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("queue");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["cx-send-queue"],
    queryFn: async () => {
      const all: QueueRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("client_life_events")
          .select("id, client_id, event_type, title, message, event_date, scheduled_send_at, send_status, send_error, force_send, clients(full_name, status)")
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...((data || []) as unknown as QueueRow[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  const { data: activeIds } = useQuery({
    queryKey: ["cx-send-queue-active-contracts"],
    queryFn: async () => {
      const ids = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("client_contracts").select("client_id").eq("status", "active").range(from, from + 999);
        if (error) throw error;
        (data || []).forEach((c) => ids.add(c.client_id as string));
        if (!data || data.length < 1000) break;
      }
      return ids;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const limit = days === "all" ? Infinity : Date.now() + Number(days) * 86400000;
    return rows
      .filter((r) => {
        if (q && !(r.clients?.full_name || "").toLowerCase().includes(q)) return false;
        const s = r.send_status || "";
        if (status === "queue" && !["scheduled", "pending"].includes(s)) return false;
        if (status !== "queue" && status !== "all" && s !== status) return false;
        if (status === "queue" && r.scheduled_send_at && new Date(r.scheduled_send_at).getTime() > limit) return false;
        return true;
      })
      .sort((a, b) => (a.scheduled_send_at || "9").localeCompare(b.scheduled_send_at || "9"))
      .slice(0, 300);
  }, [rows, search, status, days]);

  const update = async (r: QueueRow, include: boolean) => {
    setBusy(r.id);
    const patch = include
      ? { send_status: "scheduled", send_error: null, force_send: true, scheduled_send_at: r.scheduled_send_at && new Date(r.scheduled_send_at) > new Date() ? r.scheduled_send_at : nextSendAt(r.event_date) }
      : { send_status: "cancelled", send_error: "PAUSADO MANUALMENTE: retirado da fila", force_send: false };
    const { error } = await supabase.from("client_life_events").update(patch).eq("id", r.id);
    setBusy(null);
    if (error) return toast.error("Não foi possível atualizar: " + error.message);
    toast.success(include ? "Incluído na fila de envio" : "Retirado da fila");
    qc.invalidateQueries({ queryKey: ["cx-send-queue"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fila de envios automáticos</CardTitle>
        <CardDescription>
          Parabéns e momentos CX. Clientes sem contrato ativo saem da fila automaticamente, a não ser que você os inclua aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input className="h-11" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="queue">Na fila</SelectItem>
              <SelectItem value="cancelled">Fora da fila</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="failed">Falharam</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          {status === "queue" && (
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-11 sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">Próximos 7 dias</SelectItem>
                <SelectItem value="30">Próximos 30 dias</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {error ? (
          <p className="text-sm text-destructive">Erro ao carregar a fila: {(error as Error).message}</p>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nada por aqui.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const inQueue = ["scheduled", "pending"].includes(r.send_status || "");
              const hasContract = activeIds?.has(r.client_id);
              return (
                <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.clients?.full_name || "Cliente"}</span>
                      <Badge variant="outline">{STATUS_LABEL[r.send_status || ""] || r.send_status}</Badge>
                      {activeIds && !hasContract && <Badge variant="secondary">Sem contrato ativo</Badge>}
                      {r.force_send && <Badge>Incluído manualmente</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.title}
                      {r.scheduled_send_at && ` · ${new Date(r.scheduled_send_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                      {r.send_error && ` · ${r.send_error}`}
                    </p>
                    {r.message && <p className="text-xs text-muted-foreground line-clamp-1">{r.message}</p>}
                  </div>
                  {r.send_status !== "sent" && (
                    <Button
                      variant={inQueue ? "outline" : "default"}
                      className="h-11"
                      disabled={busy === r.id}
                      onClick={() => update(r, !inQueue)}
                    >
                      {inQueue ? <><PauseCircle className="h-4 w-4 mr-2" />Tirar da fila</> : <><PlayCircle className="h-4 w-4 mr-2" />Incluir na fila</>}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
