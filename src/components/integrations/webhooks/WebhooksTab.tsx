import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Webhook, Loader2 } from "lucide-react";
import { useWebhooks, Webhook as WebhookType } from "./useWebhooks";
import { WebhookCard } from "./WebhookCard";
import { WebhookFormDialog } from "./WebhookFormDialog";

interface WebhooksTabProps {
  accountId: string | null;
}

export function WebhooksTab({ accountId }: WebhooksTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null);
  
  const { data: webhooks = [], isLoading } = useWebhooks(accountId);

  const handleCreate = () => {
    setEditingWebhook(null);
    setDialogOpen(true);
  };

  const handleEdit = (webhook: WebhookType) => {
    setEditingWebhook(webhook);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingWebhook(null);
  };

  if (!accountId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Webhook className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>
                  Configure webhooks para integrar com sistemas externos
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Webhook
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && webhooks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-muted rounded-full">
                <Webhook className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Nenhum webhook configurado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie seu primeiro webhook para integrar com sistemas externos
                </p>
              </div>
              <Button onClick={handleCreate} className="mt-2 gap-2">
                <Plus className="h-4 w-4" />
                Criar Webhook
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook List */}
      {!isLoading && webhooks.length > 0 && (
        <div className="grid gap-3">
          {webhooks.map((webhook) => (
            <WebhookCard 
              key={webhook.id} 
              webhook={webhook} 
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <WebhookFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        webhook={editingWebhook}
        accountId={accountId}
      />
    </div>
  );
}
