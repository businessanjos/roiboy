import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Video, Mail, Clock, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PLATFORMS = [
  { value: "google", label: "Google Meet", icon: "🟢" },
  { value: "zoom", label: "Zoom", icon: "🔵" },
];

const EMAIL_ADVANCE_OPTIONS = [
  { value: "none", label: "Não enviar" },
  { value: "immediate", label: "Enviar agora" },
  { value: "10min", label: "10 minutos antes" },
  { value: "1hour", label: "1 hora antes" },
  { value: "1day", label: "1 dia antes" },
];

const DEFAULT_EMAIL_TEMPLATE = `Olá {nome},

Sua reunião está confirmada!

📅 Data: {data}
⏰ Horário: {horario}
🔗 Link: {link}
🔑 Senha: {senha}

Clique no link acima para entrar na reunião no horário agendado.

Até lá!`;

interface MeetingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  dueDate: string | null;
  dueTime: string | null;
  participantEmail?: string;
  participantName?: string;
  leadId?: string | null;
  onMeetingCreated: (meetingUrl: string, platform: string) => void;
}

export function MeetingConfigDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  dueDate,
  dueTime,
  participantEmail = "",
  participantName = "",
  leadId,
  onMeetingCreated,
}: MeetingConfigDialogProps) {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState("google");
  const [emailAdvance, setEmailAdvance] = useState("immediate");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Load user preferences and auto-populate message when dialog opens
  useEffect(() => {
    if (open && currentUser?.id) {
      loadUserPreferences();
    }
  }, [open, currentUser?.id]);

  // Parse date without timezone shift
  const parseDateWithoutTimezone = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Auto-populate email message with participant data
  useEffect(() => {
    if (open && participantName && dueDate) {
      const formattedDate = format(parseDateWithoutTimezone(dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const formattedTime = dueTime || "09:00";
      
      const autoMessage = `Olá ${participantName},

Sua reunião está confirmada!

📅 Data: ${formattedDate}
⏰ Horário: ${formattedTime}
🔗 Link: {link}
🔑 Senha: {senha}

Clique no link acima para entrar na reunião no horário agendado.

Até lá!`;
      
      setEmailMessage(autoMessage);
    }
  }, [open, participantName, dueDate, dueTime]);

  const loadUserPreferences = async () => {
    try {
      const { data } = await supabase
        .from("users")
        .select("meeting_platform, meeting_email_advance")
        .eq("id", currentUser!.id)
        .single();

      if (data) {
        if (data.meeting_platform) setPlatform(data.meeting_platform);
        if (data.meeting_email_advance) setEmailAdvance(data.meeting_email_advance);
      }
    } catch (error) {
      console.error("Error loading user preferences:", error);
    }
  };

  const handleCreateMeeting = async () => {
    if (!dueDate) {
      toast.error("A atividade precisa ter uma data definida");
      return;
    }

    setLoading(true);
    try {
      // Build start and end time
      const startDateTime = dueTime 
        ? `${dueDate}T${dueTime}:00` 
        : `${dueDate}T09:00:00`;
      
      // Default to 1 hour meeting
      const startDate = new Date(startDateTime);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      // Calculate send_at based on email advance preference
      let sendAt = new Date();
      if (emailAdvance !== "immediate") {
        const advanceMs: Record<string, number> = {
          "10min": 10 * 60 * 1000,
          "1hour": 60 * 60 * 1000,
          "1day": 24 * 60 * 60 * 1000,
        };
        sendAt = new Date(startDate.getTime() - (advanceMs[emailAdvance] || 0));
        // If calculated time is in the past, send immediately
        if (sendAt < new Date()) {
          sendAt = new Date();
        }
      }

      // Format message with variables
      const formattedMessage = emailMessage
        .replace(/{nome}/g, participantName || "Participante")
        .replace(/{data}/g, format(startDate, "dd/MM/yyyy", { locale: ptBR }))
        .replace(/{horario}/g, format(startDate, "HH:mm", { locale: ptBR }))
        .replace(/{link}/g, "{MEETING_URL}") // Will be replaced by the edge function
        .replace(/{senha}/g, "{MEETING_PASSWORD}"); // Will be replaced by the edge function

      const { data, error } = await supabase.functions.invoke("create-meeting", {
        body: {
          task_id: taskId,
          platform,
          participant_email: participantEmail,
          participant_name: participantName || participantEmail.split("@")[0],
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          title: taskTitle,
          email_send_at: sendAt.toISOString(),
          email_message: formattedMessage,
          email_subject: `Reunião: ${taskTitle}`,
          lead_id: leadId,
          send_email: sendEmail && emailAdvance !== "none",
        },
      });

      if (error) throw error;

      if (data?.meeting_url) {
        // Atualiza a mensagem com o link real para exibição
        const updatedMessage = emailMessage
          .replace(/{link}/g, data.meeting_url)
          .replace(/{senha}/g, data.meeting_password || "Não requer senha");
        setEmailMessage(updatedMessage);
        
        onMeetingCreated(data.meeting_url, platform);
        toast.success("Reunião criada com sucesso!");
        
        if (sendEmail && participantEmail && emailAdvance !== "none") {
          if (emailAdvance === "immediate") {
            toast.info("Convite enviado para " + participantEmail);
          } else {
            toast.info(`Convite será enviado ${EMAIL_ADVANCE_OPTIONS.find(o => o.value === emailAdvance)?.label.toLowerCase()}`);
          }
        } else if (emailAdvance === "none") {
          toast.info("Reunião criada sem envio de convite por email");
        } else if (!participantEmail) {
          toast.info("Compartilhe o link da reunião com o participante");
        } else {
          toast.info("Reunião criada sem envio de convite por email");
        }
        onOpenChange(false);
      } else {
        throw new Error("Não foi possível criar a reunião");
      }
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      toast.error(error.message || "Erro ao criar reunião");
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = dueDate 
    ? format(parseDateWithoutTimezone(dueDate), "dd 'de' MMMM", { locale: ptBR })
    : "Data não definida";
  const formattedTime = dueTime || "Horário não definido";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Configurar Reunião Online
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Meeting Info */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium">{taskTitle}</p>
            <p className="text-muted-foreground">
              {formattedDate} às {formattedTime}
            </p>
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <span>{p.icon}</span>
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Participant Email - Read Only */}
          <div className="space-y-2">
          <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email do Participante
              <span className="text-xs text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              {participantEmail || "Email não disponível"}
            </div>
            {!participantEmail && (
              <p className="text-xs text-muted-foreground">
                Você poderá compartilhar o link da reunião manualmente
              </p>
            )}
          </div>

          {/* Send Email Checkbox - só aparece se tiver email */}
          {participantEmail && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <Label htmlFor="send-email" className="text-sm font-normal cursor-pointer">
                Enviar convite por email
              </Label>
            </div>
          )}

          {sendEmail && (
            <>
              {/* When to send */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Quando enviar o convite
                </Label>
                <Select value={emailAdvance} onValueChange={setEmailAdvance}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_ADVANCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Email Message - hidden when "none" is selected */}
              {emailAdvance !== "none" && (
                <div className="space-y-2">
                  <Label>Mensagem do Convite</Label>
                  <Textarea
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{nome}"}, {"{data}"}, {"{horario}"}, {"{link}"}, {"{senha}"} para personalizar
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateMeeting} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Criar Reunião
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
