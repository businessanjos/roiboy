import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Activity,
  User,
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

export function TeamInsightsTab() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const generateInsights = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("team-insights");

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setInsights(data.insights || []);
      setGeneratedAt(data.generated_at);
      toast.success("Insights gerados com sucesso!");
    } catch (err: any) {
      console.error("Error generating insights:", err);
      toast.error("Erro ao gerar insights. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  if (!generatedAt && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Insights da Equipe</h3>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Gere insights inteligentes sobre a performance e comportamento dos vendedores e SDRs com base nos dados do mês atual.
        </p>
        <Button onClick={generateInsights} size="lg" className="gap-2">
          <Sparkles className="h-5 w-5" />
          Gerar Insights com IA
        </Button>
      </div>
    );
  }

  if (loading) {
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
          <h2 className="text-lg font-semibold">Insights da Equipe</h2>
          {generatedAt && (
            <span className="text-xs text-muted-foreground">
              Gerado em {new Date(generatedAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={generateInsights} disabled={loading} className="gap-2">
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
