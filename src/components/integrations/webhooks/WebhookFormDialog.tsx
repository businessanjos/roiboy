import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { 
  Webhook, 
  WebhookFormData, 
  WEBHOOK_METHODS, 
  WEBHOOK_EVENTS, 
  useCreateWebhook, 
  useUpdateWebhook 
} from "./useWebhooks";

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: Webhook | null;
  accountId: string;
}

const defaultFormData: WebhookFormData = {
  name: "",
  description: "",
  url: "",
  method: "POST",
  headers: "{}",
  payload_template: "{}",
  is_active: true,
  trigger_event: "",
  secret_key: "",
};

export function WebhookFormDialog({ open, onOpenChange, webhook, accountId }: WebhookFormDialogProps) {
  const [formData, setFormData] = useState<WebhookFormData>(defaultFormData);
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();

  const isEditing = !!webhook;
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (webhook) {
      setFormData({
        name: webhook.name,
        description: webhook.description || "",
        url: webhook.url,
        method: webhook.method,
        headers: JSON.stringify(webhook.headers || {}, null, 2),
        payload_template: JSON.stringify(webhook.payload_template || {}, null, 2),
        is_active: webhook.is_active,
        trigger_event: webhook.trigger_event || "",
        secret_key: webhook.secret_key || "",
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [webhook, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.url.trim()) return;

    if (isEditing && webhook) {
      await updateMutation.mutateAsync({ id: webhook.id, data: formData });
    } else {
      await createMutation.mutateAsync({ accountId, data: formData });
    }

    onOpenChange(false);
  };

  const updateField = (field: keyof WebhookFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const showPayloadTemplate = ["POST", "PUT", "PATCH"].includes(formData.method);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Webhook" : "Criar Webhook"}</DialogTitle>
          <DialogDescription>
            Configure as opções do seu webhook
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name & Method */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Meu Webhook"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Método HTTP</Label>
              <Select value={formData.method} onValueChange={(v) => updateField("method", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEBHOOK_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className={`font-mono ${m.color.replace('bg-', 'text-').split(' ')[1]}`}>
                        {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => updateField("url", e.target.value)}
              placeholder="https://api.exemplo.com/webhook"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Webhook para notificar sistema externo"
            />
          </div>

          {/* Trigger Event & Secret Key */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trigger_event">Evento Gatilho</Label>
              <Select 
                value={formData.trigger_event || "none"} 
                onValueChange={(v) => updateField("trigger_event", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {WEBHOOK_EVENTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret_key">Secret Key (HMAC)</Label>
              <Input
                id="secret_key"
                type="password"
                value={formData.secret_key}
                onChange={(e) => updateField("secret_key", e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <Label htmlFor="headers">Headers (JSON)</Label>
            <Textarea
              id="headers"
              value={formData.headers}
              onChange={(e) => updateField("headers", e.target.value)}
              placeholder='{"X-Custom-Header": "value"}'
              className="font-mono text-sm min-h-[80px]"
            />
          </div>

          {/* Payload Template - only for methods with body */}
          {showPayloadTemplate && (
            <div className="space-y-2">
              <Label htmlFor="payload_template">Payload Template (JSON)</Label>
              <Textarea
                id="payload_template"
                value={formData.payload_template}
                onChange={(e) => updateField("payload_template", e.target.value)}
                placeholder='{"event": "{{event}}", "data": "{{data}}"}'
                className="font-mono text-sm min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variável}}"} para interpolação de dados.
              </p>
            </div>
          )}

          {/* Active Switch */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Webhook ativo</Label>
              <p className="text-xs text-muted-foreground">
                Desative para pausar o disparo deste webhook
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(v) => updateField("is_active", v)}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !formData.name.trim() || !formData.url.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
