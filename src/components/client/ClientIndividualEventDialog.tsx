import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateTimeToUTC } from "@/lib/dateUtils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, FileText, Users, Monitor, MapPin, Clock, Calendar } from "lucide-react";

type EventType = "live" | "mentoria" | "workshop" | "masterclass" | "webinar" | "imersao" | "plantao" | "material" | "other";

interface ClientIndividualEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  accountId: string;
  onSuccess?: () => void;
}

export function ClientIndividualEventDialog({
  open,
  onOpenChange,
  clientId,
  accountId,
  onSuccess,
}: ClientIndividualEventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("mentoria");
  const [modality, setModality] = useState<"online" | "presencial">("online");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEventType("mentoria");
    setModality("online");
    setAddress("");
    setScheduledAt("");
    setDurationMinutes("");
    setMeetingUrl("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        modality,
        address: modality === "presencial" ? address.trim() || null : null,
        scheduled_at: scheduledAt ? localDateTimeToUTC(scheduledAt) : null,
        duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
        meeting_url: meetingUrl.trim() || null,
        client_id: clientId,
        account_id: accountId,
      } as any);

      if (error) throw error;

      toast.success("Evento individual criado!");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error("Error creating individual event:", err);
      toast.error("Erro ao criar evento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Evento Individual</DialogTitle>
          <DialogDescription>
            Este evento será exclusivo deste cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ind-title">Título *</Label>
            <Input
              id="ind-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Mentoria Individual - Sessão 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ind-desc">Descrição</Label>
            <Textarea
              id="ind-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o evento..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentoria"><div className="flex items-center gap-2"><Users className="h-4 w-4" />Mentoria</div></SelectItem>
                  <SelectItem value="live"><div className="flex items-center gap-2"><Video className="h-4 w-4" />Live / Encontro</div></SelectItem>
                  <SelectItem value="workshop"><div className="flex items-center gap-2"><Monitor className="h-4 w-4" />Workshop</div></SelectItem>
                  <SelectItem value="plantao"><div className="flex items-center gap-2"><Clock className="h-4 w-4" />Plantão</div></SelectItem>
                  <SelectItem value="material"><div className="flex items-center gap-2"><FileText className="h-4 w-4" />Material</div></SelectItem>
                  <SelectItem value="other"><div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Outro</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Select value={modality} onValueChange={(v) => setModality(v as "online" | "presencial")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online"><div className="flex items-center gap-2"><Monitor className="h-4 w-4" />Online</div></SelectItem>
                  <SelectItem value="presencial"><div className="flex items-center gap-2"><MapPin className="h-4 w-4" />Presencial</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {modality === "presencial" && (
            <div className="space-y-2">
              <Label htmlFor="ind-address">Endereço</Label>
              <Input id="ind-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ind-date">Data e Hora</Label>
              <Input id="ind-date" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ind-duration">Duração (min)</Label>
              <Input id="ind-duration" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="60" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ind-url">Link da Reunião</Label>
            <Input id="ind-url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? "Criando..." : "Criar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
