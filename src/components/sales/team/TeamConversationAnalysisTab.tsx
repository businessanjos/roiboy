import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquareText, Clock, TrendingDown, TrendingUp, Zap, AlertTriangle,
  RefreshCw, Sparkles, User, BarChart3, Target, CheckCircle2, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

const SALES_TEAM_NAMES = ["everton", "jonathan", "vanessa", "darlan", "george"];

interface TeamMember {
  id: string;
  name: string;
}

interface ConversationMetrics {
  total: number;
  with_response_data: number;
  avg_response_time_min: number;
  median_response_time_min: number;
  p90_response_time_min: number;
  fast_responses_pct: number;
  slow_responses_pct: number;
  avg_duration_min: number;
  outcomes: Record<string, number>;
  closed_count: number;
  open_count: number;
}

const DATE_RANGES = [
  { key: "7d", label: "Últimos 7 dias", days: 7 },
  { key: "15d", label: "Últimos 15 dias", days: 15 },
  { key: "30d", label: "Últimos 30 dias", days: 30 },
  { key: "month", label: "Este mês", days: 0 },
];

export function TeamConversationAnalysisTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [dateRange, setDateRange] = useState("30d");
  const [metrics, setMetrics] = useState<ConversationMetrics | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);

  // Fetch team members
  useEffect(() => {
    const fetchMembers = async () => {
      const { data: userData } = await supabase
        .from("users")
        .select("id, name")
        .not("name", "is", null);

      if (userData) {
        const filtered = userData.filter((u: any) =>
          SALES_TEAM_NAMES.some((n) => u.name?.toLowerCase().includes(n))
        );
        setMembers(filtered as TeamMember[]);
        if (filtered.length > 0) {
          // Default to Darlan
          const darlan = filtered.find((m: any) => m.name?.toLowerCase().includes("darlan"));
          setSelectedMember(darlan?.id || filtered[0].id);
        }
      }
      setMembersLoading(false);
    };
    fetchMembers();
  }, []);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const range = DATE_RANGES.find((r) => r.key === dateRange);
    if (!range) return { start: subDays(now, 30).toISOString(), end: now.toISOString() };

    if (range.key === "month") {
      return {
        start: startOfMonth(now).toISOString(),
        end: endOfMonth(now).toISOString(),
      };
    }
    return {
      start: subDays(now, range.days).toISOString(),
      end: now.toISOString(),
    };
  }, [dateRange]);

  // Fetch metrics when member or date changes
  const fetchMetrics = useCallback(async () => {
    if (!selectedMember) return;
    setLoading(true);
    setAiAnalysis(null);

    try {
      const { start, end } = getDateRange();
      const { data, error } = await supabase.functions.invoke("analyze-zapp-conversations", {
        body: {
          user_id: selectedMember,
          start_date: start,
          end_date: end,
          analysis_type: "metrics_only",
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setMetrics(data?.metrics || null);
    } catch (err: any) {
      console.error("Error fetching metrics:", err);
      toast.error("Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }, [selectedMember, getDateRange]);

  useEffect(() => {
    if (selectedMember) fetchMetrics();
  }, [selectedMember, dateRange, fetchMetrics]);

  // Run AI analysis
  const runAiAnalysis = async () => {
    if (!selectedMember) return;
    setAiLoading(true);

    try {
      const { start, end } = getDateRange();
      const { data, error } = await supabase.functions.invoke("analyze-zapp-conversations", {
        body: {
          user_id: selectedMember,
          start_date: start,
          end_date: end,
          analysis_type: "full",
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.ai_analysis) {
        setAiAnalysis(data.ai_analysis);
        toast.success("Análise de IA concluída!");
      } else {
        toast.warning("Não foi possível gerar a análise. Verifique se há conversas no período.");
      }
    } catch (err: any) {
      console.error("AI analysis error:", err);
      toast.error("Erro ao gerar análise de IA");
    } finally {
      setAiLoading(false);
    }
  };

  const selectedMemberName = members.find((m) => m.id === selectedMember)?.name || "";

  const getResponseTimeColor = (minutes: number) => {
    if (minutes <= 5) return "text-emerald-600";
    if (minutes <= 15) return "text-amber-600";
    return "text-red-600";
  };

  const getResponseTimeIcon = (minutes: number) => {
    if (minutes <= 5) return <Zap className="h-5 w-5 text-emerald-500" />;
    if (minutes <= 15) return <Clock className="h-5 w-5 text-amber-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMember} onValueChange={setSelectedMember} disabled={membersLoading}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o vendedor" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={runAiAnalysis}
            disabled={aiLoading || !metrics || metrics.total === 0}
            className="gap-1.5"
          >
            <Sparkles className={`h-4 w-4 ${aiLoading ? "animate-pulse" : ""}`} />
            {aiLoading ? "Analisando..." : "Análise IA"}
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Conversations */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Total de Conversas</span>
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-1">{metrics.total}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {metrics.closed_count} fechadas
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clock className="h-3 w-3 text-amber-500" />
                    {metrics.open_count} abertas
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Avg Response Time */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Tempo Médio Resposta</span>
                  {getResponseTimeIcon(metrics.avg_response_time_min)}
                </div>
                <p className={`text-2xl font-bold mt-1 ${getResponseTimeColor(metrics.avg_response_time_min)}`}>
                  {metrics.avg_response_time_min < 60
                    ? `${metrics.avg_response_time_min} min`
                    : `${Math.round(metrics.avg_response_time_min / 60 * 10) / 10}h`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Mediana: {metrics.median_response_time_min} min
                </p>
              </CardContent>
            </Card>

            {/* P90 Response Time */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">P90 Resposta</span>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className={`text-2xl font-bold mt-1 ${getResponseTimeColor(metrics.p90_response_time_min)}`}>
                  {metrics.p90_response_time_min < 60
                    ? `${metrics.p90_response_time_min} min`
                    : `${Math.round(metrics.p90_response_time_min / 60 * 10) / 10}h`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  90% das respostas em até este tempo
                </p>
              </CardContent>
            </Card>

            {/* Fast vs Slow */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Velocidade</span>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-600">{metrics.fast_responses_pct}%</p>
                    <p className="text-[9px] text-muted-foreground">≤5 min</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-600">{metrics.slow_responses_pct}%</p>
                    <p className="text-[9px] text-muted-foreground">&gt;30 min</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Avg Duration */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Duração Média</span>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-1">
                  {metrics.avg_duration_min > 0 ? `${metrics.avg_duration_min} min` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Tempo médio do atendimento
                </p>
              </CardContent>
            </Card>

            {/* Conversations with Data */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Com Dados Resposta</span>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-1">{metrics.with_response_data}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  de {metrics.total} conversas ({metrics.total > 0 ? Math.round((metrics.with_response_data / metrics.total) * 100) : 0}%)
                </p>
              </CardContent>
            </Card>

            {/* Outcomes */}
            {metrics.outcomes && Object.keys(metrics.outcomes).length > 0 && (
              <Card className="col-span-2">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Resultados dos Atendimentos</span>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(metrics.outcomes).map(([outcome, count]) => (
                      <Badge key={outcome} variant="secondary" className="text-xs gap-1">
                        {outcome === "sale" ? "✅ Venda" :
                         outcome === "scheduled" ? "📅 Agendado" :
                         outcome === "no_interest" ? "❌ Sem interesse" :
                         outcome === "follow_up" ? "🔄 Follow-up" :
                         outcome === "em_aberto" ? "⏳ Em aberto" :
                         outcome}
                        <span className="font-bold">{count}</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* No Data State */}
          {metrics.total === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquareText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  Nenhuma conversa encontrada para {selectedMemberName} neste período.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tente alterar o período ou o vendedor selecionado.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* AI Analysis */}
      {aiLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              Analisando conversas com IA...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {aiAnalysis && !aiLoading && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" />
                Análise de IA — {selectedMemberName}
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Gerado agora
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {aiAnalysis.split("\n").map((line, i) => {
                if (line.startsWith("## ")) {
                  return (
                    <h3 key={i} className="text-sm font-semibold mt-5 mb-2 first:mt-0">
                      {line.replace("## ", "")}
                    </h3>
                  );
                }
                if (line.startsWith("### ")) {
                  return (
                    <h4 key={i} className="text-xs font-semibold mt-3 mb-1">
                      {line.replace("### ", "")}
                    </h4>
                  );
                }
                if (line.startsWith("- **")) {
                  const parts = line.replace("- **", "").split("**");
                  return (
                    <p key={i} className="text-xs leading-relaxed ml-3 mb-0.5">
                      <span className="font-semibold">{parts[0]}</span>
                      {parts.slice(1).join("")}
                    </p>
                  );
                }
                if (line.startsWith("- ")) {
                  return (
                    <p key={i} className="text-xs leading-relaxed ml-3 mb-0.5">
                      • {line.replace("- ", "")}
                    </p>
                  );
                }
                if (line.trim() === "") return <div key={i} className="h-2" />;
                return (
                  <p key={i} className="text-xs leading-relaxed mb-1">
                    {line}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
