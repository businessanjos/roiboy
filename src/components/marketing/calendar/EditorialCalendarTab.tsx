import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronLeft, ChevronRight, Plus, Instagram, Youtube, Music2, Linkedin, Globe, BrainCircuit } from "lucide-react";
import { useMarketingIdeas, MarketingIdea } from "@/hooks/useMarketingIdeas";
import { useContentProfile } from "@/contexts/ContentProfileContext";
import { useMarketingWeeklyCalendar } from "@/hooks/useMarketingWeeklyCalendar";
import { useMarketingCopy } from "@/hooks/useMarketingCopy";
import { AiSuggestionReviewDialog } from "@/components/marketing/ai/AiSuggestionReviewDialog";
import { useMarketingAiSuggestionReviews } from "@/hooks/useMarketingAiSuggestionReviews";
import { IdeaDialog } from "../ideas/IdeaDialog";
import { toast } from "sonner";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, format, isSameMonth, isSameDay, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  linkedin: Linkedin,
  multi: Globe,
  other: Globe,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  tiktok: "bg-foreground/10 text-foreground border-foreground/30",
  youtube: "bg-red-500/10 text-red-600 border-red-500/30",
  linkedin: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  multi: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

export function EditorialCalendarTab() {
  const { ideas, updateIdea, createIdea } = useMarketingIdeas();
  const { generateCopy } = useMarketingCopy();
  const { selectedProfile } = useContentProfile();
  const { suggestWeeklyCalendar } = useMarketingWeeklyCalendar();
  const { reviews, recordReview } = useMarketingAiSuggestionReviews("suggest-weekly-marketing-calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [openIdea, setOpenIdea] = useState<MarketingIdea | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reviewingIndex, setReviewingIndex] = useState<number | null>(null);
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [copyingKey, setCopyingKey] = useState<string | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState<{
    item: WeeklySuggestionItem;
    hookOptions: string[];
    ctaOptions: string[];
    selectedHook: string;
    selectedCta: string;
    draft: string;
  } | null>(null);

  type WeeklySuggestionItem = NonNullable<typeof suggestWeeklyCalendar.data>["schedule"][number];

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const scheduled = useMemo(() => {
    return ideas.filter((i) => {
      const date = i.scheduled_for || i.scheduled_at || i.planned_date;
      if (!date) return false;
      if (platformFilter !== "all" && (i.publish_platform || i.platform) !== platformFilter) return false;
      return true;
    });
  }, [ideas, platformFilter]);

  const unscheduled = useMemo(
    () => ideas.filter((i) => !i.scheduled_for && !i.scheduled_at && !i.planned_date && i.status !== "posted" && i.status !== "archived"),
    [ideas],
  );

  const feedbackSummary = useMemo(() => ({
    accepted: reviews.filter((item) => item.decision === "accepted").length,
    edited: reviews.filter((item) => item.decision === "edited").length,
    rejected: reviews.filter((item) => item.decision === "rejected").length,
  }), [reviews]);

  const ideasOnDay = (day: Date) =>
    scheduled.filter((i) => {
      const date = i.scheduled_for || i.scheduled_at || i.planned_date;
      if (!date) return false;
      try {
        return isSameDay(parseISO(date as string), day);
      } catch {
        return false;
      }
    });

  const handleDrop = (day: Date) => {
    if (!draggedId) return;
    const iso = day.toISOString();
    updateIdea.mutate({ id: draggedId, scheduled_for: iso, status: "scheduled" });
    setDraggedId(null);
  };

  const handleGenerateWeek = async () => {
    if (!selectedProfile) return;

    await suggestWeeklyCalendar.mutateAsync({
      profileId: selectedProfile.id,
      platform: selectedProfile.platform,
      username: selectedProfile.username,
      displayName: selectedProfile.display_name,
    });
  };

  const getSuggestionKey = (item: WeeklySuggestionItem) => `${item.date}:${item.channel}:${item.title}`;

  const handleCreateFromSuggestion = async (
    item: WeeklySuggestionItem,
    overrides?: Partial<Pick<WeeklySuggestionItem, "title" | "hook" | "cta" | "rationale">>,
  ) => {
    const nextItem = { ...item, ...overrides };

    await createIdea.mutateAsync({
      title: nextItem.title,
      hook: nextItem.hook,
      description: `${nextItem.rationale}\n\nCanal: ${nextItem.channel}\nCTA: ${nextItem.cta}`,
      format: (nextItem.channel === "email" ? "other" : nextItem.format) as MarketingIdea["format"],
      platform: (nextItem.channel === "email" ? "other" : nextItem.platform) as MarketingIdea["platform"],
      planned_date: nextItem.date,
      status: "scheduled",
      priority: nextItem.objective === "converter" ? "high" : nextItem.objective === "reter" ? "medium" : "medium",
      tags: [nextItem.objective, nextItem.channel],
    });
  };

  const activeSuggestion = reviewingIndex !== null ? suggestWeeklyCalendar.data?.schedule[reviewingIndex] : null;

  const registerSuggestionReview = async (
    decision: "accepted" | "edited" | "rejected",
    suggestion: WeeklySuggestionItem,
    value: Record<string, string>,
    notes: string,
  ) => {
    const editedPayload = decision === "edited"
      ? {
          title: value.title,
          hook: value.hook,
          cta: value.cta,
          rationale: value.rationale,
        }
      : null;

    await recordReview.mutateAsync({
      suggestionType: suggestion.channel === "email" ? "weekly-email" : "weekly-post",
      sourceFunction: "suggest-weekly-marketing-calendar",
      sourceItemKey: getSuggestionKey(suggestion),
      decision,
      objective: suggestion.objective,
      profilePlatform: selectedProfile?.platform,
      profileId: selectedProfile?.id,
      profileUsername: selectedProfile?.username,
      suggestionPayload: suggestion,
      editedPayload,
      inputContext: {
        weeklyFocus: suggestWeeklyCalendar.data?.weeklyFocus,
        summary: suggestWeeklyCalendar.data?.summary,
      },
      decisionNotes: notes,
    });
  };

  const handleApproveAndCreate = async (item: WeeklySuggestionItem) => {
    const suggestionKey = getSuggestionKey(item);
    setPublishingKey(suggestionKey);

    try {
      await registerSuggestionReview("accepted", item, {}, "");
      await handleCreateFromSuggestion(item);
      toast.success("Sugestão aprovada e enviada para o calendário");
    } finally {
      setPublishingKey(null);
    }
  };

  const buildCopyBrief = (item: WeeklySuggestionItem) => {
    return [
      `Título da pauta: ${item.title}`,
      `Dia planejado: ${item.dayLabel} (${item.date})`,
      `Canal: ${item.channel}`,
      `Plataforma: ${item.platform}`,
      `Formato: ${item.format}`,
      `Objetivo: ${item.objective}`,
      `Hook sugerido no calendário: ${item.hook}`,
      `CTA sugerido no calendário: ${item.cta}`,
      `Justificativa estratégica: ${item.rationale}`,
      "Crie o texto considerando o histórico do perfil selecionado e os padrões que já performaram melhor.",
    ].join("\n");
  };

  const parseGeneratedOptions = (value: string, fallback: string) => {
    const options = value
      .split(/\n+/)
      .map((line) => line.replace(/^\s*\d+[.)-]?\s*/, "").trim())
      .filter(Boolean);

    return options.length > 0 ? options.slice(0, 2) : [fallback];
  };

  const generateDraftForSuggestion = async (item: WeeklySuggestionItem, selectedHook: string, selectedCta: string) => {
    const brief = [
      buildCopyBrief(item),
      `Hook escolhido: ${selectedHook}`,
      `CTA escolhido: ${selectedCta}`,
      "Use exatamente o hook e o CTA escolhidos na versão final.",
    ].join("\n");

    const draftType = item.channel === "email" ? "email" : "caption";
    const draftResult = await generateCopy.mutateAsync({
      copyType: draftType,
      brief,
      objective: item.objective,
      format: item.format,
      platform: item.platform,
      hook: selectedHook,
      useBrandVoice: true,
      profileId: selectedProfile?.id,
      profilePlatform: selectedProfile?.platform,
      profileUsername: selectedProfile?.username,
      profileDisplayName: selectedProfile?.display_name,
    });

    return draftResult.output;
  };

  const handleGenerateCopyForSuggestion = async (item: WeeklySuggestionItem) => {
    const suggestionKey = getSuggestionKey(item);
    setCopyingKey(suggestionKey);

    try {
      const brief = buildCopyBrief(item);
      const [hookResult, ctaResult] = await Promise.all([
        generateCopy.mutateAsync({
          copyType: "hook",
          brief,
          objective: item.objective,
          format: item.format,
          platform: item.platform,
          useBrandVoice: true,
          profileId: selectedProfile?.id,
          profilePlatform: selectedProfile?.platform,
          profileUsername: selectedProfile?.username,
          profileDisplayName: selectedProfile?.display_name,
        }),
        generateCopy.mutateAsync({
          copyType: "cta",
          brief,
          objective: item.objective,
          format: item.format,
          platform: item.platform,
          useBrandVoice: true,
          profileId: selectedProfile?.id,
          profilePlatform: selectedProfile?.platform,
          profileUsername: selectedProfile?.username,
          profileDisplayName: selectedProfile?.display_name,
        }),
      ]);

      const hookOptions = parseGeneratedOptions(hookResult.output, item.hook);
      const ctaOptions = parseGeneratedOptions(ctaResult.output, item.cta);
      const selectedHook = hookOptions[0];
      const selectedCta = ctaOptions[0];
      const draft = await generateDraftForSuggestion(item, selectedHook, selectedCta);

      setGeneratedCopy({
        item,
        hookOptions,
        ctaOptions,
        selectedHook,
        selectedCta,
        draft,
      });
      toast.success("Copy gerada para a pauta selecionada");
    } finally {
      setCopyingKey(null);
    }
  };

  const handleSelectGeneratedOption = async (field: "selectedHook" | "selectedCta", value: string) => {
    if (!generatedCopy) return;

    const nextState = {
      ...generatedCopy,
      [field]: value,
    };

    setGeneratedCopy(nextState);

    try {
      const draft = await generateDraftForSuggestion(nextState.item, nextState.selectedHook, nextState.selectedCta);
      setGeneratedCopy({ ...nextState, draft });
    } catch (error) {
      setGeneratedCopy(generatedCopy);
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-lg capitalize min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Hoje</Button>
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas plataformas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="multi">Multi-plataforma</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateWeek} disabled={!selectedProfile || suggestWeeklyCalendar.isPending}>
            {suggestWeeklyCalendar.isPending ? "Gerando semana..." : "IA da semana"}
          </Button>
        </div>
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 text-foreground">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <span className="font-medium">Aprendizado do calendário</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Aceitos: {feedbackSummary.accepted}</Badge>
            <Badge variant="outline">Editados: {feedbackSummary.edited}</Badge>
            <Badge variant="outline">Descartados: {feedbackSummary.rejected}</Badge>
          </div>
        </div>
      </Card>

      {suggestWeeklyCalendar.data && (
        <Card className="p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">{suggestWeeklyCalendar.data.weeklyFocus}</h4>
            <p className="text-sm text-muted-foreground">{suggestWeeklyCalendar.data.summary}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestWeeklyCalendar.data.schedule.map((item, index) => (
              <div key={`${item.date}-${index}`} className="rounded-md border bg-background p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{item.dayLabel}</Badge>
                  <Badge variant="secondary">{item.channel === "email" ? "E-mail" : item.format}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.platform} · {item.objective}</p>
                </div>
                <p className="text-xs text-muted-foreground">{item.hook}</p>
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => handleGenerateCopyForSuggestion(item)}
                    disabled={!!copyingKey || suggestWeeklyCalendar.isPending}
                  >
                    {copyingKey === getSuggestionKey(item) ? "Gerando copy..." : "Gerar copy"}
                  </Button>
                  <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={() => handleApproveAndCreate(item)}
                    disabled={createIdea.isPending || recordReview.isPending || publishingKey === getSuggestionKey(item)}
                  >
                    {publishingKey === getSuggestionKey(item) ? "Aprovando..." : "Aceitar e criar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReviewingIndex(index)}
                    disabled={createIdea.isPending || recordReview.isPending}
                  >
                    Editar antes
                  </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-2">
          <div className="grid grid-cols-7 gap-1 mb-1 text-xs font-medium text-muted-foreground">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="px-2 py-1 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const items = ideasOnDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(day)}
                  className={cn(
                    "min-h-[110px] p-1.5 rounded-md border bg-card flex flex-col gap-1",
                    !isCurrentMonth && "opacity-40",
                    isToday && "ring-2 ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-medium", isToday && "text-primary")}>
                      {format(day, "d")}
                    </span>
                    {items.length > 0 && <span className="text-[10px] text-muted-foreground">{items.length}</span>}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {items.slice(0, 3).map((idea) => {
                      const platform = idea.publish_platform || idea.platform;
                      const Icon = PLATFORM_ICONS[platform] || Globe;
                      return (
                        <button
                          key={idea.id}
                          onClick={() => setOpenIdea(idea)}
                          draggable
                          onDragStart={() => setDraggedId(idea.id)}
                          className={cn(
                            "w-full text-left text-[10px] px-1.5 py-1 rounded border truncate flex items-center gap-1 hover:opacity-80 cursor-grab",
                            PLATFORM_COLORS[platform] || PLATFORM_COLORS.other,
                          )}
                          title={idea.title}
                        >
                          <Icon className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{idea.title}</span>
                        </button>
                      );
                    })}
                    {items.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{items.length - 3}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Sem data ({unscheduled.length})</h4>
            <Button size="sm" variant="ghost" onClick={() => setOpenIdea({} as MarketingIdea)}>
              <Plus className="h-3 w-3 mr-1" />Nova
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Arraste para o calendário para agendar</p>
          {unscheduled.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Tudo agendado 🎉</p>
          ) : (
            unscheduled.map((idea) => {
              const platform = idea.publish_platform || idea.platform;
              const Icon = PLATFORM_ICONS[platform] || Globe;
              return (
                <div
                  key={idea.id}
                  draggable
                  onDragStart={() => setDraggedId(idea.id)}
                  onClick={() => setOpenIdea(idea)}
                  className="p-2 rounded-md border bg-background hover:bg-muted cursor-grab text-xs space-y-1"
                >
                  <div className="flex items-center gap-1">
                    <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{idea.title}</span>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[10px] py-0">{idea.format}</Badge>
                    <Badge variant="outline" className="text-[10px] py-0">{idea.priority}</Badge>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {openIdea && (
        <IdeaDialog
          open={!!openIdea}
          onOpenChange={(o) => !o && setOpenIdea(null)}
          idea={openIdea.id ? openIdea : null}
        />
      )}

      <AiSuggestionReviewDialog
        open={reviewingIndex !== null}
        onOpenChange={(open) => !open && setReviewingIndex(null)}
        title="Revisar sugestão semanal"
        description="Registre o que foi aceito, ajustado ou descartado para a IA melhorar a priorização da próxima semana."
        fields={[
          { key: "title", label: "Título" },
          { key: "hook", label: "Hook", multiline: true, rows: 3 },
          { key: "cta", label: "CTA" },
          { key: "rationale", label: "Justificativa", multiline: true, rows: 4 },
        ]}
        initialValue={{
          title: activeSuggestion?.title || "",
          hook: activeSuggestion?.hook || "",
          cta: activeSuggestion?.cta || "",
          rationale: activeSuggestion?.rationale || "",
        }}
        acceptLabel="Aceitar sugestão"
        editLabel="Salvar ajustes"
        rejectLabel="Descartar"
        onAcceptOriginal={async (notes) => {
          if (!activeSuggestion) return;
          await registerSuggestionReview("accepted", activeSuggestion, {}, notes);
          await handleCreateFromSuggestion(activeSuggestion);
          setReviewingIndex(null);
          toast.success("Sugestão aprovada e enviada para o calendário");
        }}
        onSaveEdits={async (value, notes) => {
          if (!activeSuggestion) return;
          await registerSuggestionReview("edited", activeSuggestion, value, notes);
          await handleCreateFromSuggestion(activeSuggestion, {
            title: value.title,
            hook: value.hook,
            cta: value.cta,
            rationale: value.rationale,
          });
          setReviewingIndex(null);
          toast.success("Sugestão editada e enviada para o calendário");
        }}
        onReject={async (value, notes) => {
          if (!activeSuggestion) return;
          await registerSuggestionReview("rejected", activeSuggestion, value, notes);
          setReviewingIndex(null);
        }}
        isSubmitting={recordReview.isPending}
      />

      <Dialog open={!!generatedCopy} onOpenChange={(open) => !open && setGeneratedCopy(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Copy da pauta selecionada</DialogTitle>
            <DialogDescription>
              {generatedCopy ? `${generatedCopy.item.title} · ${generatedCopy.item.objective}` : ""}
            </DialogDescription>
          </DialogHeader>

          {generatedCopy && (
            <div className="space-y-4">
              <Card className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Hook</p>
                <p className="text-sm whitespace-pre-wrap">{generatedCopy.hook}</p>
              </Card>
              <Card className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">CTA</p>
                <p className="text-sm whitespace-pre-wrap">{generatedCopy.cta}</p>
              </Card>
              <Card className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Rascunho</p>
                <p className="text-sm whitespace-pre-wrap">{generatedCopy.draft}</p>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
