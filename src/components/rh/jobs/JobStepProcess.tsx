import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, ArrowUp, ArrowDown, Sparkles, Trash2 } from "lucide-react";
import { JOB_URGENCY_LABELS, JOB_TAGS } from "@/constants/jobOptions";
import type { JobFormData, JobUrgency } from "@/types/job";
import { suggestStagesAI, type JobStageDraft, useHRJobStages, useReplaceHRJobStages } from "@/hooks/useHRJobStages";
import { toast } from "sonner";

interface Props { form: UseFormReturn<JobFormData>; jobId?: string; }

export function JobStepProcess({ form, jobId }: Props) {
  const selectedTags = form.watch("tags");
  const toggleTag = (t: string) => {
    const current = form.getValues("tags");
    form.setValue("tags", current.includes(t) ? current.filter(x => x !== t) : [...current, t]);
  };

  const { data: savedStages } = useHRJobStages(jobId);
  const replaceStages = useReplaceHRJobStages();
  const [stages, setStages] = useState<JobStageDraft[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    if (savedStages && savedStages.length > 0 && stages.length === 0) {
      setStages(savedStages.map(s => ({
        id: s.id, name: s.name, order_index: s.order_index, sla_days: s.sla_days,
        owner_role: s.owner_role, owner_name: s.owner_name,
        evaluation_criteria: s.evaluation_criteria || [],
        what_to_do: s.what_to_do, test_or_material: s.test_or_material, ai_focus: null,
      })));
    }
  }, [savedStages]);

  const addStage = () => setStages(prev => [...prev, {
    name: "", order_index: prev.length, sla_days: 5, owner_role: "RH",
    owner_name: null, evaluation_criteria: [], what_to_do: null, test_or_material: null, ai_focus: null,
  }]);
  const removeStage = (i: number) => setStages(prev => prev.filter((_, idx) => idx !== i));
  const moveStage = (i: number, dir: -1 | 1) => {
    setStages(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((s, idx) => ({ ...s, order_index: idx }));
    });
  };
  const updateStage = (i: number, patch: Partial<JobStageDraft>) => setStages(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const runAI = async () => {
    const v = form.getValues();
    if (!v.title) { toast.error("Preencha o título da vaga primeiro"); return; }
    setLoadingAI(true);
    try {
      const suggested = await suggestStagesAI({
        title: v.title, description: v.description, seniority: v.seniority || undefined,
        contract_type: v.contract_type, department: v.department,
      });
      if (suggested.length === 0) toast.error("IA não retornou etapas. Tente novamente.");
      else { setStages(suggested); toast.success(`${suggested.length} etapas sugeridas pela IA`); }
    } catch (e: any) {
      toast.error("Erro IA: " + (e?.message || e));
    } finally { setLoadingAI(false); }
  };

  const saveStages = async () => {
    if (!jobId) { toast.info("Salve a vaga primeiro para persistir as etapas."); return; }
    await replaceStages.mutateAsync({ jobId, stages });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Processo Seletivo</h2>
        <p className="text-muted-foreground">Datas, etapas do funil e o que a IA deve observar em cada etapa</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="application_deadline" render={({ field }) => (
          <FormItem>
            <FormLabel>Prazo para Candidatura</FormLabel>
            <FormControl>
              <Input type="date" value={field.value ? field.value.toISOString().split("T")[0] : ""}
                onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="expected_start_date" render={({ field }) => (
          <FormItem>
            <FormLabel>Data Prevista de Início</FormLabel>
            <FormControl>
              <Input type="date" value={field.value ? field.value.toISOString().split("T")[0] : ""}
                onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="urgency" render={({ field }) => (
        <FormItem>
          <FormLabel>Urgência</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              {(Object.entries(JOB_URGENCY_LABELS) as [JobUrgency, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="require_cover_letter" render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <FormLabel>Exigir Carta de Apresentação</FormLabel>
            <p className="text-sm text-muted-foreground">Candidatos precisarão enviar carta de apresentação</p>
          </div>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )} />

      {/* Etapas do processo */}
      <div className="border-t pt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Etapas do processo seletivo</h3>
            <p className="text-sm text-muted-foreground">Defina o funil de avaliação e o que cada etapa deve investigar</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={runAI} disabled={loadingAI}>
              <Sparkles className="h-4 w-4 mr-1" />{loadingAI ? "Pensando..." : "Sugerir com IA"}
            </Button>
            <Button type="button" size="sm" onClick={addStage}><Plus className="h-4 w-4 mr-1" />Etapa</Button>
            {jobId && <Button type="button" variant="secondary" size="sm" onClick={saveStages} disabled={replaceStages.isPending}>Salvar etapas</Button>}
          </div>
        </div>

        {stages.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma etapa definida. Clique em "Sugerir com IA" ou adicione manualmente.
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {stages.map((s, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{i + 1}</Badge>
                    <Input className="flex-1" value={s.name} onChange={e => updateStage(i, { name: e.target.value })} placeholder="Nome da etapa (ex: Entrevista com gestor)" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveStage(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveStage(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStage(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">SLA (dias)</label>
                      <Input type="number" min={1} value={s.sla_days ?? ""} onChange={e => updateStage(i, { sla_days: e.target.value ? parseInt(e.target.value) : null })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Papel</label>
                      <Select value={s.owner_role || "RH"} onValueChange={v => updateStage(i, { owner_role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["RH", "Gestor", "Técnico", "C-Level"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Quem conduz</label>
                      <Input value={s.owner_name || ""} onChange={e => updateStage(i, { owner_name: e.target.value })} placeholder="Ex: Everton e Maikol" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">O que fazer nesta etapa</label>
                    <Textarea rows={2} value={s.what_to_do || ""} onChange={e => updateStage(i, { what_to_do: e.target.value })} placeholder="Ex: Entrevista por vídeo de 45min explorando histórico comercial e fit cultural" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Teste / material aplicado</label>
                    <Input value={s.test_or_material || ""} onChange={e => updateStage(i, { test_or_material: e.target.value })} placeholder="Ex: Role-play de cold call, Case de churn, Teste de Excel" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Critérios de avaliação (um por linha)</label>
                    <Textarea rows={3} value={(s.evaluation_criteria || []).join("\n")} onChange={e => updateStage(i, { evaluation_criteria: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) })} placeholder="Ex: Experiência com SaaS B2B" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FormLabel>Tags</FormLabel>
        <div className="flex flex-wrap gap-2">
          {JOB_TAGS.map(t => (
            <Badge key={t} variant={selectedTags.includes(t) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleTag(t)}>
              {t}{selectedTags.includes(t) && <X className="h-3 w-3 ml-1" />}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
