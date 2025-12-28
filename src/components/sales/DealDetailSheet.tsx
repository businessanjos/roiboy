import { useState, useEffect } from "react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Deal, DealStage } from "@/hooks/useDeals";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
} from "lucide-react";
import { FieldValueBadge } from "@/components/custom-fields/FieldValueBadge";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";

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

interface DealDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  stages: DealStage[];
  onEdit: () => void;
  onMarkAsWon: (dealId: string) => Promise<void>;
  onMarkAsLost: (dealId: string, reason?: string) => Promise<void>;
  onReopen: (dealId: string) => Promise<void>;
  onStageChange: (dealId: string, stageId: string) => Promise<boolean>;
}

const EVENT_TYPES = [
  { value: "note", label: "Nota", icon: StickyNote },
  { value: "call", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Video },
];

const getEventConfig = (eventType: string) => {
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
      return { icon: CheckCircle, bgColor: "bg-slate-500", textColor: "text-slate-500", label: "Status" };
    default:
      return { icon: StickyNote, bgColor: "bg-muted", textColor: "text-muted-foreground", label: "Evento" };
  }
};

export function DealDetailSheet({
  open,
  onOpenChange,
  deal,
  stages,
  onEdit,
  onMarkAsWon,
  onMarkAsLost,
  onReopen,
  onStageChange,
}: DealDetailSheetProps) {
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [eventType, setEventType] = useState("note");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null; account_id?: string } | null>(null);
  const [changingStage, setChangingStage] = useState(false);
  
  // Lead custom fields
  const [leadCustomFields, setLeadCustomFields] = useState<CustomField[]>([]);
  const [leadFieldValues, setLeadFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (deal?.id && open) {
      fetchActivities();
      fetchCurrentUser();
      if (deal.lead_id) {
        fetchLeadCustomFields();
      } else {
        setLeadCustomFields([]);
        setLeadFieldValues({});
      }
    }
  }, [deal?.id, deal?.lead_id, open]);

  const fetchLeadCustomFields = async () => {
    if (!deal?.lead_id) return;
    
    // Get account_id
    const userRes = await supabase
      .from("users")
      .select("account_id")
      .single();
    
    const accountId = userRes.data?.account_id;
    if (!accountId) return;

    try {
      // Fetch custom fields for leads
      const { data: fields, error: fieldsError } = await (supabase as any)
        .from("custom_fields")
        .select("id, account_id, name, field_type, options, display_order, is_active, is_required, show_in_clients, show_in_leads, created_at, updated_at")
        .eq("account_id", accountId)
        .eq("show_in_leads", true)
        .eq("is_active", true)
        .order("display_order");
      
      if (fieldsError) {
        console.error("Error fetching custom fields:", fieldsError);
        return;
      }

      if (!fields || fields.length === 0) {
        setLeadCustomFields([]);
        setLeadFieldValues({});
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
        created_at: f.created_at,
        updated_at: f.updated_at,
      }));
      setLeadCustomFields(formattedFields);

      // Fetch field values for this lead
      const valuesRes = await supabase
        .from("lead_field_values")
        .select("*")
        .eq("lead_id", deal.lead_id);
      
      const values = valuesRes.data;

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
                valuesMap[v.field_id] = v.value_text;
                break;
              case "multi_select":
              case "user":
                valuesMap[v.field_id] = v.value_json;
                break;
            }
          }
        });
        setLeadFieldValues(valuesMap);
      }
    } catch (error) {
      console.error("Error fetching lead custom fields:", error);
    }
  };

  const fetchCurrentUser = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, account_id")
      .single();
    if (data) setCurrentUser(data);
  };

  const fetchActivities = async () => {
    if (!deal?.id) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from("deal_activities")
      .select(`
        *,
        user:users(name, avatar_url)
      `)
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching activities:", error);
    } else {
      setActivities((data || []) as DealActivity[]);
    }
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
  const contactName = deal.client?.full_name || deal.contact_name || 'Sem contato';
  const isClosed = deal.status !== 'open';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarImage src={deal.client?.avatar_url || undefined} />
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                  {getInitials(contactName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl truncate pr-2">{deal.title}</SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-muted-foreground">{contactName}</span>
                  {deal.client?.phone_e164 && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">{deal.client.phone_e164}</span>
                    </>
                  )}
                  {deal.status === 'won' && (
                    <Badge className="bg-emerald-500 gap-1 ml-2">
                      <Trophy className="h-3 w-3" />
                      Ganha
                    </Badge>
                  )}
                  {deal.status === 'lost' && (
                    <Badge variant="destructive" className="gap-1 ml-2">
                      <XCircle className="h-3 w-3" />
                      Perdida
                    </Badge>
                  )}
                  {deal.status === 'open' && currentStage && (
                    <Badge
                      variant="outline"
                      className="ml-2"
                      style={{ 
                        borderColor: currentStage.color,
                        color: currentStage.color,
                      }}
                    >
                      {currentStage.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isClosed && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                    onClick={() => onMarkAsWon(deal.id)}
                  >
                    <Trophy className="h-4 w-4 mr-1" />
                    Ganha
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => onMarkAsLost(deal.id)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Perdida
                  </Button>
                </>
              )}
              {isClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReopen(deal.id)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reabrir
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Deal Info */}
              <div className="space-y-5">
                {/* Stats Cards - Improved Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Valor</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-500">{formatCurrency(deal.value)}</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/20">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Probabilidade</span>
                    </div>
                    <p className="text-xl font-bold text-blue-500">{deal.probability}%</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/20">
                        <Clock className="h-4 w-4 text-amber-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Idade</span>
                    </div>
                    <p className="text-xl font-bold text-amber-500">{daysSinceCreation} dias</p>
                  </div>
                  <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-violet-500/20">
                        <Calendar className="h-4 w-4 text-violet-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Previsão</span>
                    </div>
                    <p className="text-xl font-bold text-violet-500">
                      {deal.expected_close_date
                        ? format(new Date(deal.expected_close_date), "dd/MM/yy")
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Details Card */}
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  {/* Stage Selector (only for open deals) */}
                  {!isClosed && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground block mb-1">Etapa</span>
                        <Select
                          value={deal.stage_id || ""}
                          onValueChange={handleStageChange}
                          disabled={changingStage}
                        >
                          <SelectTrigger className="h-9 text-sm bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {stages.map(stage => (
                              <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: stage.color }}
                                  />
                                  {stage.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {changingStage && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                  )}

                  {/* Responsible User */}
                  {deal.responsible_user && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground block mb-1">Responsável</span>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-primary/20">
                            <AvatarImage src={deal.responsible_user.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(deal.responsible_user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{deal.responsible_user.name}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {deal.tags && deal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                      {deal.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs rounded-full px-3">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {deal.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Observações</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{deal.notes}</p>
                    </div>
                  )}
                </div>

                {/* Lead Custom Fields - Only show filled fields */}
                {deal.lead_id && leadCustomFields.length > 0 && (
                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      Campos do Lead
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {leadCustomFields.map(field => {
                        const value = leadFieldValues[field.id];
                        const hasValue = value !== undefined && value !== null && value !== '';
                        return (
                          <div key={field.id} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{field.name}</p>
                            {hasValue ? (
                              <FieldValueBadge field={field} value={value} />
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">Não preenchido</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Timeline */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  Histórico Comercial
                </h4>

                {/* Add new activity */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger className="w-[140px] h-9 text-sm bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {EVENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">Registrar atividade</span>
                  </div>
                  <Textarea
                    placeholder="Descreva a interação..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    className="resize-none text-sm bg-background"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddActivity}
                      disabled={!newNote.trim() || submitting}
                      className="gap-1.5"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Adicionar
                    </Button>
                  </div>
                </div>

                {/* Activities Timeline */}
                <div className="rounded-xl border bg-card overflow-hidden">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhuma atividade registrada
                    </div>
                  ) : (
                    <div className="max-h-[380px] overflow-y-auto">
                      {activities.map((activity, index) => {
                        const config = getEventConfig(activity.type);
                        const Icon = config.icon;
                        const userName = activity.user?.name || "Sistema";
                        const userAvatar = activity.user?.avatar_url;
                        const isLast = index === activities.length - 1;

                        return (
                          <div 
                            key={activity.id} 
                            className={cn(
                              "flex gap-3 p-4",
                              !isLast && "border-b"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0",
                              config.bgColor
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-1.5 mb-1">
                                <Avatar className="h-5 w-5 border border-border">
                                  <AvatarImage src={userAvatar || undefined} />
                                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                    {getInitials(userName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{userName}</span>
                                <span className="text-muted-foreground">·</span>
                                <span className={cn("text-sm font-medium", config.textColor)}>
                                  {activity.title || config.label}
                                </span>
                                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                                  {formatDistanceToNow(new Date(activity.created_at), { locale: ptBR, addSuffix: true })}
                                </span>
                              </div>
                              {activity.content && (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                                  {activity.content}
                                </p>
                              )}
                              {activity.type === 'stage_change' && activity.old_value && activity.new_value && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  De <span className="font-medium text-foreground">{activity.old_value}</span> para{" "}
                                  <span className="font-medium text-foreground">{activity.new_value}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
