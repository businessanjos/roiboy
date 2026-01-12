import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  DollarSign, TrendingUp, Clock, Calendar, User, Tag,
  CheckCircle, XCircle, RotateCcw, Loader2, MessageSquare,
  Phone, Video, Mail, FileText, Plus, ListTodo, ChevronDown, ChevronUp
} from "lucide-react";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { ZappLeadDataEditor } from "./ZappLeadDataEditor";
import { LeadFieldValueEditor } from "@/components/custom-fields/LeadFieldValueEditor";

interface ZappDealDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  leadId?: string | null;
  clientId?: string | null;
  stages: { id: string; name: string; color: string; display_order: number }[];
  onDealUpdated: () => void;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  status: string;
  probability: number | null;
  expected_close_date: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  responsible_user_id: string | null;
  responsible_user?: { name: string; avatar_url: string | null } | null;
  lead?: { full_name: string; phone: string | null } | null;
  client?: { full_name: string; phone_e164: string | null } | null;
}

interface DealActivity {
  id: string;
  type: string;
  content: string | null;
  created_at: string;
  user?: { name: string; avatar_url: string | null } | null;
}

interface InternalTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: string;
  custom_status_id: string | null;
  completed_at: string | null;
  created_at: string;
  activity_type?: { name: string; color: string; icon: string | null } | null;
  assigned_user?: { name: string; avatar_url: string | null } | null;
}

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: string[] | null;
  display_order: number;
}

interface FieldValue {
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: any | null;
}

const EVENT_TYPES = [
  { value: "note", label: "Nota", icon: FileText },
  { value: "call", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Video },
];

