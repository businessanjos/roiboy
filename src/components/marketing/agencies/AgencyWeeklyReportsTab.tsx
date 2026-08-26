import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus, Trophy, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { getPublicOrigin } from "@/lib/publicLink";
import { useTrafficAgency } from "@/hooks/useTrafficAgencies";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAgencyWeeklyReports, type AgencyWeeklyReport } from "@/hooks/useAgencyWeeklyReports";
import { AgencyWeeklyReportDialog } from "./AgencyWeeklyReportDialog";

const fmtBRL = (v?: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v?: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const fmtNum = (v?: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR"));

function Delta({ current, previous, invert }: { current?: number | null; previous?: number | null; invert?: boolean }) {
  if (current == null || previous == null || previous === 0) return null;
  const diff = ((current - previous) / previous) * 100;
  const good = invert ? diff < 0 : diff > 0;
  const Icon = Math.abs(diff) < 0.01 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  const color = Math.abs(diff) < 0.01 ? "text-muted-foreground" : good ? "text-success" : "text-danger";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(diff).toFixed(1)}%
    </span>
  );
}

function Metric({
  label, value, current, previous, invert,
}: { label: string; value: string; current?: number | null; previous?: number | null; invert?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-lg font-bold">{value}</span>
        <Delta current={current} previous={previous} invert={invert} />
      </div>
    </div>
  );
}

function TextSection({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </div>
  );
}

