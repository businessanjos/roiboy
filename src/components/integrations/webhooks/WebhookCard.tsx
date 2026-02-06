import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Copy, 
  Pencil, 
  Trash2, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ExternalLink,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Webhook, WEBHOOK_METHODS, WEBHOOK_EVENTS, useDeleteWebhook, useTestWebhook } from "./useWebhooks";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookCardProps {
  webhook: Webhook;
  onEdit: (webhook: Webhook) => void;
}

export function WebhookCard({ webhook, onEdit }: WebhookCardProps) {
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeleteWebhook();
  const testMutation = useTestWebhook();

  const methodConfig = WEBHOOK_METHODS.find(m => m.value === webhook.method);
  const eventLabel = WEBHOOK_EVENTS.find(e => e.value === webhook.trigger_event)?.label || webhook.trigger_event;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhook.url);
    toast({ title: "URL copiada!" });
  };

  const handleTest = () => {
    testMutation.mutate(webhook);
  };

  const handleDelete = () => {
    deleteMutation.mutate(webhook.id);
    setDeleteOpen(false);
  };

  const getStatusCodeColor = (code: number | null) => {
    if (!code) return "text-muted-foreground";
    if (code >= 200 && code < 300) return "text-green-600";
    if (code >= 400) return "text-red-600";
    return "text-yellow-600";
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium truncate">{webhook.name}</h4>
                  <Badge className={methodConfig?.color || ""}>
                    {webhook.method}
                  </Badge>
                  <Badge variant={webhook.is_active ? "default" : "secondary"}>
                    {webhook.is_active ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Ativo</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Inativo</>
                    )}
                  </Badge>
                </div>
                {webhook.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {webhook.description}
                  </p>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleTest}
                  disabled={testMutation.isPending}
                  title="Testar webhook"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(webhook)}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* URL */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
              <code className="text-xs flex-1 truncate text-muted-foreground">
                {webhook.url}
              </code>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyUrl}>
                <Copy className="h-3 w-3" />
              </Button>
              <a 
                href={webhook.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                {webhook.trigger_event && (
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {eventLabel}
                    </Badge>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {webhook.last_triggered_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(webhook.last_triggered_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                    {webhook.last_status_code && (
                      <span className={getStatusCodeColor(webhook.last_status_code)}>
                        ({webhook.last_status_code})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O webhook "{webhook.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
