import { useEffect, useMemo, useState } from "react";
import { ContentPiece, PLATFORMS, PIECE_STATUSES, Talent, useUpsertPiece, useDeletePiece, callContentHQAI, usePillars } from "@/hooks/useContentHQ";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, Trash2, Loader2, ExternalLink, CheckCircle2, Wand2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BRIEFING_TEMPLATES, STAGE_CHECKLISTS, pickTemplate } from "./contentHQTemplates";
import { toast } from "@/hooks/use-toast";

type Props = {
  piece: ContentPiece | null;
  talent: Talent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function ContentHQPieceDrawer({ piece, talent, open, onOpenChange }: Props) {
  const upsert = useUpsertPiece();
  const del = useDeletePiece();
  const { data: pillars = [] } = usePillars(talent?.id);
  const [draft, setDraft] = useState<any>(piece);
  const [tab, setTab] = useState("briefing");
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => { setDraft(piece); setTab("briefing"); }, [piece?.id]);

  const template = useMemo(() => piece ? pickTemplate(piece.platform, piece.format) : null, [piece?.platform, piece?.format]);
  const templateKey = template?.id || "reels";

  if (!piece || !draft || !talent) return null;

  const pl = PLATFORMS.find(p => p.id === piece.platform);
  const briefing = draft.briefing || {};
  const templateData = briefing.template?.[templateKey] || {};
  const checklist: Record<string, boolean> = briefing.checklist?.[piece.status] || {};
  const stageItems = STAGE_CHECKLISTS[piece.status] || [];
  const done = stageItems.filter(i => checklist[i]).length;
  const pct = stageItems.length ? Math.round((done / stageItems.length) * 100) : 0;

  const setTemplateField = (key: string, value: string) => {
    setDraft({
      ...draft,
      briefing: { ...briefing, template: { ...(briefing.template || {}), [templateKey]: { ...templateData, [key]: value } } },
    });
  };

  const toggleCheck = (item: string) => {
    const next = { ...checklist, [item]: !checklist[item] };
    setDraft({
      ...draft,
      briefing: { ...briefing, checklist: { ...(briefing.checklist || {}), [piece.status]: next } },
    });
  };

  const applyTemplateToPiece = () => {
    // Mirror common template fields into top-level columns (script/cta/caption/hashtags/thumbnail_brief/hook).
    const t = templateData;
    setDraft({
      ...draft,
      hook: t.hook ?? draft.hook,
      script: t.script ?? draft.script,
      cta: t.cta ?? draft.cta,
      caption: t.caption ?? draft.caption,
      hashtags: t.hashtags ?? draft.hashtags,
      thumbnail_brief: t.thumb ?? t.design ?? t.cover ?? draft.thumbnail_brief,
    });
    toast({ title: "Template sincronizado com a pauta" });
  };

  const handleAIFill = async () => {
    setLoadingAI(true);
    try {
      const pillar = pillars.find(p => p.id === piece.pillar_id);
      const r = await callContentHQAI("generate_briefing", talent, {
        title: piece.title, platform: piece.platform, format: piece.format, pillar_name: pillar?.name,
      });
      setDraft({
        ...draft,
        hook: r.hook ?? draft.hook,
        script: r.script ?? draft.script,
        cta: r.cta ?? draft.cta,
        caption: r.caption ?? draft.caption,
        hashtags: r.hashtags ?? draft.hashtags,
        thumbnail_brief: r.thumbnail_brief ?? draft.thumbnail_brief,
        briefing: {
          ...briefing,
          template: {
            ...(briefing.template || {}),
            [templateKey]: {
              ...templateData,
              hook: r.hook ?? templateData.hook,
              script: r.script ?? templateData.script,
              cta: r.cta ?? templateData.cta,
              caption: r.caption ?? templateData.caption,
              hashtags: r.hashtags ?? templateData.hashtags,
              thumb: r.thumbnail_brief ?? templateData.thumb,
            },
          },
        },
      });
      toast({ title: "Briefing preenchido pela IA" });
    } finally { setLoadingAI(false); }
  };

  const handleSave = () => upsert.mutate(draft, { onSuccess: () => onOpenChange(false) });

  const advanceStage = () => {
    const idx = PIECE_STATUSES.findIndex(s => s.id === piece.status);
    const next = PIECE_STATUSES[Math.min(idx + 1, PIECE_STATUSES.length - 1)];
    setDraft({ ...draft, status: next.id });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={pl?.color}>{pl?.label}</Badge>
            <Badge variant="outline">{PIECE_STATUSES.find(s => s.id === piece.status)?.label}</Badge>
            {piece.format && <Badge variant="outline">{piece.format}</Badge>}
            <Badge variant="secondary">{template?.label}</Badge>
          </div>
          <SheetTitle className="text-left">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="text-base font-semibold" />
          </SheetTitle>
          <SheetDescription className="text-left">{talent.name}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PIECE_STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={draft.platform} onValueChange={(v) => setDraft({ ...draft, platform: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={draft.scheduled_date || ""} onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })} />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="briefing">Briefing</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="approval">Aprovação</TabsTrigger>
          </TabsList>

          <TabsContent value="briefing" className="space-y-3 mt-4">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleAIFill} disabled={loadingAI} className="gap-2">
                {loadingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Preencher com IA
              </Button>
              <Button size="sm" variant="outline" onClick={applyTemplateToPiece} className="gap-2">
                <Wand2 className="h-3.5 w-3.5" /> Sincronizar template → pauta
              </Button>
              <Select
                value={templateKey}
                onValueChange={(v) => setDraft({ ...draft, format: BRIEFING_TEMPLATES[v].label })}
              >
                <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(BRIEFING_TEMPLATES).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {template?.sections.map(sec => (
              <div key={sec.key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sec.label}</label>
                <Textarea
                  rows={sec.rows || 3}
                  placeholder={sec.placeholder}
                  value={templateData[sec.key] || ""}
                  onChange={(e) => setTemplateField(sec.key, e.target.value)}
                  className="mt-1"
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="checklist" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold">{PIECE_STATUSES.find(s => s.id === piece.status)?.label}</span>
                <span className="text-muted-foreground"> · {done}/{stageItems.length}</span>
              </div>
              <Button size="sm" variant="outline" onClick={advanceStage} className="gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> Avançar etapa
              </Button>
            </div>
            <Progress value={pct} />
            <div className="space-y-2">
              {stageItems.map(item => (
                <label key={item} className="flex items-start gap-2 p-2 rounded border hover:bg-muted/30 cursor-pointer">
                  <Checkbox checked={!!checklist[item]} onCheckedChange={() => toggleCheck(item)} />
                  <span className={`text-sm ${checklist[item] ? "line-through text-muted-foreground" : ""}`}>{item}</span>
                </label>
              ))}
            </div>

            <div className="pt-3 border-t">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Próximas etapas</div>
              <div className="space-y-1">
                {PIECE_STATUSES.filter(s => s.id !== piece.status).map(s => {
                  const c = briefing.checklist?.[s.id] || {};
                  const total = (STAGE_CHECKLISTS[s.id] || []).length;
                  const d = Object.values(c).filter(Boolean).length;
                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1">
                      <span className={s.color + " px-2 py-0.5 rounded"}>{s.label}</span>
                      <span className="text-muted-foreground">{d}/{total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assets" className="space-y-3 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link de gravação bruta / pasta</label>
              <Input
                placeholder="Drive, Frame.io, Dropbox..."
                value={briefing.assets?.raw_url || ""}
                onChange={(e) => setDraft({ ...draft, briefing: { ...briefing, assets: { ...(briefing.assets || {}), raw_url: e.target.value } } })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link do vídeo editado</label>
              <Input
                placeholder="URL do corte final"
                value={briefing.assets?.edit_url || ""}
                onChange={(e) => setDraft({ ...draft, briefing: { ...briefing, assets: { ...(briefing.assets || {}), edit_url: e.target.value } } })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capa / Thumbnail (URL)</label>
              <Input
                placeholder="URL da arte de capa"
                value={briefing.assets?.cover_url || ""}
                onChange={(e) => setDraft({ ...draft, briefing: { ...briefing, assets: { ...(briefing.assets || {}), cover_url: e.target.value } } })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Referências visuais</label>
              <Textarea
                rows={3}
                placeholder="Cole links de referências (1 por linha)."
                value={briefing.assets?.references || ""}
                onChange={(e) => setDraft({ ...draft, briefing: { ...briefing, assets: { ...(briefing.assets || {}), references: e.target.value } } })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">URL publicada</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={draft.published_url || ""}
                  onChange={(e) => setDraft({ ...draft, published_url: e.target.value })}
                />
                {draft.published_url && (
                  <Button size="icon" variant="outline" asChild>
                    <a href={draft.published_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="approval" className="space-y-3 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status de aprovação</label>
              <Select
                value={briefing.approval?.status || "pending"}
                onValueChange={(v) => setDraft({ ...draft, briefing: { ...briefing, approval: { ...(briefing.approval || {}), status: v } } })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Aguardando aprovação</SelectItem>
                  <SelectItem value="changes_requested">Ajustes solicitados</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Reprovado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aprovador</label>
              <Input
                placeholder="Nome / e-mail"
                value={briefing.approval?.approver || ""}
                onChange={(e) => setDraft({ ...draft, briefing: { ...briefing, approval: { ...(briefing.approval || {}), approver: e.target.value } } })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas do aprovador</label>
              <Textarea
                rows={5}
                placeholder="Pontos a ajustar, observações, restrições de compliance..."
                value={briefing.approval?.notes || ""}
                onChange={(e) => setDraft({ ...draft, briefing: { ...briefing, approval: { ...(briefing.approval || {}), notes: e.target.value } } })}
              />
            </div>
            <div className="flex gap-2 flex-wrap pt-2">
              {["Sem claims médicos não comprovados", "Sem antes/depois sem consentimento", "Marcas/parcerias declaradas", "Direitos de imagem ok", "Música licenciada"].map(item => {
                const c = briefing.approval?.compliance || {};
                return (
                  <label key={item} className="flex items-center gap-2 text-xs border rounded px-2 py-1 cursor-pointer">
                    <Checkbox
                      checked={!!c[item]}
                      onCheckedChange={() => setDraft({ ...draft, briefing: { ...briefing, approval: { ...(briefing.approval || {}), compliance: { ...c, [item]: !c[item] } } } })}
                    />
                    {item}
                  </label>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex items-center justify-between gap-2 sticky bottom-0 bg-background pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir esta pauta?")) del.mutate(piece.id, { onSuccess: () => onOpenChange(false) }); }} className="text-destructive gap-2">
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
