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

    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
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
    <div className="space-y-4">
      {/* Form Responses */}
      {formResponses.map((response) => (
        <Card key={response.id} className="overflow-hidden">
          <Collapsible 
            open={expandedResponses.has(response.id)} 
            onOpenChange={() => toggleResponse(response.id)}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedResponses.has(response.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">
                        {response.forms?.title || "Formulário"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Preenchido em {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {response.last_edited_at && (
                          <span className="ml-2 text-muted-foreground">
                            • Editado em {format(new Date(response.last_edited_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {Object.keys(response.responses).length} campo(s)
                  </Badge>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                <div className="space-y-3 border-t pt-4">
                  {/* Edit/Save buttons */}
                  <div className="flex justify-end gap-2 mb-2">
                    {isEditing(response.id) ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditing}
                          disabled={saving}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveEditing(response.id)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          Salvar
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(response);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>

                  {Object.entries(response.responses).map(([fieldId, value]) => (
                    <div key={fieldId} className="grid grid-cols-3 gap-2 text-sm">
                      <span className="text-muted-foreground font-medium">
                        {getFieldLabel(fieldId)}
                      </span>
                      <span className="col-span-2">
                        {isEditing(response.id)
                          ? renderEditField(fieldId, value)
                          : formatValue(value, fieldId)
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

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
