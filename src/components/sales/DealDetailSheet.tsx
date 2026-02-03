import { useState, useEffect } from "react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Deal, DealStage } from "@/hooks/useDeals";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as icons from "lucide-react";
import {
  StickyNote,
  Phone,
  Mail,
  Video,
  Calendar,
  MessageSquare,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Trophy,
  Loader2,
  Plus,
  Edit,
  DollarSign,
  User,
  Clock,
  TrendingUp,
  RotateCcw,
  Building2,
  FileText,
  ListTodo,
  Settings,
  Copy,
  Trash2,
  GitMerge,
  Package,
  type LucideIcon,
} from "lucide-react";
import { FieldValueBadge } from "@/components/custom-fields/FieldValueBadge";
import { DealFieldValueEditor } from "@/components/custom-fields/DealFieldValueEditor";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { DealActivitiesTab } from "./DealActivitiesTab";
import { DealFieldsConfigDialog } from "./DealFieldsConfigDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { DealLeadInfo } from "./DealLeadInfo";
import { DealTransferDialog } from "./DealTransferDialog";
import { MergeDealDialog } from "./MergeDealDialog";
import { useDealMerge } from "@/hooks/useDealMerge";
import { DEAL_FIELD_IDS } from "@/utils/dealToClientContractMapping";

interface DealActivity {
  id: string;
  deal_id: string;
  type: string;
  title: string | null;
  content: string | null;
  old_value: string | null;
  new_value: string | null;
  user_id: string | null;
  created_at: string;
  user?: {
    name: string;
    avatar_url: string | null;
  } | null;
}

interface DealTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_user?: {
    name: string;
    avatar_url: string | null;
  } | null;
  custom_status?: {
    name: string;
    color: string;
    is_completed_status: boolean;
  } | null;
  activity_type?: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

type TimelineItem = 
  | { type: 'activity'; data: DealActivity; created_at: string }
  | { type: 'task'; data: DealTask; created_at: string };

interface DealDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  stages: DealStage[];
  allDeals?: Deal[];
  onEdit: () => void;
  onMarkAsWon: (dealId: string) => Promise<void>;
  onMarkAsLost: (dealId: string, reason?: string) => Promise<void>;
  onReopen: (dealId: string) => Promise<void>;
  onStageChange: (dealId: string, stageId: string) => Promise<boolean>;
  onDealUpdated?: () => void;
  processingWonDealId?: string | null;
}

const EVENT_TYPES = [
  { value: "note", label: "Nota", icon: StickyNote },
  { value: "call", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Video },
];

const getEventConfig = (eventType: string, title?: string) => {
  switch (eventType) {
    case "note":
      return { icon: StickyNote, bgColor: "bg-primary", textColor: "text-primary", label: "Nota" };
    case "call":
      return { icon: Phone, bgColor: "bg-blue-500", textColor: "text-blue-500", label: "Ligação" };
    case "whatsapp":
      return { icon: MessageSquare, bgColor: "bg-emerald-500", textColor: "text-emerald-500", label: "WhatsApp" };
    case "email":
      return { icon: Mail, bgColor: "bg-amber-500", textColor: "text-amber-500", label: "Email" };
    case "meeting":
      return { icon: Video, bgColor: "bg-violet-500", textColor: "text-violet-500", label: "Reunião" };
    case "stage_change":
      return { icon: ArrowRightLeft, bgColor: "bg-indigo-500", textColor: "text-indigo-500", label: "Mudança de etapa" };
    case "status_change":
      if (title === 'Negócio perdido') {
        return { icon: XCircle, bgColor: "bg-red-500", textColor: "text-red-500", label: "Perdido" };
      }
      if (title === 'Negócio reaberto') {
        return { icon: RotateCcw, bgColor: "bg-gray-500", textColor: "text-gray-500", label: "Reaberto" };
      }
      return { icon: CheckCircle, bgColor: "bg-emerald-500", textColor: "text-emerald-500", label: "Ganho" };
    default:
      return { icon: StickyNote, bgColor: "bg-muted", textColor: "text-muted-foreground", label: "Evento" };
  }
};

