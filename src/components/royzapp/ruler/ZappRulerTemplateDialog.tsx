import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  RULER_PRESETS,
  type RulerTemplate,
  type RulerTemplateStep,
} from "@/hooks/useZappRulers";

interface ZappRulerTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RulerTemplate | null;
  onSave: (input: {
    id?: string;
    name: string;
    description?: string | null;
    default_auto_send: boolean;
    send_window_start: number;
    send_window_end: number;
    stop_on_reply: boolean;
    steps: RulerTemplateStep[];
  }) => Promise<unknown>;
}

const emptyStep = (order: number): RulerTemplateStep => ({
  offset_days: order === 0 ? 1 : order * 7,
  title: `Toque ${order + 1}`,
  message: "",
  sort_order: order,
});

export function ZappRulerTemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
}: ZappRulerTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [autoSend, setAutoSend] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [windowStart, setWindowStart] = useState(9);
  const [windowEnd, setWindowEnd] = useState(20);
  const [steps, setSteps] = useState<RulerTemplateStep[]>([emptyStep(0)]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastTemplateIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = template?.id ?? null;
    const idChanged = id !== lastTemplateIdRef.current;
    if (idChanged) {
      lastTemplateIdRef.current = id;
      setDirty(false);
    }
    // Não sobrescreve edições em andamento quando o template for atualizado
    // em segundo plano (ex.: fetchAll após salvar).
    if (dirty && !idChanged) return;
    setName(template?.name || "");
    setDescription(template?.description || "");
    setAutoSend(template?.default_auto_send ?? true);
    setStopOnReply(template?.stop_on_reply ?? true);
    setWindowStart(template?.send_window_start ?? 9);
    setWindowEnd(template?.send_window_end ?? 20);
    setSteps(template?.steps?.length ? template.steps.map((s) => ({ ...s })) : [emptyStep(0)]);
  }, [open, template]);

  const applyPreset = (presetId: string) => {
    const preset = RULER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSteps(preset.steps.map((s) => ({ ...s })));
    if (!name) setName(preset.label.split(" — ")[0]);
  };

  const updateStep = (index: number, patch: Partial<RulerTemplateStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Dê um nome para a régua");
      return;
    }
    const cleaned = steps.filter((s) => s.message.trim());
    if (cleaned.length === 0) {
      toast.error("Adicione ao menos um toque com mensagem");
      return;
    }
    if (windowEnd <= windowStart) {
      toast.error("A janela de envio precisa terminar depois do início");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: template?.id,
        name,
        description,
        default_auto_send: autoSend,
        send_window_start: windowStart,
        send_window_end: windowEnd,
        stop_on_reply: stopOnReply,
        steps: cleaned,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("[ZappRuler] save template failed", err);
      // O hook já exibe toast de erro/sucesso; aqui só garantimos que o
      // dialog permaneça aberto em caso de falha e libere o loading.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Editar régua" : "Nova régua de relacionamento"}</DialogTitle>
          <DialogDescription>
            Use {"{primeiro_nome}"} ou {"{nome}"} para personalizar as mensagens.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Follow-up comercial" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Quando usar esta cadência"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Começar de um preset</Label>
              <div className="flex flex-wrap gap-2">
                {RULER_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="outline"
                    className="rounded-full h-auto py-2 px-4 text-sm font-normal whitespace-normal text-left justify-start"
                    onClick={() => applyPreset(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Envio automático</p>
                  <p className="text-xs text-muted-foreground">Padrão ao aplicar a régua</p>
                </div>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Parar ao responder</p>
                  <p className="text-xs text-muted-foreground">Cancela os toques restantes</p>
                </div>
                <Switch checked={stopOnReply} onCheckedChange={setStopOnReply} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Janela de envio — início</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={windowStart}
                  onChange={(e) => setWindowStart(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Janela de envio — fim</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Toques</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSteps((prev) => [...prev, emptyStep(prev.length)])}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>

              {steps.map((step, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">D+</span>
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        value={step.offset_days}
                        onChange={(e) => updateStep(idx, { offset_days: Number(e.target.value) })}
                      />
                    </div>
                    <Input
                      className="flex-1"
                      value={step.title}
                      onChange={(e) => updateStep(idx, { title: e.target.value })}
                      placeholder={`Toque ${idx + 1}`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    value={step.message}
                    onChange={(e) => updateStep(idx, { message: e.target.value })}
                    placeholder="Mensagem enviada neste toque"
                  />
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar régua
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
