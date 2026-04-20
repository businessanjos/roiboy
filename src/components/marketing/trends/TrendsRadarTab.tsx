import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Sparkles, ExternalLink, Archive, Trash2, Loader2, Flame } from "lucide-react";
import { useMarketingTrends } from "@/hooks/useMarketingTrends";
import { useMarketingIdeas } from "@/hooks/useMarketingIdeas";
import { useMarketingBrandVoice } from "@/hooks/useMarketingBrandVoice";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function TrendsRadarTab() {
  const { trends, isLoading, discover, archiveTrend, deleteTrend } = useMarketingTrends();
  const { createIdea } = useMarketingIdeas();
  const { voice } = useMarketingBrandVoice();
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [customQuery, setCustomQuery] = useState("");

  const runDiscover = () => {
    discover.mutate({
      niche: niche || voice?.niche || undefined,
      platform,
      customQuery: customQuery || undefined,
    });
  };

  const turnIntoIdea = (trend: any) => {
    createIdea.mutate({
      title: trend.title,
      hook: trend.title,
      description: trend.ai_adaptation || trend.description,
      format: "reel",
      platform: platform as any,
      status: "draft",
      tags: trend.tags || [],
    });
    toast.success("Trend convertida em ideia");
  };

  const hypeColor = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 80) return "bg-red-500/10 text-red-600 border-red-500/30";
    if (score >= 60) return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    if (score >= 40) return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    return "bg-blue-500/10 text-blue-600 border-blue-500/30";
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-orange-500/10 text-orange-600"><Flame className="h-5 w-5" /></div>
          <div>
            <h3 className="font-semibold">Hype Radar</h3>
            <p className="text-xs text-muted-foreground">Descubra tendências e ganhe adaptações para a marca</p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Input
              placeholder={`Nicho (padrão: ${voice?.niche || "definir tom de voz"})`}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runDiscover} disabled={discover.isPending}>
            {discover.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Descobrir
          </Button>
        </div>

        <Input
          placeholder="Pesquisa customizada (opcional). Ex: trends de áudios virais para mentoria médica"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
        />
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : trends.length === 0 ? (
        <Card className="p-12 text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhuma tendência ainda. Clique em "Descobrir" para começar.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trends.map((trend) => (
            <Card key={trend.id} className="p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold leading-tight flex-1">{trend.title}</h4>
                {trend.hype_score !== null && (
                  <Badge variant="outline" className={hypeColor(trend.hype_score)}>
                    <Flame className="h-3 w-3 mr-1" />{trend.hype_score}
                  </Badge>
                )}
              </div>
              {trend.description && <p className="text-sm text-muted-foreground line-clamp-3">{trend.description}</p>}
              {trend.ai_adaptation && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-primary">Adaptação para a marca</span>
                  </div>
                  <p className="text-xs">{trend.ai_adaptation}</p>
                </div>
              )}
              {trend.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {trend.tags.slice(0, 4).map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">{format(new Date(trend.captured_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                <div className="flex gap-1">
                  {trend.source_url && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                      <a href={trend.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => turnIntoIdea(trend)}>
                    + Ideia
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => archiveTrend.mutate(trend.id)}>
                    <Archive className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTrend.mutate(trend.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
