import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, MessageCircle, Users, ClipboardCheck, MessageCircleQuestion } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientHistoryTimeline } from "./ClientHistoryTimeline";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Item = {
  id: string;
  at: string;
  source: "checkin" | "direct" | "group";
  title: string;
  who: string | null;
  action: string;
  text: string | null;
  link?: string;
  /** Última mensagem da conversa é da equipe e o cliente não respondeu */
  pendingReply?: boolean;
  /** Dias desde essa mensagem da equipe */
  silentDays?: number;
  /** Mensagem recebida do cliente (não enviada pela equipe) */
  inbound?: boolean;
};

const KIND: Record<string, string> = { checkpoint: "Checkpoint registrado", contato: "Contato registrado" };
const CHANNEL: Record<string, string> = { whatsapp: "WhatsApp", call: "Ligação", ligacao: "Ligação", meeting: "Reunião", reuniao: "Reunião", email: "E-mail", presencial: "Presencial" };

const zone = "America/Sao_Paulo";
const dateTimeLabel = (at: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(at));
const silenceLabel = (days?: number) => {
  if (days === undefined) return "";
  if (days <= 0) return "hoje";
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
};

export function ClientInteractionDetailsDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-interaction-details", clientId],
    enabled: open,
    queryFn: async (): Promise<{ items: Item[]; lastInboundAt: string | null }> => {
      const [ck, direct, links] = await Promise.all([
        supabase
          .from("client_checkins")
          .select("id, happened_at, kind, channel, summary, user_id, initiated_by")
          .eq("client_id", clientId)
          .order("happened_at", { ascending: false })
          .limit(10),
        supabase.from("zapp_conversations").select("id, contact_name, is_group, sector_id").eq("client_id", clientId),
        supabase.from("zapp_group_clients" as any).select("conversation_id").eq("client_id", clientId),
      ]);
      if (ck.error) throw ck.error;
      if (direct.error) throw direct.error;
      if (links.error) throw links.error;

      const convIds = new Set<string>((direct.data || []).map((c: any) => c.id));
      ((links.data || []) as any[]).forEach((l) => convIds.add(l.conversation_id));

      let convs: any[] = direct.data || [];
      const missing = [...convIds].filter((id) => !convs.some((c) => c.id === id));
      if (missing.length) {
        const r = await supabase.from("zapp_conversations").select("id, contact_name, is_group, sector_id").in("id", missing);
        if (r.error) throw r.error;
        convs = convs.concat(r.data || []);
      }
      const convMap = new Map(convs.map((c) => [c.id, c]));

      // Última mensagem de cada conversa (exatas, uma consulta por conversa).
      const msgs = await Promise.all(
        [...convIds].map((id) =>
          supabase
            .from("zapp_messages")
            .select("id, sent_at, content, direction, sender_name, message_type, zapp_conversation_id")
            .eq("zapp_conversation_id", id)
            .eq("is_deleted", false)
            .order("sent_at", { ascending: false })
            .limit(3),
        ),
      );
      for (const m of msgs) if (m.error) throw m.error;

      // Conversas em que a última mensagem é da equipe: o cliente não respondeu
      // depois dela. Guardamos quantos dias se passaram desde essa mensagem.
      const pendingMessages = new Map<string, number>();
      let lastInboundAt: string | null = null;
      msgs.forEach((m) => {
        const rows = m.data || [];
        if (rows.length && rows[0].direction === "outbound") {
          pendingMessages.set(
            `msg-${rows[0].id}`,
            Math.floor((Date.now() - new Date(rows[0].sent_at).getTime()) / 86_400_000),
          );
        }
        const inbound = rows.find((r: any) => r.direction !== "outbound");
        if (inbound && (!lastInboundAt || new Date(inbound.sent_at) > new Date(lastInboundAt))) {
          lastInboundAt = inbound.sent_at;
        }
      });


      const userIds = [...new Set((ck.data || []).map((r: any) => r.user_id).filter(Boolean))];
      const users = new Map<string, string>();
      if (userIds.length) {
        const u = await supabase.from("users").select("id, name").in("id", userIds);
        if (u.error) throw u.error;
        (u.data || []).forEach((x: any) => users.set(x.id, x.name));
      }

      const items: Item[] = (ck.data || []).map((r: any) => ({
        id: `ck-${r.id}`,
        at: r.happened_at,
        source: "checkin",
        title: "Registro na ficha (check-in)",
        who: r.user_id ? users.get(r.user_id) ?? null : null,
        action: `${KIND[r.kind] ?? r.kind}${r.channel ? ` · ${CHANNEL[r.channel] ?? r.channel}` : ""}${
          r.initiated_by ? ` · iniciado por ${r.initiated_by === "client" ? "cliente" : "equipe"}` : ""
        }`,
        text: r.summary,
      }));

      msgs.forEach((m) =>
        (m.data || []).forEach((r: any) => {
          const c = convMap.get(r.zapp_conversation_id);
          const out = r.direction === "outbound";
          items.push({
            id: `msg-${r.id}`,
            at: r.sent_at,
            source: c?.is_group ? "group" : "direct",
            title: c?.is_group ? `Grupo: ${c?.contact_name || "sem nome"}` : `Conversa individual${c?.contact_name ? `: ${c.contact_name}` : ""}`,
            who: r.sender_name || (out ? "Equipe" : "Cliente"),
            action: `${out ? "Mensagem enviada pela equipe" : "Mensagem recebida"}${
              r.message_type && r.message_type !== "text" ? ` · ${r.message_type}` : ""
            }`,
            text: r.content,
            pendingReply: pendingMessages.has(`msg-${r.id}`) || undefined,
            silentDays: pendingMessages.get(`msg-${r.id}`),
            inbound: !out,
            link: `/roy-zapp?sector=${c?.sector_id || ""}&conversation=${r.zapp_conversation_id}`,
          });
        }),
      );

      return {
        items: items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 15),
        lastInboundAt,
      };
    },
  });
  const items = data?.items;

  // A interação mais recente da linha do tempo é uma mensagem da equipe sem
  // resposta: cliente está há X dias sem responder.
  const newestPending = items?.find((i) => i.pendingReply);
  // Caso contrário, a última mensagem é do cliente: a bola está com a consultora.
  const newestMsg = items?.find((i) => i.source !== "checkin");
  const awaitingTeam = !newestPending && !!newestMsg?.inbound;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">Interações de {clientName}</DialogTitle>
          <DialogDescription>
            Registros de check-in e mensagens do RoyZapp, do mais recente ao mais antigo (horário de Brasília).
          </DialogDescription>
        </DialogHeader>

        {!isLoading && !error && newestPending && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="h-4 w-4 shrink-0 text-warning" />
              <p className="text-sm font-semibold text-warning">
                Cliente sem responder {silenceLabel(newestPending.silentDays)}
              </p>
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Última resposta do cliente</dt>
                <dd className="font-medium">
                  {data?.lastInboundAt ? dateTimeLabel(data.lastInboundAt) : "Nunca respondeu"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Última mensagem enviada (equipe)</dt>
                <dd className="font-medium">
                  {dateTimeLabel(newestPending.at)}
                  {newestPending.who ? ` · ${newestPending.who}` : ""}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {newestPending.title} — a equipe escreveu por último e o cliente não respondeu depois disso.
            </p>
          </div>
        )}

        {!isLoading && !error && awaitingTeam && newestMsg && (
          <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 p-3">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-info">Aguardando resposta da consultora</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A última mensagem foi do cliente em {dateTimeLabel(newestMsg.at)} — {newestMsg.title}.
              </p>
            </div>
          </div>
        )}


        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">Não foi possível carregar as interações. Tente de novo.</p>
        ) : !items?.length ? (
          <p className="py-6 text-sm text-muted-foreground">Nenhuma interação encontrada para este cliente.</p>
        ) : (
          <ClientHistoryTimeline entries={items.map((it) => ({
            id: it.id,
            at: it.at,
            title: it.title,
            detail: [it.action, it.who ? `Por ${it.who}` : null].filter(Boolean).join(" · "),
            text: it.text,
            icon: it.source === "checkin" ? ClipboardCheck : it.source === "group" ? Users : MessageCircle,
            badge: it.pendingReply ? `Cliente sem responder ${silenceLabel(it.silentDays)}` : undefined,
            action: it.link ? (
              <Button asChild variant="ghost" size="sm" className="h-8 px-0 text-xs text-primary">
                <Link to={it.link}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Ver no RoyZapp</Link>
              </Button>
            ) : undefined,
          }))} />
        )}
      </DialogContent>
    </Dialog>
  );
}