export function DealDetailSheet({
  open,
  onOpenChange,
  deal,
  stages,
  allDeals = [],
  onEdit,
  onMarkAsWon,
  onMarkAsLost,
  onReopen,
  onStageChange,
  onDealUpdated,
  processingWonDealId,
}: DealDetailSheetProps) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [eventType, setEventType] = useState("note");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null; account_id?: string } | null>(null);
  const [changingStage, setChangingStage] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [fieldsConfigOpen, setFieldsConfigOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  
  const { mergeDeals } = useDealMerge();

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
  
  // Deal custom fields
  const [dealCustomFields, setDealCustomFields] = useState<CustomField[]>([]);
  const [dealFieldValues, setDealFieldValues] = useState<Record<string, any>>({});
  const [itemVendaProductName, setItemVendaProductName] = useState<string | null>(null);
  
  const { isAdmin } = usePermissions();

  useEffect(() => {
    if (deal?.id && open) {
      fetchActivities();
      fetchCurrentUser();
      fetchDealCustomFields();
    }
  }, [deal?.id, open]);

  const fetchDealCustomFields = async () => {
    if (!deal?.id) return;
    
    // Get account_id from auth user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      console.error("[DealDetailSheet] No auth user found");
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();
    
    const accountId = userData?.account_id;
    if (!accountId) {
      console.error("[DealDetailSheet] No account_id found for user");
      return;
    }

    try {
      // Fetch custom fields for deals
      const { data: fields, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("id, account_id, name, field_type, options, display_order, is_active, is_required, show_in_clients, show_in_leads, show_in_deals, created_at, updated_at")
        .eq("account_id", accountId)
        .eq("show_in_deals", true)
        .eq("is_active", true)
        .order("display_order");
      
      console.log("[DealDetailSheet] Deal custom fields fetched:", fields?.length || 0, "fields");
      
      if (fieldsError) {
        console.error("Error fetching custom fields:", fieldsError);
        return;
      }

      if (!fields || fields.length === 0) {
        setDealCustomFields([]);
        setDealFieldValues({});
        return;
      }

      const formattedFields: CustomField[] = fields.map((f) => ({
        id: f.id,
        account_id: f.account_id,
        name: f.name,
        field_type: f.field_type as CustomField['field_type'],
        options: Array.isArray(f.options) 
          ? (f.options as Array<{ value: string; label: string; color: string }>)
          : [],
        display_order: f.display_order,
        is_active: f.is_active,
        is_required: f.is_required,
        show_in_clients: f.show_in_clients,
        show_in_leads: f.show_in_leads,
        show_in_deals: f.show_in_deals,
        created_at: f.created_at,
        updated_at: f.updated_at,
      }));
      setDealCustomFields(formattedFields);

      // Fetch field values for this deal
      const { data: values, error: valuesError } = await supabase
        .from("deal_field_values")
        .select("*")
        .eq("deal_id", deal.id);
      
      console.log("[DealDetailSheet] Deal field values fetched:", values?.length || 0, "values for deal", deal.id);
      if (valuesError) {
        console.error("[DealDetailSheet] Error fetching deal field values:", valuesError);
      }

      if (values) {
        const valuesMap: Record<string, any> = {};
        values.forEach((v) => {
          const field = formattedFields.find(f => f.id === v.field_id);
          if (field) {
            switch (field.field_type) {
              case "boolean":
                valuesMap[v.field_id] = v.value_boolean;
                break;
              case "number":
              case "currency":
                valuesMap[v.field_id] = v.value_number;
                break;
              case "date":
                valuesMap[v.field_id] = v.value_date;
                break;
              case "select":
              case "text":
              case "instagram":
                valuesMap[v.field_id] = v.value_text;
                break;
              case "multi_select":
              case "user":
              case "location":
              case "multi_instagram":
                valuesMap[v.field_id] = v.value_json;
                break;
            }
          }
        });
        setDealFieldValues(valuesMap);
        
        // Fetch product name for Item da Venda if it exists
        const itemVendaValue = valuesMap[DEAL_FIELD_IDS.ITEM_VENDA];
        if (itemVendaValue) {
          // Check if it's a UUID (new format - direct product_id)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(itemVendaValue)) {
            const { data: productData } = await supabase
              .from('products')
              .select('name')
              .eq('id', itemVendaValue)
              .maybeSingle();
            
            if (productData) {
              setItemVendaProductName(productData.name);
            }
          } else {
            // Legacy format - get label from custom field options
            const itemVendaField = formattedFields.find(f => f.id === DEAL_FIELD_IDS.ITEM_VENDA);
            if (itemVendaField?.options) {
              const option = itemVendaField.options.find(o => o.value === itemVendaValue);
              if (option) {
                setItemVendaProductName(option.label);
              }
            }
          }
        } else {
          setItemVendaProductName(null);
        }
      }
    } catch (error) {
      console.error("Error fetching deal custom fields:", error);
    }
  };

  const handleDealFieldValueChange = (fieldId: string, newValue: any) => {
    setDealFieldValues(prev => ({
      ...prev,
      [fieldId]: newValue,
    }));
  };

  const fetchCurrentUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, account_id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();
    if (data) setCurrentUser(data);
  };

  const fetchActivities = async () => {
    if (!deal?.id) return;
    setLoading(true);
    
    // Fetch activities and tasks in parallel
    const [activitiesResult, tasksResult] = await Promise.all([
      supabase
        .from("deal_activities")
        .select(`
          *,
          user:users(name, avatar_url)
        `)
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("internal_tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          due_time,
          completed_at,
          created_at,
          assigned_user:users!internal_tasks_assigned_to_fkey(name, avatar_url),
          custom_status:task_statuses!internal_tasks_custom_status_id_fkey(name, color, is_completed_status),
          activity_type:activity_types!internal_tasks_activity_type_id_fkey(name, icon, color)
        `)
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false })
    ]);

    if (activitiesResult.error) {
      console.error("Error fetching activities:", activitiesResult.error);
    } else {
      setActivities((activitiesResult.data || []) as DealActivity[]);
    }
    
    if (tasksResult.error) {
      console.error("Error fetching tasks:", tasksResult.error);
    } else {
      setTasks((tasksResult.data || []) as DealTask[]);
    }

    // Merge activities and tasks into timeline
    const activityItems: TimelineItem[] = (activitiesResult.data || []).map(a => ({
      type: 'activity' as const,
      data: a as DealActivity,
      created_at: a.created_at
    }));
    
    const taskItems: TimelineItem[] = (tasksResult.data || []).map(t => ({
      type: 'task' as const,
      data: t as DealTask,
      created_at: t.created_at
    }));

    const merged = [...activityItems, ...taskItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    setTimelineItems(merged);
    setLoading(false);
  };

  const handleAddActivity = async () => {
    if (!newNote.trim() || !currentUser?.account_id || !deal?.id) return;

    setSubmitting(true);
    try {
      const selectedType = EVENT_TYPES.find(t => t.value === eventType);
      const { error } = await supabase.from("deal_activities").insert({
        account_id: currentUser.account_id,
        deal_id: deal.id,
        type: eventType,
        title: selectedType?.label || "Nota",
        content: newNote.trim(),
        user_id: currentUser.id,
      });

      if (error) throw error;

      setNewNote("");
      setEventType("note");
      fetchActivities();
      toast.success("Atividade registrada!");
    } catch (error: any) {
      console.error("Error adding activity:", error);
      toast.error("Erro ao registrar atividade");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("deal_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;

      fetchActivities();
      toast.success("Anotação excluída!");
    } catch (error: any) {
      console.error("Error deleting activity:", error);
      toast.error("Erro ao excluir anotação");
    }
  };

  const handleStageChange = async (newStageId: string) => {
    if (!deal || newStageId === deal.stage_id) return;
    setChangingStage(true);
    try {
      const success = await onStageChange(deal.id, newStageId);
      if (success) {
        fetchActivities();
      }
    } finally {
      setChangingStage(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!deal) return null;

  const currentStage = stages.find(s => s.id === deal.stage_id);
  const daysSinceCreation = differenceInDays(new Date(), new Date(deal.created_at));
  const contactName = deal.client?.full_name || deal.lead?.full_name || deal.contact_name || 'Sem contato';
  const contactPhone = deal.client?.phone_e164 || deal.lead?.phone || null;
  const isClosed = deal.status !== 'open';

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success("Telefone copiado!");
    } catch (err) {
      toast.error("Erro ao copiar telefone");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 border border-primary/20">
                <AvatarImage src={deal.client?.avatar_url || deal.lead?.avatar_url || undefined} />
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {getInitials(contactName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-base font-semibold truncate">{deal.title}</SheetTitle>
                  {deal.status === 'won' && (
                    <Badge className="bg-emerald-500/90 text-white text-[10px] h-5 px-1.5">
                      <Trophy className="h-3 w-3 mr-0.5" />
                      Ganha
                    </Badge>
                  )}
                  {deal.status === 'lost' && (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                      <XCircle className="h-3 w-3 mr-0.5" />
                      Perdida
                    </Badge>
                  )}
                  {deal.status === 'open' && currentStage && (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 px-1.5"
                      style={{ 
                        borderColor: currentStage.color,
                        color: currentStage.color,
                        backgroundColor: `${currentStage.color}10`,
                      }}
                    >
                      {currentStage.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  {deal.client_id ? (
                    <button
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/clients/${deal.client_id}`);
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      {contactName}
                    </button>
                  ) : deal.lead_id ? (
                    <button
                      onClick={() => {
                        navigate(`/leads?lead=${deal.lead_id}`);
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      {contactName}
                    </button>
                  ) : (
                    <span>{contactName}</span>
                  )}
                  {contactPhone && (
                    <>
                      <span>·</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPhone(contactPhone);
                        }}
                        className="text-primary/70 hover:text-primary hover:underline flex items-center gap-1 transition-colors"
                        title="Clique para copiar"
                      >
                        {contactPhone}
                        <Copy className="h-3 w-3 opacity-60" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mr-8">
              {!isClosed && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={() => onMarkAsWon(deal.id)}
                    disabled={processingWonDealId === deal.id}
                  >
                    {processingWonDealId === deal.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trophy className="h-4 w-4 mr-1" />
                    )}
                    {processingWonDealId === deal.id ? "Processando..." : "Ganha"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => setLostDialogOpen(true)}
                    disabled={!!processingWonDealId}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Perdida
                  </Button>
                </>
              )}
              {isClosed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5"
                  onClick={() => onReopen(deal.id)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reabrir
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
                <Edit className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column - Deal Info */}
              <div className="space-y-4">
                {/* Stats Cards - Compact Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-500">{formatCurrency(deal.value)}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Probabilidade</span>
                    </div>
                    <p className="text-lg font-bold text-blue-500">{deal.probability}%</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Idade</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{daysSinceCreation} dias</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    {deal.status === 'won' && deal.won_at ? (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ganho em</span>
                        </div>
                        <p className="text-lg font-bold text-emerald-500">
                          {format(new Date(deal.won_at), "dd/MM/yy")}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="h-3.5 w-3.5 text-violet-500" />
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Previsão</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">
                          {deal.expected_close_date
                            ? format(new Date(deal.expected_close_date), "dd/MM/yy")
                            : "—"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Details Card */}
                <div className="rounded-lg border p-3 space-y-3">
                  {/* Stage Selector (only for open deals) */}
                  {!isClosed && (
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground min-w-[50px]">Etapa</span>
                      <Select
                        value={deal.stage_id || ""}
                        onValueChange={handleStageChange}
                        disabled={changingStage}
                      >
                        <SelectTrigger className="h-8 text-sm flex-1 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {stages.map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                {stage.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {changingStage && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                  )}

                  {/* Responsible User */}
                  <div className="flex items-center gap-2 overflow-hidden">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground min-w-[40px]">Resp.</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {deal.responsible_user ? (
                        <>
                          <Avatar className="h-5 w-5 flex-shrink-0">
                            <AvatarImage src={deal.responsible_user.avatar_url || undefined} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {getInitials(deal.responsible_user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{deal.responsible_user.name}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Sem responsável</span>
                      )}
                    </div>
                    {!isClosed && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setMergeDialogOpen(true)}
                        >
                          <GitMerge className="h-3.5 w-3.5 mr-1" />
                          Mesclar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setTransferDialogOpen(true)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                          Transferir
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Item da Venda (Product) - Highlighted */}
                  {itemVendaProductName && (
                    <div className="flex items-center gap-2 py-2 px-3 -mx-3 bg-primary/5 rounded-lg border border-primary/20">
                      <Package className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-xs text-muted-foreground min-w-[50px]">Item</span>
                      <span className="text-sm font-medium text-primary flex-1">{itemVendaProductName}</span>
                    </div>
                  )}

                  {/* Tags */}
                  {deal.tags && deal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      {deal.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-[10px] h-5 px-2">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {deal.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Observações</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{deal.notes}</p>
                    </div>
                  )}
                </div>

                {/* Deal Custom Fields - Editable */}
                {(dealCustomFields.length > 0 || isAdmin) && (
                  <div className="rounded-lg border p-3">
                    <h4 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Campos Personalizados
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-5 w-5 -mr-1"
                          onClick={() => setFieldsConfigOpen(true)}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                    </h4>
                    {dealCustomFields.length > 0 && currentUser?.account_id ? (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        {dealCustomFields.map(field => {
                          const value = dealFieldValues[field.id];
                          return (
                            <div key={field.id} className="min-w-0 overflow-hidden relative z-0">
                              <p className="text-[10px] text-muted-foreground mb-0.5">{field.name}</p>
                              <DealFieldValueEditor
                                field={field}
                                dealId={deal.id}
                                accountId={currentUser.account_id}
                                currentValue={value}
                                onValueChange={handleDealFieldValueChange}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : dealCustomFields.length > 0 ? (
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum campo visível</p>
                    )}
                  </div>
                )}

                <DealFieldsConfigDialog
                  open={fieldsConfigOpen}
                  onOpenChange={setFieldsConfigOpen}
                  accountId={currentUser?.account_id || ""}
                  onSave={() => fetchDealCustomFields()}
                />
              </div>

              {/* Right Column - Tabs for History and Tasks */}
              <div className="space-y-3">
                <Tabs defaultValue="history" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 h-8">
                    <TabsTrigger value="history" className="text-xs h-7">
                      <Clock className="h-3 w-3 mr-1" />
                      Histórico
                    </TabsTrigger>
                    <TabsTrigger value="activities" className="text-xs h-7">
                      <ListTodo className="h-3 w-3 mr-1" />
                      Atividades
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="history" className="mt-3 space-y-3">
                    {/* Add new activity */}
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select value={eventType} onValueChange={setEventType}>
                          <SelectTrigger className="w-[120px] h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {EVENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <type.icon className="h-3.5 w-3.5" />
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">Registrar interação</span>
                      </div>
                      <Textarea
                        placeholder="Descreva a interação..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={2}
                        className="resize-none text-sm bg-background"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleAddActivity}
                          disabled={!newNote.trim() || submitting}
                        >
                          {submitting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Plus className="h-3.5 w-3.5 mr-1" />
                          )}
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    {/* Timeline with Activities and Tasks */}
                    <div className="rounded-lg border bg-muted/30 overflow-hidden">
                      {loading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : timelineItems.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          Nenhuma interação registrada
                        </div>
                      ) : (
                        <div className="max-h-[480px] overflow-y-auto divide-y">
                          {timelineItems.map((item) => {
                            if (item.type === 'activity') {
                              const activity = item.data;
                              const config = getEventConfig(activity.type, activity.title);
                              const Icon = config.icon;
                              const userName = activity.user?.name || "Sistema";

                              return (
                                <div key={`activity-${activity.id}`} className="group flex gap-2.5 p-3 hover:bg-muted/30 transition-colors">
                                  <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0",
                                    config.bgColor
                                  )}>
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 text-xs">
                                      <span className="font-medium">{userName}</span>
                                      <span className="text-muted-foreground">·</span>
                                      <span className={cn("font-medium", config.textColor)}>
                                        {activity.title || config.label}
                                      </span>
                                      <div className="flex items-center gap-1 ml-auto">
                                        <span className="text-[10px] text-muted-foreground">
                                          {formatDistanceToNow(new Date(activity.created_at), { locale: ptBR, addSuffix: true })}
                                        </span>
                                        {!['stage_change', 'status_change'].includes(activity.type) && (
                                          <button
                                            onClick={() => handleDeleteActivity(activity.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                                            title="Excluir anotação"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {activity.content && (
                                      <>
                                        <p className={cn(
                                          "text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap",
                                          !expandedItems.has(activity.id) && "line-clamp-2"
                                        )}>
                                          {activity.content}
                                        </p>
                                        {activity.content.length > 100 && (
                                          <button
                                            onClick={() => toggleItemExpanded(activity.id)}
                                            className="text-xs font-medium text-primary hover:underline mt-1 cursor-pointer"
                                          >
                                            {expandedItems.has(activity.id) ? "Ver menos" : "Ver mais"}
                                          </button>
                                        )}
                                      </>
                                    )}
                                    {(activity.type === 'stage_change' || activity.type === 'status_change') && activity.old_value && activity.new_value && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {activity.old_value} → {activity.new_value}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              // Task item
                              const task = item.data;
                              const isCompleted = task.custom_status?.is_completed_status || task.completed_at !== null;
                              const userName = task.assigned_user?.name || "Sem responsável";
                              
                              // Get icon from activity_type or use default
                              const iconName = task.activity_type?.icon;
                              const activityColor = task.activity_type?.color || (isCompleted ? "#22c55e" : "#f59e0b");
                              const activityName = task.activity_type?.name || "Atividade";
                              
                              // Dynamically get icon component
                              const IconComponent = iconName 
                                ? (icons[iconName as keyof typeof icons] as LucideIcon | undefined) || ListTodo
                                : ListTodo;

                              return (
                                <div key={`task-${task.id}`} className="flex gap-2.5 p-3">
                                  <div 
                                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                                    style={{ backgroundColor: activityColor }}
                                  >
                                    <IconComponent className="h-3 w-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 text-xs">
                                      <span className="font-medium">{userName}</span>
                                      <span className="text-muted-foreground">·</span>
                                      <span className="font-medium" style={{ color: activityColor }}>
                                        {isCompleted ? "Concluiu" : "Agendou"} {activityName}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground ml-auto">
                                        {formatDistanceToNow(new Date(task.created_at), { locale: ptBR, addSuffix: true })}
                                      </span>
                                    </div>
                                    <p className={cn(
                                      "text-xs mt-0.5",
                                      isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                                    )}>
                                      {task.activity_type?.name || task.title}
                                    </p>
                                    {task.description && (
                                      <p className={cn(
                                        "text-xs text-muted-foreground mt-1 whitespace-pre-wrap",
                                        !expandedItems.has(task.id) && "line-clamp-2"
                                      )}>
                                        {task.description}
                                      </p>
                                    )}
                                    {task.description && task.description.length > 100 && (
                                      <button
                                        onClick={() => toggleItemExpanded(task.id)}
                                        className="text-xs font-medium text-primary hover:underline mt-1 cursor-pointer"
                                      >
                                        {expandedItems.has(task.id) ? "Ver menos" : "Ver mais"}
                                      </button>
                                    )}
                                    {task.due_date && (
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                        <Calendar className="h-2.5 w-2.5" />
                                        {(() => {
                                          const [year, month, day] = task.due_date.split("-").map(Number);
                                          let hours = 0, minutes = 0;
                                          if (task.due_time) {
                                            const timeParts = task.due_time.split(":");
                                            hours = parseInt(timeParts[0], 10);
                                            minutes = parseInt(timeParts[1], 10);
                                          }
                                          const dateObj = new Date(year, month - 1, day, hours, minutes);
                                          return task.due_time 
                                            ? format(dateObj, "dd/MM/yy 'às' HH:mm", { locale: ptBR })
                                            : format(dateObj, "dd/MM/yy", { locale: ptBR });
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          })}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="activities" className="mt-3">
                    <DealActivitiesTab dealId={deal.id} leadId={deal.lead_id} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Transfer Dialog */}
        {currentUser?.account_id && (
          <DealTransferDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            dealId={deal.id}
            dealTitle={deal.title}
            currentOwnerId={deal.responsible_user_id}
            currentOwnerName={deal.responsible_user?.name || null}
            accountId={currentUser.account_id}
            onTransferred={() => {
              fetchActivities();
              onDealUpdated?.();
            }}
          />
        )}

        {/* Lost Reason Dialog */}
        <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Marcar como Perdida</DialogTitle>
              <DialogDescription>
                Por favor, informe o motivo da perda para continuar.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Motivo da Perda <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Ex: Preço acima do orçamento, concorrente ofereceu melhor condição..."
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setLostDialogOpen(false);
                  setLostReason("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={!lostReason.trim()}
                onClick={async () => {
                  await onMarkAsLost(deal.id, lostReason.trim());
                  setLostDialogOpen(false);
                  setLostReason("");
                }}
              >
                Concluído
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Merge Deal Dialog */}
        {deal && (
          <MergeDealDialog
            open={mergeDialogOpen}
            onOpenChange={setMergeDialogOpen}
            sourceDeal={deal}
            deals={allDeals}
            onMerge={async (sourceDealId, targetDealId, mergedData, sourceDealTitle) => {
              const success = await mergeDeals(sourceDealId, targetDealId, mergedData, sourceDealTitle);
              if (success) {
                onOpenChange(false);
                onDealUpdated?.();
              }
              return success;
            }}
          />
        )}
        
      </SheetContent>
    </Sheet>
  );
}
