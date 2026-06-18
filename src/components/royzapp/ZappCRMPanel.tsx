import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Briefcase, 
  Plus, 
  DollarSign,
  ExternalLink,
  User,
  Phone,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Zap,
  ListTodo,
  Eye,
  FileText,
  Pencil,
} from "lucide-react";
import { LeadFieldValueEditor } from "@/components/custom-fields/LeadFieldValueEditor";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { ZappDealDetailSheet } from "./ZappDealDetailSheet";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { RequiredFieldsModal } from "@/components/sales/RequiredFieldsModal";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";

interface ZappCRMPanelProps {
  conversationPhone?: string | null;
  conversationClientId?: string | null;
  conversationLeadId?: string | null;
  conversationContactName?: string | null;
}

interface DealStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  status: string;
  created_at: string;
}

interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
}

interface PendingTask {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  activity_type_id: string | null;
  activity_type?: { name: string; color: string; icon: string | null } | null;
}

interface ActivityType {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export function ZappCRMPanel({ 
  conversationPhone, 
  conversationClientId, 
  conversationLeadId,
  conversationContactName 
}: ZappCRMPanelProps) {
  const { currentUser } = useCurrentUser();
  const { activityTypes } = useActivityTypes();
  const { validateDealMove } = useRequiredFieldsValidation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");
  const [dealDetailOpen, setDealDetailOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PendingTask | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);
  const [requiredFieldsModal, setRequiredFieldsModal] = useState<{
    open: boolean;
    dealId: string;
    dealTitle: string;
    targetStageId: string;
    targetStageName: string;
    missingFields: CustomField[];
  } | null>(null);
  
  // Products for "Item da Venda"
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Fetch deal stages
  const { data: stages = [] } = useQuery({
    queryKey: ["deal-stages-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stages")
        .select("id, name, color, display_order")
        .order("display_order");
      if (error) throw error;
      return data as DealStage[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Fetch products for "Item da Venda"
  const { data: fetchedProducts = [] } = useQuery({
    queryKey: ["products-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("account_id", currentUser?.account_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; price: number }[];
    },
    enabled: !!currentUser?.account_id && showCreateDeal,
  });

  // Sync products to state when fetched
  if (fetchedProducts.length > 0 && products.length !== fetchedProducts.length) {
    setProducts(fetchedProducts);
  }

  // Fetch lead info if we have a lead_id
  const { data: leadInfo, isLoading: leadLoading } = useQuery({
    queryKey: ["lead-info-zapp", conversationLeadId],
    queryFn: async () => {
      if (!conversationLeadId) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, phone, email, status")
        .eq("id", conversationLeadId)
        .maybeSingle();
      if (error) throw error;
      return data as Lead | null;
    },
    enabled: !!conversationLeadId,
  });

  // Fetch custom fields for leads
  const { data: customFields = [] } = useQuery({
    queryKey: ["lead-custom-fields-crm", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, options, display_order")
        .eq("account_id", currentUser?.account_id)
        .eq("show_in_leads", true)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.account_id && !!conversationLeadId,
  });

  // Fetch field values for lead
  const { data: fieldValues = [], refetch: refetchFieldValues } = useQuery({
    queryKey: ["lead-field-values-crm", conversationLeadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_field_values")
        .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
        .eq("lead_id", conversationLeadId);
      if (error) throw error;
      return data;
    },
    enabled: !!conversationLeadId,
  });

  // Fetch deals for this lead/client with fallback by phone
  const { data: deals = [], isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ["contact-deals-zapp", conversationLeadId, conversationClientId, conversationPhone, currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      // First try direct lookup by lead_id or client_id
      if (conversationLeadId || conversationClientId) {
        let query = supabase
          .from("deals")
          .select("id, title, value, stage_id, status, created_at")
          .neq("status", "lost")
          .order("created_at", { ascending: false });

        if (conversationLeadId) {
          query = query.eq("lead_id", conversationLeadId);
        } else if (conversationClientId) {
          query = query.eq("client_id", conversationClientId);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        // If found, return the deals
        if (data && data.length > 0) {
          return data as Deal[];
        }
      }

      // Fallback: search by phone if no deals found and we have a phone
      if (conversationPhone) {
        // Find all leads with the same phone number in this account
        const { data: similarLeads } = await supabase
          .from("leads")
          .select("id")
          .eq("account_id", currentUser.account_id)
          .eq("phone", conversationPhone);

        if (similarLeads && similarLeads.length > 0) {
          const leadIds = similarLeads.map(l => l.id);
          const { data: dealsByPhone, error: dealsError } = await supabase
            .from("deals")
            .select("id, title, value, stage_id, status, created_at")
            .in("lead_id", leadIds)
            .neq("status", "lost")
            .order("created_at", { ascending: false });

          if (dealsError) throw dealsError;
          if (dealsByPhone && dealsByPhone.length > 0) {
            return dealsByPhone as Deal[];
          }
        }

        // Also check clients with the same phone
        const { data: similarClients } = await supabase
          .from("clients")
          .select("id")
          .eq("account_id", currentUser.account_id)
          .eq("phone_e164", conversationPhone);

        if (similarClients && similarClients.length > 0) {
          const clientIds = similarClients.map(c => c.id);
          const { data: dealsByClient, error: dealsError } = await supabase
            .from("deals")
            .select("id, title, value, stage_id, status, created_at")
            .in("client_id", clientIds)
            .neq("status", "lost")
            .order("created_at", { ascending: false });

          if (dealsError) throw dealsError;
          if (dealsByClient && dealsByClient.length > 0) {
            return dealsByClient as Deal[];
          }
        }
      }

      return [];
    },
    enabled: !!(conversationLeadId || conversationClientId || conversationPhone) && !!currentUser?.account_id,
  });

  const activeDeal = deals.find(d => d.status === "open");

  // Fetch pending tasks for active deal
  const { data: pendingTasks = [], refetch: refetchPendingTasks } = useQuery({
    queryKey: ["pending-tasks-deal-zapp", activeDeal?.id, conversationLeadId],
    queryFn: async () => {
      let query = supabase
        .from("internal_tasks")
        .select(`
          id, title, due_date, due_time, activity_type_id,
          activity_type:activity_types(name, color, icon)
        `)
        .is("completed_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);
      
      if (activeDeal?.id && conversationLeadId) {
        query = query.or(`deal_id.eq.${activeDeal.id},lead_id.eq.${conversationLeadId}`);
      } else if (activeDeal?.id) {
        query = query.eq("deal_id", activeDeal.id);
      } else if (conversationLeadId) {
        query = query.eq("lead_id", conversationLeadId);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PendingTask[];
    },
    enabled: !!(activeDeal?.id || conversationLeadId),
  });

  // Move deal mutation
  const moveDeal = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const { error } = await supabase
        .from("deals")
        .update({ stage_id: stageId })
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDeals();
      toast.success("Negócio movido!");
    },
  });

  // Create deal mutation
  const createDeal = useMutation({
    mutationFn: async () => {
      if (!currentUser?.account_id || !stages[0]) throw new Error("Dados insuficientes");

      const { data: stageData, error: stageError } = await supabase
        .from("deal_stages")
        .select("pipeline_id")
        .eq("id", stages[0].id)
        .single();

      if (stageError) throw stageError;

      const { data: newDeal, error } = await supabase
        .from("deals")
        .insert({
          account_id: currentUser.account_id,
          title: newDealTitle || conversationContactName || "Novo negócio",
          value: parseFloat(newDealValue.replace(/\D/g, "")) / 100 || 0,
          stage_id: stages[0].id,
          pipeline_id: stageData.pipeline_id,
          lead_id: conversationLeadId || null,
          client_id: conversationClientId || null,
          status: "open",
          responsible_user_id: currentUser.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Persist product_id in deal_field_values if selected
      if (newDeal && selectedProductId && selectedProductId !== "__none__") {
        await supabase.from("deal_field_values").insert({
          deal_id: newDeal.id,
          field_id: "033b91fb-3add-4c96-aec9-567fefbd0fb2",
          account_id: currentUser.account_id,
          value_text: selectedProductId,
        });
      }
    },
    onSuccess: () => {
      refetchDeals();
      setShowCreateDeal(false);
      setNewDealTitle("");
      setNewDealValue("");
      setSelectedProductId("");
      toast.success("Negócio criado!");
    },
    onError: () => {
      toast.error("Erro ao criar negócio");
    },
  });

  // Complete task mutation
  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("internal_tasks")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPendingTasks();
      toast.success("Tarefa concluída!");
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCurrencyInput = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (numericValue) {
      const formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(parseInt(numericValue) / 100);
      setNewDealValue(formatted);
    } else {
      setNewDealValue("");
    }
  };

  const openTaskDialog = (activityType?: ActivityType) => {
    setSelectedActivityType(activityType || null);
    setTaskDialogOpen(true);
  };

  const isLoading = leadLoading || dealsLoading;
  const hasContact = conversationLeadId || conversationClientId;
  // Format task date with relative labels and time
  const formatTaskDate = (dueDate: string | null, dueTime: string | null): string => {
    if (!dueDate) return "";
    const date = parseLocalDate(dueDate);
    if (!date) return "";
    
    let dateLabel: string;
    if (isToday(date)) {
      dateLabel = "Hoje";
    } else if (isTomorrow(date)) {
      dateLabel = "Amanhã";
    } else {
      dateLabel = format(date, "dd/MM", { locale: ptBR });
    }
    
    if (dueTime) {
      const timeLabel = dueTime.slice(0, 5); // "HH:mm"
      return `${dateLabel} ${timeLabel}`;
    }
    return dateLabel;
  };

  // Get next scheduled task date
  const nextTaskDate = pendingTasks[0]?.due_date 
    ? formatTaskDate(pendingTasks[0].due_date, pendingTasks[0].due_time)
    : null;

  // Helper function to get field value
  const getFieldValue = (fieldId: string) => {
    const fv = fieldValues.find(v => v.field_id === fieldId);
    if (!fv) return null;
    const field = customFields.find(f => f.id === fieldId);
    if (!field) return null;
    
    switch (field.field_type) {
      case "boolean": return fv.value_boolean;
      case "number":
      case "currency": return fv.value_number;
      case "date": return fv.value_date;
      case "multi_select":
      case "user":
      case "location":
      case "multi_instagram": return fv.value_json;
      default: return fv.value_text;
    }
  };

  if (!hasContact) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-zapp-accent" />
            <span className="font-medium text-zapp-text">CRM</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-zapp-text-muted">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Selecione uma conversa com lead ou cliente para ver o CRM</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-zapp-accent" />
            <span className="font-medium text-zapp-text">CRM</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs"
            onClick={() => navigate(activeDeal?.id ? `/pipeline?deal=${activeDeal.id}` : "/pipeline")}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Pipeline
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Contact Info */}
          <Card className="p-3 bg-zapp-panel border-zapp-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zapp-accent/20 flex items-center justify-center">
                <User className="h-5 w-5 text-zapp-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zapp-text truncate">
                  {leadInfo?.full_name || conversationContactName || "Contato"}
                </p>
                <div className="flex items-center gap-2 text-xs text-zapp-text-muted">
                  <Phone className="h-3 w-3" />
                  <span>{conversationPhone || leadInfo?.phone || "-"}</span>
                </div>
              </div>
              {conversationLeadId && (
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">
                  Lead
                </Badge>
              )}
              {conversationClientId && (
                <Badge variant="outline" className="text-[10px] border-green-500 text-green-500">
                  Cliente
                </Badge>
              )}
            </div>
          </Card>

          {/* Custom Fields - visible when there's a lead */}
          {conversationLeadId && customFields.length > 0 && (
            <Card className="p-3 bg-zapp-panel border-zapp-border">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-zapp-text-muted" />
                <span className="text-xs font-medium text-zapp-text">
                  Campos Personalizados
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {customFields.map(field => {
                  const formattedOptions = Array.isArray(field.options)
                    ? field.options.map((opt: any) => 
                        typeof opt === 'string' 
                          ? { value: opt, label: opt, color: 'gray' }
                          : opt
                      )
                    : [];
                  
                  return (
                    <div key={field.id} className="min-w-0">
                      <span className="text-[10px] text-zapp-text-muted block mb-1 truncate">
                        {field.name}
                      </span>
                      <LeadFieldValueEditor
                        field={{
                          id: field.id,
                          name: field.name,
                          field_type: field.field_type as "boolean" | "currency" | "date" | "instagram" | "multi_select" | "number" | "select" | "text" | "user",
                          options: formattedOptions,
                          is_required: false,
                          is_active: true,
                          display_order: field.display_order,
                        }}
                        leadId={conversationLeadId}
                        accountId={currentUser?.account_id || ""}
                        currentValue={getFieldValue(field.id)}
                        onValueChange={() => refetchFieldValues()}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
            </div>
          ) : activeDeal ? (
            <>
              {/* Active Deal Card */}
              <Card className="p-3 bg-zapp-panel border-zapp-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-zapp-text">Negócio Ativo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {nextTaskDate && (
                      <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">
                        <Calendar className="h-3 w-3 mr-1" />
                        {nextTaskDate}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => setDealDetailOpen(true)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Detalhes
                    </Button>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="font-medium text-zapp-text truncate">{activeDeal.title}</p>
                  <p className="text-lg font-bold text-zapp-accent">{formatCurrency(activeDeal.value)}</p>
                </div>

                {/* Stage selector */}
                <div className="space-y-2">
                  <Label className="text-xs text-zapp-text-muted">Mover para estágio:</Label>
                  <div className="flex flex-wrap gap-1">
                    {stages.map(stage => {
                      const isActive = stage.id === activeDeal.stage_id;
                      return (
                        <Button
                          key={stage.id}
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          className={cn(
                            "h-7 text-xs px-2",
                            isActive && "pointer-events-none"
                          )}
                          style={isActive ? { backgroundColor: stage.color } : { borderColor: stage.color, color: stage.color }}
                          onClick={async () => {
                            if (!isActive && currentUser?.account_id) {
                              const result = await validateDealMove(activeDeal.id, stage.id, currentUser.account_id);
                              if (!result.canMoveToStage) {
                                setRequiredFieldsModal({
                                  open: true,
                                  dealId: activeDeal.id,
                                  dealTitle: activeDeal.title,
                                  targetStageId: stage.id,
                                  targetStageName: stage.name,
                                  missingFields: result.missingFields,
                                });
                              } else {
                                moveDeal.mutate({ dealId: activeDeal.id, stageId: stage.id });
                              }
                            }
                          }}
                          disabled={moveDeal.isPending}
                        >
                          {stage.name}
                          {isActive && <CheckCircle className="h-3 w-3 ml-1" />}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              {activityTypes.length > 0 && (
                <Card className="p-3 bg-zapp-panel border-zapp-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-zapp-text">Ações Rápidas</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activityTypes.slice(0, 3).map(type => (
                      <Button 
                        key={type.id} 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        style={{ borderColor: type.color || undefined, color: type.color || undefined }}
                        onClick={() => openTaskDialog(type)}
                      >
                        {type.icon && <DynamicIcon name={type.icon} className="h-3 w-3 mr-1" />}
                        {type.name}
                      </Button>
                    ))}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-xs"
                      onClick={() => openTaskDialog()}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Outra
                    </Button>
                  </div>
                </Card>
              )}

              {/* Pending Tasks */}
              {pendingTasks.length > 0 && (
                <Card className="p-3 bg-zapp-panel border-zapp-border">
                  <div className="flex items-center gap-2 mb-2">
                    <ListTodo className="h-3.5 w-3.5 text-zapp-text-muted" />
                    <span className="text-xs font-medium text-zapp-text">
                      Próximas ({pendingTasks.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {pendingTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-center gap-2 text-xs group">
                        <Checkbox 
                          onCheckedChange={() => completeTask.mutate(task.id)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="flex-1 truncate text-zapp-text">{task.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setEditingTask(task);
                            setTaskDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3 text-zapp-text-muted hover:text-zapp-text" />
                        </Button>
                        {task.due_date && (
                          <span className="text-zapp-text-muted whitespace-nowrap">
                            {formatTaskDate(task.due_date, task.due_time)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : showCreateDeal ? (
            /* Create Deal Form */
            <Card className="p-3 bg-zapp-panel border-zapp-border">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="h-4 w-4 text-zapp-accent" />
                <span className="text-sm font-medium text-zapp-text">Criar Negócio</span>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-zapp-text-muted">Título</Label>
                  <Input
                    value={newDealTitle}
                    onChange={(e) => setNewDealTitle(e.target.value)}
                    placeholder={conversationContactName || "Nome do negócio"}
                    className="h-8 text-sm bg-zapp-bg border-zapp-border text-zapp-text mt-1"
                  />
                </div>

                {/* Item da Venda */}
                <div>
                  <Label className="text-xs text-zapp-text-muted">Item da Venda</Label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const productId = e.target.value;
                      setSelectedProductId(productId);
                      if (productId && productId !== "__none__") {
                        const product = products.find(p => p.id === productId);
                        if (product) {
                          const formatted = new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(product.price);
                          setNewDealValue(formatted);
                        }
                      }
                    }}
                    className="w-full h-8 text-sm bg-zapp-bg border border-zapp-border text-zapp-text mt-1 rounded px-2"
                  >
                    <option value="">Selecione o produto</option>
                    <option value="__none__">Nenhum</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-zapp-text-muted">Valor</Label>
                  <Input
                    value={newDealValue}
                    onChange={(e) => handleCurrencyInput(e.target.value)}
                    placeholder="R$ 0,00"
                    className="h-8 text-sm bg-zapp-bg border-zapp-border text-zapp-text mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8"
                    onClick={() => setShowCreateDeal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => createDeal.mutate()}
                    disabled={createDeal.isPending}
                  >
                    {createDeal.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Criar"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            /* No active deal - show create button */
            <Card className="p-4 bg-zapp-panel border-zapp-border border-dashed">
              <div className="text-center">
                <Briefcase className="h-8 w-8 mx-auto mb-2 text-zapp-text-muted opacity-50" />
                <p className="text-sm text-zapp-text-muted mb-3">
                  Nenhum negócio ativo para este contato
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowCreateDeal(true)}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Criar Negócio
                </Button>
              </div>
            </Card>
          )}

          {/* Past deals (won) */}
          {deals.filter(d => d.status === "won").length > 0 && (
            <div>
              <p className="text-xs text-zapp-text-muted mb-2">Negócios ganhos</p>
              <div className="space-y-2">
                {deals.filter(d => d.status === "won").map(deal => (
                  <Card 
                    key={deal.id}
                    className="p-2 bg-zapp-panel/50 border-zapp-border cursor-pointer hover:bg-zapp-panel"
                    onClick={() => navigate(`/sales?deal=${deal.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zapp-text truncate">{deal.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-500 font-medium">{formatCurrency(deal.value)}</span>
                        <Badge className="text-[10px] bg-green-500/20 text-green-500">Ganho</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Deal Detail Sheet */}
      {activeDeal && (
        <ZappDealDetailSheet
          open={dealDetailOpen}
          onOpenChange={setDealDetailOpen}
          dealId={activeDeal.id}
          leadId={conversationLeadId}
          clientId={conversationClientId}
          stages={stages}
          onDealUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["contact-deals-zapp"] });
            queryClient.invalidateQueries({ queryKey: ["lead-info-zapp", conversationLeadId] });
            queryClient.invalidateQueries({ queryKey: ["deals"] });
            refetchDeals();
            refetchPendingTasks();
          }}
        />
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask ? {
          id: editingTask.id,
          title: editingTask.title,
          description: null,
          status: "pending",
          priority: "medium",
          due_date: editingTask.due_date,
          due_time: editingTask.due_time,
          client_id: null,
          deal_id: activeDeal?.id || null,
          lead_id: conversationLeadId || null,
          assigned_to: null,
          activity_type_id: editingTask.activity_type_id || null,
        } : null}
        dealId={activeDeal?.id}
        leadId={conversationLeadId || undefined}
        initialActivityTypeId={selectedActivityType?.id}
        forceSectorId="vendas"
        onSuccess={() => {
          refetchPendingTasks();
          setTaskDialogOpen(false);
          setEditingTask(null);
        }}
      />

      {/* Required Fields Modal */}
      {requiredFieldsModal && (
        <RequiredFieldsModal
          open={requiredFieldsModal.open}
          onOpenChange={(open) => !open && setRequiredFieldsModal(null)}
          dealId={requiredFieldsModal.dealId}
          dealTitle={requiredFieldsModal.dealTitle}
          targetStageName={requiredFieldsModal.targetStageName}
          missingFields={requiredFieldsModal.missingFields}
          accountId={currentUser?.account_id || ""}
          onComplete={() => {
            moveDeal.mutate({ 
              dealId: requiredFieldsModal.dealId, 
              stageId: requiredFieldsModal.targetStageId 
            });
            setRequiredFieldsModal(null);
          }}
        />
      )}
    </div>
  );
}
