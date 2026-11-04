import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Image as ImageIcon, Mic, Video, FileText, MessageSquare } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string | null;
  onClose: () => void;
  onOpenFull: (id: string) => void;
}

interface Msg {
  id: string;
  direction: string;
  content: string | null;
  transcription: string | null;
  message_type: string | null;
  media_type: string | null;
  media_filename: string | null;
  sent_at: string;
  sender_name: string | null;
}

function mediaLabel(m: Msg) {
  const t = (m.media_type || m.message_type || "").toLowerCase();
  if (t.includes("audio") || t.includes("ptt")) return { icon: Mic, label: "Áudio" };
  if (t.includes("video")) return { icon: Video, label: "Vídeo" };
  if (t.includes("image") || t.includes("sticker")) return { icon: ImageIcon, label: "Imagem" };
  if (t.includes("document")) return { icon: FileText, label: m.media_filename || "Documento" };
  return null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function ZappConversationQuickPreview({ conversationId, onClose, onOpenFull }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["zapp-quick-preview", conversationId],
    enabled: !!conversationId,
    staleTime: 30_000,
    queryFn: async () => {
      const [conv, msgs] = await Promise.all([
        supabase
          .from("zapp_conversations")
          .select("id, contact_name, phone_e164, is_group")
          .eq("id", conversationId!)
          .maybeSingle(),
        supabase
          .from("zapp_messages")
          .select("id, direction, content, transcription, message_type, media_type, media_filename, sent_at, sender_name")
          .eq("zapp_conversation_id", conversationId!)
          .eq("is_deleted", false)
          .order("sent_at", { ascending: false })
          .limit(40),
      ]);
      if (conv.error) throw conv.error;
      if (msgs.error) throw msgs.error;
      return { conv: conv.data, msgs: ((msgs.data as Msg[]) || []).reverse() };
    },
  });

  useEffect(() => {
    if (data) requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
  }, [data]);

  const name = data?.conv?.contact_name || data?.conv?.phone_e164 || "Contato";

  return (
    <Dialog open={!!conversationId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl border-primary/20 bg-card">
        <div className="flex items-center gap-3 px-5 py-4 pr-12 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
          <div className="h-10 w-10 shrink-0 rounded-full bg-primary/15 text-primary ring-1 ring-primary/30 flex items-center justify-center text-sm font-semibold">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold truncate">{name}</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground truncate">
              {data?.conv?.phone_e164 || "—"}{data?.conv?.is_group ? " · grupo" : ""}
            </DialogDescription>
          </div>
        </div>

        <div className="h-[55vh] overflow-y-auto px-4 py-3 bg-muted/30 space-y-2">
          {error ? (
            <p className="text-sm text-destructive py-6 text-center">Não foi possível carregar a conversa.</p>
          ) : isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-10 rounded-2xl", i % 2 ? "ml-auto w-2/3" : "w-1/2")} />
            ))
          ) : !data?.msgs.length ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
              <MessageSquare className="h-6 w-6" /> Nenhuma mensagem.
            </div>
          ) : (
            data.msgs.map((m, i) => {
              const out = m.direction === "outbound";
              const media = mediaLabel(m);
              const text = m.content || m.transcription;
              const prev = data.msgs[i - 1];
              const newDay = !prev || !isSameDay(new Date(prev.sent_at), new Date(m.sent_at));
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="flex justify-center my-2">
                      <span className="text-[10px] uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                        {format(new Date(m.sent_at), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        out
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-background border border-border rounded-bl-md"
                      )}
                    >
                      {media && (
                        <div className="flex items-center gap-1.5 font-medium">
                          <media.icon className="h-3.5 w-3.5" /> <span className="truncate">{media.label}</span>
                        </div>
                      )}
                      {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
                      <p className={cn("text-[10px] mt-1 text-right", out ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {format(new Date(m.sent_at), "HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <span className="text-[11px] text-muted-foreground">Prévia rápida · últimas 40 mensagens</span>
          <Button size="sm" onClick={() => conversationId && onOpenFull(conversationId)} className="gap-1.5">
            Abrir conversa <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
