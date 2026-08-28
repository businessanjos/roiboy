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
import { useSectorUsers } from "@/hooks/useSectorUsers";
import { useActivityTypes } from "@/hooks/useActivityTypes";
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
  dealId?: string | null;
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
  dealId,
  onEnrolled,
}: ZappRulerEnrollDialogProps) {
  const { currentUser } = useCurrentUser();
  const [templateId, setTemplateId] = useState<string>("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState("09:00");
  const [autoSend, setAutoSend] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [activityTypeId, setActivityTypeId] = useState<string>("");

  const effectiveSector = sectorId || "vendas";
  const { users: sectorUsers } = useSectorUsers({ sectorId: effectiveSector });
  // Todos os tipos de atividade (sem restrição de setor).
  const { activityTypes } = useActivityTypes();
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  const assigneeOptions = useMemo(() => {
    const list = sectorUsers.map((u) => ({ id: u.id, name: u.name }));
    if (currentUser?.id && !list.some((u) => u.id === currentUser.id)) {
      list.unshift({ id: currentUser.id, name: currentUser.name || "Eu" });
    }
    return list;
  }, [sectorUsers, currentUser?.id, currentUser?.name]);

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

  // Tipo de atividade padrão: "Follow Up" do setor.
  useEffect(() => {
    if (!open || activityTypes.length === 0) return;
    setActivityTypeId((prev) => {
      if (prev && activityTypes.some((t) => t.id === prev)) return prev;
      const followUp = activityTypes.find((t) =>
        t.name.toLowerCase().replace(/[\s-]/g, "").includes("followup"),
      );
      return followUp?.id || activityTypes[0].id;
    });
  }, [open, activityTypes]);

  // Responsável padrão: dono do negócio, senão o usuário atual.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let defaultId = currentUser?.id || "";
      if (dealId) {
        const { data } = await supabase
          .from("deals")
          .select("responsible_user_id, sales_user_id")
          .eq("id", dealId)
          .maybeSingle();
        defaultId = (data as any)?.responsible_user_id || (data as any)?.sales_user_id || defaultId;
      }
      if (!cancelled) setAssigneeId(defaultId);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, dealId, currentUser?.id]);

  // Nome real do cliente/lead para compor o título da atividade.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let name: string | null = null;
      if (clientId) {
        const { data } = await supabase
          .from("clients")
          .select("full_name")
          .eq("id", clientId)
          .maybeSingle();
        name = (data as any)?.full_name || null;
      } else if (leadId) {
        const { data } = await supabase
          .from("leads")
          .select("full_name")
          .eq("id", leadId)
          .maybeSingle();
        name = (data as any)?.full_name || null;
      }
      if (!cancelled) setResolvedName(name || contactName?.trim() || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId, leadId, contactName]);



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
          assigned_to: assigneeId || currentUser.id,
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

      const responsibleId = assigneeId || currentUser.id;
      const who = resolvedName?.trim() || contactName?.trim();
      // Cada toque vira uma atividade real na agenda (Tarefas), inclusive os "só atividade".
      const taskRows = rows.map((r) => ({
        account_id: currentUser.account_id,
        client_id: clientId || null,
        lead_id: leadId || null,
        deal_id: dealId || null,
        activity_type_id: activityTypeId || null,
        title: who ? `${r.title} · ${who}` : r.title,
        description: r.is_task
          ? `Atividade da régua "${template.name}" (D+${r.offset_days}).`
          : `Toque da régua "${template.name}" (D+${r.offset_days}).\n\n${r.message}`,
        due_date: (() => {
          const d = new Date(r.scheduled_at);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })(),
        due_time: dueTime,
        priority: "medium" as const,
        status: "pending" as const,
        assigned_to: responsibleId,
        created_by: currentUser.id,
      }));
      const { error: taskError } = await supabase.from("internal_tasks").insert(taskRows);
      if (taskError) {
        console.error("[ZappRuler] task creation failed", taskError);
        toast.error("Régua criada, mas não foi possível registrar as atividades.");
      }

      // Registro na timeline do negócio (card do pipeline).
      if (dealId) {
        const { error: timelineError } = await supabase.from("deal_activities").insert({
          account_id: currentUser.account_id,
          deal_id: dealId,
          type: "note",
          title: `Régua de follow up: ${template.name}`,
          content: `${rows.length} toques programados a partir de ${new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")} às ${dueTime}. Responsável: ${
            assigneeOptions.find((u) => u.id === responsibleId)?.name || "—"
          }.`,
          user_id: currentUser.id,
        });
        if (timelineError) console.error("[ZappRuler] timeline entry failed", timelineError);
      }

      toast.success(
        `Régua "${template.name}" iniciada com ${rows.length} toques e ${taskError ? 0 : taskRows.length} atividades.`,
      );

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
                <Label>Responsável</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Quem vai executar" />
                  </SelectTrigger>
                  <SelectContent>
                    {assigneeOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de atividade</Label>
                <Select value={activityTypeId} onValueChange={setActivityTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
