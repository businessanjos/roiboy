import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import type { RulerTemplate } from "@/hooks/useZappRulers";
import { buildTouchRows, computeTouchDate } from "./rulerScheduling";

interface ZappRulerEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: RulerTemplate[];
  sectorId?: string | null;
  integrationId?: string | null;
  conversationId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  clientId?: string | null;
  leadId?: string | null;
  onEnrolled?: () => void;
}

export function ZappRulerEnrollDialog({
  open,
  onOpenChange,
  templates,
  sectorId,
  integrationId,
  conversationId,
  contactName,
  contactPhone,
  clientId,
  leadId,
  onEnrolled,
}: ZappRulerEnrollDialogProps) {
  const { currentUser } = useCurrentUser();
  const [templateId, setTemplateId] = useState<string>("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState("09:00");
  const [autoSend, setAutoSend] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.is_active && t.steps.length > 0),
    [templates],
  );
  const template = activeTemplates.find((t) => t.id === templateId) || null;

  useEffect(() => {
    if (!open) return;
    const first = activeTemplates[0];
    setTemplateId(first?.id || "");
    setAutoSend(first?.default_auto_send ?? true);
    setStopOnReply(first?.stop_on_reply ?? true);
    setStartDate(new Date().toISOString().slice(0, 10));
    setDueTime("09:00");
  }, [open, activeTemplates]);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = activeTemplates.find((t) => t.id === id);
    if (tpl) {
      setAutoSend(tpl.default_auto_send);
      setStopOnReply(tpl.stop_on_reply);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser?.account_id || !template) return;
    const phone = (contactPhone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Este contato não tem telefone válido para a régua.");
      return;
    }

    setSaving(true);
    try {
      const { data: enrollment, error } = await supabase
        .from("zapp_ruler_enrollments")
        .insert({
          account_id: currentUser.account_id,
          sector_id: sectorId || null,
          template_id: template.id,
          template_name: template.name,
          conversation_id: conversationId || null,
          integration_id: integrationId || null,
          client_id: clientId || null,
          lead_id: leadId || null,
          contact_name: contactName || null,
          contact_phone: phone,
          assigned_to: currentUser.id,
          start_date: startDate,
          due_time: dueTime,
          auto_send: autoSend,
          send_window_start: template.send_window_start,
          send_window_end: template.send_window_end,
          stop_on_reply: stopOnReply,
          status: "active",
          created_by: currentUser.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = buildTouchRows({
        enrollmentId: enrollment.id,
        accountId: currentUser.account_id,
        steps: template.steps,
        startDate,
        dueTime,
        autoSend,
      });
      const { error: touchError } = await supabase.from("zapp_ruler_touches").insert(rows);
      if (touchError) throw touchError;

      toast.success(`Régua "${template.name}" iniciada com ${rows.length} toques.`);
      onOpenChange(false);
      onEnrolled?.();
    } catch (err: any) {
      console.error("[ZappRuler] enroll failed", err);
      toast.error(err?.message || "Não foi possível iniciar a régua");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Iniciar régua de relacionamento
          </DialogTitle>
          <DialogDescription>
            {contactName ? `Contato: ${contactName}` : "Programe os toques deste contato."}
          </DialogDescription>
        </DialogHeader>

        {activeTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum modelo de régua ativo neste setor. Crie um modelo na aba Régua.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.steps.length} toques
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enviar automaticamente</p>
                <p className="text-xs text-muted-foreground">
                  Desligado, cada toque vira uma tarefa manual na fila.
                </p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Parar se o contato responder</p>
                <p className="text-xs text-muted-foreground">Cancela os toques restantes.</p>
              </div>
              <Switch checked={stopOnReply} onCheckedChange={setStopOnReply} />
            </div>

            {template && (
              <ScrollArea className="h-48 rounded-lg border">
                <div className="space-y-3 p-3 pr-4">
                  {template.steps.map((s, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">D+{s.offset_days}</Badge>
                        {s.is_task && <Badge variant="outline">Atividade</Badge>}
                        <span className="text-xs font-medium">{s.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {computeTouchDate(startDate, s.offset_days, dueTime).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {s.is_task ? "Tarefa interna, sem envio de mensagem." : s.message}
                      </p>
                    </div>
                  ))}

                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !template}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Iniciar régua
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
