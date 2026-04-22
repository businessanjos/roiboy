import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Star, Trash2, Sparkles, Plus, Copy as CopyIcon, ExternalLink, Flame, TrendingUp, Filter, Loader2 } from "lucide-react";
import { useMarketingHooks, type HookCategory } from "@/hooks/useMarketingHooks";
import { useMarketingIdeas } from "@/hooks/useMarketingIdeas";
import { useMarketingCopy, type CopyObjective } from "@/hooks/useMarketingCopy";
import { useContentProfile } from "@/contexts/ContentProfileContext";
import { toast } from "sonner";

const CATEGORIES: { value: HookCategory; label: string; emoji: string }[] = [
  { value: "curiosidade", label: "Curiosidade", emoji: "🤔" },
  { value: "promessa", label: "Promessa", emoji: "🎯" },
  { value: "polemica", label: "Polêmica", emoji: "⚡" },
  { value: "historia", label: "História", emoji: "📖" },
  { value: "dado", label: "Dado", emoji: "📊" },
  { value: "provocacao", label: "Provocação", emoji: "💥" },
  { value: "outro", label: "Outro", emoji: "✨" },
];

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", manual: "Manual", ai: "IA",
};

export function HooksTab() {
  const { hooks, isLoading, extractFromPosts, createHook, toggleFavorite, deleteHook, incrementUsage } = useMarketingHooks();
  const { createIdea } = useMarketingIdeas();
  const { generateCopy } = useMarketingCopy();
  const { selectedProfile } = useContentProfile();

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [search, setSearch] = useState("");
  const [hookBrief, setHookBrief] = useState("");
  const [hookObjective, setHookObjective] = useState<CopyObjective>("educar");
  const [generatedHooks, setGeneratedHooks] = useState<string[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [newHook, setNewHook] = useState({ text: "", category: "curiosidade" as HookCategory, notes: "" });

  const filtered = useMemo(() => {
    return hooks.filter(h => {
      if (showOnlyFavorites && !h.is_favorite) return false;
      if (filterCategory !== "all" && h.category !== filterCategory) return false;
      if (filterPlatform !== "all" && h.source_platform !== filterPlatform && h.source !== filterPlatform) return false;
      if (search && !h.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [hooks, filterCategory, filterPlatform, showOnlyFavorites, search]);

  const stats = useMemo(() => ({
    total: hooks.length,
    avgScore: hooks.length ? Math.round(hooks.reduce((s, h) => s + (h.performance_score || 0), 0) / hooks.length) : 0,
    favorites: hooks.filter(h => h.is_favorite).length,
    fromAI: hooks.filter(h => h.created_by_ai).length,
  }), [hooks]);

  const handleUseHook = async (hook: typeof hooks[number]) => {
    incrementUsage.mutate(hook.id);
    createIdea.mutate({
      title: `Reel: ${hook.text.slice(0, 50)}`,
      hook: hook.text,
      format: "reel",
      platform: "instagram",
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const handleGenerateHooks = () => {
    if (!hookBrief.trim()) {
      toast.error("Descreva o tema para gerar hooks");
      return;
    }

    generateCopy.mutate({
      copyType: "hook",
      brief: hookBrief,
      objective: hookObjective,
      platform: selectedProfile?.platform || "instagram",
      useBrandVoice: true,
      profileId: selectedProfile?.id,
      profilePlatform: selectedProfile?.platform,
      profileUsername: selectedProfile?.username,
      profileDisplayName: selectedProfile?.display_name,
    }, {
      onSuccess: (data) => {
        const parsedHooks = data.output
          .split(/\n+/)
          .map((line) => line.replace(/^\s*\d+[.)-]?\s*/, "").trim())
          .filter(Boolean);
        setGeneratedHooks(parsedHooks);
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Gerador de Hooks com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Tema, oferta, transformação ou contexto para os hooks..."
            value={hookBrief}
            onChange={(e) => setHookBrief(e.target.value)}
            rows={3}
          />
          <div className="grid gap-3 md:grid-cols-[180px_1fr] md:items-end">
            <div className="space-y-2">
              <div className="text-sm font-medium">Objetivo</div>
              <Select value={hookObjective} onValueChange={(v) => setHookObjective(v as CopyObjective)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="educar">Educar</SelectItem>
                  <SelectItem value="converter">Converter</SelectItem>
                  <SelectItem value="reter">Reter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              {selectedProfile && (
                <div className="text-xs text-muted-foreground">Base ativa: <strong>@{selectedProfile.username}</strong> · {selectedProfile.platform}</div>
              )}
              <Button onClick={handleGenerateHooks} disabled={generateCopy.isPending}>
                {generateCopy.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {generateCopy.isPending ? "Gerando..." : "Gerar hooks"}
              </Button>
            </div>
          </div>

          {generatedHooks.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {generatedHooks.map((generatedHook, index) => (
                <div key={`${generatedHook}-${index}`} className="rounded-md border border-border bg-background p-3 space-y-3">
                  <p className="text-sm leading-relaxed">{generatedHook}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleCopy(generatedHook)} className="flex-1">
                      <CopyIcon className="h-3.5 w-3.5 mr-1" />Copiar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => createHook.mutate({ text: generatedHook, category: "promessa", notes: `Gerado com IA para objetivo ${hookObjective}` })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />Salvar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" /> Banco de Hooks
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Ganchos extraídos automaticamente dos seus posts virais ou criados manualmente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => extractFromPosts.mutate({})}
            disabled={extractFromPosts.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {extractFromPosts.isPending ? "Extraindo..." : "Extrair com IA"}
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Hook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Hook</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="Cole ou escreva o gancho..."
                  value={newHook.text}
                  onChange={e => setNewHook({ ...newHook, text: e.target.value })}
                  rows={3}
                />
                <Select value={newHook.category} onValueChange={v => setNewHook({ ...newHook, category: v as HookCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Notas (opcional) — por que esse hook funciona?"
                  value={newHook.notes}
                  onChange={e => setNewHook({ ...newHook, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  if (!newHook.text.trim()) return toast.error("Texto obrigatório");
                  createHook.mutate(newHook, { onSuccess: () => { setAddOpen(false); setNewHook({ text: "", category: "curiosidade", notes: "" }); } });
                }}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Score médio</div><div className="text-2xl font-bold">{stats.avgScore}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Favoritos</div><div className="text-2xl font-bold">{stats.favorites}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Da IA</div><div className="text-2xl font-bold">{stats.fromAI}</div></CardContent></Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="ai">IA</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={showOnlyFavorites ? "default" : "outline"} size="sm" onClick={() => setShowOnlyFavorites(v => !v)}>
            <Star className="h-4 w-4 mr-1" /> Favoritos
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : !filtered.length ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          {hooks.length === 0
            ? "Nenhum hook ainda. Clique em 'Extrair com IA' para gerar a partir dos seus posts ou crie manualmente."
            : "Nenhum hook com esses filtros."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(hook => {
            const cat = CATEGORIES.find(c => c.value === hook.category);
            const isTop = hook.performance_score >= 80;
            return (
              <Card key={hook.id} className={isTop ? "border-primary/50" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {cat && <Badge variant="secondary">{cat.emoji} {cat.label}</Badge>}
                      <Badge variant="outline" className="text-xs">{PLATFORM_LABELS[hook.source_platform || hook.source] || hook.source}</Badge>
                      {isTop && <Badge className="bg-primary/20 text-primary border-primary/30"><Flame className="h-3 w-3 mr-1" />Top</Badge>}
                      {hook.created_by_ai && <Badge variant="outline" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />IA</Badge>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => toggleFavorite.mutate({ id: hook.id, is_favorite: !hook.is_favorite })}>
                      <Star className={`h-4 w-4 ${hook.is_favorite ? "fill-primary text-primary" : ""}`} />
                    </Button>
                  </div>

                  <p className="text-sm leading-relaxed">{hook.text}</p>

                  {hook.notes && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">{hook.notes}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {hook.performance_score > 0 && <span><TrendingUp className="h-3 w-3 inline mr-1" />{hook.performance_score}pts</span>}
                      {hook.views > 0 && <span>{hook.views.toLocaleString()} views</span>}
                      {hook.times_used > 0 && <span>Usado {hook.times_used}x</span>}
                    </div>
                  </div>

                  <div className="flex gap-1 pt-1 border-t">
                    <Button size="sm" variant="outline" onClick={() => handleUseHook(hook)} className="flex-1">
                      Criar ideia
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(hook.text)}>
                      <CopyIcon className="h-3.5 w-3.5" />
                    </Button>
                    {hook.source_url && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={hook.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteHook.mutate(hook.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