export function ZappDealDetailSheet({
  open,
  onOpenChange,
  dealId,
  leadId,
  clientId,
  stages,
  onDealUpdated,
}: ZappDealDetailSheetProps) {
  const { currentUser } = useCurrentUser();
  const { activityTypes } = useActivityTypes();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("resumo");
  const [newActivityType, setNewActivityType] = useState("note");
  const [newActivityDescription, setNewActivityDescription] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Fetch deal details
  const { data: deal, isLoading: dealLoading, refetch: refetchDeal } = useQuery({
    queryKey: ["deal-detail-zapp", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          responsible_user:users!deals_responsible_user_id_fkey(name, avatar_url),
          lead:leads(full_name, phone),
          client:clients(full_name, phone_e164)
        `)
        .eq("id", dealId)
        .single();
      if (error) throw error;
      return data as Deal;
    },
    enabled: open && !!dealId,
  });

  // Fetch custom fields for leads
  const { data: customFields = [] } = useQuery({
    queryKey: ["lead-custom-fields", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, options, display_order")
        .eq("account_id", currentUser?.account_id)
        .eq("show_in_leads", true)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as CustomField[];
    },
    enabled: open && !!currentUser?.account_id && !!leadId,
  });

  // Fetch field values
  const { data: fieldValues = [], refetch: refetchFieldValues } = useQuery({
    queryKey: ["lead-field-values", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_field_values")
        .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
        .eq("lead_id", leadId);
      if (error) throw error;
      return data as FieldValue[];
    },
    enabled: open && !!leadId,
  });

  // Fetch deal activities
  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: ["deal-activities-zapp", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select(`*, user:users(name, avatar_url)`)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DealActivity[];
    },
    enabled: open && !!dealId,
  });

  // Fetch tasks linked to deal or lead
  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["deal-tasks-zapp", dealId, leadId],
    queryFn: async () => {
      let query = supabase
        .from("internal_tasks")
        .select(`
          id, title, description, due_date, due_time, status, custom_status_id, completed_at, created_at,
          activity_type:activity_types(name, color, icon),
          assigned_user:users!internal_tasks_assigned_to_fkey(name, avatar_url)
        `)
        .order("created_at", { ascending: false });
      
      if (dealId && leadId) {
        query = query.or(`deal_id.eq.${dealId},lead_id.eq.${leadId}`);
      } else if (dealId) {
        query = query.eq("deal_id", dealId);
      } else if (leadId) {
        query = query.eq("lead_id", leadId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as InternalTask[];
    },
    enabled: open && !!(dealId || leadId),
  });

  // Move deal mutation
  const moveDeal = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from("deals")
        .update({ stage_id: stageId })
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDeal();
      onDealUpdated();
      toast.success("Negócio movido!");
    },
  });

  // Mark as won/lost mutation
  const updateDealStatus = useMutation({
    mutationFn: async (status: "won" | "lost" | "open") => {
      const { error } = await supabase
        .from("deals")
        .update({ 
          status,
          closed_at: status === "open" ? null : new Date().toISOString()
        })
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      refetchDeal();
      onDealUpdated();
      toast.success(
        status === "won" ? "Negócio marcado como ganho!" :
        status === "lost" ? "Negócio marcado como perdido!" :
        "Negócio reaberto!"
      );
    },
  });

  // Add activity mutation
  const addActivity = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id || !currentUser?.account_id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("deal_activities")
        .insert([{
          account_id: currentUser.account_id,
          deal_id: dealId,
          type: newActivityType,
          content: newActivityDescription.trim() || null,
          user_id: currentUser.id,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewActivityDescription("");
      refetchActivities();
      toast.success("Atividade registrada!");
    },
  });

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
      case "multi-select":
      case "user": return fv.value_json;
      default: return fv.value_text;
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

  const getDealAge = () => {
    if (!deal) return 0;
    const created = new Date(deal.created_at);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getEventIcon = (type: string) => {
    const event = EVENT_TYPES.find(e => e.value === type);
    return event?.icon || FileText;
  };

  const contactName = deal?.lead?.full_name || deal?.client?.full_name || "Contato";
  const currentStage = stages.find(s => s.id === deal?.stage_id);

  // Merge activities and tasks for timeline
  const timelineItems = [
    ...activities.map(a => ({
      id: a.id,
      type: "activity" as const,
      subType: a.type,
      title: EVENT_TYPES.find(e => e.value === a.type)?.label || a.type,
      description: a.content,
      date: a.created_at,
      user: a.user,
    })),
    ...tasks.map(t => ({
      id: t.id,
      type: "task" as const,
      subType: t.activity_type?.name || "Tarefa",
      title: t.title,
      description: t.description,
      date: t.completed_at || t.created_at,
      user: t.assigned_user,
      status: t.status,
      activityType: t.activity_type,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 bg-zapp-bg border-zapp-border">
        {dealLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-zapp-accent" />
          </div>
        ) : deal ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-4 py-3 border-b border-zapp-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zapp-accent/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-zapp-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-base text-zapp-text truncate">
                    {deal.title}
                  </SheetTitle>
                  <p className="text-xs text-zapp-text-muted">{contactName}</p>
                </div>
                <Badge 
                  className={cn(
                    "text-xs",
                    deal.status === "won" && "bg-green-500/20 text-green-500",
                    deal.status === "lost" && "bg-red-500/20 text-red-500",
                    deal.status === "open" && "bg-amber-500/20 text-amber-500"
                  )}
                >
                  {deal.status === "won" ? "Ganho" : deal.status === "lost" ? "Perdido" : "Aberto"}
                </Badge>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                {deal.status === "open" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-green-500 text-green-500 hover:bg-green-500/10"
                      onClick={() => updateDealStatus.mutate("won")}
                      disabled={updateDealStatus.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ganho
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-red-500 text-red-500 hover:bg-red-500/10"
                      onClick={() => updateDealStatus.mutate("lost")}
                      disabled={updateDealStatus.isPending}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Perdido
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => updateDealStatus.mutate("open")}
                    disabled={updateDealStatus.isPending}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reabrir
                  </Button>
                )}
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-2 h-8 bg-zapp-panel">
                <TabsTrigger value="resumo" className="text-xs h-6">Resumo</TabsTrigger>
                {leadId && <TabsTrigger value="lead" className="text-xs h-6">Dados do Lead</TabsTrigger>}
                <TabsTrigger value="historico" className="text-xs h-6">Histórico</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                {/* Resumo Tab */}
                <TabsContent value="resumo" className="p-4 space-y-4 mt-0">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <div className="flex items-center gap-2 text-zapp-text-muted mb-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span className="text-xs">Valor</span>
                      </div>
                      <p className="text-lg font-bold text-zapp-accent">{formatCurrency(deal.value)}</p>
                    </Card>
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <div className="flex items-center gap-2 text-zapp-text-muted mb-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-xs">Probabilidade</span>
                      </div>
                      <p className="text-lg font-bold text-zapp-text">{deal.probability || 0}%</p>
                    </Card>
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <div className="flex items-center gap-2 text-zapp-text-muted mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">Idade</span>
                      </div>
                      <p className="text-lg font-bold text-zapp-text">{getDealAge()} dias</p>
                    </Card>
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <div className="flex items-center gap-2 text-zapp-text-muted mb-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-xs">Previsão</span>
                      </div>
                      <p className="text-sm font-medium text-zapp-text">
                        {deal.expected_close_date 
                          ? format(new Date(deal.expected_close_date), "dd/MM/yy")
                          : "-"
                        }
                      </p>
                    </Card>
                  </div>

                  {/* Stage Selector */}
                  <Card className="p-3 bg-zapp-panel border-zapp-border">
                    <Label className="text-xs text-zapp-text-muted">Etapa</Label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {stages.map(stage => {
                        const isActive = stage.id === deal.stage_id;
                        return (
                          <Button
                            key={stage.id}
                            size="sm"
                            variant={isActive ? "default" : "outline"}
                            className={cn("h-7 text-xs px-2", isActive && "pointer-events-none")}
                            style={isActive 
                              ? { backgroundColor: stage.color } 
                              : { borderColor: stage.color, color: stage.color }
                            }
                            onClick={() => !isActive && moveDeal.mutate(stage.id)}
                            disabled={moveDeal.isPending}
                          >
                            {stage.name}
                            {isActive && <CheckCircle className="h-3 w-3 ml-1" />}
                          </Button>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Responsible */}
                  {deal.responsible_user && (
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <Label className="text-xs text-zapp-text-muted">Responsável</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={deal.responsible_user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {deal.responsible_user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-zapp-text">{deal.responsible_user.name}</span>
                      </div>
                    </Card>
                  )}

                  {/* Tags */}
                  {deal.tags && deal.tags.length > 0 && (
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-3.5 w-3.5 text-zapp-text-muted" />
                        <Label className="text-xs text-zapp-text-muted">Tags</Label>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {deal.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Notes */}
                  {deal.notes && (
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <Label className="text-xs text-zapp-text-muted">Observações</Label>
                      <p className="text-sm text-zapp-text mt-1 whitespace-pre-wrap">{deal.notes}</p>
                    </Card>
                  )}

                  {/* Custom Fields */}
                  {leadId && customFields.length > 0 && (
                    <Card className="p-3 bg-zapp-panel border-zapp-border">
                      <Label className="text-xs text-zapp-text-muted mb-2 block">Campos Personalizados</Label>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {customFields.map(field => {
                          // Convert string[] options to FieldOption[] format
                          const formattedOptions = Array.isArray(field.options)
                            ? field.options.map((opt: any) => 
                                typeof opt === 'string' 
                                  ? { value: opt, label: opt, color: 'gray' }
                                  : opt
                              )
                            : [];
                          
                          return (
                            <div key={field.id} className="min-w-0">
                              <span className="text-[10px] text-zapp-text-muted block mb-1 break-words">
                                {field.name}
                              </span>
                              <div className="max-w-full">
                                <LeadFieldValueEditor
                                  field={{
                                    id: field.id,
                                    name: field.name,
                                    field_type: field.field_type as any,
                                    options: formattedOptions,
                                    is_required: false,
                                    is_active: true,
                                    display_order: field.display_order,
                                  }}
                                  leadId={leadId}
                                  accountId={currentUser?.account_id || ""}
                                  currentValue={getFieldValue(field.id)}
                                  onValueChange={() => refetchFieldValues()}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </TabsContent>

                {/* Lead Data Tab */}
                {leadId && (
                  <TabsContent value="lead" className="p-4 mt-0">
                    <ZappLeadDataEditor leadId={leadId} onLeadUpdated={onDealUpdated} />
                  </TabsContent>
                )}

                {/* Histórico Tab */}
                <TabsContent value="historico" className="p-4 space-y-4 mt-0">
                  {/* Add Activity Form */}
                  <Card className="p-3 bg-zapp-panel border-zapp-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="h-3.5 w-3.5 text-zapp-accent" />
                      <Label className="text-xs text-zapp-text">Registrar Atividade</Label>
                    </div>
                    <div className="space-y-2">
                      <Select value={newActivityType} onValueChange={setNewActivityType}>
                        <SelectTrigger className="h-8 text-xs bg-zapp-bg border-zapp-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className="h-3 w-3" />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={newActivityDescription}
                        onChange={(e) => setNewActivityDescription(e.target.value)}
                        placeholder="Descrição da atividade..."
                        className="text-xs bg-zapp-bg border-zapp-border text-zapp-text min-h-[60px]"
                      />
                      <Button
                        size="sm"
                        onClick={() => addActivity.mutate()}
                        disabled={addActivity.isPending}
                        className="w-full h-8"
                      >
                        {addActivity.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Adicionar"
                        )}
                      </Button>
                    </div>
                  </Card>

                  {/* Timeline */}
                  <div className="space-y-3">
                    {timelineItems.length === 0 ? (
                      <p className="text-xs text-zapp-text-muted text-center py-4">
                        Nenhuma atividade registrada
                      </p>
                    ) : (
                      timelineItems.map(item => {
                        const Icon = item.type === "activity" 
                          ? getEventIcon(item.subType) 
                          : ListTodo;
                        
                        return (
                          <div key={item.id} className="flex gap-3">
                            <div 
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                item.type === "task" && item.activityType
                                  ? ""
                                  : "bg-zapp-accent/20"
                              )}
                              style={
                                item.type === "task" && item.activityType
                                  ? { backgroundColor: `${item.activityType.color}20` }
                                  : undefined
                              }
                            >
                              {item.type === "task" && item.activityType?.icon ? (
                                <DynamicIcon 
                                  name={item.activityType.icon} 
                                  className="h-4 w-4"
                                  style={{ color: item.activityType.color }}
                                />
                              ) : (
                                <Icon className="h-4 w-4 text-zapp-accent" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-zapp-text">
                                      {item.type === "task" ? item.title : item.title}
                                    </span>
                                    {item.type === "task" && (
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-[10px] h-4",
                                          item.status === "done" || item.status === "completed"
                                            ? "border-green-500 text-green-500"
                                            : "border-amber-500 text-amber-500"
                                        )}
                                      >
                                        {item.status === "done" || item.status === "completed" ? "Concluído" : "Pendente"}
                                      </Badge>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className={cn(
                                      "text-xs text-zapp-text-muted mt-0.5 whitespace-pre-wrap",
                                      !expandedItems.has(item.id) && "line-clamp-2"
                                    )}>
                                      {item.description}
                                    </p>
                                  )}
                                  {item.description && item.description.length > 100 && (
                                    <button
                                      onClick={() => toggleItemExpanded(item.id)}
                                      className="text-xs font-medium text-primary hover:underline mt-1 cursor-pointer"
                                    >
                                      {expandedItems.has(item.id) ? "Ver menos" : "Ver mais"}
                                    </button>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zapp-text-muted">
                                    {item.user && <span>{item.user.name}</span>}
                                    <span>•</span>
                                    <span>{format(new Date(item.date), "dd/MM HH:mm", { locale: ptBR })}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zapp-text-muted">
            Negócio não encontrado
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
