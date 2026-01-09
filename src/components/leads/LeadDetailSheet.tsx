import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Mail,
  Clock,
  TrendingUp,
  ChevronRight,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { LeadTimeline } from "./LeadTimeline";
import { LeadCustomFieldsManager, LeadCustomField } from "@/components/custom-fields/LeadCustomFieldsManager";
import { LeadFieldValueEditor } from "@/components/custom-fields/LeadFieldValueEditor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LEAD_SOURCES = [
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "indicacao", label: "Indicação" },
  { value: "evento", label: "Evento" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

const LEAD_STATUS = [
  { value: "new", label: "Novo", color: "bg-blue-500" },
  { value: "contacted", label: "Contatado", color: "bg-amber-500" },
  { value: "qualified", label: "Qualificado", color: "bg-emerald-500" },
  { value: "unqualified", label: "Não Qualificado", color: "bg-gray-500" },
];

interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage?: { name: string } | null;
}

interface LeadDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  onEdit?: (lead: Lead) => void;
  onDelete?: (leadId: string) => void;
  onCreateDeal?: (lead: Lead) => void;
  onDealClick?: (deal: Deal) => void;
}

export function LeadDetailSheet({ 
  open, 
  onOpenChange, 
  leadId, 
  onEdit,
  onDelete,
  onCreateDeal,
  onDealClick,
}: LeadDetailSheetProps) {
  const { currentUser } = useCurrentUser();
  const { hasVendasAccess } = useSectorAccess();
  const { isAdmin } = usePermissions();
  
  // Admins ou usuários com acesso a Vendas podem gerenciar campos personalizados
  const canManageCustomFields = isAdmin || hasVendasAccess;
  const [lead, setLead] = useState<Lead | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<LeadCustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [managerOpen, setManagerOpen] = useState(false);

  const fetchCustomFields = async () => {
    const { data } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("is_active", true)
      .eq("show_in_leads", true)
      .order("display_order");

    if (data) {
      const mapped: LeadCustomField[] = data.map(f => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type as LeadCustomField["field_type"],
        options: (f.options as unknown as { value: string; label: string; color: string }[]) || [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
        show_in_leads: f.show_in_leads,
      }));
      setCustomFields(mapped);
    }
  };

  const fetchFieldValues = async (id: string) => {
    const { data } = await supabase
      .from("lead_field_values")
      .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
      .eq("lead_id", id);

    if (data) {
      const values: Record<string, any> = {};
      data.forEach(fv => {
        values[fv.field_id] = fv.value_text ?? fv.value_number ?? fv.value_boolean ?? fv.value_date ?? fv.value_json;
      });
      setFieldValues(values);
    }
  };

  const handleFieldValueChange = (fieldId: string, newValue: any) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: newValue }));
  };

  useEffect(() => {
    if (open && leadId) {
      fetchLeadData();
      fetchCustomFields();
      fetchFieldValues(leadId);
    }
  }, [open, leadId]);

  const fetchLeadData = async () => {
    if (!leadId) return;
    
    setLoading(true);
    try {
      // Fetch lead data
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("id, full_name, phone, email, source, status, notes, created_at")
        .eq("id", leadId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      // Fetch associated deals
      const { data: dealsData, error: dealsError } = await supabase
        .from("deals")
        .select("id, title, value, stage:deal_stages(name)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (dealsError) throw dealsError;
      setDeals(dealsData || []);
    } catch (error) {
      console.error("Error fetching lead data:", error);
      toast.error("Erro ao carregar dados do lead");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", lead.id);

      if (error) throw error;
      setLead({ ...lead, status: newStatus });
      toast.success("Status atualizado");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const getSourceLabel = (source: string) => {
    return LEAD_SOURCES.find((s) => s.value === source)?.label || source;
  };

  if (!open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {loading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : lead ? (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>{lead.full_name}</SheetTitle>
                  <div className="flex items-center gap-2">
                    <Select
                      value={lead.status}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${s.color}`} />
                              {s.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  {lead.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.email}</span>
                    </div>
                  )}
                  {lead.source && (
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>Origem: {getSourceLabel(lead.source)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Criado em{" "}
                      {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>

                {/* Custom Fields Section - Values */}
                {customFields.length > 0 && (
                  <div className="space-y-2">
                    {customFields.map(field => (
                      <div
                        key={field.id}
                        className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {field.name}:
                        </span>
                        <LeadFieldValueEditor
                          field={field}
                          leadId={lead.id}
                          accountId={currentUser?.account_id || ""}
                          currentValue={fieldValues[field.id]}
                          onValueChange={handleFieldValueChange}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {lead.notes && (
                  <div>
                    <p className="text-sm font-medium mb-2">Observações</p>
                    <p className="text-sm text-muted-foreground">{lead.notes}</p>
                  </div>
                )}

                {/* Add Custom Fields Button - Only for users with Vendas access */}
                {canManageCustomFields && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManagerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Inserir campos
                  </Button>
                )}

                <Separator />

                {/* Deals Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Negócios</p>
                    {onCreateDeal && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateDeal(lead)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Novo
                      </Button>
                    )}
                  </div>
                  {deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum negócio vinculado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {deals.map((deal) => (
                        <Card 
                          key={deal.id}
                          className={cn(onDealClick && "cursor-pointer hover:bg-muted/50")}
                          onClick={() => onDealClick?.(deal)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{deal.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {deal.stage?.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {deal.value > 0 && (
                                  <Badge variant="outline">
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(deal.value)}
                                  </Badge>
                                )}
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Timeline */}
                <div>
                  <p className="text-sm font-medium mb-3">Histórico</p>
                  <LeadTimeline leadId={lead.id} />
                </div>

                {/* Actions */}
                {(onEdit || onDelete) && (
                  <div className="flex gap-2">
                    {onEdit && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          onOpenChange(false);
                          onEdit(lead);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="outline"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => {
                          onOpenChange(false);
                          onDelete(lead.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">Lead não encontrado</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Custom Fields Manager Dialog - Outside Sheet to avoid Radix context conflicts */}
      <LeadCustomFieldsManager
        open={managerOpen}
        onOpenChange={(open) => {
          setManagerOpen(open);
          // Quando fecha, re-buscar os dados
          if (!open && leadId) {
            fetchCustomFields();
            fetchFieldValues(leadId);
          }
        }}
        onFieldsChange={() => {
          fetchCustomFields();
          if (leadId) fetchFieldValues(leadId);
        }}
      />
    </>
  );
}
