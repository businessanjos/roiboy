import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Loader2 } from "lucide-react";

interface DuplicateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  /** Redireciona para o novo evento ao concluir (default: true) */
  navigateOnSuccess?: boolean;
  onDuplicated?: (newEventId: string) => void;
}

type CopyOptions = {
  schedule: boolean;
  checklist: boolean;
  costs: boolean;
  team: boolean;
  products: boolean;
};

const DEFAULT_OPTIONS: CopyOptions = {
  schedule: true,
  checklist: true,
  costs: true,
  team: true,
  products: true,
};

/** Campos que nunca devem ser copiados de uma edição para outra. */
const EXCLUDED_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "checkin_code",
  "public_registration_code",
  "scheduled_at",
  "ends_at",
  "status",
  "rsvp_closed",
  "rsvp_deadline",
]);

export default function DuplicateEventDialog({
  open,
  onOpenChange,
  eventId,
  navigateOnSuccess = true,
  onDuplicated,
}: DuplicateEventDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [options, setOptions] = useState<CopyOptions>(DEFAULT_OPTIONS);
  const [source, setSource] = useState<any>(null);

  useEffect(() => {
    if (!open || !eventId) return;
    setOptions(DEFAULT_OPTIONS);
    (async () => {
      const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      if (!data) return;
      setSource(data);
      const year = new Date().getFullYear();
      const base = (data.title || "").replace(/\s*[–-]?\s*(19|20)\d{2}\s*$/, "").trim();
      setTitle(`${base} — ${year + (data.scheduled_at && new Date(data.scheduled_at).getFullYear() >= year ? 1 : 0)}`);
      setScheduledAt("");
    })();
  }, [open, eventId]);

  const duration = (() => {
    if (!source?.scheduled_at || !source?.ends_at) return null;
    return new Date(source.ends_at).getTime() - new Date(source.scheduled_at).getTime();
  })();

  const handleDuplicate = async () => {
    if (!source || !title.trim()) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = {};
      Object.entries(source).forEach(([k, v]) => {
        if (!EXCLUDED_FIELDS.has(k)) payload[k] = v;
      });
      payload.title = title.trim();
      payload.status = "draft";
      if (scheduledAt) {
        const start = new Date(scheduledAt);
        payload.scheduled_at = start.toISOString();
        if (duration && duration > 0) {
          payload.ends_at = new Date(start.getTime() + duration).toISOString();
        }
      }

      const { data: created, error } = await supabase
        .from("events")
        .insert(payload as any)
        .select("id")
        .single();
      if (error) throw error;

      const newId = created.id as string;
      const accountId = source.account_id as string;

      const tasks: Promise<any>[] = [];

      if (options.schedule) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from("event_schedule")
              .select("title, description, start_time, end_time, location, speaker, notes, display_order")
              .eq("event_id", eventId!);
            if (data?.length) {
              await supabase
                .from("event_schedule")
                .insert(data.map((r) => ({ ...r, event_id: newId, account_id: accountId })) as any);
            }
          })(),
        );
      }

      if (options.checklist) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from("event_checklist")
              .select("title, description, category, priority, display_order, assigned_to")
              .eq("event_id", eventId!);
            if (data?.length) {
              await supabase.from("event_checklist").insert(
                data.map((r) => ({
                  ...r,
                  event_id: newId,
                  account_id: accountId,
                  status: "pending",
                })) as any,
              );
            }
          })(),
        );
      }

      if (options.costs) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from("event_costs")
              .select("description, category, estimated_value, actual_value, supplier, notes")
              .eq("event_id", eventId!);
            if (data?.length) {
              await supabase.from("event_costs").insert(
                data.map((r: any) => ({
                  description: r.description,
                  category: r.category,
                  // valores realizados viram estimativa da nova edição
                  estimated_value: Number(r.actual_value) || Number(r.estimated_value) || 0,
                  supplier: r.supplier,
                  notes: r.notes,
                  status: "estimated",
                  event_id: newId,
                  account_id: accountId,
                })) as any,
              );
            }
          })(),
        );
      }

      if (options.team) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from("event_team")
              .select("user_id, role, role_description, responsibilities, is_primary, is_external")
              .eq("event_id", eventId!);
            if (data?.length) {
              await supabase
                .from("event_team")
                .insert(data.map((r) => ({ ...r, event_id: newId, account_id: accountId })) as any);
            }
          })(),
        );
      }

      if (options.products) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from("event_products")
              .select("product_id")
              .eq("event_id", eventId!);
            if (data?.length) {
              await supabase
                .from("event_products")
                .insert(data.map((r) => ({ ...r, event_id: newId, account_id: accountId })) as any);
            }
          })(),
        );
      }

      await Promise.all(tasks);

      toast({
        title: "Evento duplicado",
        description: "Nova edição criada como rascunho.",
      });
      onOpenChange(false);
      onDuplicated?.(newId);
      if (navigateOnSuccess) navigate(`/events/${newId}`);
    } catch (e: any) {
      toast({
        title: "Erro ao duplicar evento",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: keyof CopyOptions) => (v: boolean | string) =>
    setOptions((o) => ({ ...o, [key]: !!v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Duplicar evento
          </DialogTitle>
          <DialogDescription>
            Cria uma nova edição a partir de {source?.title ? `"${source.title}"` : "uma edição anterior"}.
            Participantes, presenças e mídias não são copiados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dup-title">Nome da nova edição</Label>
            <Input id="dup-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dup-date">Nova data (opcional)</Label>
            <Input
              id="dup-date"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sem data definida, a edição fica em "Planejar" até você agendar.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Copiar desta edição</Label>
            {(
              [
                ["schedule", "Cronograma"],
                ["checklist", "Checklist (como pendente)"],
                ["costs", "Custos (como estimativa)"],
                ["team", "Equipe"],
                ["products", "Produtos vinculados"],
              ] as [keyof CopyOptions, string][]
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox id={`dup-${key}`} checked={options[key]} onCheckedChange={toggle(key)} />
                <Label htmlFor={`dup-${key}`} className="font-normal text-sm">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} disabled={loading || !title.trim() || !source}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
