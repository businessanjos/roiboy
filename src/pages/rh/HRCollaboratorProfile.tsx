import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHRCollaborators, HRCollaborator } from "@/hooks/useHRCollaborators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Save, User, Briefcase, Phone, Mail, MapPin, AlertTriangle,
  Calendar, FileText, Trash2, Clock, Gift, TrendingUp, CalendarDays,
  CheckCircle2, Loader2, Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import CollaboratorDocuments from "./components/CollaboratorDocuments";
import CollaboratorVacations from "./components/CollaboratorVacations";
import CollaboratorSalaryHistory from "./components/CollaboratorSalaryHistory";
import CollaboratorTimeRecords from "./components/CollaboratorTimeRecords";
import CollaboratorBenefits from "./components/CollaboratorBenefits";
import CollaboratorPayroll from "./components/CollaboratorPayroll";
import { Wallet } from "lucide-react";

const RH_ALLOWED_EMAIL = "m.quintana@me.com";

const STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "vacation", label: "Férias" },
  { value: "leave", label: "Afastado" },
];

const EMPLOYMENT_TYPES: Record<string, string> = {
  clt: "CLT", pj: "PJ", socio: "Sócio", intern: "Estágio", temporary: "Temporário", freelancer: "Freelancer",
};

const DEPARTMENT_OPTIONS = [
  "Administrativo",
  "Comercial",
  "Financeiro",
  "Jurídico",
  "Marketing",
  "Operações",
  "Recursos Humanos",
  "Tecnologia",
  "Suporte",
  "Diretoria",
];

function getSalaryLabel(employmentType?: string | null) {
  if (employmentType === "pj") return "Fee mensal";
  if (employmentType === "socio") return "Pró-labore";
  return "Salário";
}

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

