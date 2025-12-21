import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Brain, MessageSquare, Sparkles, AlertTriangle, Heart, Coins } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIUsageData {
  totalAnalyses: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  roiEventsCreated: number;
  riskEventsCreated: number;
  lifeEventsCreated: number;
  modelUsage: { model: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
}

// Estimated costs per 1M tokens (approximate)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-flash-lite": { input: 0.025, output: 0.10 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "google/gemini-3-pro-preview": { input: 1.50, output: 6.00 },
  "openai/gpt-5": { input: 5.00, output: 15.00 },
  "openai/gpt-5-mini": { input: 0.40, output: 1.60 },
  "openai/gpt-5-nano": { input: 0.10, output: 0.40 },
};

export function AIUsageStats() {
  const [data, setData] = useState<AIUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    fetchUsageData();
  }, [period]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      
      let query = supabase.from("ai_usage_logs").select("*");
      
      if (period === "7d") {
        query = query.gte("created_at", subDays(new Date(), 7).toISOString());
      } else if (period === "30d") {
        query = query.gte("created_at", subDays(new Date(), 30).toISOString());
      }

      const { data: logs, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Aggregate data
      const modelCount: Record<string, number> = {};
      const dailyCount: Record<string, number> = {};
      let totalInput = 0, totalOutput = 0;
      let roiEvents = 0, riskEvents = 0, lifeEvents = 0;

      (logs || []).forEach((log: any) => {
        totalInput += log.input_tokens || 0;
        totalOutput += log.output_tokens || 0;
        roiEvents += log.roi_events_created || 0;
        riskEvents += log.risk_events_created || 0;
        lifeEvents += log.life_events_created || 0;

        // Model usage
        modelCount[log.model] = (modelCount[log.model] || 0) + 1;

        // Daily usage
        const day = format(new Date(log.created_at), "yyyy-MM-dd");
        dailyCount[day] = (dailyCount[day] || 0) + 1;
      });

      const modelUsage = Object.entries(modelCount)
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count);

      const dailyUsage = Object.entries(dailyCount)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);

      setData({
        totalAnalyses: logs?.length || 0,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        roiEventsCreated: roiEvents,
        riskEventsCreated: riskEvents,
        lifeEventsCreated: lifeEvents,
        modelUsage,
        dailyUsage,
      });
    } catch (error) {
      console.error("Error fetching AI usage:", error);
    } finally {
      setLoading(false);
    }
  };

  const estimateCost = () => {
    if (!data) return 0;
    
    // Use average cost estimate
    const avgInputCost = 0.30; // per 1M tokens
    const avgOutputCost = 1.20; // per 1M tokens
    
    const inputCost = (data.totalInputTokens / 1_000_000) * avgInputCost;
    const outputCost = (data.totalOutputTokens / 1_000_000) * avgOutputCost;
    
    return inputCost + outputCost;
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Uso de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalAnalyses === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Uso de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma análise de IA registrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  const estimatedCost = estimateCost();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Uso de IA
          </CardTitle>
          <div className="flex gap-1">
            {(["7d", "30d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  period === p 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Total"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div>
              <p className="text-lg font-bold">{data.totalAnalyses}</p>
              <p className="text-xs text-muted-foreground">Análises</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <Coins className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-lg font-bold">${estimatedCost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Custo est.</p>
            </div>
          </div>
        </div>

        {/* Token usage */}
        <div className="text-xs space-y-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Tokens entrada:</span>
            <span className="font-medium text-foreground">{formatNumber(data.totalInputTokens)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tokens saída:</span>
            <span className="font-medium text-foreground">{formatNumber(data.totalOutputTokens)}</span>
          </div>
        </div>

        {/* Events created */}
        <div className="border-t pt-3">
          <p className="text-xs font-medium mb-2">Eventos Criados</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <span className="text-muted-foreground">ROI:</span>
              <span className="font-medium">{data.roiEventsCreated}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className="text-muted-foreground">Riscos:</span>
              <span className="font-medium">{data.riskEventsCreated}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="h-3 w-3 text-pink-500" />
              <span className="text-muted-foreground">CX:</span>
              <span className="font-medium">{data.lifeEventsCreated}</span>
            </div>
          </div>
        </div>

        {/* Model usage */}
        {data.modelUsage.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Modelos Utilizados</p>
            <div className="space-y-1.5">
              {data.modelUsage.slice(0, 3).map(({ model, count }) => (
                <div key={model} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[150px]">
                    {model.split("/")[1] || model}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mini chart */}
        {data.dailyUsage.length > 1 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Análises por Dia</p>
            <div className="flex items-end gap-0.5 h-12">
              {data.dailyUsage.map((day, i) => {
                const maxCount = Math.max(...data.dailyUsage.map(d => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-primary/60 hover:bg-primary rounded-t transition-colors"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${format(new Date(day.date), "dd/MM", { locale: ptBR })}: ${day.count} análises`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
