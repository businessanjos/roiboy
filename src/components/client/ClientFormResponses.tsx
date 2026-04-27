import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, FileText, ChevronDown, ChevronRight, Building2, CheckCircle2,
  Pencil, Save, X, Mail, Phone, Calendar as CalendarIcon, MapPin, Hash,
  DollarSign, Link as LinkIcon, User, Sparkles, ListChecks, Type,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

interface ClientFormResponsesProps {
  clientId: string;
}

interface FormResponse {
  id: string;
  form_id: string;
  responses: Record<string, any>;
  submitted_at: string;
  last_edited_at: string | null;
  last_edited_by: string | null;
  forms: {
    id: string;
    title: string;
    fields: any[];
  } | null;
}

interface DiagnosticData {
  id: string;
  business_sector: string | null;
  business_segment: string | null;
  company_size: string | null;
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
  short_term_goals: string | null;
  long_term_goals: string | null;
  current_situation: string | null;
  pain_points: string | null;
  previous_solutions: string | null;
  expectations: string | null;
  success_criteria: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const COMPANY_SIZE_LABELS: Record<string, string> = {
  mei: "MEI",
  micro: "Microempresa",
  pequena: "Pequena empresa",
  media: "Média empresa",
  grande: "Grande empresa",
};

export function ClientFormResponses({ clientId }: ClientFormResponsesProps) {
  const [loading, setLoading] = useState(true);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [customFieldsMap, setCustomFieldsMap] = useState<Map<string, { name: string; field_type: string | null; options: any[] | null }>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const { currentUser } = useCurrentUser();

  useEffect(() => {
    fetchData();
  }, [clientId]);

  // Auto-expand all responses on first load so the consultant sees everything immediately
  useEffect(() => {
    if (!hasAutoExpanded && (formResponses.length > 0 || diagnostic)) {
      const ids = new Set<string>(formResponses.map(r => r.id));
      if (diagnostic) ids.add("diagnostic");
      setExpandedResponses(ids);
      setHasAutoExpanded(true);
    }
  }, [formResponses, diagnostic, hasAutoExpanded]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("account_id")
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) throw clientError;
      const accountId = clientData?.account_id;

      if (accountId) {
        const { data: fieldsData } = await supabase
          .from("custom_fields")
          .select("id, name, field_type, options")
          .eq("account_id", accountId);

        if (fieldsData) {
          setCustomFieldsMap(new Map(fieldsData.map(f => [f.id, { name: f.name, field_type: f.field_type, options: f.options as any[] | null }])));
        }
      }

      const { data: responsesData, error: responsesError } = await supabase
        .from("form_responses")
        .select(`
          id,
          form_id,
          responses,
          submitted_at,
          last_edited_at,
          last_edited_by,
          forms (
            id,
            title,
            fields
          )
        `)
        .eq("client_id", clientId)
        .order("submitted_at", { ascending: false });

      if (responsesError) throw responsesError;
      setFormResponses((responsesData || []).map(r => ({
        ...r,
        responses: (r.responses as Record<string, any>) || {},
        last_edited_at: (r as any).last_edited_at || null,
        last_edited_by: (r as any).last_edited_by || null,
        forms: r.forms ? {
          ...r.forms,
          fields: (r.forms.fields as any[]) || [],
        } : null,
      })));

      const { data: diagnosticData, error: diagnosticError } = await supabase
        .from("client_diagnostics")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();

      if (diagnosticError) throw diagnosticError;
      if (diagnosticData) {
        setDiagnostic({
          ...diagnosticData,
          main_challenges: (diagnosticData.main_challenges as string[]) || [],
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleResponse = (id: string) => {
    setExpandedResponses(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startEditing = (response: FormResponse) => {
    setEditingId(response.id);
    setEditValues({ ...response.responses });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEditing = async (responseId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("form_responses")
        .update({
          responses: editValues,
          last_edited_at: new Date().toISOString(),
          last_edited_by: currentUser?.id || null,
        } as any)
        .eq("id", responseId);

      if (error) throw error;

      setFormResponses(prev =>
        prev.map(r =>
          r.id === responseId
            ? { ...r, responses: editValues, last_edited_at: new Date().toISOString(), last_edited_by: currentUser?.id || null }
            : r
        )
      );
      setEditingId(null);
      setEditValues({});
      toast.success("Ficha atualizada com sucesso!");
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const getFieldLabel = (fieldId: string): string => {
    const field = customFieldsMap.get(fieldId);
    return field?.name || fieldId;
  };

  const resolveOptionLabel = (options: any[], value: string): string => {
    const opt = options.find((o: any) => o.value === value);
    return opt?.label || value;
  };

  // Try to parse a string that looks like JSON
  const tryParseJSON = (value: any): any => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
    return value;
  };

  const humanizeKey = (key: string): string => {
    const map: Record<string, string> = {
      hasEmployees: "Possui colaboradores",
      employees: "Colaboradores",
      cargo: "Cargo",
      regime: "Regime",
      nome: "Nome",
      name: "Nome",
      quantidade: "Quantidade",
      qtd: "Quantidade",
      tipo: "Tipo",
      valor: "Valor",
      descricao: "Descrição",
      observacao: "Observação",
    };
    if (map[key]) return map[key];
    return key
      .replace(/[_-]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());
  };

  const formatScalar = (value: any): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    return String(value);
  };

  const formatValue = (value: any, fieldId?: string): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    
    if (fieldId) {
      const field = customFieldsMap.get(fieldId);
      if (field?.options && Array.isArray(field.options) && field.options.length > 0) {
        if (Array.isArray(value)) {
          return value.map(v => resolveOptionLabel(field.options!, String(v))).join(", ");
        }
        if (typeof value === "string" && value.startsWith("opt_")) {
          return resolveOptionLabel(field.options, value);
        }
      }
    }

    const parsed = tryParseJSON(value);
    if (Array.isArray(parsed)) return parsed.map(v => typeof v === "object" ? "" : v).join(", ");
    if (typeof parsed === "object" && parsed !== null) return "";
    return String(parsed);
  };

  // Render rich content for objects / arrays of objects (e.g. employees list)
  const renderStructured = (value: any): React.ReactNode | null => {
    const parsed = tryParseJSON(value);
    if (parsed === null || parsed === undefined) return null;

    // Array of primitives -> chips
    if (Array.isArray(parsed) && parsed.every(v => typeof v !== "object" || v === null)) {
      if (parsed.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {parsed.map((v, i) => (
            <span key={i} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
              {formatScalar(v)}
            </span>
          ))}
        </div>
      );
    }

    // Array of objects -> mini cards
    if (Array.isArray(parsed) && parsed.some(v => typeof v === "object" && v !== null)) {
      if (parsed.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="mt-2 space-y-2">
          {parsed.map((item, i) => (
            <div key={i} className="rounded-md border bg-muted/30 p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Item {i + 1}
                </span>
              </div>
              {typeof item === "object" && item !== null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(item).map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{humanizeKey(k)}</span>
                      <span className="text-sm font-medium">{formatScalar(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm">{formatScalar(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Single object -> key/value grid
    if (typeof parsed === "object") {
      const entries = Object.entries(parsed);
      if (entries.length === 0) return <span className="text-muted-foreground">—</span>;

      // Special pattern: { hasX: bool, x: [...] } — render the array prominently
      const boolKey = entries.find(([k, v]) => typeof v === "boolean" && k.startsWith("has"));
      const arrKey = entries.find(([, v]) => Array.isArray(v));
      if (boolKey && arrKey) {
        return (
          <div className="mt-1 space-y-2">
            <div className="text-sm">
              <span className="font-medium">{humanizeKey(boolKey[0])}:</span>{" "}
              <span>{boolKey[1] ? "Sim" : "Não"}</span>
            </div>
            {boolKey[1] && renderStructured(arrKey[1])}
          </div>
        );
      }

      return (
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{humanizeKey(k)}</span>
              <span className="text-sm font-medium break-words">
                {typeof v === "object" && v !== null ? JSON.stringify(v) : formatScalar(v)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const isStructured = (value: any): boolean => {
    const parsed = tryParseJSON(value);
    return (typeof parsed === "object" && parsed !== null);
  };

  const renderEditField = (fieldId: string, value: any) => {
    const field = customFieldsMap.get(fieldId);
    const fieldType = field?.field_type;

    // Select/radio with options
    if (field?.options && Array.isArray(field.options) && field.options.length > 0) {
      return (
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={editValues[fieldId] || ""}
          onChange={(e) => setEditValues(prev => ({ ...prev, [fieldId]: e.target.value }))}
        >
          <option value="">Selecione...</option>
          {field.options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label || opt.value}
            </option>
          ))}
        </select>
      );
    }

    // Long text
    if (fieldType === "textarea" || (typeof value === "string" && value.length > 100)) {
      return (
        <Textarea
          value={editValues[fieldId] || ""}
          onChange={(e) => setEditValues(prev => ({ ...prev, [fieldId]: e.target.value }))}
          rows={3}
        />
      );
    }

    // Default: text input
    return (
      <Input
        value={editValues[fieldId] || ""}
        onChange={(e) => setEditValues(prev => ({ ...prev, [fieldId]: e.target.value }))}
      />
    );
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Detect a sensible icon + visual treatment based on field name & value
  const getFieldVisual = (label: string, value: any, fieldId?: string) => {
    const l = (label || "").toLowerCase();
    const field = fieldId ? customFieldsMap.get(fieldId) : undefined;
    const ft = field?.field_type || "";
    const strVal = typeof value === "string" ? value : "";

    if (/email|e-mail/.test(l) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal))
      return { Icon: Mail, tone: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" };
    if (/telefone|whats|celular|phone|contato/.test(l))
      return { Icon: Phone, tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
    if (/data|nasc|aniver|date/.test(l) || ft === "date")
      return { Icon: CalendarIcon, tone: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" };
    if (/endere|cidade|estado|cep|local/.test(l))
      return { Icon: MapPin, tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" };
    if (/cnpj|cpf|documento|rg/.test(l))
      return { Icon: Hash, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
    if (/fatur|receita|invest|valor|orcam|orçam|preço|preco|r\$/.test(l))
      return { Icon: DollarSign, tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
    if (/site|url|link|insta|face|youtube|tiktok/.test(l) || /^https?:\/\//.test(strVal))
      return { Icon: LinkIcon, tone: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" };
    if (/nome|razão|razao|empresa|companhia/.test(l))
      return { Icon: User, tone: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" };
    if (Array.isArray(value) || ft === "multiselect" || ft === "checkbox")
      return { Icon: ListChecks, tone: "text-fuchsia-600 dark:text-fuchsia-400", bg: "bg-fuchsia-500/10" };
    if (ft === "textarea" || (typeof value === "string" && value.length > 100))
      return { Icon: Sparkles, tone: "text-primary", bg: "bg-primary/10" };
    return { Icon: Type, tone: "text-muted-foreground", bg: "bg-muted" };
  };

  const isLongText = (value: any) =>
    typeof value === "string" && value.length > 80;


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasContent = formResponses.length > 0 || diagnostic;

  if (!hasContent) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Nenhuma ficha preenchida</p>
        <p className="text-sm">Envie formulários para o cliente preencher</p>
      </div>
    );
  }

  const structureItems = [
    { key: "has_formal_structure", label: "Estrutura formal" },
    { key: "has_defined_processes", label: "Processos documentados" },
    { key: "has_financial_control", label: "Controle financeiro" },
    { key: "has_marketing_strategy", label: "Estratégia de marketing" },
    { key: "has_sales_team", label: "Equipe de vendas" },
    { key: "has_digital_presence", label: "Presença digital" },
  ] as const;

  const isEditing = (id: string) => editingId === id;

  return (
    <div className="space-y-6">
      {/* Hero summary */}
      {formResponses.length > 0 && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {formResponses.length === 1
                  ? "1 ficha preenchida pelo cliente"
                  : `${formResponses.length} fichas preenchidas pelo cliente`}
              </p>
              <p className="text-xs text-muted-foreground">
                Última resposta em {format(new Date(formResponses[0].submitted_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                {" • "}
                {formResponses.reduce((acc, r) => acc + Object.keys(r.responses).length, 0)} campos respondidos no total
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Responses */}
      {formResponses.map((response) => {
        const entries = Object.entries(response.responses).filter(
          ([, v]) => v !== null && v !== undefined && v !== ""
        );
        return (
        <Card key={response.id} className="overflow-hidden shadow-sm">
          <Collapsible 
            open={expandedResponses.has(response.id)} 
            onOpenChange={() => toggleResponse(response.id)}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors py-4 bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">
                        {response.forms?.title || "Formulário"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Preenchido em {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {response.last_edited_at && (
                          <span className="ml-2">
                            • Editado em {format(new Date(response.last_edited_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {entries.length} {entries.length === 1 ? "campo" : "campos"}
                    </Badge>
                    {expandedResponses.has(response.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-5 pb-5">
                {/* Edit/Save buttons */}
                <div className="flex justify-end gap-2 mb-4">
                  {isEditing(response.id) ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                        <X className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={() => saveEditing(response.id)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Salvar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); startEditing(response); }}
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {entries.map(([fieldId, value]) => {
                    const label = getFieldLabel(fieldId);
                    const { Icon, tone, bg } = getFieldVisual(label, value, fieldId);
                    const long = isLongText(value) && !isEditing(response.id);
                    return (
                      <div
                        key={fieldId}
                        className={cn(
                          "rounded-lg border bg-card p-3 flex gap-3 transition-colors hover:border-primary/40",
                          long && "md:col-span-2"
                        )}
                      >
                        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", bg)}>
                          <Icon className={cn("h-4 w-4", tone)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                            {label}
                          </p>
                          {isEditing(response.id) ? (
                            <div className="mt-1">{renderEditField(fieldId, value)}</div>
                          ) : (
                            <p className={cn(
                              "text-sm text-foreground break-words",
                              long ? "whitespace-pre-wrap leading-relaxed" : "font-medium"
                            )}>
                              {formatValue(value, fieldId)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
        );
      })}


      {/* Legacy Diagnostic */}
      {diagnostic && (
        <Card className="overflow-hidden">
          <Collapsible 
            open={expandedResponses.has("diagnostic")} 
            onOpenChange={() => toggleResponse("diagnostic")}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedResponses.has("diagnostic") ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Building2 className="h-5 w-5 text-emerald-500" />
                    <div>
                      <CardTitle className="text-base">
                        Diagnóstico Empresarial
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Atualizado em {format(new Date(diagnostic.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Legado
                  </Badge>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 space-y-6">
                <div className="border-t pt-4">
                  {/* Company Info */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Informações da Empresa
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {diagnostic.business_sector && (
                        <div>
                          <span className="text-muted-foreground">Setor:</span>
                          <span className="ml-2">{diagnostic.business_sector}</span>
                        </div>
                      )}
                      {diagnostic.business_segment && (
                        <div>
                          <span className="text-muted-foreground">Segmento:</span>
                          <span className="ml-2">{diagnostic.business_segment}</span>
                        </div>
                      )}
                      {diagnostic.company_size && (
                        <div>
                          <span className="text-muted-foreground">Porte:</span>
                          <span className="ml-2">{COMPANY_SIZE_LABELS[diagnostic.company_size] || diagnostic.company_size}</span>
                        </div>
                      )}
                      {diagnostic.employee_count !== null && (
                        <div>
                          <span className="text-muted-foreground">Funcionários:</span>
                          <span className="ml-2">{diagnostic.employee_count}</span>
                        </div>
                      )}
                      {diagnostic.annual_revenue !== null && (
                        <div>
                          <span className="text-muted-foreground">Faturamento:</span>
                          <span className="ml-2">{formatCurrency(diagnostic.annual_revenue)}</span>
                        </div>
                      )}
                      {diagnostic.years_in_business !== null && (
                        <div>
                          <span className="text-muted-foreground">Anos de mercado:</span>
                          <span className="ml-2">{diagnostic.years_in_business}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Structure */}
                  <div className="space-y-3 mt-6">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Estrutura Organizacional
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {structureItems.map(item => (
                        <Badge 
                          key={item.key}
                          variant={diagnostic[item.key] ? "default" : "outline"}
                          className={cn(
                            "text-xs",
                            !diagnostic[item.key] && "opacity-50"
                          )}
                        >
                          {item.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Challenges */}
                  {diagnostic.main_challenges.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <h4 className="font-medium text-sm">Principais Desafios</h4>
                      <div className="flex flex-wrap gap-2">
                        {diagnostic.main_challenges.map(challenge => (
                          <Badge key={challenge} variant="secondary" className="text-xs">
                            {challenge}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Goals */}
                  {(diagnostic.short_term_goals || diagnostic.long_term_goals) && (
                    <div className="space-y-3 mt-6">
                      <h4 className="font-medium text-sm">Objetivos</h4>
                      <div className="space-y-2 text-sm">
                        {diagnostic.short_term_goals && (
                          <div>
                            <span className="text-muted-foreground">Curto prazo:</span>
                            <p className="mt-1">{diagnostic.short_term_goals}</p>
                          </div>
                        )}
                        {diagnostic.long_term_goals && (
                          <div>
                            <span className="text-muted-foreground">Longo prazo:</span>
                            <p className="mt-1">{diagnostic.long_term_goals}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Situation */}
                  {(diagnostic.current_situation || diagnostic.pain_points || diagnostic.expectations) && (
                    <div className="space-y-3 mt-6">
                      <h4 className="font-medium text-sm">Situação</h4>
                      <div className="space-y-2 text-sm">
                        {diagnostic.current_situation && (
                          <div>
                            <span className="text-muted-foreground">Situação atual:</span>
                            <p className="mt-1">{diagnostic.current_situation}</p>
                          </div>
                        )}
                        {diagnostic.pain_points && (
                          <div>
                            <span className="text-muted-foreground">Principais dores:</span>
                            <p className="mt-1">{diagnostic.pain_points}</p>
                          </div>
                        )}
                        {diagnostic.expectations && (
                          <div>
                            <span className="text-muted-foreground">Expectativas:</span>
                            <p className="mt-1">{diagnostic.expectations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {diagnostic.notes && (
                    <div className="space-y-2 mt-6">
                      <h4 className="font-medium text-sm">Observações</h4>
                      <p className="text-sm">{diagnostic.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}
