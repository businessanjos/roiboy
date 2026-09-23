import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Brain, FileText, MessageSquareWarning, ShieldCheck, Upload, Trash2,
  Download, Plus, Save, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  EMPTY_SETTINGS, KnowledgeSettings, useKnowledgeCorrections,
  useKnowledgeDocuments, useKnowledgeSettings,
} from "./useAIKnowledge";

function ListEditor({
  values, onChange, placeholder,
}: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...values, draft.trim()]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="secondary" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1.5">
        {values.map((v, i) => (
          <div key={`${v}-${i}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span className="flex-1">{v}</span>
            <Button
              type="button" size="icon" variant="ghost"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {values.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum item cadastrado.</p>
        )}
      </div>
    </div>
  );
}

export function AIKnowledgeManager() {
  const { settings, isLoading, save } = useKnowledgeSettings();
  const { documents, upload, reprocess, remove, download } = useKnowledgeDocuments();
  const { corrections, upsert, toggle, remove: removeCorrection } = useKnowledgeCorrections();

  const [form, setForm] = useState<KnowledgeSettings>(EMPTY_SETTINGS);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const set = <K extends keyof KnowledgeSettings>(key: K, value: KnowledgeSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const completion = useMemo(() => {
    const checks = [
      !!form.business_summary, !!form.target_audience, !!form.offer_type,
      !!form.average_ticket, !!form.tone_of_voice,
      form.discovery_questions.length > 0, form.qualification_criteria.length > 0,
      !!form.opening_scripts?.organic, !!form.opening_scripts?.form,
      form.stages.some((s) => s.goal || s.guidelines),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  const conflicts = useMemo(() => {
    const list: string[] = [];
    if (!form.business_summary) list.push("Falta descrever em uma frase o que a empresa faz.");
    if (!form.tone_of_voice) list.push("Falta definir o tom de voz usado nas sugestões.");
    if (form.discovery_questions.length === 0) list.push("Nenhuma pergunta de descoberta cadastrada — a auditoria de calls fica genérica.");
    if (form.qualification_criteria.length === 0) list.push("Sem critérios de qualificação, a IA não consegue apontar leads fora do perfil.");
    if (form.stages.every((s) => !s.goal && !s.guidelines)) list.push("As 5 etapas do processo comercial estão vazias.");
    if (documents.length === 0) list.push("Nenhum material enviado — as sugestões ficam só com as regras escritas aqui.");
    return list;
  }, [form, documents.length]);

  const [newCorrection, setNewCorrection] = useState({
    lead_message: "", incorrect_response: "", problem_identified: "",
    expected_response: "", action_type: "guideline", is_active: true,
  });

  const stats = useMemo(() => ({
    total: documents.length,
    chunks: documents.reduce((s, d) => s + (d.chunks_count ?? 0), 0),
    ok: documents.filter((d) => d.status === "completed").length,
    errors: documents.filter((d) => d.status === "error").length,
  }), [documents]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Brain className="h-5 w-5 text-primary" /> Base de Conhecimento IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Manual oficial de vendas usado nas sugestões do RoyZapp e na análise das videochamadas.
          </p>
        </div>
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" /> Salvar
        </Button>
      </div>

      <Tabs defaultValue="process" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="process"><Brain className="mr-2 h-4 w-4" />Processo Comercial</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="mr-2 h-4 w-4" />Documentos & Web</TabsTrigger>
          <TabsTrigger value="corrections"><MessageSquareWarning className="mr-2 h-4 w-4" />Correções</TabsTrigger>
          <TabsTrigger value="consistency"><ShieldCheck className="mr-2 h-4 w-4" />Consistência</TabsTrigger>
        </TabsList>

        {/* PROCESSO COMERCIAL */}
        <TabsContent value="process" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preenchimento do manual</CardTitle>
              <CardDescription>{completion}% completo</CardDescription>
            </CardHeader>
            <CardContent><Progress value={completion} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Sobre o negócio</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Em uma frase, o que a empresa faz</Label>
                <Textarea
                  value={form.business_summary ?? ""}
                  onChange={(e) => set("business_summary", e.target.value)}
                  placeholder="Ex.: mentoria de gestão para clínicas médicas e odontológicas."
                />
              </div>
              <div className="space-y-2">
                <Label>Público-alvo</Label>
                <Input value={form.target_audience ?? ""} onChange={(e) => set("target_audience", e.target.value)} placeholder="Médicos, dentistas, empresários" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de oferta</Label>
                <Input value={form.offer_type ?? ""} onChange={(e) => set("offer_type", e.target.value)} placeholder="Mentoria / Serviço" />
              </div>
              <div className="space-y-2">
                <Label>Vende para</Label>
                <Input value={form.selling_to ?? ""} onChange={(e) => set("selling_to", e.target.value)} placeholder="Empresas B2B" />
              </div>
              <div className="space-y-2">
                <Label>Ticket médio</Label>
                <Input value={form.average_ticket ?? ""} onChange={(e) => set("average_ticket", e.target.value)} placeholder="Acima de R$ 50.000" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Tom de voz</Label>
                <Input value={form.tone_of_voice ?? ""} onChange={(e) => set("tone_of_voice", e.target.value)} placeholder="Consultivo, premium, sem gírias" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Concorrentes</Label>
                <ListEditor values={form.competitors} onChange={(v) => set("competitors", v)} placeholder="Nome do concorrente" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">As 5 etapas do processo</CardTitle>
              <CardDescription>Objetivo e orientações de cada etapa da conversa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.stages.map((stage, i) => (
                <div key={stage.key} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{i + 1}</Badge>
                    <span className="font-medium">{stage.label}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Objetivo da etapa</Label>
                      <Input
                        value={stage.goal}
                        onChange={(e) => {
                          const next = [...form.stages];
                          next[i] = { ...stage, goal: e.target.value };
                          set("stages", next);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Como conduzir</Label>
                      <Textarea
                        value={stage.guidelines}
                        onChange={(e) => {
                          const next = [...form.stages];
                          next[i] = { ...stage, guidelines: e.target.value };
                          set("stages", next);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Perguntas de descoberta obrigatórias</CardTitle></CardHeader>
              <CardContent>
                <ListEditor values={form.discovery_questions} onChange={(v) => set("discovery_questions", v)} placeholder="Ex.: Quantos pacientes atende por mês?" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Critérios de qualificação</CardTitle></CardHeader>
              <CardContent>
                <ListEditor values={form.qualification_criteria} onChange={(v) => set("qualification_criteria", v)} placeholder="Ex.: faturamento mínimo de R$ 100 mil/mês" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roteiros de abertura</CardTitle>
              <CardDescription>Use {"{{nome_cliente}}"} e {"{{nome_agente}}"} para personalizar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Lead orgânico</Label>
                <Textarea
                  value={form.opening_scripts?.organic ?? ""}
                  onChange={(e) => set("opening_scripts", { ...form.opening_scripts, organic: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lead de formulário</Label>
                <Textarea
                  value={form.opening_scripts?.form ?? ""}
                  onChange={(e) => set("opening_scripts", { ...form.opening_scripts, form: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="docs" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Documentos", value: stats.total },
              { label: "Fragmentos", value: stats.chunks },
              { label: "Processados", value: stats.ok },
              { label: "Com erro", value: stats.errors },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-semibold">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Fontes na internet</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {(["website", "instagram", "linkedin"] as const).map((k) => (
                <div key={k} className="space-y-2">
                  <Label className="capitalize">{k === "website" ? "Site institucional" : k}</Label>
                  <Input
                    value={form.web_sources?.[k] ?? ""}
                    onChange={(e) => set("web_sources", { ...form.web_sources, [k]: e.target.value })}
                    placeholder="https://"
                  />
                </div>
              ))}
              <div className="md:col-span-3 space-y-2">
                <Label>Outros links</Label>
                <ListEditor
                  values={form.web_sources?.others ?? []}
                  onChange={(v) => set("web_sources", { ...form.web_sources, others: v })}
                  placeholder="https://"
                />
              </div>
              <div className="md:col-span-3">
                <Button variant="secondary" onClick={() => save.mutate(form)} disabled={save.isPending}>
                  <Save className="mr-2 h-4 w-4" /> Salvar fontes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Materiais enviados</CardTitle>
              <CardDescription>Manuais, lâminas, apresentações e transcrições.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {upload.isPending ? "Enviando…" : "Clique para enviar um arquivo"}
                </span>
                <span className="text-xs">
                  PDF, Word (.docx), texto, .md, .csv, legendas (.vtt/.srt) — até 50 MB. O conteúdo é lido e dividido em fragmentos automaticamente.
                </span>
                <input
                  type="file" className="hidden"
                  accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.vtt,.srt,.html,.log"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate(file);
                    e.target.value = "";
                  }}
                />
              </label>

              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString("pt-BR")} ·{" "}
                        {doc.file_size ? `${Math.round(Number(doc.file_size) / 1024)} KB` : "—"} ·{" "}
                        {doc.chunks_count} fragmentos
                      </p>
                      {doc.error_message && (
                        <p className="mt-1 text-xs text-amber-600">{doc.error_message}</p>
                      )}
                    </div>
                    <Badge variant={doc.status === "error" ? "destructive" : "secondary"}>
                      {doc.status === "completed" ? "Pronto" : doc.status === "error" ? "Erro" : "Processando"}
                    </Badge>
                    <Button
                      size="icon" variant="ghost" title="Ler o conteúdo de novo"
                      disabled={reprocess.isPending || doc.status === "processing"}
                      onClick={() => reprocess.mutate(doc.id)}
                    >
                      <RefreshCw className={`h-4 w-4 ${doc.status === "processing" ? "animate-spin" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => download(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(doc)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {documents.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum material enviado ainda.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CORREÇÕES */}
        <TabsContent value="corrections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova correção</CardTitle>
              <CardDescription>Ensine o que não dizer e qual é a abordagem certa.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mensagem do lead</Label>
                <Textarea value={newCorrection.lead_message} onChange={(e) => setNewCorrection({ ...newCorrection, lead_message: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Abordagem incorreta</Label>
                <Textarea value={newCorrection.incorrect_response} onChange={(e) => setNewCorrection({ ...newCorrection, incorrect_response: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Problema identificado</Label>
                <Textarea value={newCorrection.problem_identified} onChange={(e) => setNewCorrection({ ...newCorrection, problem_identified: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Abordagem recomendada</Label>
                <Textarea value={newCorrection.expected_response} onChange={(e) => setNewCorrection({ ...newCorrection, expected_response: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button
                  disabled={!newCorrection.expected_response.trim() || upsert.isPending}
                  onClick={() =>
                    upsert.mutate(newCorrection, {
                      onSuccess: () => setNewCorrection({
                        lead_message: "", incorrect_response: "", problem_identified: "",
                        expected_response: "", action_type: "guideline", is_active: true,
                      }),
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Adicionar correção
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {corrections.map((c) => (
              <Card key={c.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={c.is_active ? "secondary" : "outline"}>
                      {c.is_active ? "Ativa" : "Desativada"}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(v) => toggle.mutate({ id: c.id, is_active: v })}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeCorrection.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div><p className="text-xs text-muted-foreground">Mensagem do lead</p><p>{c.lead_message || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Abordagem incorreta</p><p>{c.incorrect_response || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Problema</p><p>{c.problem_identified || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Abordagem recomendada</p><p className="font-medium">{c.expected_response}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {corrections.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma correção cadastrada.</p>
            )}
          </div>
        </TabsContent>

        {/* CONSISTÊNCIA */}
        <TabsContent value="consistency">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verificação do manual</CardTitle>
              <CardDescription>O que ainda falta para a IA responder no padrão da empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {conflicts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Manual completo e sem pendências.
                </div>
              ) : (
                conflicts.map((c) => (
                  <div key={c} className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                    <span>{c}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
