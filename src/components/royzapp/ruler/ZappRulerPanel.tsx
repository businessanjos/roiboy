import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  CalendarClock,
  Check,
  Loader2,
  Pencil,
  Plus,
  SkipForward,
  Trash2,
  XCircle,
} from "lucide-react";
import { useZappRulers, type RulerTemplate, type RulerEnrollment } from "@/hooks/useZappRulers";
import { ZappRulerTemplateDialog } from "./ZappRulerTemplateDialog";

interface ZappRulerPanelProps {
  sectorId?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ZappRulerPanel({ sectorId }: ZappRulerPanelProps) {
  const {
    loading,
    templates,
    enrollments,
    activeEnrollments,
    pendingManualTouches,
    saveTemplate,
    deleteTemplate,
    deleteEnrollment,
    cancelEnrollment,
    markTouchDone,
    skipTouch,
  } = useZappRulers(sectorId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RulerTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RulerTemplate | null>(null);

  // Mantém o estado de edição sincronizado com a lista atualizada,
  // mesmo quando o diálogo de detalhe está aberto.
  useEffect(() => {
    if (!editing) return;
    const fresh = templates.find((t) => t.id === editing.id);
    if (fresh && fresh !== editing) {
      setEditing(fresh);
    }
  }, [templates, editing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zapp-text-muted">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando réguas...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zapp-text flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Régua de relacionamento
          </h2>
          <p className="text-xs text-zapp-text-muted">
            Cadências programadas de follow-up por WhatsApp neste setor.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Nova régua
        </Button>
      </div>

      <Tabs defaultValue="fila">
        <TabsList>
          <TabsTrigger value="fila">Fila de hoje ({pendingManualTouches.length})</TabsTrigger>
          <TabsTrigger value="ativas">Ativas ({activeEnrollments.length})</TabsTrigger>
          <TabsTrigger value="modelos">Modelos ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-3 pt-3">
          {pendingManualTouches.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum toque manual pendente. Tudo em dia.
            </p>
          ) : (
            pendingManualTouches.map(({ touch, enrollment }) => (
              <Card key={touch.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {enrollment.contact_name || enrollment.contact_phone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.template_name} · {touch.title} · venceu em {formatDateTime(touch.scheduled_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {touch.is_task && <Badge variant="outline">Atividade</Badge>}
                      <Badge variant="secondary">D+{touch.offset_days}</Badge>
                    </div>
                  </div>
                  {touch.is_task ? (
                    <p className="text-xs text-muted-foreground">
                      Tarefa interna — nenhuma mensagem será enviada.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{touch.message}</p>
                  )}
                  <div className="flex gap-2">
                    {!touch.is_task && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard?.writeText(touch.message);
                          toast.success("Mensagem copiada");
                        }}
                      >
                        Copiar
                      </Button>
                    )}

                    <Button size="sm" onClick={() => markTouchDone(touch.id)}>
                      <Check className="h-4 w-4 mr-1" /> Feito
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => skipTouch(touch.id)}>
                      <SkipForward className="h-4 w-4 mr-1" /> Pular
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="ativas" className="space-y-3 pt-3">
          {enrollments.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum contato em régua ainda. Abra uma conversa e use "Régua" no cabeçalho.
            </p>
          ) : (
            enrollments.map((enrollment) => {
              const sent = enrollment.touches.filter((t) => t.status === "sent").length;
              const next = enrollment.touches.find((t) => t.status === "pending");
              return (
                <Card key={enrollment.id}>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm flex items-center justify-between gap-2">
                      <span className="truncate">
                        {enrollment.contact_name || enrollment.contact_phone}
                      </span>
                      <Badge variant={enrollment.status === "active" ? "default" : "secondary"}>
                        {STATUS_LABEL[enrollment.status] || enrollment.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {enrollment.template_name} · {sent}/{enrollment.touches.length} toques ·{" "}
                      {enrollment.auto_send ? "envio automático" : "manual"}
                    </p>
                    {next && (
                      <p className="text-xs text-muted-foreground">
                        Próximo: {next.title} em {formatDateTime(next.scheduled_at)}
                      </p>
                    )}
                    {enrollment.cancel_reason && (
                      <p className="text-xs text-muted-foreground">Motivo: {enrollment.cancel_reason}</p>
                    )}
                    <div className="flex gap-2">
                      {enrollment.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelEnrollment(enrollment.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Encerrar régua
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteEnrollTarget(enrollment)}
                      >
                        <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Excluir
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="modelos" className="space-y-3 pt-3">
          {templates.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum modelo criado. Comece com um preset em "Nova régua".
            </p>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.steps.length} toques · janela {template.send_window_start}h-
                        {template.send_window_end}h ·{" "}
                        {template.default_auto_send ? "automático" : "manual"}
                      </p>
                      {template.description && (
                        <p className="text-xs text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(template);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(template)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {template.steps.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        D+{s.offset_days}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <ZappRulerTemplateDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        template={editing}
        onSave={saveTemplate}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir régua "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Contatos já em andamento continuam com os toques agendados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteTemplate(deleteTarget.id);
                } catch (err: any) {
                  // O hook já exibe o toast de erro/sucesso.
                  console.error("[ZappRuler] delete failed", err);
                } finally {
                  setDeleteTarget(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
