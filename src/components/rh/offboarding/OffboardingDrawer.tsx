import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CheckCircle2, ExternalLink, AlertTriangle, Calculator, Trash2, Plus, ShieldOff, Briefcase,
  Upload, FileText, Link2, Copy, Clock, History, DollarSign, UserX, Sparkles, Download, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useHROffboardings, useHROffboardingChecklist,
  OFFBOARDING_STAGES, OFFBOARDING_STAGE_LABELS, OFFBOARDING_STAGE_COLORS,
  type HROffboarding, type OffboardingStage,
} from "@/hooks/useHROffboardings";
import {
  useOffboardingTimeline, useOffboardingDocuments, useCollaboratorPendencies,
  reassignCollaboratorResources, ensureExitInterviewToken, buildExitInterviewLink,
  DOCUMENT_CATEGORIES, EXTERNAL_ACCESS_SYSTEMS,
} from "@/hooks/useHROffboardingExtras";
import {
  computeRescission, TERMINATION_TYPE_LABELS, NOTICE_TYPE_LABELS,
  type TerminationType, type NoticeType,
} from "@/lib/rescissionCalc";
import { computeLegalDeadlines } from "@/lib/offboardingDeadlines";
import { exportOffboardingDossier } from "@/lib/exportOffboardingPDF";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTeamUsers } from "@/hooks/useTeamUsers";
import { supabase } from "@/integrations/supabase/client";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function OffboardingDrawer({
  offboarding, open, onClose,
}: { offboarding: HROffboarding; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { update, remove } = useHROffboardings();
  const { items, toggle, add, remove: removeItem } = useHROffboardingChecklist(offboarding.id);
  const { data: timeline = [] } = useOffboardingTimeline(offboarding.id);
  const { documents, upload, remove: removeDoc } = useOffboardingDocuments(offboarding.id);
  const { data: pendencies } = useCollaboratorPendencies(offboarding.collaborator_id);
  const { users: teamUsers = [] } = useTeamUsers() as any;

  const [tab, setTab] = useState("resumo");
  const [form, setForm] = useState<Partial<HROffboarding>>({});
  const [reassignOpen, setReassignOpen] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState("trct");

  useEffect(() => {
    setForm({
      termination_type: offboarding.termination_type,
      initiated_by: offboarding.initiated_by,
      notice_communicated_at: offboarding.notice_communicated_at,
      last_day_worked: offboarding.last_day_worked,
      termination_date: offboarding.termination_date,
      notice_type: offboarding.notice_type,
      notice_days: offboarding.notice_days ?? 30,
      reason: offboarding.reason,
      reason_details: offboarding.reason_details,
      will_replace: offboarding.will_replace,
      notes: offboarding.notes,
      stage: offboarding.stage,
      exit_nps: offboarding.exit_nps,
      exit_interview: offboarding.exit_interview || {},
      rescission_calc: offboarding.rescission_calc || {},
      access_cutoff_done: offboarding.access_cutoff_done,
    });
    setPublicToken(offboarding.exit_interview_token || null);
  }, [offboarding.id]);

  const collab = offboarding.collaborator;
  const deadlines = useMemo(() => computeLegalDeadlines(form.termination_date || offboarding.termination_date), [form.termination_date, offboarding.termination_date]);

  // Rescissão calc inputs
  const [calcInput, setCalcInput] = useState(() => ({
    baseSalary: Number(collab?.base_salary || collab?.salary || 0),
    avgVariable: 0,
    hireDate: collab?.hire_date || new Date().toISOString().slice(0, 10),
    lastDayWorked: offboarding.last_day_worked || new Date().toISOString().slice(0, 10),
    terminationType: offboarding.termination_type as TerminationType,
    noticeType: offboarding.notice_type as NoticeType,
    noticeDays: offboarding.notice_days ?? 30,
    vacationDaysPending: 0,
    hadVacationAdvance: false,
    dependents: 0,
    fgtsBalance: 0,
  }));
  const rescission = useMemo(() => computeRescission(calcInput), [calcInput]);

  async function save(patch: Partial<HROffboarding>) {
    await update({ id: offboarding.id, patch });
    toast.success("Atualizado");
  }
  async function saveCalc() {
    await save({ rescission_calc: { inputs: calcInput, result: rescission, savedAt: new Date().toISOString() } as any });
  }

  const checklistByCat = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((i) => { (groups[i.category] = groups[i.category] || []).push(i); });
    return groups;
  }, [items]);
  const checklistProgress = items.length ? Math.round((items.filter(i => i.done).length / items.length) * 100) : 0;

  const totalPend = (pendencies?.openTasks || 0) + (pendencies?.openDeals || 0) + (pendencies?.assignedClients || 0);
  const hasOverdueDeadline = deadlines.some(d => d.severity === "overdue" || d.severity === "urgent");

  async function completeOffboarding() {
    if (totalPend > 0 && !confirm(`Colaborador ainda tem ${totalPend} pendências (tarefas/deals/clientes). Concluir mesmo assim?`)) return;
    if (!confirm("Confirmar conclusão? Isso vai inativar o colaborador e cortar seu acesso à plataforma.")) return;
    await save({
      stage: "completed",
      access_cutoff_done: true,
      access_cutoff_at: new Date().toISOString(),
      termination_date: form.termination_date || new Date().toISOString().slice(0, 10),
    });
    toast.success("Desligamento concluído — colaborador inativado");
    onClose();
  }

  async function generatePublicLink() {
    const token = await ensureExitInterviewToken(offboarding.id, publicToken);
    setPublicToken(token);
    const link = buildExitInterviewLink(token);
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado: " + link);
  }

  async function createFinancialEntry() {
    if (!rescission.net || !currentUser?.account_id) return toast.error("Calcule a rescisão primeiro");
    const desc = `Rescisão — ${collab?.full_name}`;
    const { data, error } = await (supabase.from("financial_entries") as any).insert({
      account_id: currentUser.account_id,
      type: "expense",
      status: "pending",
      description: desc,
      amount: rescission.net,
      due_date: form.termination_date ? new Date(form.termination_date).toISOString() : new Date().toISOString(),
      created_by: currentUser.id,
      notes: `Líquido a pagar de rescisão. Bruto ${fmtBRL(rescission.gross)} | Descontos ${fmtBRL(rescission.deductions)} | FGTS depósito ${fmtBRL(rescission.fgtsDeposit)} | Multa ${fmtBRL(rescission.fgtsPenalty)}`,
    }).select().single();
    if (error) return toast.error("Falha: " + error.message);
    await save({ financial_entry_id: data.id });
    toast.success("Lançamento financeiro criado");
  }

  async function handleUpload(file: File) {
    await upload({ file, category: docCategory });
    if (fileRef.current) fileRef.current.value = "";
  }

  function exportPDF() {
    exportOffboardingDossier(offboarding, {
      checklist: items.map(i => ({ label: i.label, category: i.category, done: i.done })),
      documents: documents.map(d => ({ file_name: d.file_name, category: d.category, created_at: d.created_at })),
      timeline: timeline.map(t => ({ event_type: t.event_type, description: t.description, created_at: t.created_at })),
    });
  }

  // ============ Stepper ============
  const stageIndex = OFFBOARDING_STAGES.indexOf(offboarding.stage as any);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={collab?.avatar_url || undefined} />
              <AvatarFallback>{(collab?.full_name || "?").split(" ").slice(0,2).map(s=>s[0]).join("")}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle>{collab?.full_name}</SheetTitle>
              <SheetDescription>
                {collab?.position || "—"} · {TERMINATION_TYPE_LABELS[offboarding.termination_type]}
              </SheetDescription>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={OFFBOARDING_STAGE_COLORS[offboarding.stage]}>
                  {OFFBOARDING_STAGE_LABELS[offboarding.stage]}
                </Badge>
                {offboarding.will_replace && offboarding.replacement_job_id && (
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => navigate(`/rh/vacancies/${offboarding.replacement_job_id}`)}>
                    <Briefcase className="h-3 w-3 mr-1" /> Ver vaga aberta <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-6 text-xs ml-auto" onClick={exportPDF}>
                  <Download className="h-3 w-3 mr-1" /> Dossiê PDF
                </Button>
              </div>
            </div>
          </div>

          {/* ====== Stepper ====== */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
            {OFFBOARDING_STAGES.map((s, i) => {
              const active = i === stageIndex;
              const done = i < stageIndex || offboarding.stage === "completed";
              return (
                <button key={s} onClick={() => save({ stage: s as OffboardingStage })}
                  className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full whitespace-nowrap transition ${
                    active ? "bg-rose-500/15 text-rose-700 font-semibold ring-1 ring-rose-500/30"
                    : done ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}>
                  {done && <CheckCircle2 className="h-3 w-3" />}
                  <span>{i + 1}. {OFFBOARDING_STAGE_LABELS[s]}</span>
                </button>
              );
            })}
          </div>

          {/* ====== Alertas globais ====== */}
          {hasOverdueDeadline && (
            <div className="mt-3 flex items-start gap-2 p-2 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Há prazos legais vencidos ou urgentes. Verifique a aba "Rescisão" / "Resumo".</span>
            </div>
          )}
          {totalPend > 0 && offboarding.stage !== "completed" && (
            <div className="mt-2 flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span><strong>{totalPend} pendências</strong> precisam ser reatribuídas antes de cortar acesso. Veja aba "Pendências".</span>
            </div>
          )}
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-7 w-full h-auto">
            <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
            <TabsTrigger value="pendencias" className="text-xs">
              Pendências {totalPend > 0 && <Badge variant="destructive" className="ml-1 h-4 text-[9px] px-1">{totalPend}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs">
              Checklist {checklistProgress > 0 && <span className="ml-1 text-[9px]">{checklistProgress}%</span>}
            </TabsTrigger>
            <TabsTrigger value="rescisao" className="text-xs">Rescisão</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs">
              Docs {documents.length > 0 && <span className="ml-1 text-[9px]">{documents.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="saida" className="text-xs">Saída</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
          </TabsList>

          {/* ====== RESUMO ====== */}
          <TabsContent value="resumo" className="space-y-4 mt-4">
            {/* Prazos legais */}
            {deadlines.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Prazos legais</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {deadlines.map(d => (
                    <div key={d.key} className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium">{d.label}</p>
                        <p className="text-[10px] text-muted-foreground">{d.description}</p>
                      </div>
                      <Badge variant="outline" className={
                        d.severity === "overdue" ? "bg-rose-500/15 text-rose-700 border-rose-300"
                        : d.severity === "urgent" ? "bg-orange-500/15 text-orange-700 border-orange-300"
                        : d.severity === "warning" ? "bg-amber-500/15 text-amber-700 border-amber-300"
                        : "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                      }>
                        {format(d.dueDate, "dd/MM")} · {d.daysRemaining >= 0 ? `${d.daysRemaining}d` : `${Math.abs(d.daysRemaining)}d atraso`}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.termination_type} onValueChange={(v) => { setForm({ ...form, termination_type: v as any }); setCalcInput({ ...calcInput, terminationType: v as TerminationType }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TERMINATION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Iniciado por</Label>
                <Select value={form.initiated_by} onValueChange={(v) => setForm({ ...form, initiated_by: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Empresa</SelectItem>
                    <SelectItem value="employee">Colaborador</SelectItem>
                    <SelectItem value="mutual">Acordo mútuo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de comunicação</Label>
                <Input type="date" value={form.notice_communicated_at || ""} onChange={(e) => setForm({ ...form, notice_communicated_at: e.target.value })} />
              </div>
              <div>
                <Label>Último dia trabalhado</Label>
                <Input type="date" value={form.last_day_worked || ""} onChange={(e) => { setForm({ ...form, last_day_worked: e.target.value }); setCalcInput({ ...calcInput, lastDayWorked: e.target.value }); }} />
              </div>
              <div>
                <Label>Data efetiva</Label>
                <Input type="date" value={form.termination_date || ""} onChange={(e) => setForm({ ...form, termination_date: e.target.value })} />
              </div>
              <div>
                <Label>Aviso prévio</Label>
                <Select value={form.notice_type} onValueChange={(v) => { setForm({ ...form, notice_type: v as any }); setCalcInput({ ...calcInput, noticeType: v as NoticeType }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTICE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dias de aviso</Label>
                <Input type="number" value={form.notice_days || 30} onChange={(e) => { const n = Number(e.target.value); setForm({ ...form, notice_days: n }); setCalcInput({ ...calcInput, noticeDays: n }); }} />
              </div>
            </div>

            <div>
              <Label>Motivo (curto)</Label>
              <Input value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div>
              <Label>Detalhes</Label>
              <Textarea rows={3} value={form.reason_details || ""} onChange={(e) => setForm({ ...form, reason_details: e.target.value })} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="repor" checked={!!form.will_replace} onCheckedChange={(v) => setForm({ ...form, will_replace: !!v })} />
              <Label htmlFor="repor" className="cursor-pointer">A vaga será reposta</Label>
              {form.will_replace && !offboarding.replacement_job_id && (
                <span className="text-xs text-muted-foreground">(salve para criar rascunho de vaga)</span>
              )}
            </div>

            <div>
              <Label>Observações internas</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="destructive" size="sm" onClick={async () => { if (confirm("Excluir este desligamento?")) { await remove(offboarding.id); onClose(); } }}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => save(form)}>Salvar</Button>
                {offboarding.stage !== "completed" && (
                  <Button onClick={completeOffboarding}><CheckCircle2 className="h-4 w-4" /> Concluir</Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ====== PENDÊNCIAS ====== */}
          <TabsContent value="pendencias" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserX className="h-4 w-4" /> Recursos atribuídos ao colaborador</CardTitle></CardHeader>
              <CardContent>
                {!pendencies?.userId ? (
                  <p className="text-sm text-muted-foreground">Colaborador sem usuário vinculado à plataforma — nada a reatribuir.</p>
                ) : totalPend === 0 ? (
                  <p className="text-sm text-emerald-700">✓ Sem pendências. Pode concluir o desligamento.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <Stat label="Tarefas abertas" value={pendencies.openTasks} />
                      <Stat label="Deals em aberto" value={pendencies.openDeals} />
                      <Stat label="Clientes na carteira" value={pendencies.assignedClients} />
                    </div>
                    <Button onClick={() => setReassignOpen(true)} className="w-full">
                      <Sparkles className="h-4 w-4 mr-2" /> Reatribuir tudo para outro responsável
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <ReassignDialog
              open={reassignOpen} onOpenChange={setReassignOpen}
              fromUserId={pendencies?.userId || null}
              users={teamUsers}
              pendencies={pendencies as any}
              onDone={() => { setReassignOpen(false); }}
            />
          </TabsContent>

          {/* ====== CHECKLIST ====== */}
          <TabsContent value="checklist" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{items.filter(i=>i.done).length} de {items.length} concluídos ({checklistProgress}%)</p>
              <AddChecklistItem onAdd={(label, category) => add({ label, category })} />
            </div>

            {/* Quick seed: granular access items */}
            {!(checklistByCat["acessos"] || []).some(i => i.label.includes("Google")) && (
              <Card className="bg-violet-500/5 border-violet-500/20">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <p className="text-xs"><strong>Sugestão:</strong> adicionar lista granular de acessos externos ({EXTERNAL_ACCESS_SYSTEMS.length} sistemas).</p>
                  <Button size="sm" variant="outline" onClick={async () => {
                    for (const s of EXTERNAL_ACCESS_SYSTEMS) await add({ label: `Revogar acesso: ${s.label}`, category: "acessos" });
                    toast.success("Itens adicionados ao checklist");
                  }}>Adicionar todos</Button>
                </CardContent>
              </Card>
            )}

            {["geral","documentos","financeiro","acessos","equipamentos"].map((cat) => {
              const its = checklistByCat[cat] || [];
              if (!its.length) return null;
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{cat}</p>
                  <div className="space-y-1.5">
                    {its.map((i) => (
                      <div key={i.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group">
                        <Checkbox checked={i.done} onCheckedChange={(v) => toggle({ id: i.id, done: !!v })} />
                        <span className={`flex-1 text-sm ${i.done ? "line-through text-muted-foreground" : ""}`}>{i.label}</span>
                        {i.done_at && <span className="text-[10px] text-muted-foreground">{format(new Date(i.done_at), "dd/MM HH:mm", { locale: ptBR })}</span>}
                        <button onClick={() => removeItem(i.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* ====== RESCISÃO ====== */}
          <TabsContent value="rescisao" className="space-y-4 mt-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Calculadora de Rescisão (estimativa)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Salário base</Label><Input type="number" step="0.01" value={calcInput.baseSalary} onChange={(e) => setCalcInput({ ...calcInput, baseSalary: +e.target.value })} /></div>
                  <div><Label>Média variável (12m)</Label><Input type="number" step="0.01" value={calcInput.avgVariable} onChange={(e) => setCalcInput({ ...calcInput, avgVariable: +e.target.value })} /></div>
                  <div><Label>Admissão</Label><Input type="date" value={calcInput.hireDate} onChange={(e) => setCalcInput({ ...calcInput, hireDate: e.target.value })} /></div>
                  <div><Label>Último dia</Label><Input type="date" value={calcInput.lastDayWorked} onChange={(e) => setCalcInput({ ...calcInput, lastDayWorked: e.target.value })} /></div>
                  <div><Label>Férias vencidas (dias)</Label><Input type="number" value={calcInput.vacationDaysPending} onChange={(e) => setCalcInput({ ...calcInput, vacationDaysPending: +e.target.value })} /></div>
                  <div><Label>Dependentes (IRRF)</Label><Input type="number" value={calcInput.dependents} onChange={(e) => setCalcInput({ ...calcInput, dependents: +e.target.value })} /></div>
                  <div><Label>Saldo FGTS acumulado</Label><Input type="number" step="0.01" value={calcInput.fgtsBalance} onChange={(e) => setCalcInput({ ...calcInput, fgtsBalance: +e.target.value })} /></div>
                  <div className="flex items-end gap-2"><Checkbox id="adv" checked={calcInput.hadVacationAdvance} onCheckedChange={(v) => setCalcInput({ ...calcInput, hadVacationAdvance: !!v })} /><Label htmlFor="adv">Já recebeu adiantamento de férias</Label></div>
                </div>

                <Separator />

                <div className="space-y-1">
                  {rescission.lines.map((l) => (
                    <div key={l.key} className="flex justify-between text-sm py-0.5">
                      <span className={l.value < 0 ? "text-rose-600" : ""}>{l.label}</span>
                      <span className={`font-mono ${l.value < 0 ? "text-rose-600" : "text-foreground"}`}>{fmtBRL(l.value)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span>Bruto:</span><span className="font-mono">{fmtBRL(rescission.gross)}</span></div>
                  <div className="flex justify-between"><span>Descontos:</span><span className="font-mono text-rose-600">{fmtBRL(rescission.deductions)}</span></div>
                  <div className="flex justify-between col-span-2 text-base font-semibold border-t pt-2 mt-1"><span>Líquido a pagar:</span><span className="font-mono text-emerald-600">{fmtBRL(rescission.net)}</span></div>
                  <div className="flex justify-between"><span>Depósito FGTS:</span><span className="font-mono">{fmtBRL(rescission.fgtsDeposit)}</span></div>
                  <div className="flex justify-between"><span>Multa FGTS:</span><span className="font-mono text-amber-700">{fmtBRL(rescission.fgtsPenalty)}</span></div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/20 text-xs text-amber-800">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  Cálculo estimado. Valores oficiais via contabilidade/eSocial.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={saveCalc} variant="outline">Salvar cálculo</Button>
                  <Button onClick={createFinancialEntry} disabled={!!offboarding.financial_entry_id}>
                    <DollarSign className="h-4 w-4 mr-1" />
                    {offboarding.financial_entry_id ? "Lançamento criado" : "Criar lançamento financeiro"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== DOCUMENTOS ====== */}
          <TabsContent value="documentos" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Anexar documento</CardTitle></CardHeader>
              <CardContent className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Categoria</Label>
                  <Select value={docCategory} onValueChange={setDocCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Enviar</Button>
              </CardContent>
            </Card>

            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento anexado.</p>
            ) : (
              <div className="space-y-2">
                {documents.map(d => (
                  <Card key={d.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.file_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {DOCUMENT_CATEGORIES.find(c => c.key === d.category)?.label || d.category}
                          {" · "}{format(new Date(d.created_at), "dd/MM/yyyy HH:mm")}
                          {d.size_bytes && ` · ${Math.round(d.size_bytes/1024)} KB`}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" asChild><a href={d.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeDoc(d)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ====== SAÍDA (Entrevista + Acessos) ====== */}
          <TabsContent value="saida" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Link para o colaborador responder</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Gere um link público para o ex-colaborador preencher a entrevista de saída sem viés (sem o RH no meio).</p>
                {publicToken && offboarding.exit_interview_submitted_at && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">
                    Respondida em {format(new Date(offboarding.exit_interview_submitted_at), "dd/MM/yyyy HH:mm")}
                  </Badge>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={generatePublicLink}>
                    <Copy className="h-3 w-3 mr-1" /> {publicToken ? "Copiar link" : "Gerar link"}
                  </Button>
                  {publicToken && (
                    <Input readOnly value={buildExitInterviewLink(publicToken)} className="text-xs" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldOff className="h-4 w-4 text-rose-600" /> Corte de Acessos da plataforma</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Ao concluir o desligamento, o colaborador é <strong>inativado na plataforma</strong> (login bloqueado). Sistemas externos devem ser revogados via checklist.</p>
                <div className="flex items-center gap-2 p-3 rounded border">
                  <Checkbox
                    checked={form.access_cutoff_done ?? offboarding.access_cutoff_done}
                    onCheckedChange={(v) => setForm({ ...form, access_cutoff_done: !!v })}
                  />
                  <div className="flex-1">
                    <Label>Acessos da plataforma cortados</Label>
                    {offboarding.access_cutoff_at && (
                      <p className="text-xs text-muted-foreground">Em {format(new Date(offboarding.access_cutoff_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => save({ access_cutoff_done: form.access_cutoff_done, access_cutoff_at: form.access_cutoff_done ? new Date().toISOString() : null })}>Salvar</Button>
                </div>
              </CardContent>
            </Card>

            <ExitInterview
              value={form.exit_interview || {}}
              nps={form.exit_nps}
              onChange={(ei, nps) => setForm({ ...form, exit_interview: ei, exit_nps: nps })}
              onSave={() => save({ exit_interview: form.exit_interview, exit_nps: form.exit_nps })}
            />
          </TabsContent>

          {/* ====== TIMELINE ====== */}
          <TabsContent value="timeline" className="space-y-2 mt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><History className="h-3 w-3" /> Auditoria completa</p>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {timeline.map(e => (
                  <div key={e.id} className="flex gap-3 p-2 rounded border-l-2 border-rose-500/30 bg-muted/30">
                    <div className="flex-1">
                      <p className="text-sm">{e.description || e.event_type}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {e.actor?.name && ` · ${e.actor.name}`}
                      </p>
                      {e.metadata && Object.keys(e.metadata).length > 0 && (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {JSON.stringify(e.metadata)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded border text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function AddChecklistItem({ onAdd }: { onAdd: (label: string, category: string) => void }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("geral");
  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Novo item..." value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 w-44" />
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="geral">Geral</SelectItem>
          <SelectItem value="documentos">Documentos</SelectItem>
          <SelectItem value="financeiro">Financeiro</SelectItem>
          <SelectItem value="acessos">Acessos</SelectItem>
          <SelectItem value="equipamentos">Equipamentos</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={!label.trim()} onClick={() => { onAdd(label.trim(), category); setLabel(""); }}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

const EXIT_QUESTIONS = [
  { key: "real_reason", label: "Qual o motivo real da saída?" },
  { key: "what_worked", label: "O que funcionou bem na sua experiência aqui?" },
  { key: "what_failed", label: "O que precisamos melhorar (gestão, processos, cultura)?" },
  { key: "leadership", label: "Como avalia sua liderança direta?" },
  { key: "would_return", label: "Voltaria a trabalhar conosco? Em que condições?" },
  { key: "recommend", label: "Recomendaria a empresa para um amigo?" },
];

function ExitInterview({ value, nps, onChange, onSave }: {
  value: any; nps: number | null | undefined;
  onChange: (ei: any, nps: number | null) => void; onSave: () => void;
}) {
  return (
    <Card><CardContent className="pt-6 space-y-4">
      <div>
        <Label>NPS do ex-colaborador (0 a 10)</Label>
        <div className="flex items-center gap-3 mt-2">
          <Slider value={[nps ?? 5]} min={0} max={10} step={1} onValueChange={(v) => onChange(value, v[0])} className="flex-1" />
          <span className="text-2xl font-semibold w-10 text-right">{nps ?? "—"}</span>
        </div>
      </div>
      <Separator />
      {EXIT_QUESTIONS.map((q) => (
        <div key={q.key}>
          <Label>{q.label}</Label>
          <Textarea rows={2} value={value[q.key] || ""} onChange={(e) => onChange({ ...value, [q.key]: e.target.value }, nps ?? null)} />
        </div>
      ))}
      <Button onClick={onSave} className="w-full">Salvar entrevista</Button>
    </CardContent></Card>
  );
}

function ReassignDialog({ open, onOpenChange, fromUserId, users, pendencies, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; fromUserId: string | null;
  users: Array<{ id: string; name: string | null }>; pendencies: any; onDone: () => void;
}) {
  const [toUser, setToUser] = useState("");
  const [scope, setScope] = useState({ tasks: true, deals: true, clients: true });
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!fromUserId || !toUser) return;
    setLoading(true);
    try {
      const r = await reassignCollaboratorResources(fromUserId, toUser, scope);
      toast.success(`Reatribuído: ${r.tasks || 0} tarefas, ${r.deals || 0} deals, ${r.clients || 0} clientes`);
      onDone();
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reatribuir recursos</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Novo responsável</Label>
            <Select value={toUser} onValueChange={setToUser}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {users.filter(u => u.id !== fromUserId).map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Checkbox checked={scope.tasks} onCheckedChange={(v) => setScope({ ...scope, tasks: !!v })} /><Label>Tarefas abertas ({pendencies?.openTasks || 0})</Label></div>
            <div className="flex items-center gap-2"><Checkbox checked={scope.deals} onCheckedChange={(v) => setScope({ ...scope, deals: !!v })} /><Label>Deals em aberto ({pendencies?.openDeals || 0})</Label></div>
            <div className="flex items-center gap-2"><Checkbox checked={scope.clients} onCheckedChange={(v) => setScope({ ...scope, clients: !!v })} /><Label>Clientes da carteira ({pendencies?.assignedClients || 0})</Label></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={run} disabled={!toUser || loading}>Reatribuir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
