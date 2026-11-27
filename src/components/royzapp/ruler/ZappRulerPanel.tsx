import { useEffect, useMemo, useState } from "react";
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
  ArrowDownUp,
  CalendarClock,
  Check,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Search,
  SkipForward,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_RULER_FILTERS,
  filterAndSortRulerRows,
  matchesRulerSearch,
  rulerDayKey,
  type RulerFilterState,
  type RulerPeriod,
  type RulerSort,
} from "@/lib/zappRulerFilters";
import { RulerEnrollmentDetailDialog } from "./RulerEnrollmentDetailDialog";
import { useZappRulers, type RulerTemplate, type RulerEnrollment } from "@/hooks/useZappRulers";
import { ZappRulerTemplateDialog } from "./ZappRulerTemplateDialog";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";

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
    deleteTouch,
    contactExtras,
  } = useZappRulers(sectorId, { withContactExtras: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RulerTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RulerTemplate | null>(null);
  const [deleteEnrollTarget, setDeleteEnrollTarget] = useState<RulerEnrollment | null>(null);

  const [tab, setTab] = useState("fila");
  const [filters, setFilters] = useState<RulerFilterState>(DEFAULT_RULER_FILTERS);
  const [detailId, setDetailId] = useState<string | null>(null);
  const setFilter = (patch: Partial<RulerFilterState>) => setFilters((prev) => ({ ...prev, ...patch }));

  const todayKey = rulerDayKey(new Date());
  const templateNames = useMemo(
    () =>
      Array.from(new Set(enrollments.map((e) => e.template_name).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [enrollments],
  );

  // Fila: a data é o vencimento do toque. Ativas: a data é a próxima atividade em aberto.
  const filaRows = useMemo(
    () =>
      filterAndSortRulerRows(
        pendingManualTouches,
        (row) => ({ enrollment: row.enrollment, date: row.touch.scheduled_at }),
        filters,
        contactExtras,
        todayKey,
      ),
    [pendingManualTouches, filters, contactExtras, todayKey],
  );
  const ativasRows = useMemo(
    () =>
      filterAndSortRulerRows(
        enrollments,
        (enrollment) => ({
          enrollment,
          date: enrollment.touches.find((t) => t.status === "pending")?.scheduled_at ?? null,
        }),
        filters,
        contactExtras,
        todayKey,
      ),
    [enrollments, filters, contactExtras, todayKey],
  );
  const modeloRows = useMemo(
    () =>
      templates.filter((t) =>
        matchesRulerSearch(
          { id: t.id, contact_name: t.name, contact_phone: "", template_name: t.description },
          undefined,
          filters.query,
        ),
      ),
    [templates, filters.query],
  );

  const filtering =
    filters.query.trim() !== "" || filters.template !== "all" || filters.period !== "all";
  const detailEnrollment = detailId ? enrollments.find((e) => e.id === detailId) ?? null : null;

  const filaPg = usePagedList(filaRows, { resetKey: ["fila", filters], isLoading: loading });
  const ativasPg = usePagedList(ativasRows, { resetKey: ["ativas", filters], isLoading: loading });
  const modelosPg = usePagedList(modeloRows, { resetKey: ["modelos", filters.query], isLoading: loading });

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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fila">Fila de hoje ({pendingManualTouches.length})</TabsTrigger>
          <TabsTrigger value="ativas">Ativas ({activeEnrollments.length})</TabsTrigger>
          <TabsTrigger value="modelos">Modelos ({templates.length})</TabsTrigger>
        </TabsList>

        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.query}
                onChange={(e) => setFilter({ query: e.target.value })}
                placeholder={
                  tab === "modelos" ? "Buscar modelo pelo nome" : "Buscar por nome, telefone, e-mail ou régua"
                }
                aria-label="Buscar nas réguas"
                className="h-9 pl-9 pr-9"
              />
              {filters.query && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setFilter({ query: "" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {tab !== "modelos" && (
              <>
                <Select value={filters.template} onValueChange={(v) => setFilter({ template: v })}>
                  <SelectTrigger className="h-9 w-full sm:w-[200px]" aria-label="Filtrar por régua">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as réguas</SelectItem>
                    {templateNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.period} onValueChange={(v) => setFilter({ period: v as RulerPeriod })}>
                  <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] sm:w-[170px]" aria-label="Filtrar por data">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo o período</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Esta semana</SelectItem>
                    <SelectItem value="month">Este mês</SelectItem>
                    <SelectItem value="custom">Escolher datas</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.sort} onValueChange={(v) => setFilter({ sort: v as RulerSort })}>
                  <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] sm:w-[190px]" aria-label="Ordenar">
                    <ArrowDownUp className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_asc">Data mais antiga</SelectItem>
                    <SelectItem value="date_desc">Data mais recente</SelectItem>
                    <SelectItem value="name_asc">Nome de A a Z</SelectItem>
                    <SelectItem value="name_desc">Nome de Z a A</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {tab !== "modelos" && filters.period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>De</span>
              <Input
                type="date"
                aria-label="Data inicial"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => setFilter({ from: e.target.value })}
                className="h-9 w-[150px]"
              />
              <span>até</span>
              <Input
                type="date"
                aria-label="Data final"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => setFilter({ to: e.target.value })}
                className="h-9 w-[150px]"
              />
            </div>
          )}

          {tab !== "modelos" && filtering && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {tab === "fila"
                  ? `${filaRows.length} de ${pendingManualTouches.length} toques`
                  : `${ativasRows.length} de ${enrollments.length} réguas`}
              </span>
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setFilters((prev) => ({ ...DEFAULT_RULER_FILTERS, sort: prev.sort }))}
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        <TabsContent value="fila" className="space-y-3 pt-3">
          {pendingManualTouches.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum toque manual pendente. Tudo em dia.
            </p>
          ) : filaRows.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum toque encontrado com essa busca ou filtro.
            </p>
          ) : (
            <>
            {filaPg.items.map(({ touch, enrollment }) => (
              <Card key={touch.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setDetailId(enrollment.id)}
                        className="block max-w-full truncate text-left text-sm font-medium hover:text-primary hover:underline"
                      >
                        {enrollment.contact_name || enrollment.contact_phone}
                      </button>
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
                  <div className="flex flex-wrap gap-2">
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
                    <Button size="sm" variant="ghost" onClick={() => setDetailId(enrollment.id)}>
                      <ListChecks className="h-4 w-4 mr-1" /> Ver régua
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <PagerFor state={filaPg} itemLabel="toques" />
            </>
          )}
        </TabsContent>

        <TabsContent value="ativas" className="space-y-3 pt-3">
          {enrollments.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum contato em régua ainda. Abra uma conversa e use "Régua" no cabeçalho.
            </p>
          ) : ativasRows.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhuma régua encontrada com essa busca ou filtro.
            </p>
          ) : (
            <>
            {ativasPg.items.map((enrollment) => {
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
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setDetailId(enrollment.id)}>
                        <ListChecks className="h-4 w-4 mr-1" /> Ver atividades
                      </Button>
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
            })}
            <PagerFor state={ativasPg} itemLabel="réguas ativas" />
            </>
          )}
        </TabsContent>

        <TabsContent value="modelos" className="space-y-3 pt-3">
          {templates.length > 0 && modeloRows.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum modelo encontrado com essa busca.
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-zapp-text-muted py-8 text-center">
              Nenhum modelo criado. Comece com um preset em "Nova régua".
            </p>
          ) : (
            <>
            {modelosPg.items.map((template) => (
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
            ))}
            <PagerFor state={modelosPg} itemLabel="modelos" />
            </>
          )}
        </TabsContent>
      </Tabs>

      <RulerEnrollmentDetailDialog
        enrollment={detailEnrollment}
        onOpenChange={(o) => !o && setDetailId(null)}
        onComplete={markTouchDone}
        onDelete={deleteTouch}
        onCancelEnrollment={cancelEnrollment}
      />

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

      <AlertDialog
        open={!!deleteEnrollTarget}
        onOpenChange={(o) => !o && setDeleteEnrollTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir régua de {deleteEnrollTarget?.contact_name || deleteEnrollTarget?.contact_phone}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todos os toques agendados deste contato serão apagados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteEnrollTarget) return;
                try {
                  await deleteEnrollment(deleteEnrollTarget.id);
                } catch (err) {
                  console.error("[ZappRuler] delete enrollment failed", err);
                } finally {
                  setDeleteEnrollTarget(null);
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
