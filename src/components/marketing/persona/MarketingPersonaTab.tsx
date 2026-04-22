import { useState, useEffect, useMemo } from "react";
import { useMarketingPersona, PersonaField, isArrayField, MarketingPersona } from "@/hooks/useMarketingPersona";
import { useInstagramHighlightsCache, type HighlightItem } from "@/hooks/useInstagramHighlightsCache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Loader2, Plus, X, Target, Brain, Heart, MessageSquare, Database, Instagram, TrendingUp, Hash, Film, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { PersonaAbCompareDialog } from "./PersonaAbCompareDialog";
import { PersonaAbStatsPanel } from "./PersonaAbStatsPanel";
import { useContentProfile } from "@/contexts/ContentProfileContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const AI_PERSONA_ALLOWED_EMAIL = "m.quintana@me.com";

function formatHighlight(it: HighlightItem | string, prefix = ""): string {
  if (typeof it === "string") return it;
  if (it.avg_engagement) return `${prefix}${it.label} (${it.avg_engagement}% eng)`;
  return `${prefix}${it.label}${it.count ? ` (${it.count}x)` : ""}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

interface FieldDef {
  key: PersonaField;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

const SECTIONS: { id: string; title: string; icon: any; description: string; fields: FieldDef[] }[] = [
  {
    id: "identity",
    title: "Identidade",
    icon: Target,
    description: "Quem é essa pessoa demograficamente",
    fields: [
      { key: "profession", label: "Profissão", placeholder: "Ex: Médica esteta, Biomédica esteta, Dentista com foco em HOF" },
      { key: "education", label: "Formação", placeholder: "Ex: Medicina + pós em Medicina Estética" },
      { key: "age_range", label: "Faixa etária", placeholder: "Ex: 32-45 anos" },
      { key: "gender", label: "Gênero predominante", placeholder: "Ex: Feminino (90%)" },
      { key: "location", label: "Localização", placeholder: "Ex: Capitais e cidades grandes do Sudeste e Sul" },
    ],
  },
  {
    id: "business",
    title: "Negócio",
    icon: Database,
    description: "Como ela trabalha e o porte",
    fields: [
      { key: "business_type", label: "Tipo de negócio", placeholder: "Ex: Clínica própria de estética avançada" },
      { key: "business_size", label: "Porte", placeholder: "Ex: Solo ou com 2-4 colaboradores" },
      { key: "revenue_range", label: "Faturamento médio mensal", placeholder: "Ex: R$ 30k a R$ 80k" },
      { key: "years_in_business", label: "Tempo de mercado", placeholder: "Ex: 3 a 8 anos" },
    ],
  },
  {
    id: "psychographic",
    title: "Mente & Coração",
    icon: Heart,
    description: "O que a move por dentro — base de toda copy",
    fields: [
      { key: "pains", label: "Dores principais", placeholder: "Ex: Não consegue precificar serviços premium" },
      { key: "desires", label: "Desejos / Transformação buscada", placeholder: "Ex: Ter agenda cheia com pacientes premium" },
      { key: "objections", label: "Objeções comuns", placeholder: "Ex: 'Já tentei outro mentor e não funcionou'" },
      { key: "emotional_triggers", label: "Gatilhos emocionais", placeholder: "Ex: Medo de ficar para trás" },
    ],
  },
  {
    id: "language",
    title: "Linguagem & Hábitos",
    icon: MessageSquare,
    description: "Como ela fala, onde está, o que consome",
    fields: [
      { key: "vocabulary", label: "Vocabulário do nicho", placeholder: "Ex: harmonização, bioestimulador, ticket médio" },
      { key: "channels", label: "Canais frequentados", placeholder: "Ex: Instagram, congressos da SBME" },
      { key: "references_consumed", label: "Referências consumidas", placeholder: "Ex: @drahaileealuotto, podcasts de medicina estética" },
    ],
  },
  {
    id: "context",
    title: "Contexto Profundo",
    icon: Brain,
    description: "A vida dela em poucas palavras",
    fields: [
      { key: "daily_routine", label: "Rotina diária", placeholder: "Como é um dia típico dela?", multiline: true },
      { key: "biggest_dream", label: "Maior sonho", placeholder: "Profissionalmente, o que ela mais quer?", multiline: true },
      { key: "biggest_fear", label: "Maior medo", placeholder: "O que mais a assusta?", multiline: true },
      { key: "notes", label: "Notas extras", placeholder: "Outras observações importantes", multiline: true },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

export function MarketingPersonaTab() {
  const { persona, isLoading, upsertPersona, suggestField, submitAbFeedback } = useMarketingPersona();
  const { selectedProfile } = useContentProfile();
  const { currentUser } = useCurrentUser();
  const canUseAiSuggest = currentUser?.email?.toLowerCase() === AI_PERSONA_ALLOWED_EMAIL;
  // Só faz sentido usar perfil ativo quando ele é Instagram (única plataforma analisada hoje pela Persona)
  const activeInstagramProfileId = selectedProfile?.platform === "instagram" ? selectedProfile.id : null;
  const activeInstagramUsername = selectedProfile?.platform === "instagram" ? selectedProfile.username : null;

  const [draft, setDraft] = useState<Partial<MarketingPersona>>({});
  const [arrayInputs, setArrayInputs] = useState<Record<string, string>>({});
  const [suggestingField, setSuggestingField] = useState<PersonaField | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [highlights, setHighlights] = useState<{
    formats: string[];
    themes: string[];
    hashtags: string[];
    instagramUsername?: string | null;
    updatedAt?: number;
  } | null>(null);

  // A/B test state
  const [abDialog, setAbDialog] = useState<{
    open: boolean;
    field: PersonaField | null;
    fieldLabel: string;
    variantA: string | string[];
    variantB: string | string[];
    abTestId: string | null;
    hasHighlights: boolean;
  }>({ open: false, field: null, fieldLabel: "", variantA: "", variantB: "", abTestId: null, hasHighlights: false });
  // Mapa field -> { abTestId, chosenValue } para detectar save implícito
  const [pendingAbApplied, setPendingAbApplied] = useState<Record<string, { abTestId: string; value: any }>>({});

  useEffect(() => {
    if (persona) setDraft(persona);
  }, [persona]);

  const setField = (key: PersonaField, value: any) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setIsDirty(true);
  };

  const addArrayItem = (key: PersonaField) => {
    const v = (arrayInputs[key] || "").trim();
    if (!v) return;
    const current = (draft[key] as string[]) || [];
    setField(key, [...current, v]);
    setArrayInputs((s) => ({ ...s, [key]: "" }));
  };

  const removeArrayItem = (key: PersonaField, idx: number) => {
    const current = (draft[key] as string[]) || [];
    setField(key, current.filter((_, i) => i !== idx));
  };

  const findFieldLabel = (key: PersonaField) => {
    for (const sec of SECTIONS) {
      const f = sec.fields.find((x) => x.key === key);
      if (f) return f.label;
    }
    return key;
  };

  const handleSuggest = async (key: PersonaField) => {
    setSuggestingField(key);
    try {
      const res = await suggestField.mutateAsync({ field: key, instagramProfileId: activeInstagramProfileId });

      // Atualiza painel de destaques
      if (res.instagramHighlights && (res.instagramHighlights.formats?.length || res.instagramHighlights.themes?.length || res.instagramHighlights.hashtags?.length)) {
        setHighlights({
          formats: res.instagramHighlights.formats || [],
          themes: res.instagramHighlights.themes || [],
          hashtags: res.instagramHighlights.hashtags || [],
          instagramUsername: res.instagramUsername,
          updatedAt: Date.now(),
        });
      }

      // Se temos A/B test válido, abre o diálogo de comparação
      if (res.abTestId && res.variantA !== undefined && res.variantB !== undefined) {
        setAbDialog({
          open: true,
          field: key,
          fieldLabel: findFieldLabel(key),
          variantA: res.variantA as any,
          variantB: res.variantB as any,
          abTestId: res.abTestId,
          hasHighlights: !!res.hasHighlights,
        });
      } else {
        // Fallback: aplica direto
        applySuggestionToField(key, res.suggestion);
      }
    } catch (e: any) {
      // toast já tratado no hook
    } finally {
      setSuggestingField(null);
    }
  };

  const applySuggestionToField = (key: PersonaField, suggestion: string | string[]) => {
    if (isArrayField(key)) {
      const items = (suggestion as string[]) || [];
      const current = (draft[key] as string[]) || [];
      const merged = Array.from(new Set([...current, ...items]));
      setField(key, merged);
      toast.success(`${items.length} sugestões adicionadas`);
    } else {
      setField(key, suggestion as string);
      toast.success("Sugestão aplicada");
    }
  };

  const handleAbChoose = async (variant: "a" | "b") => {
    const { field, abTestId, variantA, variantB } = abDialog;
    if (!field || !abTestId) return;
    const value = variant === "a" ? variantA : variantB;
    applySuggestionToField(field, value);
    // marca para detecção de save sem edição
    setPendingAbApplied((m) => ({ ...m, [field]: { abTestId, value } }));
    try {
      await submitAbFeedback.mutateAsync({ abTestId, action: "choose", variant });
    } catch (_) {}
    setAbDialog((d) => ({ ...d, open: false }));
  };

  const handleAbFeedback = async (variant: "a" | "b", feedback: "up" | "down") => {
    if (!abDialog.abTestId) return;
    try {
      await submitAbFeedback.mutateAsync({ abTestId: abDialog.abTestId, action: "feedback", variant, feedback });
    } catch (_) {}
  };

  const handleSave = async () => {
    await upsertPersona.mutateAsync(draft);
    setIsDirty(false);
    toast.success("Persona salva");

    // Captura aceite implícito: para cada campo com A/B aplicado pendente, registra save
    const entries = Object.entries(pendingAbApplied);
    for (const [field, info] of entries) {
      const finalValue = (draft as any)[field];
      try {
        await submitAbFeedback.mutateAsync({
          abTestId: info.abTestId,
          action: "save",
          value: finalValue,
        });
      } catch (_) {}
    }
    setPendingAbApplied({});
  };

  // Cálculo de completude
  const filledCount = ALL_FIELDS.filter((k) => {
    const v = draft[k];
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  }).length;
  const completeness = Math.round((filledCount / ALL_FIELDS.length) * 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Target className="h-6 w-6 text-primary" />
                Persona do Público-Alvo
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                Defina com profundidade quem é a pessoa que você quer atingir. Toda IA da área de Marketing (Copy, Ideias, Trends, Editorial) vai usar essa Persona pra falar diretamente com ela.
              </CardDescription>
            </div>
            <Button
              onClick={handleSave}
              disabled={!isDirty || upsertPersona.isPending}
              size="lg"
              className="shrink-0"
            >
              {upsertPersona.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Persona
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completude da Persona</span>
              <span className="font-semibold">{completeness}% ({filledCount}/{ALL_FIELDS.length} campos)</span>
            </div>
            <Progress value={completeness} className="h-2" />
            {completeness < 60 && canUseAiSuggest && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                Dica: clique em <strong>Sugerir com IA</strong> em cada campo. A IA analisa seus clientes reais de Rykas Mentoring e Eternum Club pra sugerir o conteúdo certo.
              </p>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Painel de resultados do A/B Test */}
      <PersonaAbStatsPanel />

      {/* Destaques do Instagram (cache atualizado por cron diário + fallback ao vivo) */}
      <InstagramHighlightsPanel
        sessionHighlights={highlights}
        profileId={activeInstagramProfileId}
        fallbackUsername={activeInstagramUsername}
      />


      {/* Sections */}
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className="h-5 w-5 text-primary" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {section.fields.map((f) => (
                <PersonaFieldEditor
                  key={f.key}
                  field={f}
                  value={draft[f.key]}
                  inputValue={arrayInputs[f.key] || ""}
                  onInputChange={(v) => setArrayInputs((s) => ({ ...s, [f.key]: v }))}
                  onChange={(v) => setField(f.key, v)}
                  onAddItem={() => addArrayItem(f.key)}
                  onRemoveItem={(i) => removeArrayItem(f.key, i)}
                  onSuggest={() => handleSuggest(f.key)}
                  isSuggesting={suggestingField === f.key}
                  canUseAiSuggest={canUseAiSuggest}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {isDirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button size="lg" onClick={handleSave} disabled={upsertPersona.isPending} className="shadow-lg">
            {upsertPersona.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      )}

      <PersonaAbCompareDialog
        open={abDialog.open}
        onOpenChange={(o) => setAbDialog((d) => ({ ...d, open: o }))}
        fieldLabel={abDialog.fieldLabel}
        variantA={abDialog.variantA}
        variantB={abDialog.variantB}
        isArray={abDialog.field ? isArrayField(abDialog.field) : false}
        hasHighlights={abDialog.hasHighlights}
        onChoose={handleAbChoose}
        onFeedback={handleAbFeedback}
      />
    </div>
  );
}

interface PersonaFieldEditorProps {
  field: FieldDef;
  value: any;
  inputValue: string;
  onInputChange: (v: string) => void;
  onChange: (v: any) => void;
  onAddItem: () => void;
  onRemoveItem: (i: number) => void;
  onSuggest: () => void;
  isSuggesting: boolean;
  canUseAiSuggest: boolean;
}

function PersonaFieldEditor({ field, value, inputValue, onInputChange, onChange, onAddItem, onRemoveItem, onSuggest, isSuggesting, canUseAiSuggest }: PersonaFieldEditorProps) {
  const isArray = isArrayField(field.key);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{field.label}</Label>
        {canUseAiSuggest && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSuggest}
            disabled={isSuggesting}
            className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
          >
            {isSuggesting ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analisando...</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1" /> Sugerir com IA</>
            )}
          </Button>
        )}
      </div>

      {isArray ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={field.placeholder}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddItem();
                }
              }}
            />
            <Button type="button" variant="outline" size="icon" onClick={onAddItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {Array.isArray(value) && value.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.map((item: string, i: number) => (
                <Badge key={i} variant="secondary" className="pl-3 pr-1 py-1 gap-1 text-sm font-normal">
                  {item}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(i)}
                    className="ml-1 rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : field.multiline ? (
        <Textarea
          placeholder={field.placeholder}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      ) : (
        <Input
          placeholder={field.placeholder}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function HighlightGroup({ icon: Icon, label, items, accent }: { icon: any; label: string; items: string[]; accent: string }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${accent}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <Badge key={i} variant="secondary" className="text-xs font-normal">
              {it}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Sem dados suficientes</p>
      )}
    </div>
  );
}

interface InstagramHighlightsPanelProps {
  sessionHighlights: {
    formats: string[];
    themes: string[];
    hashtags: string[];
    instagramUsername?: string | null;
    updatedAt?: number;
  } | null;
  profileId?: string | null;
  fallbackUsername?: string | null;
}

function InstagramHighlightsPanel({ sessionHighlights, profileId, fallbackUsername }: InstagramHighlightsPanelProps) {
  const { highlights: cached, isLoading, refreshNow } = useInstagramHighlightsCache(profileId);

  // Prioriza dados em-sessão (acabou de rodar IA) sobre cache
  const display = useMemo(() => {
    if (sessionHighlights && (sessionHighlights.formats.length || sessionHighlights.themes.length || sessionHighlights.hashtags.length)) {
      return {
        formats: sessionHighlights.formats,
        themes: sessionHighlights.themes,
        hashtags: sessionHighlights.hashtags,
        username: fallbackUsername || sessionHighlights.instagramUsername || cached?.username || null,
        computedAt: sessionHighlights.updatedAt ? new Date(sessionHighlights.updatedAt).toISOString() : cached?.computed_at,
        postsAnalyzed: cached?.posts_analyzed || 0,
        source: "live" as const,
      };
    }
    if (cached) {
      return {
        formats: (cached.formats || []).map((it) => formatHighlight(it)),
        themes: (cached.themes || []).map((it) => formatHighlight(it)),
        hashtags: (cached.hashtags || []).map((it) => formatHighlight(it, "#")),
        username: fallbackUsername || cached.username,
        computedAt: cached.computed_at,
        postsAnalyzed: cached.posts_analyzed,
        source: "cache" as const,
      };
    }
    return null;
  }, [sessionHighlights, cached]);

  if (isLoading || !display) return null;
  const hasAny = display.formats.length || display.themes.length || display.hashtags.length;
  if (!hasAny) return null;

  return (
    <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Instagram className="h-5 w-5 text-pink-500" />
              Destaques que a IA usa como base
            </CardTitle>
            <CardDescription className="mt-1">
              Top 3 formatos, temas e hashtags com maior engajamento — recalculados automaticamente todos os dias.
              {display.computedAt && (
                <> · Atualizado {timeAgo(display.computedAt)} {display.postsAnalyzed > 0 && `· ${display.postsAnalyzed} posts analisados`}</>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {display.username && (
              <Badge variant="outline" className="border-pink-500/40 text-pink-600 dark:text-pink-400 gap-1.5">
                <Instagram className="h-3 w-3" />
                @{display.username}
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshNow.mutate()}
              disabled={refreshNow.isPending}
              className="h-8 gap-1.5"
            >
              {refreshNow.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Atualizar agora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <HighlightGroup icon={Film} label="Top 3 Formatos" items={display.formats} accent="text-blue-500" />
        <HighlightGroup icon={TrendingUp} label="Top 3 Temas" items={display.themes} accent="text-amber-500" />
        <HighlightGroup icon={Hash} label="Top 3 Hashtags" items={display.hashtags} accent="text-pink-500" />
      </CardContent>
    </Card>
  );
}
