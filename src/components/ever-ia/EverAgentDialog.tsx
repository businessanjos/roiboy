import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  system_prompt: string | null;
  greeting_message: string | null;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  is_enabled: boolean;
  personality: string | null;
  sector_id: string;
}

interface Props {
  agent: Agent | null;
  sectors: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Rápido)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Equilibrado)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Avançado)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini (Eficiente)" },
  { value: "openai/gpt-5", label: "GPT-5 (Premium)" },
];

export function EverAgentDialog({ agent, sectors, open, onOpenChange, onSaved }: Props) {
  const isEditing = !!agent;
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState(agent?.display_name || "");
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [sectorId, setSectorId] = useState(agent?.sector_id || "");
  const [model, setModel] = useState(agent?.model || "google/gemini-3-flash-preview");
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7);
  const [personality, setPersonality] = useState(agent?.personality || "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [greetingMessage, setGreetingMessage] = useState(agent?.greeting_message || "");

  async function handleSave() {
    if (!displayName.trim() || !sectorId) {
      toast.error("Preencha o nome e selecione um setor");
      return;
    }

    setSaving(true);
    const payload = {
      display_name: displayName.trim(),
      name: name.trim() || displayName.trim().toLowerCase().replace(/\s+/g, "_"),
      description: description.trim() || null,
      sector_id: sectorId,
      model,
      temperature,
      personality: personality.trim() || null,
      system_prompt: systemPrompt.trim() || null,
      greeting_message: greetingMessage.trim() || null,
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase
        .from("ai_sector_agents")
        .update(payload)
        .eq("id", agent.id));
    } else {
      ({ error } = await supabase.from("ai_sector_agents").insert(payload));
    }

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar agente: " + error.message);
      return;
    }

    toast.success(isEditing ? "Agente atualizado" : "Agente criado");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Agente" : "Novo Agente de IA"}</DialogTitle>
          <DialogDescription>
            Configure o comportamento e personalidade do agente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome de exibição *</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Atendente Virtual"
              />
            </div>
            <div className="space-y-2">
              <Label>Setor *</Label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do papel do agente"
            />
          </div>

          <div className="space-y-2">
            <Label>Personalidade</Label>
            <Input
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Ex: Profissional, amigável e proativo"
            />
          </div>

          {/* AI Config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temperatura: {temperature.toFixed(1)}</Label>
              <Slider
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
                min={0}
                max={1}
                step={0.1}
                className="mt-3"
              />
              <p className="text-xs text-muted-foreground">
                0 = preciso, 1 = criativo
              </p>
            </div>
          </div>

          {/* Prompts */}
          <div className="space-y-2">
            <Label>Prompt do sistema</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Instruções detalhadas para o agente. Ex: Você é um atendente da empresa X, especializado em..."
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de saudação</Label>
            <Textarea
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              placeholder="Mensagem enviada automaticamente quando a IA inicia o atendimento"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar" : "Criar Agente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