export function AgencyWeeklyReportsTab({ agencyId, color = "#6366f1" }: { agencyId: string; color?: string }) {
  const { reports, isLoading, save, remove } = useAgencyWeeklyReports(agencyId);
  const { data: agency } = useTrafficAgency(agencyId);
  const publicUrl = agency?.public_report_token
    ? `${getPublicOrigin()}/relatorio-agencia/${agency.public_report_token}`
    : null;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyWeeklyReport | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const chartData = useMemo(
    () =>
      [...reports]
        .sort((a, b) => a.week_start.localeCompare(b.week_start))
        .map((r) => ({
          week: format(parseISO(r.week_start), "dd/MM", { locale: ptBR }),
          investimento: Number(r.spend) || 0,
          leads: r.leads_total,
          mql: r.leads_mql,
          cpl: r.cpl != null ? Number(r.cpl) : null,
          cpmql: r.cost_per_mql != null ? Number(r.cost_per_mql) : null,
          ctr: r.ctr != null ? Number(r.ctr) : null,
        })),
    [reports],
  );

  const latest = reports[0];
  const previous = reports[1];

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (r: AgencyWeeklyReport) => { setEditing(r); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Relatórios semanais</h3>
          <p className="text-xs text-muted-foreground">Histórico das métricas enviadas pela agência</p>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado — envie para a agência preencher");
              }}
            >
              <Link2 className="mr-1 h-4 w-4" /> Copiar link da agência
            </Button>
          )}
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Novo relatório
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum relatório semanal registrado ainda.</p>
            <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Registrar primeiro relatório</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {latest && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Última semana · {format(parseISO(latest.week_start), "dd/MM", { locale: ptBR })} – {format(parseISO(latest.week_end), "dd/MM/yyyy", { locale: ptBR })}
                  {previous && <span className="ml-2 text-xs font-normal text-muted-foreground">vs. semana anterior</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                <Metric label="Investimento" value={fmtBRL(latest.spend)} current={latest.spend} previous={previous?.spend} />
                <Metric label="Impressões" value={fmtNum(latest.impressions)} current={latest.impressions} previous={previous?.impressions} />
                <Metric label="CTR" value={fmtPct(latest.ctr)} current={latest.ctr} previous={previous?.ctr} />
                <Metric label="Leads gerais" value={fmtNum(latest.leads_total)} current={latest.leads_total} previous={previous?.leads_total} />
                <Metric label="MQL" value={fmtNum(latest.leads_mql)} current={latest.leads_mql} previous={previous?.leads_mql} />
                <Metric label="Taxa de MQL" value={fmtPct(latest.mql_rate)} current={latest.mql_rate} previous={previous?.mql_rate} />
                <Metric label="CPL" value={fmtBRL(latest.cpl)} current={latest.cpl} previous={previous?.cpl} invert />
                <Metric label="Custo por MQL" value={fmtBRL(latest.cost_per_mql)} current={latest.cost_per_mql} previous={previous?.cost_per_mql} invert />
                <Metric label="CPM" value={fmtBRL(latest.cpm)} current={latest.cpm} previous={previous?.cpm} invert />
                <Metric label="Connect Rate" value={fmtPct(latest.connect_rate)} current={latest.connect_rate} previous={previous?.connect_rate} />
                <Metric label="Conversão LP → Lead" value={fmtPct(latest.lp_conversion_rate)} current={latest.lp_conversion_rate} previous={previous?.lp_conversion_rate} />
                <Metric label="Cliques no link" value={fmtNum(latest.link_clicks)} current={latest.link_clicks} previous={previous?.link_clicks} />
              </CardContent>
            </Card>
          )}

          {reports.length > 1 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Investimento × Leads × MQL</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid opacity={0.3} stroke="hsl(var(--hairline))" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="l" dataKey="investimento" name="Investimento (R$)" fill={color} radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="r" dataKey="leads" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="r" dataKey="mql" name="MQL" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Eficiência (CPL, custo por MQL, CTR)</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid opacity={0.3} stroke="hsl(var(--hairline))" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="l" type="monotone" dataKey="cpl" name="CPL (R$)" stroke="#f59e0b" />
                      <Line yAxisId="l" type="monotone" dataKey="cpmql" name="Custo por MQL (R$)" stroke="#ef4444" />
                      <Line yAxisId="r" type="monotone" dataKey="ctr" name="CTR (%)" stroke="#10b981" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-3">
            {reports.map((r) => {
              const isOpen = expanded === r.id;
              return (
                <Card key={r.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
                    <button className="flex-1 text-left" onClick={() => setExpanded(isOpen ? null : r.id)}>
                      <CardTitle className="text-sm">
                        {format(parseISO(r.week_start), "dd/MM", { locale: ptBR })} – {format(parseISO(r.week_end), "dd/MM/yyyy", { locale: ptBR })}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{fmtBRL(r.spend)}</Badge>
                        <Badge variant="outline">{fmtNum(r.leads_total)} leads</Badge>
                        <Badge variant="outline">{fmtNum(r.leads_mql)} MQL</Badge>
                        <Badge variant="outline">CPL {fmtBRL(r.cpl)}</Badge>
                      </div>
                    </button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="space-y-4 border-t pt-4">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Metric label="Impressões" value={fmtNum(r.impressions)} />
                        <Metric label="Cliques no link" value={fmtNum(r.link_clicks)} />
                        <Metric label="Visualizações de página" value={fmtNum(r.page_views)} />
                        <Metric label="CTR" value={fmtPct(r.ctr)} />
                        <Metric label="Connect Rate" value={fmtPct(r.connect_rate)} />
                        <Metric label="Taxa de MQL" value={fmtPct(r.mql_rate)} />
                        <Metric label="Conversão LP → Lead" value={fmtPct(r.lp_conversion_rate)} />
                        <Metric label="CPM" value={fmtBRL(r.cpm)} />
                      </div>
                      {r.best_creative_name && (
                        <div className="rounded-lg border bg-warning-soft p-3 dark:bg-warning/20">
                          <p className="flex items-center gap-1.5 text-xs font-semibold">
                            <Trophy className="h-3.5 w-3.5 text-warning" /> Melhor criativo
                          </p>
                          <p className="mt-1 text-sm font-medium">{r.best_creative_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtBRL(r.best_creative_spend)} · {fmtNum(r.best_creative_mqls)} MQL · CPA {fmtBRL(r.best_creative_cpa)}
                          </p>
                          {r.best_creative_url && (
                            <a href={r.best_creative_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              Ver criativo <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {r.best_creative_notes && <p className="mt-1 whitespace-pre-wrap text-sm">{r.best_creative_notes}</p>}
                        </div>
                      )}
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextSection title="Comparação com a semana anterior" body={r.comparison_notes} />
                        <TextSection title="Evolução" body={r.evolution_notes} />
                        <TextSection title="Gargalo" body={r.bottleneck_notes} />
                        <TextSection title="Ações do time" body={r.team_actions} />
                        <TextSection title="Dependências do cliente" body={r.client_dependencies} />
                        <TextSection title="Resumo" body={r.summary} />
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AgencyWeeklyReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agencyId={agencyId}
        report={editing}
        saving={save.isPending}
        onSave={async (values) => {
          await save.mutateAsync(values);
          setDialogOpen(false);
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) remove.mutate(deleteId); setDeleteId(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