export default function HRCollaboratorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { updateCollaborator, deleteCollaborator } = useHRCollaborators();
  const [collab, setCollab] = useState<HRCollaborator | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [form, setForm] = useState<Partial<HRCollaborator>>({});
  const [cpfLooking, setCpfLooking] = useState(false);
  const [salaryDisplay, setSalaryDisplay] = useState("");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  const initialLoad = useRef(true);

  formRef.current = form;

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("hr_collaborators")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        toast.error("Colaborador não encontrado");
        navigate("/rh/collaborators");
        return;
      }
      const collabData = { ...data, source: "hr" as const } as HRCollaborator;
      setCollab(collabData);
      setForm(collabData);
      setSalaryDisplay(formatBRL(collabData.salary));
      setLoading(false);
      setTimeout(() => { initialLoad.current = false; }, 100);
    })();
  }, [id]);

  const performSave = useCallback(async () => {
    const currentForm = formRef.current;
    if (!id || !currentForm.full_name?.trim()) return;
    setSaving(true);
    const ok = await updateCollaborator(id, currentForm, true);
    setSaving(false);
    if (ok) {
      setCollab(prev => ({ ...prev!, ...currentForm } as HRCollaborator));
      setLastSaved(new Date());
    }
  }, [id, updateCollaborator]);

  useEffect(() => {
    if (initialLoad.current || loading) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { performSave(); }, 2000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [form, performSave, loading]);

  useEffect(() => {
    const onUnload = () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const handleSave = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await performSave();
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await deleteCollaborator(id);
    if (ok) navigate("/rh/collaborators");
  };

  const setField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

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
      const updates: Partial<HRCollaborator> = {};
      if (data.nome) updates.full_name = data.nome;
      if (data.nascimento) {
        // Format DD/MM/YYYY to YYYY-MM-DD
        const parts = data.nascimento.split("/");
        if (parts.length === 3) {
          updates.birth_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      if (data.telefone) updates.phone = data.telefone;
      if (data.endereco) updates.address = data.endereco;
      if (data.bairro && data.endereco) updates.address = `${data.endereco}, ${data.bairro}`;
      if (data.cidade) updates.city = data.cidade;
      if (data.estado) updates.state = data.estado;
      if (data.cep) updates.zip_code = data.cep;

      setForm(f => ({ ...f, ...updates }));
      toast.success("Dados do CPF preenchidos com sucesso!");
    } catch (err) {
      toast.error("Erro ao consultar CPF");
    }
    setCpfLooking(false);
  };

  if (currentUser && currentUser.email !== RH_ALLOWED_EMAIL) {
    return <Navigate to="/" replace />;
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;
  if (!collab) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh/collaborators")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarImage src={collab.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {getInitials(collab.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{collab.full_name}</h1>
          <p className="text-sm text-muted-foreground">{collab.position || "Sem cargo"} • {collab.department || "Sem departamento"}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os documentos, registros de ponto, férias e benefícios serão removidos.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
            </span>
          )}
          {!saving && lastSaved && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Salvo às {lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="personal" className="gap-1.5 text-xs sm:text-sm">
            <User className="h-4 w-4" /> Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="vacations" className="gap-1.5 text-xs sm:text-sm">
            <CalendarDays className="h-4 w-4" /> Férias
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4" /> Histórico
          </TabsTrigger>
          {form.employment_type !== 'PJ' && form.employment_type !== 'socio' && (
            <TabsTrigger value="timerecords" className="gap-1.5 text-xs sm:text-sm">
              <Clock className="h-4 w-4" /> Ponto
            </TabsTrigger>
          )}
          <TabsTrigger value="benefits" className="gap-1.5 text-xs sm:text-sm">
            <Gift className="h-4 w-4" /> Benefícios
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1.5 text-xs sm:text-sm">
            <Wallet className="h-4 w-4" /> Folha & Encargos
          </TabsTrigger>
        </TabsList>

        {/* TAB: Dados Pessoais */}
        <TabsContent value="personal" className="space-y-4 mt-4">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCpfLookup}
                    disabled={cpfLooking}
                    title="Consultar dados pelo CPF (HubDev)"
                    className="shrink-0"
                  >
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" /> Contato</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Email</Label><Input value={form.email || ""} onChange={e => setField("email", e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ""} onChange={e => setField("phone", e.target.value)} /></div>
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Dados Profissionais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Departamento</Label>
                <Select value={form.department || ""} onValueChange={v => setField("department", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cargo</Label><Input value={form.position || ""} onChange={e => setField("position", e.target.value)} /></div>
              <div><Label>Data de admissão</Label><Input type="date" value={form.hire_date || ""} onChange={e => setField("hire_date", e.target.value)} /></div>
              <div><Label>Data de desligamento</Label><Input type="date" value={form.termination_date || ""} onChange={e => setField("termination_date", e.target.value)} /></div>
              <div>
                <Label>Vínculo</Label>
                <Select value={form.employment_type || "clt"} onValueChange={v => setField("employment_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{getSalaryLabel(form.employment_type)}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input
                    className="pl-10"
                    value={salaryDisplay}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^\d,]/g, "");
                      setSalaryDisplay(raw);
                    }}
                    onBlur={() => {
                      const parsed = parseBRL(salaryDisplay);
                      setField("salary", parsed);
                      setSalaryDisplay(formatBRL(parsed));
                    }}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </div>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Contato de Emergência</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nome</Label><Input value={form.emergency_contact_name || ""} onChange={e => setField("emergency_contact_name", e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={form.emergency_contact_phone || ""} onChange={e => setField("emergency_contact_phone", e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea rows={4} value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Anotações sobre o colaborador..." />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Documentos */}
        <TabsContent value="documents" className="mt-4">
          <CollaboratorDocuments collaboratorId={id!} accountId={collab.account_id} />
        </TabsContent>

        {/* TAB: Férias & Afastamentos */}
        <TabsContent value="vacations" className="mt-4">
          <CollaboratorVacations collaboratorId={id!} accountId={collab.account_id} />
        </TabsContent>

        {/* TAB: Histórico Salarial */}
        <TabsContent value="history" className="mt-4">
          <CollaboratorSalaryHistory
            collaboratorId={id!}
            accountId={collab.account_id}
            currentSalary={collab.salary}
            currentPosition={collab.position}
            currentDepartment={collab.department}
          />
        </TabsContent>

        {/* TAB: Ponto */}
        <TabsContent value="timerecords" className="mt-4">
          <CollaboratorTimeRecords collaboratorId={id!} accountId={collab.account_id} />
        </TabsContent>

        {/* TAB: Benefícios */}
        <TabsContent value="benefits" className="mt-4">
          <CollaboratorBenefits collaboratorId={id!} accountId={collab.account_id} />
        </TabsContent>

        {/* TAB: Folha & Encargos */}
        <TabsContent value="payroll" className="mt-4">
          <CollaboratorPayroll form={form} setField={setField} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
