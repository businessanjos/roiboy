import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHRPartners, HRPartner } from "@/hooks/useHRPartners";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Save, User, Briefcase, Phone, MapPin, AlertTriangle,
  FileText, Trash2, Crown, CheckCircle2, Loader2, Search, Percent,
  Landmark, Building2, Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const RH_ALLOWED_EMAILS = ["m.quintana@me.com", "coachevertonsantos@gmail.com", "rh@anjosbusiness.com.br"];

const STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "exited", label: "Saído" },
];

const PARTNER_TYPE_OPTIONS = [
  { value: "administrador", label: "Sócio-Administrador" },
  { value: "quotista", label: "Sócio Quotista" },
  { value: "investidor", label: "Sócio Investidor" },
];

const MARITAL_PROPERTY_OPTIONS = [
  { value: "comunhao_parcial", label: "Comunhão Parcial de Bens" },
  { value: "comunhao_universal", label: "Comunhão Universal de Bens" },
  { value: "separacao_total", label: "Separação Total de Bens" },
  { value: "participacao_final", label: "Participação Final nos Aquestos" },
];

const DEPARTMENT_OPTIONS = [
  "Administrativo", "Comercial", "Financeiro", "Jurídico",
  "Marketing", "Operações", "Recursos Humanos", "Tecnologia",
  "Suporte", "Diretoria",
];

function formatBRL(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "";
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

export default function HRPartnerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { updatePartner, deletePartner } = useHRPartners();
  const [partner, setPartner] = useState<HRPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [form, setForm] = useState<Partial<HRPartner>>({});
  const [cpfLooking, setCpfLooking] = useState(false);
  const [proLaboreDisplay, setProLaboreDisplay] = useState("");
  const [ownershipDisplay, setOwnershipDisplay] = useState("");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  const isDirty = useRef(false);

  formRef.current = form;

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("hr_partners")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        toast.error("Sócio não encontrado");
        navigate("/rh/partners");
        return;
      }
      const partnerData = data as unknown as HRPartner;
      setPartner(partnerData);
      setForm(partnerData);
      setProLaboreDisplay(formatBRL(partnerData.pro_labore));
      setOwnershipDisplay(partnerData.ownership_percentage != null ? String(partnerData.ownership_percentage) : "");
      setLoading(false);
      isDirty.current = false;
    })();
  }, [id]);

  const performSave = useCallback(async () => {
    const currentForm = formRef.current;
    if (!id || !currentForm.full_name?.trim()) return;
    setSaving(true);
    const ok = await updatePartner(id, currentForm, true);
    setSaving(false);
    if (ok) {
      setPartner(prev => ({ ...prev!, ...currentForm } as HRPartner));
      setLastSaved(new Date());
    }
  }, [id, updatePartner]);

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
    const ok = await deletePartner(id);
    if (ok) navigate("/rh/partners");
  };

  const setField = (key: string, value: any) => {
    isDirty.current = true;
    setForm(f => ({ ...f, [key]: value }));
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
      const updates: Partial<HRPartner> = {};
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
      setForm(f => ({ ...f, ...updates }));
      toast.success("Dados do CPF preenchidos com sucesso!");
    } catch {
      toast.error("Erro ao consultar CPF");
    }
    setCpfLooking(false);
  };

  if (currentUser && !RH_ALLOWED_EMAILS.includes((currentUser.email || "").toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;
  if (!partner) return null;

  const showMaritalRegime = form.marital_status === "married";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh/partners")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarImage src={partner.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {getInitials(partner.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            {partner.full_name}
            <Crown className="h-4 w-4 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground">
            {partner.position || "Sócio"} • {partner.department || "Sem departamento"}
            {partner.ownership_percentage != null && ` • ${partner.ownership_percentage}%`}
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
              <AlertDialogTitle>Excluir sócio?</AlertDialogTitle>
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
            <div><Label>Nacionalidade</Label><Input value={form.nationality || ""} onChange={e => setField("nationality", e.target.value)} placeholder="Brasileiro(a)" /></div>
            <div><Label>Profissão / Formação</Label><Input value={form.profession || ""} onChange={e => setField("profession", e.target.value)} placeholder="Ex: Administrador" /></div>
            <div><Label>PIS/PASEP</Label><Input value={form.pis_pasep || ""} onChange={e => setField("pis_pasep", e.target.value)} /></div>
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
            {showMaritalRegime && (
              <div>
                <Label>Regime de bens</Label>
                <Select value={form.marital_property_regime || ""} onValueChange={v => setField("marital_property_regime", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {MARITAL_PROPERTY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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

        {/* Dados Societários */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Dados Societários</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de sócio</Label>
              <Select value={form.partner_type || "quotista"} onValueChange={v => setField("partner_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTNER_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Área de atuação</Label>
              <Select value={form.department || ""} onValueChange={v => setField("department", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cargo</Label><Input value={form.position || ""} onChange={e => setField("position", e.target.value)} /></div>
            <div>
              <Label>Participação societária (%)</Label>
              <div className="relative">
                <Input
                  value={ownershipDisplay}
                  onChange={e => setOwnershipDisplay(e.target.value)}
                  onBlur={() => {
                    const val = parseFloat(ownershipDisplay);
                    setField("ownership_percentage", isNaN(val) ? null : val);
                    setOwnershipDisplay(isNaN(val) ? "" : String(val));
                  }}
                  placeholder="0"
                  type="number"
                  min="0"
                  max="100"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div>
              <Label>Pró-labore</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  className="pl-10"
                  value={proLaboreDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^\d,]/g, "");
                    setProLaboreDisplay(raw);
                  }}
                  onBlur={() => {
                    const parsed = parseBRL(proLaboreDisplay);
                    setField("pro_labore", parsed);
                    setProLaboreDisplay(formatBRL(parsed));
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div><Label>Data de entrada</Label><Input type="date" value={form.join_date || ""} onChange={e => setField("join_date", e.target.value)} /></div>
            <div><Label>Data de saída</Label><Input type="date" value={form.exit_date || ""} onChange={e => setField("exit_date", e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || "active"} onValueChange={v => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nº Contrato Social / Alteração</Label><Input value={form.social_contract_number || ""} onChange={e => setField("social_contract_number", e.target.value)} placeholder="Ex: 1ª Alteração" /></div>
            <div><Label>CNPJ da Holding (se PJ)</Label><Input value={form.holding_cnpj || ""} onChange={e => setField("holding_cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></div>
          </CardContent>
        </Card>

        {/* Dados Bancários */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> Dados Bancários</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Banco</Label><Input value={form.bank_name || ""} onChange={e => setField("bank_name", e.target.value)} placeholder="Ex: Itaú" /></div>
            <div><Label>Agência</Label><Input value={form.bank_agency || ""} onChange={e => setField("bank_agency", e.target.value)} /></div>
            <div><Label>Conta</Label><Input value={form.bank_account || ""} onChange={e => setField("bank_account", e.target.value)} /></div>
            <div><Label>Chave PIX</Label><Input value={form.bank_pix_key || ""} onChange={e => setField("bank_pix_key", e.target.value)} placeholder="CPF, email, telefone ou chave aleatória" /></div>
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
            <Textarea rows={4} value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Anotações sobre o sócio..." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
