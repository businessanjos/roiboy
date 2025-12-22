import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Pencil } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  modality: "online" | "presencial";
  address: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  budget: number | null;
  expected_attendees: number | null;
  status: string | null;
}

interface Props {
  event: Event;
  accountId: string | null;
  onUpdate: () => void;
}

export default function EventOverviewTab({ event, accountId, onUpdate }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description || "",
    status: event.status || "draft",
    budget: event.budget?.toString() || "",
    expected_attendees: event.expected_attendees?.toString() || "",
    meeting_url: event.meeting_url || "",
    material_url: event.material_url || "",
    address: event.address || "",
  });

  const handleSave = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from("events")
      .update({
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        expected_attendees: formData.expected_attendees ? parseInt(formData.expected_attendees) : null,
        meeting_url: formData.meeting_url || null,
        material_url: formData.material_url || null,
        address: formData.address || null,
      })
      .eq("id", event.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o evento",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Evento atualizado com sucesso",
      });
      setEditing(false);
      onUpdate();
    }
    
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Informações do Evento</CardTitle>
            <CardDescription>Dados gerais e configurações</CardDescription>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={!editing}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={!editing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="planned">Planejado</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!editing}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Orçamento (R$)</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                disabled={!editing}
                placeholder="0,00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expected_attendees">Participantes Esperados</Label>
              <Input
                id="expected_attendees"
                type="number"
                value={formData.expected_attendees}
                onChange={(e) => setFormData({ ...formData, expected_attendees: e.target.value })}
                disabled={!editing}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meeting_url">Link da Reunião</Label>
              <Input
                id="meeting_url"
                type="url"
                value={formData.meeting_url}
                onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                disabled={!editing}
                placeholder="https://..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="material_url">Link do Material</Label>
              <Input
                id="material_url"
                type="url"
                value={formData.material_url}
                onChange={(e) => setFormData({ ...formData, material_url: e.target.value })}
                disabled={!editing}
                placeholder="https://..."
              />
            </div>
          </div>

          {event.modality === "presencial" && (
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!editing}
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
