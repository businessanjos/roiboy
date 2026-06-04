import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Save, Sparkles, ExternalLink, Copy, Plus, X, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { JOB_BENEFITS, WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS } from "@/constants/jobOptions";
import { getPublicOrigin } from "@/lib/publicLink";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Candidato" },
  { id: 2, title: "Posição" },
  { id: 3, title: "Remuneração" },
  { id: 4, title: "Conteúdo" },
  { id: 5, title: "Design" },
  { id: 6, title: "Revisão" },
];

const ACCENT_PALETTE = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E",
  "#F59E0B", "#10B981", "#06B6D4", "#0EA5E9",
  "#0F172A", "#D4A84B",
];

type Form = {
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  position_title: string;
  department: string;
  seniority: string;
  work_model: string;
  contract_type: string;
  unit: string;
  reports_to: string;
  salary_amount: string;
  salary_currency: string;
  salary_note: string;
  variable_compensation: string;
  benefits: string[];
  perks: { title: string; description: string }[];
  start_date: string;
  offer_expires_at: string;
  hero_headline: string;
  company_intro: string;
  role_pitch: string;
  next_steps: string;
  signer_name: string;
  signer_role: string;
  accent_color: string;
  cover_image_url: string;
};

const EMPTY: Form = {
  candidate_name: "", candidate_email: "", candidate_phone: "",
  position_title: "", department: "Customer Success", seniority: "", work_model: "",
  contract_type: "clt", unit: "", reports_to: "",
  salary_amount: "", salary_currency: "BRL", salary_note: "", variable_compensation: "",
  benefits: [], perks: [],
  start_date: "", offer_expires_at: "",
  hero_headline: "", company_intro: "", role_pitch: "", next_steps: "",
  signer_name: "", signer_role: "",
  accent_color: "#6366F1", cover_image_url: "",
};

const DEFAULT_COMPANY_INTRO = `A Eternum é o ecossistema de mentoria, tecnologia e gestão que está redesenhando a forma como negócios escalam no Brasil. Acreditamos que talento, propósito e execução são os três pilares de qualquer empresa que quer crescer com consistência.

Nosso time é movido por curiosidade, alta performance e proximidade com o cliente.`;

const DEFAULT_NEXT_STEPS = `Se essa proposta fizer sentido para você, basta clicar em "Aceitar oferta" no final desta página. Nosso time entrará em contato em até 24h com os próximos passos: assinatura de contrato, exames admissionais e preparação do seu primeiro dia.

Caso tenha qualquer dúvida, responda este e-mail ou fale diretamente com a pessoa que enviou esta carta.`;

