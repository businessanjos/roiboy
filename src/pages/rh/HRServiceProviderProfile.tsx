import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHRServiceProviders, HRServiceProvider } from "@/hooks/useHRServiceProviders";
import { useHRDepartments } from "@/hooks/useHRDepartments";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Save, User, Briefcase, Phone, MapPin, AlertTriangle,
  FileText, Trash2, Handshake, CheckCircle2, Loader2, Search,
  Landmark, Building2, Crown, UserSearch,
} from "lucide-react";
import { BankCombobox } from "@/components/rh/BankCombobox";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const RH_ALLOWED_EMAILS = ["m.quintana@me.com", "coachevertonsantos@gmail.com", "rh@anjosbusiness.com.br", "diessica@consultoria-luma.com", "jaqueline@consultoria-luma.com"];

const STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "terminated", label: "Encerrado" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência Bancária" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "outro", label: "Outro" },
];

function formatBRL(value: number | null | undefined): string {
  if (value == null || isNaN(value) || value === 0) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(formatted: string): number | null {
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function HRServiceProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { updateProvider, deleteProvider } = useHRServiceProviders();
  const { departments } = useHRDepartments();
  const [provider, setProvider] = useState<HRServiceProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [form, setForm] = useState<Partial<HRServiceProvider>>({});
  const [cpfLooking, setCpfLooking] = useState(false);
  const [cnpjLooking, setCnpjLooking] = useState(false);
  const [feeDisplay, setFeeDisplay] = useState("");
  const [totalDisplay, setTotalDisplay] = useState("");
  const [downPaymentDisplay, setDownPaymentDisplay] = useState("");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  const isDirty = useRef(false);

  formRef.current = form;

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("hr_service_providers")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        toast.error("Prestador não encontrado");
        navigate("/rh/service-providers");
        return;
      }
      const providerData = data as unknown as HRServiceProvider;
      setProvider(providerData);
      setForm(providerData);
      setFeeDisplay(formatBRL(providerData.fee_amount));
      setTotalDisplay(formatBRL(providerData.contract_total_value));
      setDownPaymentDisplay(formatBRL(providerData.contract_down_payment));
      setLoading(false);
      isDirty.current = false;
    })();
  }, [id]);

  const performSave = useCallback(async () => {
    const currentForm = formRef.current;
    if (!id || !currentForm.full_name?.trim()) return;
    setSaving(true);
    const ok = await updateProvider(id, currentForm, true);
    setSaving(false);
    if (ok) {
      setProvider(prev => ({ ...prev!, ...currentForm } as HRServiceProvider));
      setLastSaved(new Date());
    }
  }, [id, updateProvider]);

  useEffect(() => {
    if (!isDirty.current || loading) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { performSave(); isDirty.current = false; }, 2000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [form, performSave, loading]);

  const handleSave = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await performSave();
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await deleteProvider(id);
    if (ok) navigate("/rh/service-providers");
  };

  const setField = (key: string, value: any) => {
    isDirty.current = true;
    setForm(f => ({ ...f, [key]: value }));
  };

  const recalcFee = (total?: number | null, down?: number | null, installments?: number | null) => {
    const t = total ?? (formRef.current as any).contract_total_value ?? 0;
    const d = down ?? (formRef.current as any).contract_down_payment ?? 0;
    const n = installments ?? (formRef.current as any).contract_installments_count ?? 0;
    if (t > 0 && n > 0) {
      const remaining = t - (d || 0);
      const parcelsAfterDown = d && d > 0 ? n - 1 : n;
      if (parcelsAfterDown > 0) {
        const fee = Math.round((remaining / parcelsAfterDown) * 100) / 100;
        setField("fee_amount", fee);
        setFeeDisplay(formatBRL(fee));
        return;
      }
    }
    setField("fee_amount", null);
    setFeeDisplay("");
  };

  const handleCpfLookup = async () => {
    const cpf = form.cpf?.replace(/\D/g, "");
    if (!cpf || cpf.length !== 11) {
      toast.error("Informe um CPF válido com 11 dígitos");
      return;
    }
    setCpfLooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubdev-cpf-lookup", {
        body: { cpf, nascimento: form.birth_date || undefined },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro ao consultar CPF");
        setCpfLooking(false);
        return;
      }
      const updates: Partial<HRServiceProvider> = {};
      if (data.nome) updates.full_name = data.nome;
      if (data.nascimento) {
        const parts = data.nascimento.split("/");
        if (parts.length === 3) updates.birth_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      if (data.telefone) updates.phone = data.telefone;
      if (data.endereco) updates.address = data.endereco;
      if (data.bairro && data.endereco) updates.address = `${data.endereco}, ${data.bairro}`;
      if (data.cidade) updates.city = data.cidade;
      if (data.estado) updates.state = data.estado;
      if (data.cep) updates.zip_code = data.cep;
      isDirty.current = true;
      setForm(f => ({ ...f, ...updates }));
      toast.success("Dados do CPF preenchidos com sucesso!");
    } catch {
      toast.error("Erro ao consultar CPF");
    }
    setCpfLooking(false);
  };

  const handleCnpjLookup = async () => {
    const cnpj = form.cnpj?.replace(/\D/g, "");
    if (!cnpj || cnpj.length !== 14) {
      toast.error("Informe um CNPJ válido com 14 dígitos");
      return;
    }
    setCnpjLooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubdev-cnpj-lookup", {
        body: { cnpj },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro ao consultar CNPJ");
        setCnpjLooking(false);
        return;
      }
      const updates: Partial<HRServiceProvider> = {};
      if (data.razao_social) updates.company_name = data.razao_social;
      if (data.nome_fantasia) updates.trade_name = data.nome_fantasia;
      if (data.email && !form.email) updates.email = data.email;
      if (data.telefone && !form.phone) updates.phone = data.telefone;
      if (data.logradouro) {
        let addr = data.logradouro;
        if (data.numero) addr += `, ${data.numero}`;
        if (data.complemento) addr += ` - ${data.complemento}`;
        if (data.bairro) addr += `, ${data.bairro}`;
        updates.address = addr;
      }
      if (data.cidade) updates.city = data.cidade;
      if (data.estado) updates.state = data.estado;
      if (data.cep) updates.zip_code = data.cep;
      isDirty.current = true;
      setForm(f => ({ ...f, ...updates }));
      toast.success("Dados do CNPJ preenchidos com sucesso!");
    } catch {
      toast.error("Erro ao consultar CNPJ");
    }
    setCnpjLooking(false);
  };

  if (currentUser && !RH_ALLOWED_EMAILS.includes((currentUser.email || "").toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;
  if (!provider) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh/service-providers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarImage src={provider.avatar_url || undefined} />
          <AvatarFallback className="bg-amber-100 text-amber-700 font-semibold">
            {getInitials(provider.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            {provider.full_name}
            <Handshake className="h-4 w-4 text-amber-600" />
          </h1>
          <p className="text-sm text-muted-foreground">
            {provider.position || "Prestador"} • {provider.service_type || "Sem tipo definido"}
            {provider.company_name && ` • ${provider.company_name}`}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir prestador?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex items-center gap-2 min-w-[200px] justify-end">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[120px] justify-end">
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
            ) : lastSaved ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Salvo às {lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
            ) : null}
          </span>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Dados Pessoais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nome completo</Label><Input value={form.full_name || ""} onChange={e => setField("full_name", e.target.value)} /></div>
            <div>
              <Label>CPF</Label>
              <div className="flex gap-2">
                <Input value={form.cpf || ""} onChange={e => setField("cpf", e.target.value)} placeholder="000.000.000-00" />
                <Button type="button" variant="outline" size="icon" onClick={handleCpfLookup} disabled={cpfLooking} title="Consultar CPF" className="shrink-0">
                  {cpfLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div><Label>RG</Label><Input value={form.rg || ""} onChange={e => setField("rg", e.target.value)} /></div>
            <div><Label>Data de nascimento</Label><Input type="date" value={form.birth_date || ""} onChange={e => setField("birth_date", e.target.value)} /></div>
            <div>
              <Label>Gênero</Label>
              <Select value={form.gender || ""} onValueChange={v => setField("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                  <SelectItem value="prefer_not_say">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado civil</Label>
              <Select value={form.marital_status || ""} onValueChange={v => setField("marital_status", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Solteiro(a)</SelectItem>
                  <SelectItem value="married">Casado(a)</SelectItem>
                  <SelectItem value="divorced">Divorciado(a)</SelectItem>
                  <SelectItem value="widowed">Viúvo(a)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Dados da Empresa PJ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Dados da Empresa (PJ)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>CNPJ</Label>
              <div className="flex gap-2">
                <Input value={form.cnpj || ""} onChange={e => setField("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                <Button type="button" variant="outline" size="icon" onClick={handleCnpjLookup} disabled={cnpjLooking} title="Consultar CNPJ (HubDev)" className="shrink-0">
                  {cnpjLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div><Label>Razão Social</Label><Input value={form.company_name || ""} onChange={e => setField("company_name", e.target.value)} /></div>
            <div><Label>Nome Fantasia</Label><Input value={form.trade_name || ""} onChange={e => setField("trade_name", e.target.value)} /></div>
          </CardContent>
        </Card>

        {/* Classificação PJ + R&S */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> Classificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tipo de PJ</Label>
              <Select value={(form as any).provider_kind || "on_demand"} onValueChange={(v) => setField("provider_kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">
                    <span className="flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-amber-600" /> Diretor / Cargo de confiança</span>
                  </SelectItem>
                  <SelectItem value="on_demand">
                    <span className="flex items-center gap-1.5"><Handshake className="h-3.5 w-3.5 text-amber-600" /> Prestador sob demanda</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {((form as any).provider_kind || "on_demand") === "director"
                  ? "Sócios e diretores PJ da Eternum (Arthur, Jonathan, Jéssica, Maikol...)."
                  : "Consultorias, contábil, medicina ocupacional e demais terceirizados."}
              </p>
            </div>

            {((form as any).provider_kind || "on_demand") === "director" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                  <Crown className="h-4 w-4 text-amber-600" /> Posicionamento no Organograma
                </div>
                <p className="text-xs text-muted-foreground">
                  Diretores PJ aparecem no organograma da empresa. Defina o setor e o cargo para posicioná-lo corretamente.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Setor / Departamento</Label>
                    <Select
                      value={(form as any).department || ""}
                      onValueChange={(v) => setField("department", v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Cargo</Label>
                    <Input
                      value={form.position || ""}
                      onChange={e => setField("position", e.target.value)}
                      placeholder="Ex: CEO, Diretor, Head de Operações..."
                    />
                  </div>
                </div>
              </div>
            )}

            {((form as any).provider_kind || "on_demand") === "on_demand" && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="flex items-center gap-1.5 text-sm"><UserSearch className="h-4 w-4 text-violet-600" /> Parceiro de Recrutamento & Seleção</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Marque se este prestador capta candidatos para suas vagas.</p>
                  </div>
                  <Switch
                    checked={!!(form as any).is_recruitment_partner}
                    onCheckedChange={(v) => setField("is_recruitment_partner", v)}
                  />
                </div>
                {(form as any).is_recruitment_partner && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Comissão por contratação (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={(form as any).recruitment_commission_pct ?? ""}
                        onChange={e => setField("recruitment_commission_pct", e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ex: 15"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Observações de R&S</Label>
                      <Input
                        value={(form as any).recruitment_notes || ""}
                        onChange={e => setField("recruitment_notes", e.target.value)}
                        placeholder="Áreas que atende, contato dedicado..."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" /> Contato</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Email</Label><Input value={form.email || ""} onChange={e => setField("email", e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={form.phone || ""} onChange={e => setField("phone", e.target.value)} /></div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Endereço</Label><Input value={form.address || ""} onChange={e => setField("address", e.target.value)} /></div>
            <div><Label>Cidade</Label><Input value={form.city || ""} onChange={e => setField("city", e.target.value)} /></div>
            <div><Label>Estado</Label><Input value={form.state || ""} onChange={e => setField("state", e.target.value)} /></div>
            <div><Label>CEP</Label><Input value={form.zip_code || ""} onChange={e => setField("zip_code", e.target.value)} /></div>
          </CardContent>
        </Card>

        {/* Dados do Contrato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Dados do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>Nº do Contrato</Label><Input value={(form as any).contract_number || ""} onChange={e => setField("contract_number", e.target.value)} placeholder="Ex: PSC-001/2025" /></div>
            <div><Label>Tipo de Serviço</Label><Input value={form.service_type || ""} onChange={e => setField("service_type", e.target.value)} placeholder="Ex: Consultoria, Design..." /></div>
            <div><Label>Função / Cargo</Label><Input value={form.position || ""} onChange={e => setField("position", e.target.value)} placeholder="Ex: Consultor, Designer..." /></div>

            <div>
              <Label>Valor Total do Contrato</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  className="pl-10"
                  value={totalDisplay}
                  onChange={e => { setTotalDisplay(e.target.value.replace(/[^\d,]/g, "")); }}
                  onBlur={() => {
                    const parsed = parseBRL(totalDisplay);
                    setField("contract_total_value", parsed);
                    setTotalDisplay(formatBRL(parsed));
                    recalcFee(parsed, undefined, undefined);
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <Label>Valor de Entrada</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  className="pl-10"
                  value={downPaymentDisplay}
                  onChange={e => { setDownPaymentDisplay(e.target.value.replace(/[^\d,]/g, "")); }}
                  onBlur={() => {
                    const parsed = parseBRL(downPaymentDisplay);
                    setField("contract_down_payment", parsed);
                    setDownPaymentDisplay(formatBRL(parsed));
                    recalcFee(undefined, parsed, undefined);
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <Label>Qtd. de Parcelas</Label>
              <Input
                type="number"
                min={1}
                value={(form as any).contract_installments_count || ""}
                onChange={e => {
                  const val = parseInt(e.target.value) || null;
                  setField("contract_installments_count", val);
                  recalcFee(undefined, undefined, val);
                }}
                placeholder="1"
              />
            </div>
            <div>
              <Label>Fee mensal (calculado)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  className="pl-10 bg-muted"
                  value={feeDisplay}
                  readOnly
                  placeholder="Preenchido automaticamente"
                />
              </div>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_method || ""} onValueChange={v => setField("payment_method", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div><Label>Início do Contrato</Label><Input type="date" value={(form as any).contract_start_date || ""} onChange={e => setField("contract_start_date", e.target.value)} /></div>
            <div><Label>Fim do Contrato</Label><Input type="date" value={(form as any).contract_end_date || ""} onChange={e => setField("contract_end_date", e.target.value)} /></div>

            <div>
              <Label>Renovação Automática</Label>
              <Select value={(form as any).contract_auto_renewal ? "yes" : "no"} onValueChange={v => setField("contract_auto_renewal", v === "yes")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Sim</SelectItem>
                  <SelectItem value="no">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || "active"} onValueChange={v => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Dados Bancários */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> Dados Bancários</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Banco</Label>
              <BankCombobox
                value={(form as any).bank_name || ""}
                onChange={(bank) => {
                  setField("bank_name", bank.name);
                }}
              />
            </div>
            <div><Label>Agência</Label><Input value={(form as any).bank_agency || ""} onChange={e => setField("bank_agency", e.target.value)} /></div>
            <div><Label>Conta</Label><Input value={(form as any).bank_account || ""} onChange={e => setField("bank_account", e.target.value)} /></div>
            <div><Label>Chave PIX</Label><Input value={(form as any).bank_pix_key || ""} onChange={e => setField("bank_pix_key", e.target.value)} placeholder="CPF, email, telefone ou chave aleatória" /></div>
          </CardContent>
        </Card>

        {/* Contato de Emergência */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Contato de Emergência</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nome</Label><Input value={form.emergency_contact_name || ""} onChange={e => setField("emergency_contact_name", e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={form.emergency_contact_phone || ""} onChange={e => setField("emergency_contact_phone", e.target.value)} /></div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea rows={4} value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Anotações sobre o prestador..." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
