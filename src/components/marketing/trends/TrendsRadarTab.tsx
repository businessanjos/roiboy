import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Sparkles, ExternalLink, Archive, Trash2, Loader2, Flame, Eye, Heart, MessageCircle, Music2, Globe, Target, Wand2, CheckCircle2, AlertCircle, Instagram } from "lucide-react";
import { useMarketingTrends } from "@/hooks/useMarketingTrends";
import { useMarketingIdeas } from "@/hooks/useMarketingIdeas";
import { useMarketingBrandVoice } from "@/hooks/useMarketingBrandVoice";
import { useMarketingPersona } from "@/hooks/useMarketingPersona";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const formatCount = (n: number | null | undefined) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export function TrendsRadarTab() {
  const { trends, isLoading, discover, discoverApify, archiveTrend, deleteTrend } = useMarketingTrends();
  const { createIdea } = useMarketingIdeas();
  const { voice } = useMarketingBrandVoice();
  const { persona } = useMarketingPersona();

  // AI tab state
  const [niche, setNiche] = useState("");
  const [aiPlatform, setAiPlatform] = useState("instagram");
  const [customQuery, setCustomQuery] = useState("");
  const [extraContext, setExtraContext] = useState("");

  // Apify tab state
  const [apifyPlatform, setApifyPlatform] = useState("tiktok");
  const [hashtags, setHashtags] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Context status: medir se Persona e Tom de Voz têm conteúdo
  const personaFilled = !!(
    persona &&
    (persona.profession || persona.business_type ||
      (persona.pains?.length || 0) > 0 ||
      (persona.desires?.length || 0) > 0 ||
      (persona.vocabulary?.length || 0) > 0)
  );
  const voiceFilled = !!(
    voice &&
    (voice.personality || voice.niche || voice.target_audience ||
      (voice.tone_keywords?.length || 0) > 0 ||
      (voice.signature_phrases?.length || 0) > 0)
  );

  // Instagram conectado: checa se há perfil ativo + posts analisados
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { data: instagramStatus } = useQuery({
    queryKey: ["trends-instagram-status", accountId],
    queryFn: async () => {
      if (!accountId) return { connected: false, postsCount: 0, username: null as string | null };
      const { data: profile } = await supabase
        .from("instagram_profiles")
        .select("id, username")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("followers_count", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (!profile) return { connected: false, postsCount: 0, username: null };
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("instagram_posts")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .gte("posted_at", since);
      return { connected: true, postsCount: count || 0, username: profile.username };
    },
    enabled: !!accountId,
  });
  const instagramConnected = !!instagramStatus?.connected && (instagramStatus?.postsCount || 0) > 0;

  const runAI = () => {
    discover.mutate({
      niche: niche || voice?.niche || undefined,
      platform: aiPlatform,
      customQuery: customQuery || undefined,
      extraContext: extraContext.trim() || undefined,
    });
  };

  const runApify = () => {
    const tags = hashtags.split(/[,\s]+/).map((h) => h.trim()).filter(Boolean);
    if (!tags.length) {
      toast.error("Informe ao menos 1 hashtag");
      return;
    }
    discoverApify.mutate({ platform: apifyPlatform, hashtags: tags, maxItems: 12 });
  };

  const turnIntoIdea = (trend: any) => {
    createIdea.mutate({
      title: trend.title.slice(0, 80),
      hook: trend.title.slice(0, 80),
      description: trend.ai_adaptation || trend.description,
      format: trend.platform === "tiktok" ? "tiktok" : "reel",
      platform: (trend.platform || "instagram") as any,
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

  const filtered = trends.filter((t) => sourceFilter === "all" || t.source === sourceFilter);

  return (
    <div className="space-y-6">
      {/* Painel de Contexto: Persona + Tom de Voz */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Contexto ativo nas buscas</h4>
            </div>
          <p className="text-xs text-muted-foreground">
              Toda descoberta de trends usa automaticamente sua <strong>Persona</strong>, <strong>Tom de Voz</strong> e os <strong>top posts/formatos/hashtags</strong> do seu Instagram conectado.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={personaFilled
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"}
            >
              {personaFilled ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              <Target className="h-3 w-3 mr-1" />
              Persona {personaFilled ? "ativa" : "vazia"}
            </Badge>
            <Badge
              variant="outline"
              className={voiceFilled
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"}
            >
              {voiceFilled ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              <Wand2 className="h-3 w-3 mr-1" />
              Tom de Voz {voiceFilled ? "ativo" : "vazio"}
            </Badge>
            <Badge
              variant="outline"
              className={instagramConnected
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"}
              title={instagramConnected ? `@${instagramStatus?.username} · ${instagramStatus?.postsCount} posts (90d)` : "Conecte o Instagram para usar dados reais de performance"}
            >
              {instagramConnected ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              <Instagram className="h-3 w-3 mr-1" />
              {instagramConnected ? `Instagram (${instagramStatus?.postsCount} posts)` : "Instagram desconectado"}
            </Badge>
          </div>
        </div>
        {(!personaFilled || !voiceFilled || !instagramConnected) && (
          <div className="mt-3 pt-3 border-t border-primary/10 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              💡 Preencha <strong>Persona</strong>, <strong>Tom de Voz</strong> e conecte/sincronize seu <strong>Instagram</strong> para sugestões muito mais personalizadas.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-orange-500/10 text-orange-600"><Flame className="h-5 w-5" /></div>
          <div>
            <h3 className="font-semibold">Hype Radar</h3>
            <p className="text-xs text-muted-foreground">Descubra tendências reais e ganhe adaptações para a marca</p>
          </div>
        </div>

        <Tabs defaultValue="apify" className="space-y-4">
          <TabsList>
            <TabsTrigger value="apify"><Music2 className="h-4 w-4 mr-1" />Apify (TikTok / Reels reais)</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="h-4 w-4 mr-1" />IA + Web (Perplexity)</TabsTrigger>
          </TabsList>

          <TabsContent value="apify" className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <Select value={apifyPlatform} onValueChange={setApifyPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram (Reels/posts)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="md:col-span-2"
                placeholder="Hashtags separadas por vírgula. Ex: donadeclinica, esteticaavancada"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
              <Button onClick={runApify} disabled={discoverApify.isPending}>
                {discoverApify.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Flame className="h-4 w-4 mr-2" />}
                Buscar virais
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground self-center mr-1">Presets do nicho:</span>
              {[
                { label: "Estética (negócio)", tags: "donadeclinica,esteticaavancada,gestaodeclinica,empresariadaestetica,esteticista" },
                { label: "Mentoria/Vendas", tags: "mentoriadevendas,empreendedorismofeminino,donadenegocio,vendasdeluxo,faturamento" },
                { label: "Médicas/Clínicas", tags: "medicaempreendedora,clinicamedica,gestaomedica,marketingmedico" },
                { label: "Memes negócio BR", tags: "memesempresarial,humorcorporativo,vidadeempresaria,rotinadeempresaria" },
              ].map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setHashtags(p.tags)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Escrapamos 3× o volume, filtramos por idioma (PT-BR) e relevância via IA pro nicho de estética/mentoria. Lixo (anime, fofoca, gospel, etc.) é descartado antes de salvar.</p>
          </TabsContent>

          <TabsContent value="ai" className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Input
                  placeholder={`Nicho (padrão: ${voice?.niche || "definir tom de voz"})`}
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>
              <Select value={aiPlatform} onValueChange={setAiPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={runAI} disabled={discover.isPending}>
                {discover.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Descobrir
              </Button>
            </div>
            <Input
              placeholder="Pesquisa customizada (opcional). Ex: trends de áudios virais para mentoria médica"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="extra-context" className="text-xs flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                Contexto extra (opcional)
                <span className="text-muted-foreground font-normal">— ajuste o foco desta busca</span>
              </Label>
              <Textarea
                id="extra-context"
                placeholder={`Ex: foco em médicos do interior do RS, faturamento até 30k/mês, objetivo é vender mentoria de R$ 15k. Evite trends de dança. Priorize formato carrossel educativo.`}
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value.slice(0, 1000))}
                rows={3}
                className="resize-none text-sm"
                maxLength={1000}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Use para ajustar nicho, localização, persona específica ou objetivo da campanha.</span>
                <span>{extraContext.length}/1000</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtrar fonte:</span>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="apify">Apify (virais reais)</SelectItem>
            <SelectItem value="perplexity">Perplexity (web)</SelectItem>
            <SelectItem value="manual">Curadoria IA</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} resultado(s)</span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhuma tendência ainda. Use Apify ou IA para começar.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((trend) => (
            <Card key={trend.id} className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              {trend.thumbnail_url && (
                <div className="aspect-[9/16] max-h-[280px] overflow-hidden bg-muted relative">
                  <img src={trend.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  {trend.hype_score !== null && (
                    <Badge className={`absolute top-2 right-2 ${hypeColor(trend.hype_score)}`} variant="outline">
                      <Flame className="h-3 w-3 mr-1" />{trend.hype_score}
                    </Badge>
                  )}
                  {trend.platform && (
                    <Badge className="absolute top-2 left-2 bg-background/80 backdrop-blur" variant="outline">
                      {trend.platform}
                    </Badge>
                  )}
                </div>
              )}
              <div className="p-4 space-y-3 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold leading-tight flex-1 text-sm line-clamp-2">{trend.title}</h4>
                  {!trend.thumbnail_url && trend.hype_score !== null && (
                    <Badge variant="outline" className={hypeColor(trend.hype_score)}>
                      <Flame className="h-3 w-3 mr-1" />{trend.hype_score}
                    </Badge>
                  )}
                </div>

                {(trend.views_count || trend.likes_count || trend.comments_count) ? (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {trend.views_count ? <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatCount(trend.views_count)}</span> : null}
                    {trend.likes_count ? <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatCount(trend.likes_count)}</span> : null}
                    {trend.comments_count ? <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatCount(trend.comments_count)}</span> : null}
                  </div>
                ) : null}

                {trend.creator_handle && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />{trend.creator_handle}
                    {trend.creator_followers ? <span>· {formatCount(trend.creator_followers)} seguidores</span> : null}
                  </div>
                )}

                {trend.audio_title && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <Music2 className="h-3 w-3 shrink-0" /><span className="truncate">{trend.audio_title}</span>
                  </div>
                )}

                {trend.description && !trend.thumbnail_url && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{trend.description}</p>
                )}

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
                    {trend.tags.slice(0, 4).map((tag) => <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>)}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t mt-auto">
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
