import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Video, Clock, Save, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const PLATFORMS = [
  { value: "google", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
];

const EMAIL_ADVANCE_OPTIONS = [
  { value: "immediate", label: "Enviar imediatamente" },
  { value: "10min", label: "10 minutos antes" },
  { value: "1hour", label: "1 hora antes" },
  { value: "1day", label: "1 dia antes" },
];

const DEFAULT_EMAIL_TEMPLATE = `Olá {nome},

Sua reunião está confirmada!

📅 Data: {data}
⏰ Horário: {horario}
🔗 Link: {link}

Clique no link acima para entrar na reunião no horário agendado.

Até lá!`;

interface MeetingPreferencesCardProps {
  meetingPlatform?: string;
  meetingEmailAdvance?: string;
  meetingEmailTemplate?: string;
  onUpdate?: () => void;
}

export function MeetingPreferencesCard({ 
  meetingPlatform = "google", 
  meetingEmailAdvance = "immediate", 
  meetingEmailTemplate = DEFAULT_EMAIL_TEMPLATE,
  onUpdate 
}: MeetingPreferencesCardProps) {
  const { currentUser } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [platform, setPlatform] = useState(meetingPlatform);
  const [emailAdvance, setEmailAdvance] = useState(meetingEmailAdvance);
  const [emailTemplate, setEmailTemplate] = useState(meetingEmailTemplate || DEFAULT_EMAIL_TEMPLATE);

  const handleSave = async () => {
    if (!currentUser?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({
          meeting_platform: platform,
          meeting_email_advance: emailAdvance,
          meeting_email_template: emailTemplate,
        })
        .eq("id", currentUser.id);

      if (error) throw error;

      toast.success("Preferências de reunião salvas!");
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving meeting preferences:", error);
      toast.error(error.message || "Erro ao salvar preferências");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <CardTitle>Configurações de Reunião Online</CardTitle>
        </div>
        <CardDescription>
          Configure suas preferências padrão para reuniões de vídeo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Plataforma Favorita
            </Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a plataforma" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Antecedência do Email
            </Label>
            <Select value={emailAdvance} onValueChange={setEmailAdvance}>
              <SelectTrigger>
                <SelectValue placeholder="Quando enviar o convite" />
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
        </div>

        <div className="space-y-2">
          <Label>Template do Email de Convite</Label>
          <Textarea
            value={emailTemplate}
            onChange={(e) => setEmailTemplate(e.target.value)}
            placeholder="Digite o template do email..."
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Variáveis disponíveis: {"{nome}"}, {"{data}"}, {"{horario}"}, {"{link}"}
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Preferências
        </Button>
      </CardContent>
    </Card>
  );
}
