import { useMemo, useState } from "react";
import {
  Talent, usePillars, useUpsertPiece, PLATFORMS, callContentHQAI,
} from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Lightbulb, Loader2, Sparkles, Plus, Check, RefreshCw, Filter,
  Zap, Crown, Flame, Target as TargetIcon,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Idea = {
  title: string;
  hook: string;
  angle: string;
  pillar_name: string;
  platform: string;
  format: string;
  intensity: "quick_win" | "autoridade" | "viral" | "conversao";
};

const INTENSITY_META: Record<Idea["intensity"], { label: string; icon: any; cls: string }> = {
  quick_win: { label: "Quick Win", icon: Zap,       cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  autoridade: { label: "Autoridade", icon: Crown,   cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  viral:     { label: "Viral",     icon: Flame,     cls: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  conversao: { label: "Conversão", icon: TargetIcon, cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
};

const DEFAULT_PLATFORMS = ["instagram", "youtube", "tiktok"];

export function ContentHQIdeasLab({ talent }: { talent: Talent }) {
  const { data: pillars = [] } = usePillars(talent.id);
  const upsert = useUpsertPiece();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(24);
  const [context, setContext] = useState("");
  const [pickedPlatforms, setPickedPlatforms] = useState<string[]>(DEFAULT_PLATFORMS);
  const [pickedPillarIds, setPickedPillarIds] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<number, string>>({}); // idx -> piece id
  const [filterPillar, setFilterPillar] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterIntensity, setFilterIntensity] = useState<string>("all");

  const effectivePillars = useMemo(
    () => (pickedPillarIds.length ? pillars.filter(p => pickedPillarIds.includes(p.id)) : pillars),
    [pillars, pickedPillarIds],
  );

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const r = await callContentHQAI("generate_ideas_burst", talent, {
        count,
        platforms: pickedPlatforms,
        context: context.trim() || undefined,
        pillars: effectivePillars.map(p => ({ name: p.name, description: p.description || undefined })),
      });
      const list: Idea[] = Array.isArray(r?.ideas) ? r.ideas : [];
      setIdeas(list);
      setSaved({});
      toast({ title: `${list.length} ideias geradas`, description: "Salve as melhores no backlog." });
    } catch (e) {
      // toast handled in callContentHQAI
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (idea: Idea, idx: number) => {
    const pillar = pillars.find(p => p.name.toLowerCase() === idea.pillar_name.toLowerCase());
    upsert.mutate(
      {
        talent_id: talent.id,
        pillar_id: pillar?.id || null,
        title: idea.title,
        hook: idea.hook,
        platform: idea.platform,
        format: idea.format,
        status: "backlog",
        ai_generated: true,
      } as any,
      {
        onSuccess: (d: any) => setSaved(prev => ({ ...prev, [idx]: d?.id || "ok" })),
      },
    );
  };

  const handleSaveAll = () => {
    ideas.forEach((idea, idx) => {
      if (!saved[idx]) handleSave(idea, idx);
    });
  };

  const filtered = useMemo(() => {
    return ideas
      .map((i, idx) => ({ idea: i, idx }))
      .filter(({ idea }) =>
        (filterPillar === "all" || idea.pillar_name === filterPillar) &&
        (filterPlatform === "all" || idea.platform === filterPlatform) &&
        (filterIntensity === "all" || idea.intensity === filterIntensity),
      );
  }, [ideas, filterPillar, filterPlatform, filterIntensity]);

  const togglePlatform = (id: string) =>
    setPickedPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const togglePillar = (id: string) =>
    setPickedPillarIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="space-y-4">
      {/* Generator */}
      <Card className="p-5 bg-gradient-to-br from-amber-500/5 via-background to-primary/5">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Lightbulb className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Banco de Ideias — {talent.name}</h3>
            <p className="text-xs text-muted-foreground">
              Gere um lote grande de ideias prontas, cruzando todos os pilares e plataformas. Salve as melhores no backlog em 1 clique.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Contexto opcional (campanha, lançamento, semana, evento)
            </label>
            <Textarea
              placeholder='Ex: "Semana de inscrições abertas pro Eternum Day" ou "Cliente reclamou que tá difícil cobrar caro"'
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plataformas</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {PLATFORMS.map(p => {
                  const on = pickedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        "h-7 px-3 rounded-full text-xs font-medium border transition",
                        on ? "bg-foreground text-background border-foreground" : "bg-muted/50 hover:bg-muted",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pilares ({pickedPillarIds.length || "todos"})
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {pillars.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sem pilares — a IA usará os padrões de negócio.</span>
                )}
                {pillars.map(p => {
                  const on = pickedPillarIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePillar(p.id)}
                      className={cn(
                        "h-7 px-3 rounded-full text-xs font-medium border transition",
                        on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted",
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-2 pt-1">
            <div className="w-28">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantidade</label>
              <Input
                type="number"
                min={6}
                max={40}
                value={count}
                onChange={(e) => setCount(Math.min(40, Math.max(6, Number(e.target.value) || 6)))}
                className="mt-1"
              />
            </div>
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={loading || pickedPlatforms.length === 0}
              className="gap-2 flex-1"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando ideias...</>
                : ideas.length
                  ? <><RefreshCw className="h-4 w-4" /> Gerar novo lote</>
                  : <><Sparkles className="h-4 w-4" /> Gerar ideias agora</>
              }
            </Button>
            {ideas.length > 0 && (
              <Button variant="outline" size="lg" onClick={handleSaveAll} className="gap-2">
                <Plus className="h-4 w-4" /> Salvar todas
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Filters + results */}
      {ideas.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" /> Filtrar:
            </div>
            <FilterChip label="Todos pilares" active={filterPillar === "all"} onClick={() => setFilterPillar("all")} />
            {Array.from(new Set(ideas.map(i => i.pillar_name))).map(name => (
              <FilterChip key={name} label={name} active={filterPillar === name} onClick={() => setFilterPillar(name)} />
            ))}
            <span className="mx-1 text-muted-foreground/40">|</span>
            <FilterChip label="Todas plat." active={filterPlatform === "all"} onClick={() => setFilterPlatform("all")} />
            {Array.from(new Set(ideas.map(i => i.platform))).map(pl => (
              <FilterChip
                key={pl}
                label={PLATFORMS.find(x => x.id === pl)?.label || pl}
                active={filterPlatform === pl}
                onClick={() => setFilterPlatform(pl)}
              />
            ))}
            <span className="mx-1 text-muted-foreground/40">|</span>
            {(["all","quick_win","autoridade","viral","conversao"] as const).map(k => (
              <FilterChip
                key={k}
                label={k === "all" ? "Todas intensidades" : INTENSITY_META[k as Idea["intensity"]].label}
                active={filterIntensity === k}
                onClick={() => setFilterIntensity(k)}
              />
            ))}
            <div className="ml-auto text-xs text-muted-foreground">
              {filtered.length} de {ideas.length} ideias
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(({ idea, idx }) => {
              const platMeta = PLATFORMS.find(p => p.id === idea.platform);
              const intMeta = INTENSITY_META[idea.intensity];
              const IntIcon = intMeta?.icon || Sparkles;
              const isSaved = !!saved[idx];
              return (
                <Card key={idx} className="p-4 flex flex-col gap-3 hover:shadow-md transition">
                  <div className="flex flex-wrap gap-1.5">
                    {platMeta && <Badge variant="outline" className={platMeta.color}>{platMeta.label}</Badge>}
                    {intMeta && (
                      <Badge variant="outline" className={intMeta.cls}>
                        <IntIcon className="h-3 w-3 mr-1" /> {intMeta.label}
                      </Badge>
                    )}
                    <Badge variant="outline">{idea.format}</Badge>
                  </div>

                  <div>
                    <div className="font-semibold text-sm leading-snug">{idea.title}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2">Hook</div>
                    <div className="text-sm italic">"{idea.hook}"</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2">Ângulo</div>
                    <div className="text-xs text-muted-foreground">{idea.angle}</div>
                  </div>

                  <div className="mt-auto pt-2 border-t flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px]">{idea.pillar_name}</Badge>
                    <Button
                      size="sm"
                      variant={isSaved ? "outline" : "default"}
                      onClick={() => !isSaved && handleSave(idea, idx)}
                      disabled={isSaved}
                      className="gap-1.5 h-7"
                    >
                      {isSaved
                        ? <><Check className="h-3.5 w-3.5" /> No backlog</>
                        : <><Plus className="h-3.5 w-3.5" /> Salvar</>
                      }
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {ideas.length === 0 && !loading && (
        <Card className="p-10 text-center">
          <Lightbulb className="h-10 w-10 mx-auto text-amber-500/60 mb-3" />
          <p className="text-sm text-muted-foreground">
            Pronto pra desbloquear o time. Clique em <strong>Gerar ideias agora</strong> e receba um lote completo para esta semana.
          </p>
        </Card>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-full text-xs font-medium border transition",
        active ? "bg-foreground text-background border-foreground" : "bg-muted/40 hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
