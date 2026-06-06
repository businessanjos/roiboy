import { useEffect, useMemo, useState } from "react";
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
import { CheckCircle2, ExternalLink, AlertTriangle, Calculator, Trash2, Plus, ShieldOff, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useHROffboardings, useHROffboardingChecklist,
  OFFBOARDING_STAGES, OFFBOARDING_STAGE_LABELS, OFFBOARDING_STAGE_COLORS,
  type HROffboarding, type OffboardingStage,
} from "@/hooks/useHROffboardings";
import {
  computeRescission, TERMINATION_TYPE_LABELS, NOTICE_TYPE_LABELS,
  type TerminationType, type NoticeType,
} from "@/lib/rescissionCalc";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function OffboardingDrawer({
  offboarding, open, onClose,
}: { offboarding: HROffboarding; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { update, remove } = useHROffboardings();
  const { items, toggle, add, remove: removeItem } = useHROffboardingChecklist(offboarding.id);

  const [tab, setTab] = useState("resumo");
  const [form, setForm] = useState<Partial<HROffboarding>>({});

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
    });
  }, [offboarding.id]);

  const collab = offboarding.collaborator;

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

  async function moveStage(stage: OffboardingStage) {
    await save({ stage });
  }

  async function completeOffboarding() {
    if (!confirm("Confirmar conclusão? Isso vai inativar o colaborador e cortar seu acesso à plataforma.")) return;
    await save({ stage: "completed", access_cutoff_done: true, access_cutoff_at: new Date().toISOString(), termination_date: form.termination_date || new Date().toISOString().slice(0, 10) });
    toast.success("Desligamento concluído — colaborador inativado");
    onClose();
  }

  const checklistByCat = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((i) => { (groups[i.category] = groups[i.category] || []).push(i); });
    return groups;
  }, [items]);

  const checklistProgress = items.length ? Math.round((items.filter(i => i.done).length / items.length) * 100) : 0;

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
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="checklist">Checklist {checklistProgress > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{checklistProgress}%</Badge>}</TabsTrigger>
            <TabsTrigger value="rescisao">Rescisão</TabsTrigger>
            <TabsTrigger value="acessos">Acessos</TabsTrigger>
            <TabsTrigger value="saida">Entrevista</TabsTrigger>
          </TabsList>

          {/* ====== RESUMO ====== */}
          <TabsContent value="resumo" className="space-y-4 mt-4">
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
                <Label>Data efetiva do desligamento</Label>
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
              <div>
                <Label>Etapa</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as OffboardingStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OFFBOARDING_STAGES.map((s) => <SelectItem key={s} value={s}>{OFFBOARDING_STAGE_LABELS[s]}</SelectItem>)}
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Button onClick={completeOffboarding}><CheckCircle2 className="h-4 w-4" /> Concluir desligamento</Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ====== CHECKLIST ====== */}
          <TabsContent value="checklist" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{items.filter(i=>i.done).length} de {items.length} concluídos ({checklistProgress}%)</p>
              <AddChecklistItem onAdd={(label, category) => add({ label, category })} />
            </div>
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
                  Cálculo estimado para previsão. Valores oficiais devem ser apurados pela contabilidade (eSocial / TRCT).
                </div>

                <Button onClick={saveCalc} variant="outline" className="w-full">Salvar cálculo no desligamento</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== ACESSOS ====== */}
          <TabsContent value="acessos" className="space-y-4 mt-4">
            <Card><CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-5 w-5 text-rose-600" />
                <p className="font-medium">Corte de Acessos</p>
              </div>
              <p className="text-sm text-muted-foreground">Ao concluir o desligamento, o colaborador será automaticamente <strong>inativado na plataforma</strong> (status = inactive e login bloqueado).</p>

              <div className="flex items-center gap-2 p-3 rounded border">
                <Checkbox
                  checked={!!form.access_cutoff_done ?? offboarding.access_cutoff_done}
                  onCheckedChange={(v) => setForm({ ...form, access_cutoff_done: !!v, access_cutoff_at: v ? new Date().toISOString() : null })}
                />
                <div className="flex-1">
                  <Label>Acessos cortados</Label>
                  {offboarding.access_cutoff_at && (
                    <p className="text-xs text-muted-foreground">Em {format(new Date(offboarding.access_cutoff_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => save({ access_cutoff_done: form.access_cutoff_done, access_cutoff_at: form.access_cutoff_done ? new Date().toISOString() : null })}>Salvar</Button>
              </div>

              <p className="text-xs text-muted-foreground">Os demais sistemas externos (Google Workspace, RoyZapp, Omie, etc.) devem ser revogados manualmente — marque os itens correspondentes no checklist.</p>
            </CardContent></Card>
          </TabsContent>

          {/* ====== ENTREVISTA SAÍDA ====== */}
          <TabsContent value="saida" className="space-y-4 mt-4">
            <ExitInterview
              value={form.exit_interview || {}}
              nps={form.exit_nps}
              onChange={(ei, nps) => setForm({ ...form, exit_interview: ei, exit_nps: nps })}
              onSave={() => save({ exit_interview: form.exit_interview, exit_nps: form.exit_nps })}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
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
