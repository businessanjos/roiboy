import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Activity,
  User, Users, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Insight {
  title: string;
  description: string;
  category: "performance" | "comportamento" | "oportunidade" | "alerta";
  priority: "alta" | "média" | "baixa";
  related_member?: string;
}

interface InsightHistory {
  id: string;
  insights: Insight[];
  generated_at: string;
  scope: string;
  member_name: string | null;
}

const categoryConfig = {
  performance: { icon: TrendingUp, label: "Performance", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  comportamento: { icon: Activity, label: "Comportamento", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  oportunidade: { icon: Lightbulb, label: "Oportunidade", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  alerta: { icon: AlertTriangle, label: "Alerta", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
};

const priorityConfig = {
  alta: "bg-red-100 text-red-700 border-red-200",
  média: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baixa: "bg-green-100 text-green-700 border-green-200",
};

const TABS = [
  { key: "team", label: "Equipe", icon: Users, scope: "team", memberName: null },
  { key: "george", label: "George", icon: User, scope: "individual", memberName: "George" },
  { key: "darlan", label: "Darlan", icon: User, scope: "individual", memberName: "Darlan" },
  { key: "vanessa", label: "Vanessa", icon: User, scope: "individual", memberName: "Vanessa" },
];

export function TeamInsightsTab() {
  const [activeTab, setActiveTab] = useState("team");
  const [insightsMap, setInsightsMap] = useState<Record<string, { insights: Insight[]; generatedAt: string }>>({});
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load saved insights from history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // Get the most recent insight for each scope
      const { data, error } = await supabase
        .from("team_insights_history")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const map: Record<string, { insights: Insight[]; generatedAt: string }> = {};

      for (const row of (data || []) as any[]) {
        const key = row.scope === "individual" && row.member_name
          ? row.member_name.toLowerCase()
          : "team";
        
        if (!map[key]) {
          map[key] = {
            insights: Array.isArray(row.insights) ? row.insights : [],
            generatedAt: row.generated_at,
          };
        }
      }

      setInsightsMap(map);
    } catch (err) {
      console.error("Error loading insights history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const generateInsights = useCallback(async () => {
    const tab = TABS.find((t) => t.key === activeTab)!;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("team-insights", {
        body: { scope: tab.scope, member_name: tab.memberName },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const newInsights = data.insights || [];
      const generatedAt = data.generated_at;

      setInsightsMap((prev) => ({
        ...prev,
        [activeTab]: { insights: newInsights, generatedAt },
      }));

      toast.success("Insights gerados com sucesso!");
    } catch (err: any) {
      console.error("Error generating insights:", err);
      toast.error("Erro ao gerar insights. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const currentData = insightsMap[activeTab];
  const currentTab = TABS.find((t) => t.key === activeTab)!;

  if (loadingHistory) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const hasData = !!insightsMap[tab.key];
          return (
            <Button
              key={tab.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {hasData && (
                <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              )}
            </Button>
          );
        })}
      </div>

      {/* Content */}
      {!currentData && !loading ? (
        <EmptyState
          label={currentTab.label}
          isIndividual={currentTab.scope === "individual"}
          onGenerate={generateInsights}
        />
      ) : loading ? (
        <LoadingSkeleton />
      ) : currentData ? (
        <InsightsGrid
          insights={currentData.insights}
          generatedAt={currentData.generatedAt}
          label={currentTab.label}
          loading={loading}
          onRegenerate={generateInsights}
        />
      ) : null}
    </div>
  );
}

function EmptyState({
  label,
  isIndividual,
  onGenerate,
}: {
  label: string;
  isIndividual: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        Insights {isIndividual ? `de ${label}` : "da Equipe"}
      </h3>
      <p className="text-muted-foreground text-center max-w-md mb-6 text-sm">
        {isIndividual
          ? `Gere insights individuais sobre a performance e comportamento de ${label} com base nos dados do mês atual.`
          : "Gere insights comparativos sobre a performance e comportamento da equipe comercial com base nos dados do mês atual."}
      </p>
      <Button onClick={onGenerate} size="lg" className="gap-2">
        <Sparkles className="h-5 w-5" />
        Gerar Insights com IA
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-5 w-48 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InsightsGrid({
  insights,
  generatedAt,
  label,
  loading,
  onRegenerate,
}: {
  insights: Insight[];
  generatedAt: string;
  label: string;
  loading: boolean;
  onRegenerate: () => void;
}) {
  const sorted = [...insights].sort((a, b) => {
    const pOrder = { alta: 0, média: 1, baixa: 2 };
    return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Insights — {label}</h2>
          {generatedAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(generatedAt).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Regenerar
        </Button>
      </div>

      {/* Insights grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((insight, idx) => {
          const cat = categoryConfig[insight.category] || categoryConfig.performance;
          const CatIcon = cat.icon;

          return (
            <Card key={idx} className="border overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${cat.color}`}>
                      <CatIcon className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-sm leading-tight truncate">{insight.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cat.color}`}>
                      {cat.label}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityConfig[insight.priority]}`}>
                      {insight.priority}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>

                {insight.related_member && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    {insight.related_member}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {insights.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum insight gerado. Tente novamente.</p>
        </div>
      )}
    </div>
  );
}
