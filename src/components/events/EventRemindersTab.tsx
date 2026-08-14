import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BellRing, RefreshCw, Info } from "lucide-react";

interface EventRemindersTabProps {
  eventId: string;
  accountId: string | null;
}

const AUTO_TYPES = [
  {
    id: "rsvp_reminder",
    label: "Confirmação de presença (D-7)",
    description: "WhatsApp com link de RSVP para quem ainda não respondeu.",
  },
  {
    id: "pre_event_24h",
    label: "Lembrete da véspera (D-1)",
    description: "Aviso 24h antes para os confirmados.",
  },
  {
    id: "checkin_day",
    label: "Check-in no dia (2h antes)",
    description: "Envia o link de check-in pouco antes do início.",
  },
  {
    id: "post_event_feedback",
    label: "Feedback pós-evento (+3h)",
    description: "Pede avaliação de quem participou.",
  },
] as const;

const STATUS_LABEL: Record<string, { label: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "outline" },
  scheduled: { label: "Agendado", variant: "secondary" },
  sending: { label: "Enviando", variant: "default" },
  completed: { label: "Enviado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function EventRemindersTab({ eventId, accountId }: EventRemindersTabProps) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-auto-reminders", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, auto_reminders_enabled, auto_reminder_types")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ["event-reminder-campaigns", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_campaigns")
        .select("id, name, status, campaign_type, auto_type, scheduled_for, total_recipients, sent_count, failed_count")
        .eq("event_id", eventId)
        .order("scheduled_for", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const enabled = !!event?.auto_reminders_enabled;
  const selected: string[] = Array.isArray(event?.auto_reminder_types)
    ? (event?.auto_reminder_types as string[])
    : [];

  const save = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("events").update(patch).eq("id", eventId);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["event-auto-reminders", eventId] });
  };

  const toggleType = (id: string, checked: boolean) => {
    const next = checked ? [...new Set([...selected, id])] : selected.filter((t) => t !== id);
    save({ auto_reminder_types: next });
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("events-auto-reminders", { body: {} });
      if (error) throw error;
      const created = (data as { created?: number } | null)?.created ?? 0;
      toast.success(
        created > 0 ? `${created} lembrete(s) agendado(s)` : "Nenhum lembrete novo para agendar agora",
      );
      queryClient.invalidateQueries({ queryKey: ["event-reminder-campaigns", eventId] });
    } catch (e) {
      toast.error("Falha ao gerar lembretes", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-4 w-4 text-primary" />
                Lembretes automáticos (zAPP)
              </CardTitle>
              <CardDescription>
                Agendamento automático de RSVP, véspera, check-in e feedback pelo WhatsApp da conta.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor="auto-reminders" className="text-sm text-muted-foreground">
                {enabled ? "Ativo" : "Inativo"}
              </Label>
              <Switch
                id="auto-reminders"
                checked={enabled}
                onCheckedChange={(v) => save({ auto_reminders_enabled: v })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {AUTO_TYPES.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 rounded-md border border-border/60 p-3"
            >
              <Checkbox
                id={t.id}
                checked={selected.includes(t.id)}
                disabled={!enabled}
                onCheckedChange={(v) => toggleType(t.id, v === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor={t.id} className="text-sm font-medium cursor-pointer">
                  {t.label}
                </Label>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-px shrink-0" />
              A rotina roda de hora em hora e nunca dispara marcos já vencidos há mais de 6h.
            </p>
            <Button variant="outline" size="sm" onClick={runNow} disabled={!enabled || running}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${running ? "animate-spin" : ""}`} />
              Gerar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campanhas deste evento</CardTitle>
          <CardDescription>Automáticas e manuais, com status de envio.</CardDescription>
        </CardHeader>
        <CardContent>
          {!campaigns || campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma campanha de lembrete criada para este evento ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const status = STATUS_LABEL[c.status as string] || {
                  label: c.status as string,
                  variant: "outline" as const,
                };
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        {c.auto_type && (
                          <Badge variant="outline" className="text-[10px]">
                            Auto
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.scheduled_for
                          ? format(new Date(c.scheduled_for as string), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })
                          : "Sem agendamento"}{" "}
                        · {c.total_recipients} destinatário(s) · {c.sent_count} enviado(s)
                        {Number(c.failed_count) > 0 ? ` · ${c.failed_count} falha(s)` : ""}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
