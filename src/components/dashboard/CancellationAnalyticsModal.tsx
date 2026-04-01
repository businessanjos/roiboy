import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, XCircle, Users, Package, MapPin, Calendar, DollarSign, Clock, AlertTriangle, TrendingDown, BarChart3, Brain, Sparkles } from "lucide-react";
import { format, parseISO, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Only these users can access this modal
const AUTHORIZED_USER_IDS = [
  "de43a643-0109-4afb-ac35-be768dbf4090", // Everton Pieri
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol Parnow
  "c064c5d5-cdb5-47cc-99ce-ad416b6407b1", // Jessica Marcato
];

// Only these consultants should appear in the report
const CONSULTANT_IDS = [
  "01391bfa-5120-4d43-aedd-93e024c78094", // Dayara Grecco
  "e0017d78-21d4-413a-befc-5197df7ad666", // Andréia Barros
  "3f3b5466-4479-48f8-bfe4-d9c4281ddab8", // Michele Santos
  "81da2302-4770-4fd1-9200-c2a8cb3325f3", // Ana Sant Anna
];

export function canAccessCancellationAnalytics(userId?: string): boolean {
  return !!userId && AUTHORIZED_USER_IDS.includes(userId);
}

interface CancellationData {
  id: string;
  client_id: string;
  value: number;
  status: string;
  cancellation_reason: string | null;
  cancellation_justification: string | null;
  cancelled_at: string | null;
  status_changed_at: string | null;
  start_date: string;
  client: { full_name: string; state: string | null } | null;
  product: { name: string } | null;
  responsible_user: { name: string } | null;
}

const PERIOD_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Último ano" },
  { value: "all", label: "Todo o período" },
];

