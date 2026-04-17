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
  Instagram,
  User,
  Package,
  Tag,
} from "lucide-react";

// IDs dos campos personalizados de DEAL que queremos espelhar como leitura no lead
const DEAL_ITEM_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";
const DEAL_ORIGEM_VENDA_FIELD_ID = "43d7d9a1-9370-45f3-803a-93717d2a6d1d";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  { value: "converted", label: "Convertido", color: "bg-purple-500" },
];


interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  emails: string[] | null;
  additional_phones: string[] | null;
  instagram: string | null;
  instagrams: string[] | null;
  source: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  responsible_user_id: string | null;
  mql: string | null;
  canal: string | null;
  revenue_range: string | null;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage?: { name: string } | null;
  responsible_user_id?: string | null;
  responsible?: { name: string } | null;
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
  // Valores espelhados do deal mais recente vinculado ao lead (somente leitura)
  const [dealItemVenda, setDealItemVenda] = useState<string | null>(null);
  const [dealOrigemVenda, setDealOrigemVenda] = useState<string | null>(null);

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
        .select("id, full_name, phone, email, emails, additional_phones, instagram, instagrams, source, status, notes, created_at, mql, canal, responsible_user_id, revenue_range")
        .eq("id", leadId)
        .single();

      if (leadError) throw leadError;
      // Normalize additional_phones: DB stores {number: "..."} objects
      const normalizedPhones = Array.isArray(leadData.additional_phones)
        ? (leadData.additional_phones as Array<string | { number: string }>).map(
            (p) => (typeof p === 'object' && p !== null && 'number' in p ? (p as { number: string }).number : String(p))
          )
        : null;

      setLead({
        ...leadData,
        emails: Array.isArray(leadData.emails) ? leadData.emails as string[] : null,
        additional_phones: normalizedPhones,
        instagrams: Array.isArray(leadData.instagrams) ? leadData.instagrams as string[] : null,
      });


      // Fetch associated deals
      const { data: dealsData, error: dealsError } = await supabase
        .from("deals")
        .select("id, title, value, responsible_user_id, stage:deal_stages(name), responsible:users!deals_responsible_user_id_fkey(name)")
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
              <SheetHeader className="pr-8">
                <div className="flex items-start justify-between gap-4">
                  <SheetTitle className="pt-1">{lead.full_name}</SheetTitle>
                  <Select
                    value={lead.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="w-[140px] shrink-0">
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
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Owner (dynamic from most recent deal) */}
                {(() => {
                  const ownerName = deals.length > 0 ? deals[0]?.responsible?.name : null;
                  return ownerName ? (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Proprietário: {ownerName}</span>
                    </div>
                  ) : null;
                })()}
                {/* Contact Info */}
                <div className="space-y-3">
                  {lead.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.additional_phones && lead.additional_phones.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-7">
                      {lead.additional_phones.map((phone, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-sm">
                          <Phone className="h-3 w-3" />
                          {phone}
                        </span>
                      ))}
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.email}</span>
                    </div>
                  )}
                  {lead.emails && lead.emails.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-7">
                      {lead.emails.map((email, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-sm">
                          <Mail className="h-3 w-3" />
                          {email}
                        </span>
                      ))}
                    </div>
                  )}
                  {lead.instagram && (
                    <div className="flex items-center gap-3">
                      <Instagram className="h-4 w-4 text-pink-500" />
                      <a 
                        href={`https://instagram.com/${lead.instagram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-600 hover:underline"
                      >
                        @{lead.instagram.replace(/^@/, '')}
                      </a>
                    </div>
                  )}
                  {lead.instagrams && lead.instagrams.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-7">
                      {lead.instagrams.map((ig, idx) => (
                        <a
                          key={idx}
                          href={`https://instagram.com/${ig.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-pink-500/15 text-pink-600 text-sm hover:bg-pink-500/25"
                        >
                          <Instagram className="h-3 w-3" />
                          @{ig.replace(/^@/, '')}
                        </a>
                      ))}
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


                {customFields.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {customFields.map(field => (
                      <div
                        key={field.id}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
                      >
                        <span className="font-medium text-muted-foreground whitespace-nowrap">
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
