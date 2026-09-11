import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PhoneCall, ListTodo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CallTimelineEvent,
  type ConversationCall,
} from "@/components/telephony/CallTimelineEvent";

const TEMP_COLORS: Record<string, string> = {
  quente: "bg-destructive/15 text-destructive",
  morno: "bg-warning/15 text-warning",
  frio: "bg-info/15 text-info",
};

const SELECT =
  "id, call_id, phone, contact_name, direction, status, duration_seconds, started_at, created_at, qualification_name, user_id, agent_name, lead_id, deal_id, client_id, activity_id, recording_url, engine, metadata, threecplus_call_transcripts(status, summary, transcript, temperature, last_error, recording_url)";

/** Bloco "Última ligação" no cadastro do lead: data, duração, resultado, temperatura e resumo. */
export function LeadLastCallCard({ leadId }: { leadId: string }) {
  const [call, setCall] = useState<ConversationCall | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("threecplus_call_logs")
        .select(SELECT)
        .eq("lead_id", leadId)
        .not("call_id", "is", null)
        .neq("status", "failed")
        .order("started_at", { ascending: false })
        .limit(1);
      if (active) setCall(((data as unknown as ConversationCall[]) || [])[0] ?? null);
    })();
    return () => {
      active = false;
    };
  }, [leadId]);

  if (!call) return null;

  const transcript = call.threecplus_call_transcripts?.[0];
  const when = call.started_at || call.created_at;
  const answered = (call.duration_seconds || 0) > 0;
  const seconds = call.duration_seconds || 0;
  const duration =
    seconds >= 60 ? `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s` : `${seconds} s`;
  const task = (call.metadata as any)?.followup_task as { id: string; title: string } | undefined;

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <PhoneCall className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Última ligação</p>
          <span className="text-xs text-muted-foreground">
            {when ? format(new Date(when), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"} · {duration} ·{" "}
            {answered ? "Atendida" : "Não atendida"}
          </span>
          <Badge variant="outline">{call.engine === "ryka_call" ? "Call Ryka" : "3C Plus"}</Badge>
          {transcript?.temperature && (
            <Badge variant="secondary" className={TEMP_COLORS[transcript.temperature] || ""}>
              {transcript.temperature}
            </Badge>
          )}
        </div>

        {transcript?.summary?.resumo && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{transcript.summary.resumo}</p>
        )}

        {task?.title && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListTodo className="h-3.5 w-3.5 text-primary" />
            Tarefa criada: <span className="font-medium text-foreground">{task.title}</span>
          </p>
        )}

        <CallTimelineEvent call={call} className="px-0 py-0" />
      </CardContent>
    </Card>
  );
}
