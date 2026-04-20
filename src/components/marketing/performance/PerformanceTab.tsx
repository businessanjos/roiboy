import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Clock, Hash, Flame, Layout, Lightbulb } from "lucide-react";
import { useMarketingPerformance } from "@/hooks/useMarketingPerformance";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";

const TYPE_ICONS: Record<string, any> = {
  top_format: Layout,
  best_time: Clock,
  winning_hook: Flame,
  hashtag_pattern: Hash,
  content_pattern: Lightbulb,
};

const TYPE_LABELS: Record<string, string> = {
  top_format: "Formato campeão",
  best_time: "Melhor horário",
  winning_hook: "Hook vencedor",
  hashtag_pattern: "Padrão de hashtags",
  content_pattern: "Padrão de conteúdo",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  combined: "bg-primary/10 text-primary border-primary/20",
};

export function PerformanceTab() {
  const { insights, isLoading, analyze } = useMarketingPerformance();
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  const filtered = useMemo(() =>
    filterPlatform === "all" ? insights : insights.filter(i => i.platform === filterPlatform || i.platform === "combined"),
  [insights, filterPlatform]);

  const lastAnalysis = insights[0]?.created_at;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> Performance & Aprendizados
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Insights gerados pela IA sobre o que está funcionando nos seus posts dos últimos 90 dias.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            <Sparkles className="h-4 w-4 mr-2" />
            {analyze.isPending ? "Analisando..." : "Analisar com IA"}
          </Button>
          {lastAnalysis && (
            <span className="text-xs text-muted-foreground">
              Última análise: {new Date(lastAnalysis).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      </div>

      <Tabs value={filterPlatform} onValueChange={setFilterPlatform}>
        <TabsList>
          <TabsTrigger value="all">Todas ({insights.length})</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="combined">Combinado</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : !filtered.length ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          {insights.length === 0
            ? "Nenhum insight ainda. Clique em 'Analisar com IA' — você precisa ter pelo menos 3 posts publicados nos últimos 90 dias."
            : "Nenhum insight para essa plataforma."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(insight => {
            const Icon = TYPE_ICONS[insight.insight_type] || Lightbulb;
            return (
              <Card key={insight.id} className="hover:shadow-md transition">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={PLATFORM_COLORS[insight.platform] || ""} variant="outline">
                        {insight.platform === "combined" ? "Geral" : insight.platform}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{TYPE_LABELS[insight.insight_type]}</span>
                    </div>
                  </div>

                  <h3 className="font-semibold leading-tight">{insight.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${insight.score}%` }} />
                      </div>
                      <span className="text-xs font-medium">{insight.score}/100</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
