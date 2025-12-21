import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Building2, Target, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { CurrencyField } from "@/components/ui/form-field";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientDiagnosticProps {
  clientId: string;
}

interface DiagnosticData {
  id?: string;
  business_sector: string;
  business_segment: string;
  company_size: string;
  employee_count: number | null;
  annual_revenue: number | null;
  years_in_business: number | null;
  has_formal_structure: boolean;
  has_defined_processes: boolean;
  has_financial_control: boolean;
  has_marketing_strategy: boolean;
  has_sales_team: boolean;
  has_digital_presence: boolean;
  main_challenges: string[];
  short_term_goals: string;
  long_term_goals: string;
  current_situation: string;
  pain_points: string;
  previous_solutions: string;
  expectations: string;
  success_criteria: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

const BUSINESS_SECTORS = [
  "Agricultura",
  "Comércio",
  "Construção",
  "Educação",
  "Finanças",
  "Indústria",
  "Saúde",
  "Serviços",
  "Tecnologia",
  "Transporte",
  "Turismo",
  "Outro",
];

const COMPANY_SIZES = [
  { value: "mei", label: "MEI" },
  { value: "micro", label: "Microempresa" },
  { value: "pequena", label: "Pequena empresa" },
  { value: "media", label: "Média empresa" },
  { value: "grande", label: "Grande empresa" },
];

const COMMON_CHALLENGES = [
  "Gestão financeira",
  "Captação de clientes",
  "Retenção de clientes",
  "Gestão de equipe",
  "Processos internos",
  "Marketing digital",
  "Vendas",
  "Precificação",
  "Fluxo de caixa",
  "Crescimento sustentável",
  "Concorrência",
  "Inovação",
];

const getEmptyDiagnostic = (): DiagnosticData => ({
  business_sector: "",
  business_segment: "",
  company_size: "",
  employee_count: null,
  annual_revenue: null,
  years_in_business: null,
  has_formal_structure: false,
  has_defined_processes: false,
  has_financial_control: false,
  has_marketing_strategy: false,
  has_sales_team: false,
  has_digital_presence: false,
  main_challenges: [],
  short_term_goals: "",
  long_term_goals: "",
  current_situation: "",
  pain_points: "",
  previous_solutions: "",
  expectations: "",
  success_criteria: "",
  notes: "",
});

export function ClientDiagnostic({ clientId }: ClientDiagnosticProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData>(getEmptyDiagnostic());
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    fetchDiagnostic();
  }, [clientId]);

  const fetchDiagnostic = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_diagnostics")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDiagnostic({
          id: data.id,
          business_sector: data.business_sector || "",
          business_segment: data.business_segment || "",
          company_size: data.company_size || "",
          employee_count: data.employee_count,
          annual_revenue: data.annual_revenue,
          years_in_business: data.years_in_business,
          has_formal_structure: data.has_formal_structure || false,
          has_defined_processes: data.has_defined_processes || false,
          has_financial_control: data.has_financial_control || false,
          has_marketing_strategy: data.has_marketing_strategy || false,
          has_sales_team: data.has_sales_team || false,
          has_digital_presence: data.has_digital_presence || false,
          main_challenges: (data.main_challenges as string[]) || [],
          short_term_goals: data.short_term_goals || "",
          long_term_goals: data.long_term_goals || "",
          current_situation: data.current_situation || "",
          pain_points: data.pain_points || "",
          previous_solutions: data.previous_solutions || "",
          expectations: data.expectations || "",
          success_criteria: data.success_criteria || "",
          notes: data.notes || "",
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
        setIsNew(false);
      } else {
        setDiagnostic(getEmptyDiagnostic());
        setIsNew(true);
      }
    } catch (error) {
      console.error("Error fetching diagnostic:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id, account_id")
        .single();

      if (!userData) {
        toast.error("Usuário não encontrado");
        return;
      }

      const diagnosticData = {
        account_id: userData.account_id,
        client_id: clientId,
        business_sector: diagnostic.business_sector || null,
        business_segment: diagnostic.business_segment || null,
        company_size: diagnostic.company_size || null,
        employee_count: diagnostic.employee_count,
        annual_revenue: diagnostic.annual_revenue,
        years_in_business: diagnostic.years_in_business,
        has_formal_structure: diagnostic.has_formal_structure,
        has_defined_processes: diagnostic.has_defined_processes,
        has_financial_control: diagnostic.has_financial_control,
        has_marketing_strategy: diagnostic.has_marketing_strategy,
        has_sales_team: diagnostic.has_sales_team,
        has_digital_presence: diagnostic.has_digital_presence,
        main_challenges: diagnostic.main_challenges,
        short_term_goals: diagnostic.short_term_goals || null,
        long_term_goals: diagnostic.long_term_goals || null,
        current_situation: diagnostic.current_situation || null,
        pain_points: diagnostic.pain_points || null,
        previous_solutions: diagnostic.previous_solutions || null,
        expectations: diagnostic.expectations || null,
        success_criteria: diagnostic.success_criteria || null,
        notes: diagnostic.notes || null,
        created_by: isNew ? userData.id : undefined,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from("client_diagnostics")
          .insert(diagnosticData)
          .select()
          .single();

        if (error) throw error;
        setDiagnostic(prev => ({ ...prev, id: data.id, created_at: data.created_at, updated_at: data.updated_at }));
        setIsNew(false);
      } else {
        const { error } = await supabase
          .from("client_diagnostics")
          .update(diagnosticData)
          .eq("client_id", clientId);

        if (error) throw error;
      }

      toast.success("Diagnóstico salvo!");
    } catch (error: any) {
      console.error("Error saving diagnostic:", error);
      toast.error(error.message || "Erro ao salvar diagnóstico");
    } finally {
      setSaving(false);
    }
  };

  const toggleChallenge = (challenge: string) => {
    setDiagnostic(prev => ({
      ...prev,
      main_challenges: prev.main_challenges.includes(challenge)
        ? prev.main_challenges.filter(c => c !== challenge)
        : [...prev.main_challenges, challenge],
    }));
  };

  const updateField = <K extends keyof DiagnosticData>(field: K, value: DiagnosticData[K]) => {
    setDiagnostic(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const structureItems = [
    { key: "has_formal_structure" as const, label: "Estrutura formal definida" },
    { key: "has_defined_processes" as const, label: "Processos documentados" },
    { key: "has_financial_control" as const, label: "Controle financeiro" },
    { key: "has_marketing_strategy" as const, label: "Estratégia de marketing" },
    { key: "has_sales_team" as const, label: "Equipe de vendas" },
    { key: "has_digital_presence" as const, label: "Presença digital" },
  ];

  const filledCount = structureItems.filter(item => diagnostic[item.key]).length;

  return (
    <div className="space-y-6">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Diagnóstico Empresarial</h3>
          <p className="text-sm text-muted-foreground">
            Informações iniciais para entender o cliente
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && diagnostic.updated_at && (
            <span className="text-xs text-muted-foreground">
              Atualizado em {format(new Date(diagnostic.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select
                value={diagnostic.business_sector}
                onValueChange={(value) => updateField("business_sector", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_SECTORS.map(sector => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Segmento</Label>
              <Input
                placeholder="Ex: Consultoria de RH"
                value={diagnostic.business_segment}
                onChange={(e) => updateField("business_segment", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Porte da Empresa</Label>
              <Select
                value={diagnostic.company_size}
                onValueChange={(value) => updateField("company_size", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o porte" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map(size => (
                    <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Número de Funcionários</Label>
              <Input
                type="number"
                placeholder="Ex: 10"
                value={diagnostic.employee_count ?? ""}
                onChange={(e) => updateField("employee_count", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Faturamento Anual</Label>
              <CurrencyField
                label=""
                value={diagnostic.annual_revenue ? diagnostic.annual_revenue * 100 : undefined}
                onChange={(value) => {
                  updateField("annual_revenue", value ? value / 100 : null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Anos de Mercado</Label>
              <Input
                type="number"
                placeholder="Ex: 5"
                value={diagnostic.years_in_business ?? ""}
                onChange={(e) => updateField("years_in_business", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Estrutura Organizacional
            <Badge variant="outline" className="ml-2">
              {filledCount}/{structureItems.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Marque os itens que a empresa possui
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {structureItems.map(item => (
              <div key={item.key} className="flex items-center space-x-2">
                <Checkbox
                  id={item.key}
                  checked={diagnostic[item.key]}
                  onCheckedChange={(checked) => updateField(item.key, !!checked)}
                />
                <label
                  htmlFor={item.key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {item.label}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Challenges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Principais Desafios
            {diagnostic.main_challenges.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {diagnostic.main_challenges.length} selecionados
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Selecione os principais desafios enfrentados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {COMMON_CHALLENGES.map(challenge => (
              <Badge
                key={challenge}
                variant={diagnostic.main_challenges.includes(challenge) ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => toggleChallenge(challenge)}
              >
                {diagnostic.main_challenges.includes(challenge) && <X className="h-3 w-3 mr-1" />}
                {challenge}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Objetivos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Objetivos de Curto Prazo (até 1 ano)</Label>
            <Textarea
              placeholder="O que a empresa deseja alcançar no curto prazo?"
              value={diagnostic.short_term_goals}
              onChange={(e) => updateField("short_term_goals", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Objetivos de Longo Prazo (1-5 anos)</Label>
            <Textarea
              placeholder="Qual a visão de futuro da empresa?"
              value={diagnostic.long_term_goals}
              onChange={(e) => updateField("long_term_goals", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Current Situation */}
      <Card>
        <CardHeader>
          <CardTitle>Situação Atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição da Situação Atual</Label>
            <Textarea
              placeholder="Como está a empresa atualmente?"
              value={diagnostic.current_situation}
              onChange={(e) => updateField("current_situation", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Principais Dores</Label>
            <Textarea
              placeholder="Quais são as maiores dificuldades enfrentadas?"
              value={diagnostic.pain_points}
              onChange={(e) => updateField("pain_points", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Soluções Anteriores</Label>
            <Textarea
              placeholder="O que já foi tentado para resolver esses problemas?"
              value={diagnostic.previous_solutions}
              onChange={(e) => updateField("previous_solutions", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Expectations */}
      <Card>
        <CardHeader>
          <CardTitle>Expectativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>O que espera do trabalho/serviço?</Label>
            <Textarea
              placeholder="Quais são as expectativas do cliente?"
              value={diagnostic.expectations}
              onChange={(e) => updateField("expectations", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Critérios de Sucesso</Label>
            <Textarea
              placeholder="Como o cliente vai medir se o trabalho foi bem sucedido?"
              value={diagnostic.success_criteria}
              onChange={(e) => updateField("success_criteria", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Observações Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Outras informações relevantes sobre o cliente..."
            value={diagnostic.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Save button at bottom */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Diagnóstico
        </Button>
      </div>
    </div>
  );
}
