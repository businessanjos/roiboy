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
import { Loader2, XCircle, Users, Package, MapPin, Calendar, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

// Only these users can access this modal
const AUTHORIZED_USER_IDS = [
  "de43a643-0109-4afb-ac35-be768dbf4090", // Everton Pieri
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol Parnow
  "c064c5d5-cdb5-47cc-99ce-ad416b6407b1", // Jessica Marcato
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

      // Fetch responsible user for each contract's client
      const clientIds = [...new Set((contracts || []).map(c => c.client_id))];
      let responsibleMap: Record<string, string> = {};
      
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, responsible_user_id, responsible:users!clients_responsible_user_id_fkey(name)")
          .in("id", clientIds);
        
        clients?.forEach((c: any) => {
          if (c.responsible?.name) {
            responsibleMap[c.id] = c.responsible.name;
          }
        });
      }

      const enriched = (contracts || []).map(c => ({
        ...c,
        responsible_user: responsibleMap[c.client_id] ? { name: responsibleMap[c.client_id] } : null,
      }));

      setData(enriched as CancellationData[]);
    } catch (err) {
      console.error("Error fetching cancellation analytics:", err);
    } finally {
      setLoading(false);
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
      const reason = d.cancellation_reason || "Não informado";
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

    return { totalCount, totalValue, topConsultant, topProduct, reasons, states, months, avgTenure, tenureBuckets };
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

              {/* Tenure Distribution */}
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
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
