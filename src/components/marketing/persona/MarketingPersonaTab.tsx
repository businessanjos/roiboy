import { useState, useEffect } from "react";
import { useMarketingPersona, PersonaField, isArrayField, MarketingPersona } from "@/hooks/useMarketingPersona";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Loader2, Plus, X, Target, Brain, Heart, MessageSquare, Database, Instagram, TrendingUp, Hash, Film } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { PersonaAbCompareDialog } from "./PersonaAbCompareDialog";
import { PersonaAbStatsPanel } from "./PersonaAbStatsPanel";

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

  const handleSuggest = async (key: PersonaField) => {
    setSuggestingField(key);
    try {
      const res = await suggestField.mutateAsync(key);

      // Atualiza painel de destaques se a IA retornou
      if (res.instagramHighlights && (res.instagramHighlights.formats?.length || res.instagramHighlights.themes?.length || res.instagramHighlights.hashtags?.length)) {
        setHighlights({
          formats: res.instagramHighlights.formats || [],
          themes: res.instagramHighlights.themes || [],
          hashtags: res.instagramHighlights.hashtags || [],
          instagramUsername: res.instagramUsername,
          updatedAt: Date.now(),
        });
      }

      const basedOnParts: string[] = [];
      if (res.basedOnRealData) basedOnParts.push(`${res.clientsAnalyzed} clientes`);
      if (res.basedOnInstagram && res.instagramUsername) basedOnParts.push(`@${res.instagramUsername}`);
      const basedOnLabel = basedOnParts.length ? ` (baseado em ${basedOnParts.join(" + ")})` : "";

      if (isArrayField(key)) {
        const items = (res.suggestion as string[]) || [];
        const current = (draft[key] as string[]) || [];
        const merged = Array.from(new Set([...current, ...items]));
        setField(key, merged);
        toast.success(`${items.length} sugestões adicionadas${basedOnLabel}`);
      } else {
        setField(key, res.suggestion as string);
        toast.success(`Sugestão aplicada${basedOnLabel}`);
      }
    } catch (e: any) {
      // toast já tratado no hook
    } finally {
      setSuggestingField(null);
    }
  };

  const handleSave = async () => {
    await upsertPersona.mutateAsync(draft);
    setIsDirty(false);
    toast.success("Persona salva");
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
            {completeness < 60 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                Dica: clique em <strong>Sugerir com IA</strong> em cada campo. A IA analisa seus clientes reais de Rykas Mentoring e Eternum Club pra sugerir o conteúdo certo.
              </p>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Destaques do Instagram (atualizados a cada Sugestão da IA) */}
      {highlights && (highlights.formats.length > 0 || highlights.themes.length > 0 || highlights.hashtags.length > 0) && (
        <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 via-background to-background">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Instagram className="h-5 w-5 text-pink-500" />
                  Destaques que a IA usou como base
                </CardTitle>
                <CardDescription className="mt-1">
                  Top 3 formatos, temas e hashtags com maior engajamento — extraídos automaticamente dos posts recentes.
                </CardDescription>
              </div>
              {highlights.instagramUsername && (
                <Badge variant="outline" className="border-pink-500/40 text-pink-600 dark:text-pink-400 gap-1.5">
                  <Instagram className="h-3 w-3" />
                  baseado em @{highlights.instagramUsername}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <HighlightGroup icon={Film} label="Top 3 Formatos" items={highlights.formats} accent="text-blue-500" />
            <HighlightGroup icon={TrendingUp} label="Top 3 Temas" items={highlights.themes} accent="text-amber-500" />
            <HighlightGroup icon={Hash} label="Top 3 Hashtags" items={highlights.hashtags} accent="text-pink-500" />
          </CardContent>
        </Card>
      )}

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
}

function PersonaFieldEditor({ field, value, inputValue, onInputChange, onChange, onAddItem, onRemoveItem, onSuggest, isSuggesting }: PersonaFieldEditorProps) {
  const isArray = isArrayField(field.key);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{field.label}</Label>
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