export default function RHOfferWizard() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(id || null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data, error } = await supabase.from("hr_job_offers").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast({ title: "Não encontrado", variant: "destructive" }); navigate("/rh/offers"); return; }
      setForm({
        candidate_name: data.candidate_name || "",
        candidate_email: data.candidate_email || "",
        candidate_phone: data.candidate_phone || "",
        position_title: data.position_title || "",
        department: data.department || "",
        seniority: data.seniority || "",
        work_model: data.work_model || "",
        contract_type: data.contract_type || "clt",
        unit: data.unit || "",
        reports_to: data.reports_to || "",
        salary_amount: data.salary_amount?.toString() || "",
        salary_currency: data.salary_currency || "BRL",
        salary_note: data.salary_note || "",
        variable_compensation: data.variable_compensation || "",
        benefits: data.benefits || [],
        perks: (data.perks as any) || [],
        start_date: data.start_date || "",
        offer_expires_at: data.offer_expires_at || "",
        hero_headline: data.hero_headline || "",
        company_intro: data.company_intro || "",
        role_pitch: data.role_pitch || "",
        next_steps: data.next_steps || "",
        signer_name: data.signer_name || "",
        signer_role: data.signer_role || "",
        accent_color: data.accent_color || "#6366F1",
        cover_image_url: data.cover_image_url || "",
      });
      setSavedToken(data.public_token);
      setRecordId(data.id);
      isLoadedRef.current = true;
    })();
  }, [id]);

  // Mark as loaded once for new offers too
  useEffect(() => {
    if (!isEdit) isLoadedRef.current = true;
  }, [isEdit]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleBenefit = (b: string) => set("benefits", form.benefits.includes(b) ? form.benefits.filter(x => x !== b) : [...form.benefits, b]);
  const addPerk = () => set("perks", [...form.perks, { title: "", description: "" }]);
  const removePerk = (i: number) => set("perks", form.perks.filter((_, idx) => idx !== i));
  const updatePerk = (i: number, key: "title" | "description", v: string) =>
    set("perks", form.perks.map((p, idx) => idx === i ? { ...p, [key]: v } : p));

  const canNext = () => {
    if (step === 1) return form.candidate_name.trim().length > 1;
    if (step === 2) return form.position_title.trim().length > 1;
    return true;
  };

  const save = async (status: "draft" | "sent", opts: { silent?: boolean } = {}) => {
    if (!currentUser?.account_id) {
      if (!opts.silent) toast({ title: "Sessão expirada", description: "Faça login novamente", variant: "destructive" });
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (opts.silent) setAutoSaving(true); else setSaving(true);
    const payload: any = {
      account_id: currentUser.account_id,
      created_by: currentUser.auth_user_id || currentUser.id,
      candidate_name: form.candidate_name,
      candidate_email: form.candidate_email || null,
      candidate_phone: form.candidate_phone || null,
      position_title: form.position_title || "(rascunho)",
      department: form.department || null,
      seniority: form.seniority || null,
      work_model: form.work_model || null,
      contract_type: form.contract_type || null,
      unit: form.unit || null,
      reports_to: form.reports_to || null,
      salary_amount: form.salary_amount ? Number(form.salary_amount) : null,
      salary_currency: form.salary_currency,
      salary_note: form.salary_note || null,
      variable_compensation: form.variable_compensation || null,
      benefits: form.benefits,
      perks: form.perks.filter(p => p.title.trim()),
      start_date: form.start_date || null,
      offer_expires_at: form.offer_expires_at || null,
      hero_headline: form.hero_headline || null,
      company_intro: form.company_intro || DEFAULT_COMPANY_INTRO,
      role_pitch: form.role_pitch || null,
      next_steps: form.next_steps || DEFAULT_NEXT_STEPS,
      signer_name: form.signer_name || null,
      signer_role: form.signer_role || null,
      accent_color: form.accent_color,
      cover_image_url: form.cover_image_url || null,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    };
    let token = savedToken;
    const existingId = recordId;
    if (existingId) {
      const { data, error } = await supabase.from("hr_job_offers").update(payload).eq("id", existingId).select("public_token").maybeSingle();
      if (error) {
        if (!opts.silent) toast({ title: "Erro", description: error.message, variant: "destructive" });
        inFlightRef.current = false; setSaving(false); setAutoSaving(false); return;
      }
      token = data?.public_token || token;
    } else {
      const { data, error } = await supabase.from("hr_job_offers").insert(payload).select("public_token,id").maybeSingle();
      if (error) {
        if (!opts.silent) toast({ title: "Erro", description: error.message, variant: "destructive" });
        inFlightRef.current = false; setSaving(false); setAutoSaving(false); return;
      }
      token = data?.public_token || null;
      if (data?.id) {
        setRecordId(data.id);
        // Update URL silently so future refreshes resume the same record
        window.history.replaceState(null, "", `/rh/offers/${data.id}/edit`);
      }
    }
    setSavedToken(token);
    setLastSavedAt(new Date());
    inFlightRef.current = false;
    setSaving(false); setAutoSaving(false);
    if (!opts.silent) {
      toast({ title: status === "sent" ? "Offer gerada!" : "Rascunho salvo", description: token ? `${getPublicOrigin()}/oferta/${token}` : undefined });
    }
  };

  // Autosave debounced as draft once we have a candidate name
  useEffect(() => {
    if (!isLoadedRef.current) return;
    if (!currentUser?.account_id) return;
    if (form.candidate_name.trim().length < 2) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      save("draft", { silent: true });
    }, 1500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, currentUser?.account_id]);

  const fillWithAI = async () => {
    if (!form.position_title.trim()) {
      toast({ title: "Preencha o cargo", description: "Volte ao passo 2 e informe o cargo antes de usar a IA.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-offer-content", {
        body: {
          candidate_name: form.candidate_name,
          position_title: form.position_title,
          seniority: form.seniority,
          work_model: form.work_model,
          department: form.department,
          salary_amount: form.salary_amount,
          salary_currency: form.salary_currency,
          benefits: form.benefits,
          perks: form.perks,
          unit: form.unit,
          reports_to: form.reports_to,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setForm((f) => ({
        ...f,
        hero_headline: (data as any).hero_headline || f.hero_headline,
        company_intro: (data as any).company_intro || f.company_intro,
        role_pitch: (data as any).role_pitch || f.role_pitch,
        next_steps: (data as any).next_steps || f.next_steps,
        signer_name: f.signer_name || (data as any).signer_name || "",
        signer_role: f.signer_role || (data as any).signer_role || "",
      }));
      toast({ title: "Conteúdo gerado!", description: "Revise e ajuste conforme necessário." });
    } catch (e: any) {
      toast({ title: "Erro na IA", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };


  const copyLink = () => {
    if (!savedToken) return;
    const url = `${getPublicOrigin()}/oferta/${savedToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rh/offers")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Editar Offer" : "Nova Offer"}
          </h1>
          <p className="text-sm text-muted-foreground">Wizard para gerar uma carta-proposta linda</p>
        </div>
        <Sparkles className="h-6 w-6 text-indigo-500" />
      </div>

      {/* Stepper */}
      <div className="relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
        />
        <div className="relative flex justify-between">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id < step && setStep(s.id)}
              className="flex flex-col items-center gap-2"
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all",
                s.id <= step ? "border-primary bg-primary text-primary-foreground" : "border-muted bg-background text-muted-foreground"
              )}>
                {s.id < step ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span className={cn("text-xs hidden sm:block", s.id === step ? "font-medium" : "text-muted-foreground")}>{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={form.candidate_name} onChange={(e) => set("candidate_name", e.target.value)} placeholder="Ex.: Mariana Souza" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.candidate_email} onChange={(e) => set("candidate_email", e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.candidate_phone} onChange={(e) => set("candidate_phone", e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Cargo *</Label>
                <Input value={form.position_title} onChange={(e) => set("position_title", e.target.value)} placeholder="Ex.: Customer Success Analyst" />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input value={form.department} onChange={(e) => set("department", e.target.value)} />
              </div>
              <div>
                <Label>Senioridade</Label>
                <Select value={form.seniority} onValueChange={(v) => set("seniority", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(JOB_SENIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modelo de trabalho</Label>
                <Select value={form.work_model} onValueChange={(v) => set("work_model", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(WORK_MODEL_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de contratação</Label>
                <Select value={form.contract_type} onValueChange={(v) => set("contract_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade / Cidade</Label>
                <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Ex.: São Paulo / Remoto" />
              </div>
              <div>
                <Label>Reporta-se a</Label>
                <Input value={form.reports_to} onChange={(e) => set("reports_to", e.target.value)} />
              </div>
              <div>
                <Label>Data de início</Label>
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div>
                <Label>Validade da proposta</Label>
                <Input type="date" value={form.offer_expires_at} onChange={(e) => set("offer_expires_at", e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Moeda</Label>
                  <Select value={form.salary_currency} onValueChange={(v) => set("salary_currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Valor mensal</Label>
                  <Input type="number" step="0.01" value={form.salary_amount} onChange={(e) => set("salary_amount", e.target.value)} placeholder="0,00" />
                </div>
              </div>
              <div>
                <Label>Observação sobre salário</Label>
                <Input value={form.salary_note} onChange={(e) => set("salary_note", e.target.value)} placeholder="Ex.: revisado após 6 meses" />
              </div>
              <div>
                <Label>Remuneração variável</Label>
                <Textarea rows={2} value={form.variable_compensation} onChange={(e) => set("variable_compensation", e.target.value)} placeholder="Ex.: PLR semestral atrelada a metas..." />
              </div>
              <div>
                <Label className="mb-2 block">Benefícios</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {JOB_BENEFITS.map((b) => (
                    <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={form.benefits.includes(b)} onCheckedChange={() => toggleBenefit(b)} />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Perks personalizados</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addPerk} className="gap-1">
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.perks.map((p, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-lg border bg-muted/30">
                      <div className="flex-1 space-y-2">
                        <Input placeholder="Título (ex.: Equipamento próprio)" value={p.title} onChange={(e) => updatePerk(i, "title", e.target.value)} />
                        <Input placeholder="Descrição curta" value={p.description} onChange={(e) => updatePerk(i, "description", e.target.value)} />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePerk(i)}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label>Headline da capa</Label>
                <Input value={form.hero_headline} onChange={(e) => set("hero_headline", e.target.value)} placeholder={`Ex.: ${form.candidate_name || "Mariana"}, esta proposta é para você.`} />
              </div>
              <div>
                <Label>Sobre a Eternum</Label>
                <Textarea rows={6} value={form.company_intro} onChange={(e) => set("company_intro", e.target.value)} placeholder={DEFAULT_COMPANY_INTRO} />
              </div>
              <div>
                <Label>Sobre a vaga / Pitch</Label>
                <Textarea rows={6} value={form.role_pitch} onChange={(e) => set("role_pitch", e.target.value)} placeholder="Por que esse papel é estratégico, o que a pessoa vai fazer, com quem vai trabalhar, como o sucesso será medido..." />
              </div>
              <div>
                <Label>Próximos passos</Label>
                <Textarea rows={4} value={form.next_steps} onChange={(e) => set("next_steps", e.target.value)} placeholder={DEFAULT_NEXT_STEPS} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Quem assina</Label>
                  <Input value={form.signer_name} onChange={(e) => set("signer_name", e.target.value)} placeholder="Ex.: Marina Quintana" />
                </div>
                <div>
                  <Label>Cargo de quem assina</Label>
                  <Input value={form.signer_role} onChange={(e) => set("signer_role", e.target.value)} placeholder="Ex.: Head de Pessoas" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <Label className="mb-3 block">Cor de destaque</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("accent_color", c)}
                      className={cn(
                        "w-10 h-10 rounded-full border-2 transition-all",
                        form.accent_color === c ? "border-foreground scale-110 ring-2 ring-offset-2 ring-foreground/20" : "border-transparent"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <Input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) => set("accent_color", e.target.value)}
                    className="w-10 h-10 p-1 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <Label>Imagem de capa (URL)</Label>
                <Input value={form.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} placeholder="https://..." />
                <p className="text-xs text-muted-foreground mt-1">Opcional. Aparece atrás da headline na capa.</p>
              </div>

              {/* Preview Hero */}
              <div className="rounded-xl overflow-hidden border">
                <div
                  className="relative p-10 text-white"
                  style={{
                    background: form.cover_image_url
                      ? `linear-gradient(135deg, ${form.accent_color}DD, ${form.accent_color}99), url(${form.cover_image_url}) center/cover`
                      : `linear-gradient(135deg, ${form.accent_color}, ${form.accent_color}99)`,
                  }}
                >
                  <p className="text-xs uppercase tracking-widest opacity-80 mb-2">Carta-Proposta</p>
                  <h2 className="text-3xl font-bold leading-tight">
                    {form.hero_headline || `${form.candidate_name || "Nome do candidato"}, esta proposta é para você.`}
                  </h2>
                  <p className="mt-3 opacity-90">{form.position_title || "Cargo"}</p>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/40 space-y-2 text-sm">
                <div><strong>Candidato:</strong> {form.candidate_name} {form.candidate_email && `• ${form.candidate_email}`}</div>
                <div><strong>Cargo:</strong> {form.position_title} {form.seniority && `• ${JOB_SENIORITY_LABELS[form.seniority as keyof typeof JOB_SENIORITY_LABELS]}`}</div>
                {form.work_model && <div><strong>Modelo:</strong> {WORK_MODEL_LABELS[form.work_model as keyof typeof WORK_MODEL_LABELS]}</div>}
                {form.salary_amount && <div><strong>Salário:</strong> {form.salary_currency} {Number(form.salary_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>}
                <div><strong>Benefícios:</strong> {form.benefits.length} selecionados</div>
                <div><strong>Perks:</strong> {form.perks.filter(p => p.title.trim()).length}</div>
              </div>

              {savedToken && (
                <div className="p-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 space-y-2">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    ✨ Link público da offer:
                  </p>
                  <div className="flex gap-2">
                    <Input readOnly value={`${getPublicOrigin()}/oferta/${savedToken}`} className="bg-background" />
                    <Button variant="outline" size="icon" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={`${getPublicOrigin()}/oferta/${savedToken}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => save("draft")} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" /> Salvar rascunho
                </Button>
                <Button onClick={() => save("sent")} disabled={saving} className="gap-2 flex-1" style={{ background: form.accent_color }}>
                  <Sparkles className="h-4 w-4" /> Gerar offer e marcar como enviada
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < STEPS.length ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => navigate("/rh/offers")}>Concluir</Button>
        )}
      </div>
    </div>
  );
}
