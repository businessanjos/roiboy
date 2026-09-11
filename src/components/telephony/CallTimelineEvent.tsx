import { useState } from "react";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CallTranscript {
  status: string;
  summary: any;
  transcript: string | null;
  temperature: string | null;
  last_error: string | null;
  recording_url: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ConversationCall {
  id: string;
  call_id: string;
  phone: string | null;
  contact_name: string | null;
  direction: string | null;
  status: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  created_at?: string | null;
  qualification_name: string | null;
  user_id: string | null;
  agent_name: string | null;
  lead_id: string | null;
  deal_id: string | null;
  client_id: string | null;
  activity_id?: string | null;
  recording_url: string | null;
  threecplus_call_transcripts?: CallTranscript[] | null;
}

/** Registro criado pelo ROY na discagem, ainda sem os dados da 3C. */
export function isPendingCall(call: ConversationCall) {
  return !call.call_id;
}

/**
 * Remove o registro local do click2call quando a sync da 3C já trouxe a mesma
 * ligação (mesmo telefone, mesmo usuário, até 3 min de diferença).
 */
export function dedupeCalls<T extends ConversationCall>(calls: T[]): T[] {
  const synced = calls.filter((c) => !!c.call_id);
  const digits = (p?: string | null) => {
    const d = (p || "").replace(/\D/g, "");
    return d.length >= 8 ? d.slice(-8) : "";
  };
  const ts = (c: ConversationCall) => new Date(c.started_at || c.created_at || 0).getTime();
  return calls.filter((c) => {
    if (c.call_id) return true;
    return !synced.some(
      (s) =>
        digits(s.phone) === digits(c.phone) &&
        (!s.user_id || !c.user_id || s.user_id === c.user_id) &&
        Math.abs(ts(s) - ts(c)) <= 180_000,
    );
  });
}

export function callOutcome(call: ConversationCall) {
  const raw = (call.status || "").toLowerCase();
  if (isPendingCall(call)) return "Ligação em andamento";
  if (raw === "failed") return "Falha na chamada";
  if ((call.duration_seconds || 0) > 0) return "Atendida";
  if (raw.includes("caixa") || raw.includes("voicemail")) return "Caixa postal";
  if (raw.includes("ocupad") || raw.includes("busy")) return "Ocupado";
  return "Não atendeu";
}

function fmtDuration(seconds: number | null) {
  const s = seconds || 0;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `${m} min ${String(rest).padStart(2, "0")} s` : `${rest} s`;
}

function isOutbound(call: ConversationCall) {
  const d = (call.direction || "").toLowerCase();
  return !d.includes("in") && !d.includes("entrada") && !d.includes("receb");
}

/**
 * Evento de ligação exibido no meio do histórico (RoyZapp) ou na timeline
 * do lead/negociação. Centralizado e discreto, no estilo "Chamada de voz".
 */
export function CallTimelineEvent({
  call,
  agentLabel,
  className,
}: {
  call: ConversationCall;
  /** Nome de quem ligou (resolvido pelo chamador); cai para o agente da 3C. */
  agentLabel?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const transcript = call.threecplus_call_transcripts?.[0];
  const outcome = callOutcome(call);
  const pending = isPendingCall(call);
  const answered = outcome === "Atendida";
  const out = isOutbound(call);
  const who = agentLabel || call.agent_name || null;
  const when = call.started_at || call.created_at;
  const time = when ? format(new Date(when), "HH:mm", { locale: ptBR }) : "";
  const Icon = answered || isPendingCall(call) ? (out ? PhoneOutgoing : PhoneIncoming) : PhoneMissed;
  const summaryText: string | null = transcript?.summary?.resumo || null;

  const openDeal = () => {
    if (call.deal_id) window.open(`/sales?deal=${call.deal_id}`, "_blank");
  };

  return (
    <>
      <div className={cn("flex w-full justify-center px-2 py-1.5", className)}>
        <div
          role={call.deal_id ? "button" : undefined}
          tabIndex={call.deal_id ? 0 : undefined}
          onClick={call.deal_id ? openDeal : undefined}
          onKeyDown={(e) => {
            if (call.deal_id && (e.key === "Enter" || e.key === " ")) openDeal();
          }}
          className={cn(
            "max-w-[85%] rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-center",
            answered ? "" : "opacity-80",
            call.deal_id && "cursor-pointer hover:bg-muted/70 transition-colors",
          )}
        >
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Icon className={cn("h-3.5 w-3.5", answered ? "text-primary/70" : "")} />
            <span>
              {out ? "Ligação de saída" : "Ligação recebida"}
              {who ? ` · ${who}` : ""}
              {answered ? ` · ${fmtDuration(call.duration_seconds)}` : ""} · {outcome}
              {pending ? " · aguardando dados da 3C" : ""}
            </span>
            {time && <span className="opacity-70">· {time}</span>}
            {call.deal_id && <ExternalLink className="h-3 w-3 opacity-60" />}
          </div>

          {answered && summaryText && (
            <div className="mt-1 text-left">
              <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground/90">{summaryText}</p>
              <button
                type="button"
                className="mt-0.5 text-[11px] font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                Ver resumo completo
              </button>
            </div>
          )}

          {answered && !summaryText && (transcript?.recording_url || call.recording_url) && (
            <button
              type="button"
              className="mt-0.5 text-[11px] font-medium text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
            >
              Ouvir gravação
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {call.contact_name || call.phone || "Ligação"}
            </DialogTitle>
            <DialogDescription>
              {when ? format(new Date(when), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""} ·{" "}
              {fmtDuration(call.duration_seconds)} · {outcome}
              {call.qualification_name ? ` · ${call.qualification_name}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(transcript?.recording_url || call.recording_url) && (
              <audio
                controls
                preload="none"
                className="w-full"
                src={transcript?.recording_url || call.recording_url || undefined}
              />
            )}

            {call.deal_id && (
              <Button size="sm" variant="outline" onClick={openDeal}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir negociação
              </Button>
            )}

            {transcript?.summary && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Resumo</p>
                <p className="mt-1 text-muted-foreground">{transcript.summary.resumo}</p>
                {Array.isArray(transcript.summary.dores) && transcript.summary.dores.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <strong>Dores:</strong> {transcript.summary.dores.join("; ")}
                  </p>
                )}
                {Array.isArray(transcript.summary.objecoes) && transcript.summary.objecoes.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <strong>Objeções:</strong> {transcript.summary.objecoes.join("; ")}
                  </p>
                )}
                {Array.isArray(transcript.summary.proximos_passos) &&
                  transcript.summary.proximos_passos.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Próximos passos:</strong> {transcript.summary.proximos_passos.join("; ")}
                    </p>
                  )}
              </div>
            )}

            {transcript?.transcript ? (
              <ScrollArea className="h-64 rounded-lg border border-border p-3">
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{transcript.transcript}</p>
              </ScrollArea>
            ) : (
              <p className="text-xs text-muted-foreground">
                {transcript?.last_error || "Transcrição ainda não disponível."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