const CANCEL_STATUSES = ["cancelled", "distrato_cancelamento", "distrato_demissao", "desistencia_7d", "dismissed", "dropout_7d"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancellationAnalyticsModal({ open, onOpenChange }: Props) {
  const [data, setData] = useState<CancellationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("6");
  const [programChurn, setProgramChurn] = useState<{ total: number; cancelled: number; rate: number } | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ contractsAnalyzed: number; clientsWithMessages: number; totalMessages: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) fetchData();
  }, [open, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("client_contracts")
        .select(`
          id, client_id, value, status,
          cancellation_reason, cancellation_justification,
          cancelled_at, status_changed_at, start_date,
          client:clients(full_name, state),
          product:products(name)
        `)
        .in("status", CANCEL_STATUSES)
        .is("parent_contract_id", null)
        .order("cancelled_at", { ascending: false });

      if (period !== "all") {
        const months = parseInt(period);
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        query = query.gte("cancelled_at", startDate.toISOString());
      }

      const { data: contracts, error } = await query;
      if (error) throw error;

      // Fetch program-wide churn: active contracts vs cancelled contracts
      const { count: activeCount } = await supabase
        .from("client_contracts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .is("parent_contract_id", null);

      const cancelledCount = (contracts || []).length;
      const active = activeCount || 0;
      const base = active + cancelledCount;
      const rate = base > 0 ? Math.round((cancelledCount / base) * 1000) / 10 : 0;
      setProgramChurn({ total: base, cancelled: cancelledCount, rate });

      // Fetch responsible user for each contract's client
      const clientIds = [...new Set((contracts || []).map(c => c.client_id))];
      let responsibleMap: Record<string, { name: string; id: string }> = {};
      
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, responsible_user_id, responsible:users!clients_responsible_user_id_fkey(name)")
          .in("id", clientIds);
        
        clients?.forEach((c: any) => {
          if (c.responsible?.name && c.responsible_user_id) {
            responsibleMap[c.id] = { name: c.responsible.name, id: c.responsible_user_id };
          }
        });
      }

      // Filter to only include contracts from the 4 consultants
      const filtered = (contracts || []).filter(c => {
        const resp = responsibleMap[c.client_id];
        return resp && CONSULTANT_IDS.includes(resp.id);
      });

      const enriched = filtered.map(c => ({
        ...c,
        responsible_user: responsibleMap[c.client_id] ? { name: responsibleMap[c.client_id].name } : null,
      }));

      setData(enriched as CancellationData[]);
    } catch (err) {
      console.error("Error fetching cancellation analytics:", err);
    } finally {
      setLoading(false);
    }
  };


  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiInsights(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-churn-conversations");
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro na análise", description: data.error, variant: "destructive" });
        return;
      }
      setAiInsights(data.insights);
      setAiMeta(data.meta);
    } catch (err: any) {
      console.error("AI analysis error:", err);
      toast({ title: "Erro ao analisar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatReason = (reason: string): string => {
    const map: Record<string, string> = {
      "financeiro": "Financeiro",
      "problemas_pessoais": "Problemas Pessoais",
      "operacional_financeiro": "Operacional / Financeiro",
      "mudanca_momento": "Mudança de Momento",
      "falta_tempo": "Falta de Tempo",
      "insatisfacao": "Insatisfação",
      "nao_informado": "Não Informado",
      "falta_resultado": "Falta de Resultado",
      "falta_dedicacao": "Falta de Dedicação",
      "migracao_produto": "Migração de Produto",
      "cliente_nao_retorna": "Cliente Não Retorna",
      "inadimplencia": "Inadimplência",
      "outro": "Outro",
    };
    return map[reason.toLowerCase()] || reason.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const analytics = useMemo(() => {
    const totalCount = data.length;
    const totalValue = data.reduce((sum, d) => sum + (d.value || 0), 0);

    // Top consultant (responsible user)
    const consultantCounts: Record<string, number> = {};
    data.forEach(d => {
      const name = d.responsible_user?.name || "Sem responsável";
      consultantCounts[name] = (consultantCounts[name] || 0) + 1;
    });
    const topConsultant = Object.entries(consultantCounts).sort((a, b) => b[1] - a[1]);

    // Top product
    const productCounts: Record<string, number> = {};
    data.forEach(d => {
      const name = d.product?.name || "Sem produto";
      productCounts[name] = (productCounts[name] || 0) + 1;
    });
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1]);

    // Reasons
    const reasonCounts: Record<string, number> = {};
    data.forEach(d => {
      const reason = formatReason(d.cancellation_reason || "Não informado");
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const reasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

    // States
    const stateCounts: Record<string, number> = {};
    data.forEach(d => {
      const state = d.client?.state || "Não informado";
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    });
    const states = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);

    // By month
    const monthCounts: Record<string, number> = {};
    data.forEach(d => {
      const date = d.cancelled_at || d.status_changed_at;
      if (date) {
        const key = format(parseISO(date), "MMM/yy", { locale: ptBR });
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      }
    });
    const months = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);

    // Average tenure (months as client before cancellation)
    const tenures: number[] = [];
    data.forEach(d => {
      const cancelDate = d.cancelled_at || d.status_changed_at;
      if (cancelDate && d.start_date) {
        const months = differenceInMonths(parseISO(cancelDate), parseISO(d.start_date));
        tenures.push(Math.max(0, months));
      }
    });
    const avgTenure = tenures.length > 0 ? Math.round(tenures.reduce((s, t) => s + t, 0) / tenures.length) : 0;

    // Tenure distribution
    const tenureBuckets: Record<string, number> = {
      "0-3 meses": 0,
      "4-6 meses": 0,
      "7-12 meses": 0,
      "13-24 meses": 0,
      "25+ meses": 0,
    };
    tenures.forEach(t => {
      if (t <= 3) tenureBuckets["0-3 meses"]++;
      else if (t <= 6) tenureBuckets["4-6 meses"]++;
      else if (t <= 12) tenureBuckets["7-12 meses"]++;
      else if (t <= 24) tenureBuckets["13-24 meses"]++;
      else tenureBuckets["25+ meses"]++;
    });

    // Missing reason ranking by consultant
    const missingReasonByConsultant: Record<string, { total: number; missing: number }> = {};
    data.forEach(d => {
      const name = d.responsible_user?.name || "Sem responsável";
      if (!missingReasonByConsultant[name]) missingReasonByConsultant[name] = { total: 0, missing: 0 };
      missingReasonByConsultant[name].total++;
      if (!d.cancellation_reason || d.cancellation_reason.trim() === "") {
        missingReasonByConsultant[name].missing++;
      }
    });
    const missingReasonRanking = Object.entries(missingReasonByConsultant)
      .map(([name, { total, missing }]) => ({
        name,
        total,
        missing,
        pct: total > 0 ? Math.round((missing / total) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct || b.missing - a.missing);

    return { totalCount, totalValue, topConsultant, topProduct, reasons, states, months, avgTenure, tenureBuckets, missingReasonRanking };
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Análise de Cancelamentos
            </DialogTitle>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)] px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardContent className="p-4 text-center">
                    <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <p className="text-2xl font-bold text-destructive">{analytics.totalCount}</p>
                    <p className="text-xs text-muted-foreground">Cancelamentos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <p className="text-lg font-bold">{formatCurrency(analytics.totalValue)}</p>
                    <p className="text-xs text-muted-foreground">Valor perdido</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-2xl font-bold">{analytics.avgTenure}</p>
                    <p className="text-xs text-muted-foreground">Meses médios como cliente</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-5 w-5 text-warning mx-auto mb-1" />
                    <p className="text-lg font-bold">{analytics.months[0]?.[0] || "-"}</p>
                    <p className="text-xs text-muted-foreground">Mês com mais cancelamentos ({analytics.months[0]?.[1] || 0})</p>
                  </CardContent>
                </Card>
              </div>

              {/* Churn do Programa */}
              {programChurn && (
                <Card className="border-destructive/30 bg-gradient-to-r from-destructive/5 to-transparent">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      Churn do Programa (base geral)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-destructive">{programChurn.rate}%</p>
                        <p className="text-xs text-muted-foreground">Taxa de Churn</p>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Contratos cancelados</span>
                          <span className="font-semibold text-destructive">{programChurn.cancelled}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Contratos ativos + cancelados</span>
                          <span className="font-semibold">{programChurn.total}</span>
                        </div>
                        <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-destructive/70"
                            style={{ width: `${Math.min(programChurn.rate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Consultant */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Consultor com mais cancelamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.topConsultant.slice(0, 5).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm truncate">{name}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Top Product */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Produto com mais cancelamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.topProduct.slice(0, 5).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm truncate">{name}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Reasons */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      Motivos de cancelamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.reasons.map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between">
                        <span className="text-sm truncate">{reason}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                    {analytics.reasons.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum dado</p>
                    )}
                  </CardContent>
                </Card>

                {/* States */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Estados com mais cancelamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.states.slice(0, 8).map(([state, count]) => (
                      <div key={state} className="flex items-center justify-between">
                        <span className="text-sm">{state}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Missing Reason Ranking */}
              <Card className="border-amber-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Ranking: quem <span className="text-destructive font-bold">menos</span> preenche o motivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.missingReasonRanking.map((item) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-36 truncate">{item.name}</span>
                        <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500/70"
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-amber-600 w-12 text-right">{item.pct}%</span>
                        <span className="text-xs text-muted-foreground w-20 text-right">
                          {item.missing}/{item.total} sem motivo
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Tempo como cliente antes do cancelamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(analytics.tenureBuckets).map(([label, count]) => (
                      <div key={label} className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Monthly breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Cancelamentos por mês
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analytics.months.map(([month, count]) => (
                    <div key={month} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{month}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-full bg-destructive/20 w-32">
                          <div
                            className="h-full rounded-full bg-destructive"
                            style={{ width: `${(count / (analytics.months[0]?.[1] || 1)) * 100}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="min-w-[32px] justify-center">{count}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* AI Analysis Section */}
              <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Análise Inteligente de Churn (IA)
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={runAiAnalysis}
                      disabled={aiLoading}
                      className="gap-2"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {aiInsights ? "Reanalisar" : "Analisar Conversas"}
                        </>
                      )}
                    </Button>
                  </div>
                  {!aiInsights && !aiLoading && (
                    <p className="text-xs text-muted-foreground mt-1">
                      A IA irá analisar o histórico de conversas e timeline dos clientes cancelados para identificar padrões e gerar insights acionáveis.
                    </p>
                  )}
                </CardHeader>
                {aiLoading && (
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Analisando conversas e timelines dos clientes cancelados...</p>
                      <p className="text-xs text-muted-foreground">Isso pode levar até 1 minuto</p>
                    </div>
                  </CardContent>
                )}
                {aiInsights && !aiLoading && (
                  <CardContent>
                    {aiMeta && (
                      <div className="flex gap-4 mb-4 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                        <span>📊 {aiMeta.contractsAnalyzed} contratos analisados</span>
                        <span>💬 {aiMeta.totalMessages} mensagens processadas</span>
                        <span>👤 {aiMeta.clientsWithMessages} clientes com conversas</span>
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {aiInsights.split("\n").map((line, i) => {
                        if (line.startsWith("##") || line.startsWith("**")) {
                          return <p key={i} className="font-semibold mt-3 mb-1">{line.replace(/[#*]/g, "").trim()}</p>;
                        }
                        if (line.trim() === "") return <br key={i} />;
                        return <p key={i} className="text-sm leading-relaxed my-0.5">{line}</p>;
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>

            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
