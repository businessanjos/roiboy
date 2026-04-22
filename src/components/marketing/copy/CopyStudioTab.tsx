import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy as CopyIcon, Star, Trash2, Loader2, BrainCircuit, ThumbsUp } from "lucide-react";
import { useMarketingCopy, CopyObjective, CopyType, GenerateCopyResponse } from "@/hooks/useMarketingCopy";
import { useMarketingBrandVoice } from "@/hooks/useMarketingBrandVoice";
import { useContentProfile } from "@/contexts/ContentProfileContext";
import { AiSuggestionReviewDialog } from "@/components/marketing/ai/AiSuggestionReviewDialog";
import { useMarketingAiSuggestionReviews } from "@/hooks/useMarketingAiSuggestionReviews";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COPY_LABELS: Record<CopyType, string> = {
  hook: "Hook",
  caption: "Caption",
  script: "Roteiro",
  cta: "CTA",
  title: "Título",
  bio: "Bio",
  email: "E-mail",
  other: "Outro",
};

export function CopyStudioTab() {
  const { history, generateCopy, toggleFavorite, deleteCopy } = useMarketingCopy();
  const { voice } = useMarketingBrandVoice();
  const { selectedProfile } = useContentProfile();
  const { reviews, recordReview } = useMarketingAiSuggestionReviews("generate-marketing-copy");
  const [copyType, setCopyType] = useState<CopyType>("caption");
  const [objective, setObjective] = useState<CopyObjective>("educar");
  const [brief, setBrief] = useState("");
  const [format_, setFormat_] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [hook, setHook] = useState("");
  const [useBrandVoice, setUseBrandVoice] = useState(true);
  const [output, setOutput] = useState("");
  const [lastGeneration, setLastGeneration] = useState<GenerateCopyResponse | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const feedbackSummary = useMemo(() => {
    const accepted = reviews.filter((item) => item.decision === "accepted").length;
    const edited = reviews.filter((item) => item.decision === "edited").length;
    const rejected = reviews.filter((item) => item.decision === "rejected").length;
    return { accepted, edited, rejected };
  }, [reviews]);

  const submit = () => {
    if (!brief.trim()) { toast.error("Descreva o briefing"); return; }
    generateCopy.mutate(
      {
        copyType,
        brief,
        objective,
        format: format_,
        platform,
        hook,
        useBrandVoice,
        profileId: selectedProfile?.id,
        profilePlatform: selectedProfile?.platform,
        profileUsername: selectedProfile?.username,
        profileDisplayName: selectedProfile?.display_name,
      },
      {
        onSuccess: (d) => {
          setOutput(d.output);
          setLastGeneration(d);
          setReviewOpen(true);
        },
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const reviewFields = useMemo(() => {
    const isLongForm = copyType === "caption" || copyType === "script" || copyType === "email" || copyType === "other";
    return [
      {
        key: "output",
        label: copyType === "hook" ? "Copy sugerida" : "Texto sugerido",
        multiline: isLongForm,
        rows: isLongForm ? 8 : 4,
      },
    ];
  }, [copyType]);

  const buildReviewContext = () => ({
    brief,
    copyType,
    objective,
    format: format_,
    platform,
    hook,
    useBrandVoice,
  });

  const registerCopyReview = async (decision: "accepted" | "edited" | "rejected", reviewedOutput: string, notes: string) => {
    if (!lastGeneration) return;
    await recordReview.mutateAsync({
      suggestionType: `copy:${copyType}`,
      sourceFunction: "generate-marketing-copy",
      sourceItemKey: lastGeneration.record.id,
      decision,
      objective,
      profilePlatform: selectedProfile?.platform || platform,
      profileId: selectedProfile?.id,
      profileUsername: selectedProfile?.username,
      suggestionPayload: { output: lastGeneration.output },
      editedPayload: decision === "edited" ? { output: reviewedOutput } : null,
      inputContext: buildReviewContext(),
      decisionNotes: notes,
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="p-6 space-y-4 lg:col-span-1">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
          <div>
            <h3 className="font-semibold">Estúdio de Copy IA</h3>
            <p className="text-xs text-muted-foreground">{voice ? "Treinada no tom da marca" : "Sem tom de voz definido"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={copyType} onValueChange={(v) => setCopyType(v as CopyType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(COPY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Briefing</Label>
          <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Sobre o que é? Qual a mensagem? Qual a oferta?" rows={5} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Formato</Label>
            <Input value={format_} onChange={(e) => setFormat_(e.target.value)} placeholder="reel, carrossel..." />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Objetivo</Label>
          <Select value={objective} onValueChange={(v) => setObjective(v as CopyObjective)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="educar">Educar</SelectItem>
              <SelectItem value="converter">Converter</SelectItem>
              <SelectItem value="reter">Reter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedProfile && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Base ativa: <strong>@{selectedProfile.username}</strong> · {selectedProfile.platform}
          </div>
        )}

        {(copyType === "caption" || copyType === "script") && (
          <div className="space-y-2">
            <Label>Hook (opcional)</Label>
            <Input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Frase de abertura desejada" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="bv" className="text-sm">Usar tom da marca</Label>
          <Switch id="bv" checked={useBrandVoice} onCheckedChange={setUseBrandVoice} disabled={!voice} />
        </div>

        <Button onClick={submit} disabled={generateCopy.isPending} className="w-full">
          {generateCopy.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Gerar copy
        </Button>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <span className="font-medium">Aprendizado das revisões</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Aceitas: {feedbackSummary.accepted}</Badge>
            <Badge variant="outline">Editadas: {feedbackSummary.edited}</Badge>
            <Badge variant="outline">Descartadas: {feedbackSummary.rejected}</Badge>
          </div>
          <p>A cada geração você pode aceitar, ajustar ou descartar a sugestão para refinar as próximas copies.</p>
        </div>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {output && (
          <Card className="p-6 space-y-3 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Resultado</Badge>
                {lastGeneration && <Badge variant="outline"><ThumbsUp className="h-3 w-3 mr-1" />Revisão disponível</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)} disabled={!lastGeneration}>Revisar</Button>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(output)}><CopyIcon className="h-3 w-3 mr-1" />Copiar</Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm font-sans">{output}</pre>
          </Card>
        )}

        <div>
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">Histórico</h4>
          <div className="space-y-3">
            {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma copy gerada ainda.</p>}
            {history.map((h) => (
              <Card key={h.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{COPY_LABELS[h.copy_type]}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleFavorite.mutate({ id: h.id, is_favorite: !h.is_favorite })}>
                      <Star className={`h-3 w-3 ${h.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(h.output)}><CopyIcon className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteCopy.mutate(h.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">"{h.prompt}"</p>
                <pre className="whitespace-pre-wrap text-sm font-sans border-l-2 border-primary/30 pl-3">{h.output}</pre>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <AiSuggestionReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Revisar sugestão de copy"
        description="Ajuste o texto antes de aprovar e registre sua decisão para a IA aprender com o seu padrão editorial."
        fields={reviewFields}
        initialValue={{ output: lastGeneration?.output || "" }}
        acceptLabel="Aceitar texto"
        editLabel="Salvar edição"
        rejectLabel="Descartar"
        onAcceptOriginal={async (notes) => {
          await registerCopyReview("accepted", lastGeneration?.output || "", notes);
          setReviewOpen(false);
        }}
        onSaveEdits={async (value, notes) => {
          const nextOutput = value.output || "";
          setOutput(nextOutput);
          await registerCopyReview("edited", nextOutput, notes);
          setReviewOpen(false);
        }}
        onReject={async (value, notes) => {
          await registerCopyReview("rejected", value.output || lastGeneration?.output || "", notes);
          setReviewOpen(false);
        }}
        isSubmitting={recordReview.isPending}
      />
    </div>
  );
}
