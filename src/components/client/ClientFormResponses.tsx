import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, FileText, ChevronDown, ChevronRight, Building2, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ClientFormResponsesProps {
  clientId: string;
}

interface FormResponse {
  id: string;
  form_id: string;
  responses: Record<string, any>;
  submitted_at: string;
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

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch form responses
      const { data: responsesData, error: responsesError } = await supabase
        .from("form_responses")
        .select(`
          id,
          form_id,
          responses,
          submitted_at,
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
        forms: r.forms ? {
          ...r.forms,
          fields: (r.forms.fields as any[]) || [],
        } : null,
      })));

      // Fetch diagnostic
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

  const getFieldLabel = (form: FormResponse["forms"], fieldId: string): string => {
    if (!form?.fields) return fieldId;
    const field = form.fields.find((f: any) => f.id === fieldId);
    return field?.label || fieldId;
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
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
                  {Object.entries(response.responses).map(([fieldId, value]) => (
                    <div key={fieldId} className="grid grid-cols-3 gap-2 text-sm">
                      <span className="text-muted-foreground font-medium">
                        {getFieldLabel(response.forms, fieldId)}
                      </span>
                      <span className="col-span-2">
                        {formatValue(value)}
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
