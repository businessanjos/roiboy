import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Webhook {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  url: string;
  method: string;
  headers: Record<string, string>;
  payload_template: Record<string, unknown> | null;
  is_active: boolean;
  trigger_event: string | null;
  secret_key: string | null;
  last_triggered_at: string | null;
  last_status_code: number | null;
  created_at: string;
  updated_at: string;
}

export type WebhookFormData = {
  name: string;
  description: string;
  url: string;
  method: string;
  headers: string;
  payload_template: string;
  is_active: boolean;
  trigger_event: string;
  secret_key: string;
};

export const WEBHOOK_METHODS = [
  { value: "GET", label: "GET", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "POST", label: "POST", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "PUT", label: "PUT", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { value: "PATCH", label: "PATCH", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "DELETE", label: "DELETE", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
];

export const WEBHOOK_EVENTS = [
  { value: "client.created", label: "Cliente criado" },
  { value: "client.updated", label: "Cliente atualizado" },
  { value: "client.deleted", label: "Cliente excluído" },
  { value: "event.created", label: "Evento criado" },
  { value: "event.updated", label: "Evento atualizado" },
  { value: "task.completed", label: "Tarefa concluída" },
  { value: "form.submitted", label: "Formulário enviado" },
  { value: "contract.signed", label: "Contrato assinado" },
  { value: "payment.received", label: "Pagamento recebido" },
  { value: "manual", label: "Manual (API)" },
];

export function useWebhooks(accountId: string | null) {
  return useQuery({
    queryKey: ["webhooks", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as Webhook[];
    },
    enabled: !!accountId,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ accountId, data }: { accountId: string; data: WebhookFormData }) => {
      let headers = {};
      let payload_template = null;

      try {
        if (data.headers.trim()) {
          headers = JSON.parse(data.headers);
        }
      } catch {
        throw new Error("Headers JSON inválido");
      }

      try {
        if (data.payload_template.trim() && ["POST", "PUT", "PATCH"].includes(data.method)) {
          payload_template = JSON.parse(data.payload_template);
        }
      } catch {
        throw new Error("Payload Template JSON inválido");
      }

      const { error } = await supabase.from("webhooks").insert({
        account_id: accountId,
        name: data.name.trim(),
        description: data.description.trim() || null,
        url: data.url.trim(),
        method: data.method,
        headers,
        payload_template,
        is_active: data.is_active,
        trigger_event: data.trigger_event || null,
        secret_key: data.secret_key.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar webhook", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WebhookFormData }) => {
      let headers = {};
      let payload_template = null;

      try {
        if (data.headers.trim()) {
          headers = JSON.parse(data.headers);
        }
      } catch {
        throw new Error("Headers JSON inválido");
      }

      try {
        if (data.payload_template.trim() && ["POST", "PUT", "PATCH"].includes(data.method)) {
          payload_template = JSON.parse(data.payload_template);
        }
      } catch {
        throw new Error("Payload Template JSON inválido");
      }

      const { error } = await supabase
        .from("webhooks")
        .update({
          name: data.name.trim(),
          description: data.description.trim() || null,
          url: data.url.trim(),
          method: data.method,
          headers,
          payload_template,
          is_active: data.is_active,
          trigger_event: data.trigger_event || null,
          secret_key: data.secret_key.trim() || null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar webhook", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook excluído!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir webhook", variant: "destructive" });
    },
  });
}

export function useTestWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (webhook: Webhook) => {
      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers: {
          "Content-Type": "application/json",
          ...webhook.headers,
        },
        body: ["POST", "PUT", "PATCH"].includes(webhook.method) 
          ? JSON.stringify(webhook.payload_template || { test: true, timestamp: new Date().toISOString() })
          : undefined,
      });

      // Update last triggered info
      await supabase
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status_code: response.status,
        })
        .eq("id", webhook.id);

      return { status: response.status, ok: response.ok };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      if (result.ok) {
        toast({ title: "Webhook testado!", description: `Status: ${result.status}` });
      } else {
        toast({ title: "Webhook retornou erro", description: `Status: ${result.status}`, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao testar webhook", description: error.message, variant: "destructive" });
    },
  });
}
