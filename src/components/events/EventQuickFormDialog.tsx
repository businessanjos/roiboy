import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
import { eventTypeConfig, getEventTypesForCategory, getEventTypeConfig } from "@/config/eventTypes";

export interface QuickEvent {
  id?: string;
  title: string;
  event_type: string;
  modality: "online" | "presencial";
  scheduled_at: string | null;
  ends_at: string | null;
  address: string | null;
  description: string | null;
  color: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: QuickEvent | null;
  defaultYear?: number;
  onSaved?: () => void;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): string | null {
  if (!s) return null;
  return new Date(s).toISOString();
}

export function EventQuickFormDialog({ open, onOpenChange, event, defaultYear, onSaved }: Props) {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("live");
  const [modality, setModality] = useState<"online" | "presencial">("online");
  const [scheduledAt, setScheduledAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title ?? "");
      setEventType(event.event_type ?? "live");
      setModality(event.modality ?? "online");
      setScheduledAt(toLocalInput(event.scheduled_at));
      setEndsAt(toLocalInput(event.ends_at));
      setAddress(event.address ?? "");
      setDescription(event.description ?? "");
      setColor(event.color ?? "");
    } else {
      setTitle("");
      setEventType("live");
      setModality("online");
      const y = defaultYear ?? new Date().getFullYear();
      const now = new Date();
      const target = new Date(y, now.getMonth(), now.getDate(), 9, 0);
      setScheduledAt(toLocalInput(target.toISOString()));
      setEndsAt("");
      setAddress("");
      setDescription("");
      setColor("");
    }
  }, [open, event, defaultYear]);

  const types = getEventTypesForCategory("all");

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      title: title.trim(),
      event_type: eventType,
      modality,
      scheduled_at: fromLocalInput(scheduledAt),
      ends_at: fromLocalInput(endsAt),
      address: address.trim() || null,
      description: description.trim() || null,
      color: color || getEventTypeConfig(eventType).defaultColor,
    };

    let error;
    if (event?.id) {
      ({ error } = await supabase.from("events").update(payload).eq("id", event.id));
    } else {
      payload.account_id = currentUser.account_id;
      ({ error } = await supabase.from("events").insert(payload));
    }
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: event?.id ? "Evento atualizado" : "Evento criado" });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{event?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            Cadastro rápido para o calendário anual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do evento" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>{eventTypeConfig[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modalidade</Label>
              <Select value={modality} onValueChange={(v) => setModality(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim (opcional)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          {modality === "presencial" && (
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Local do evento" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={color || getEventTypeConfig(eventType).defaultColor}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 p-1"
              />
              <span className="text-xs text-muted-foreground">
                Padrão do tipo: {getEventTypeConfig(eventType).defaultColor}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : event?.id ? "Salvar alterações" : "Criar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
