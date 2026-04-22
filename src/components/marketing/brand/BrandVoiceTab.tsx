import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Instagram, Wand2, CheckCircle2, Pencil, AlertTriangle } from "lucide-react";
import { useMarketingBrandVoice } from "@/hooks/useMarketingBrandVoice";
import { useMarketingPersona } from "@/hooks/useMarketingPersona";
import { useMarketingReferences } from "@/hooks/useMarketingReferences";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildMarketingConsistencyReport } from "@/lib/marketingConsistency";
import { MarketingConsistencyAlertDialog } from "@/components/marketing/ai/MarketingConsistencyAlertDialog";

export function BrandVoiceTab() {
  const { voice, isLoading, learnFromInstagram, updateVoice } = useMarketingBrandVoice();
  const { persona } = useMarketingPersona();
  const { references } = useMarketingReferences();
  const [igUsername, setIgUsername] = useState("brunapieri");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [manualPosts, setManualPosts] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [pendingSave, setPendingSave] = useState<any | null>(null);

  const currentVoiceState = editing && draft ? {
    personality: draft.personality,
    tone_keywords: draft.tone_keywords.split(",").map((s: string) => s.trim()).filter(Boolean),
    forbidden_words: draft.forbidden_words.split(",").map((s: string) => s.trim()).filter(Boolean),
    signature_phrases: draft.signature_phrases.split("\n").map((s: string) => s.trim()).filter(Boolean),
    emoji_style: draft.emoji_style,
    hashtag_strategy: draft.hashtag_strategy,
    target_audience: draft.target_audience,
    niche: draft.niche,
    ai_summary: draft.ai_summary,
  } : voice;

  const consistencyReport = useMemo(() => buildMarketingConsistencyReport({
    persona,
    voice: currentVoiceState,
    references,
  }), [persona, currentVoiceState, references]);

  const startEdit = () => {
    setDraft({
      personality: voice?.personality || "",
      tone_keywords: voice?.tone_keywords?.join(", ") || "",
      forbidden_words: voice?.forbidden_words?.join(", ") || "",
      signature_phrases: voice?.signature_phrases?.join("\n") || "",
      emoji_style: voice?.emoji_style || "",
      hashtag_strategy: voice?.hashtag_strategy || "",
      target_audience: voice?.target_audience || "",
      niche: voice?.niche || "",
      ai_summary: voice?.ai_summary || "",
    });
    setEditing(true);
  };

  const persistVoice = (payload: any) => {
    updateVoice.mutate(payload, { onSuccess: () => setEditing(false) });
  };

  const saveEdit = () => {
    const payload = {
      personality: draft.personality,
      tone_keywords: draft.tone_keywords.split(",").map((s: string) => s.trim()).filter(Boolean),
      forbidden_words: draft.forbidden_words.split(",").map((s: string) => s.trim()).filter(Boolean),
      signature_phrases: draft.signature_phrases.split("\n").map((s: string) => s.trim()).filter(Boolean),
      emoji_style: draft.emoji_style,
      hashtag_strategy: draft.hashtag_strategy,
      target_audience: draft.target_audience,
      niche: draft.niche,
      ai_summary: draft.ai_summary,
    };

    const report = buildMarketingConsistencyReport({ persona, voice: payload, references });
    if (report.blockingIssues.length > 0) {
      setPendingSave(payload);
      return;
    }

    persistVoice(payload);
  };

  const runLearn = () => {
    const posts = manualPosts.split("\n---\n").map((s) => s.trim()).filter(Boolean);
    learnFromInstagram.mutate({
      instagramUsername: igUsername || undefined,
      manualPosts: posts.length > 0 ? posts : undefined,
      niche: niche || undefined,
      targetAudience: audience || undefined,
    });
  };

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary/10 text-primary"><Wand2 className="h-5 w-5" /></div>
          <div>
            <h3 className="font-semibold">Treinar com Instagram</h3>
            <p className="text-xs text-muted-foreground">A IA analisa posts e extrai o tom de voz</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1"><Instagram className="h-3 w-3" /> Usuário do Instagram</Label>
          <Input value={igUsername} onChange={(e) => setIgUsername(e.target.value)} placeholder="brunapieri" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nicho</Label>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex: mentoria para médicos" />
          </div>
          <div className="space-y-2">
            <Label>Público-alvo</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ex: médicos 30-50 anos" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Posts manuais (opcional, separe com <code className="text-xs bg-muted px-1">---</code>)</Label>
          <Textarea
            value={manualPosts}
            onChange={(e) => setManualPosts(e.target.value)}
            placeholder="Cole captions de posts seus aqui se o IG estiver bloqueando"
            rows={6}
          />
        </div>

        <Button onClick={runLearn} disabled={learnFromInstagram.isPending} className="w-full">
          <Sparkles className="h-4 w-4 mr-2" />
          {learnFromInstagram.isPending ? "Aprendendo..." : "Aprender tom de voz"}
        </Button>

        {voice?.learned_from_instagram_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            Última análise: {format(new Date(voice.learned_from_instagram_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} ({voice.posts_analyzed_count} posts)
          </p>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Tom de voz atual</h3>
          {voice && !editing && (
            <Button variant="ghost" size="sm" onClick={startEdit}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
          )}
        </div>

        {consistencyReport.issues.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validação automática ativa</AlertTitle>
            <AlertDescription>
              {consistencyReport.blockingIssues.length > 0
                ? `Há ${consistencyReport.blockingIssues.length} inconsistência(s) entre Persona, Tom de Voz e Referências para revisar antes de aplicar.`
                : "Os sinais principais estão alinhados, mas ainda há melhorias sugeridas para aumentar a confiança das próximas recomendações."}
            </AlertDescription>
          </Alert>
        )}

        {!voice && !editing && (
          <p className="text-sm text-muted-foreground">Ainda não há tom de voz definido. Use o painel ao lado para treinar com Instagram, ou clique abaixo para criar manualmente.</p>
        )}
        {!voice && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>Criar manualmente</Button>
        )}

        {voice && !editing && (
          <div className="space-y-3 text-sm">
            {voice.personality && <div><span className="font-medium">Personalidade:</span> <p className="text-muted-foreground">{voice.personality}</p></div>}
            {voice.tone_keywords?.length > 0 && (
              <div><span className="font-medium">Tom:</span> <div className="flex flex-wrap gap-1 mt-1">{voice.tone_keywords.map((k) => <Badge key={k} variant="secondary">{k}</Badge>)}</div></div>
            )}
            {voice.forbidden_words?.length > 0 && (
              <div><span className="font-medium">Evitar:</span> <div className="flex flex-wrap gap-1 mt-1">{voice.forbidden_words.map((k) => <Badge key={k} variant="outline" className="border-destructive/40 text-destructive">{k}</Badge>)}</div></div>
            )}
            {voice.signature_phrases?.length > 0 && (
              <div><span className="font-medium">Frases assinatura:</span> <ul className="list-disc list-inside text-muted-foreground">{voice.signature_phrases.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
            )}
            {voice.emoji_style && <div><span className="font-medium">Emojis:</span> <span className="text-muted-foreground">{voice.emoji_style}</span></div>}
            {voice.hashtag_strategy && <div><span className="font-medium">Hashtags:</span> <span className="text-muted-foreground">{voice.hashtag_strategy}</span></div>}
            {voice.target_audience && <div><span className="font-medium">Público:</span> <span className="text-muted-foreground">{voice.target_audience}</span></div>}
            {voice.niche && <div><span className="font-medium">Nicho:</span> <span className="text-muted-foreground">{voice.niche}</span></div>}
            {voice.ai_summary && <div className="p-3 rounded-md bg-muted/50 italic text-muted-foreground">{voice.ai_summary}</div>}
          </div>
        )}

        {editing && draft && (
          <div className="space-y-3">
            <div><Label>Personalidade</Label><Textarea rows={3} value={draft.personality} onChange={(e) => setDraft({ ...draft, personality: e.target.value })} /></div>
            <div><Label>Tom (vírgulas)</Label><Input value={draft.tone_keywords} onChange={(e) => setDraft({ ...draft, tone_keywords: e.target.value })} /></div>
            <div><Label>Evitar (vírgulas)</Label><Input value={draft.forbidden_words} onChange={(e) => setDraft({ ...draft, forbidden_words: e.target.value })} /></div>
            <div><Label>Frases assinatura (uma por linha)</Label><Textarea rows={3} value={draft.signature_phrases} onChange={(e) => setDraft({ ...draft, signature_phrases: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Estilo emoji</Label><Input value={draft.emoji_style} onChange={(e) => setDraft({ ...draft, emoji_style: e.target.value })} /></div>
              <div><Label>Hashtags</Label><Input value={draft.hashtag_strategy} onChange={(e) => setDraft({ ...draft, hashtag_strategy: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nicho</Label><Input value={draft.niche} onChange={(e) => setDraft({ ...draft, niche: e.target.value })} /></div>
              <div><Label>Público</Label><Input value={draft.target_audience} onChange={(e) => setDraft({ ...draft, target_audience: e.target.value })} /></div>
            </div>
            <div><Label>Resumo IA</Label><Textarea rows={3} value={draft.ai_summary} onChange={(e) => setDraft({ ...draft, ai_summary: e.target.value })} /></div>
            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={updateVoice.isPending}>Salvar</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Card>

      <MarketingConsistencyAlertDialog
        open={!!pendingSave}
        onOpenChange={(open) => { if (!open) setPendingSave(null); }}
        title="Reveja antes de aplicar o tom de voz"
        description="Detectamos conflitos que podem reduzir a confiança das sugestões de IA."
        report={buildMarketingConsistencyReport({ persona, voice: pendingSave, references })}
        confirmLabel="Aplicar mesmo assim"
        onConfirm={() => {
          if (!pendingSave) return;
          persistVoice(pendingSave);
          setPendingSave(null);
        }}
      />
    </div>
  );
}
