import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  StickyNote,
  Send,
  Loader2,
  UserCheck,
  Clock,
  Video,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LeadTimelineEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: {
    name: string;
    avatar_url: string | null;
  } | null;
}

interface LeadTimelineProps {
  leadId: string;
  className?: string;
}

const EVENT_TYPES = [
  { value: "note", label: "Nota", icon: StickyNote },
  { value: "call", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Video },
  { value: "contact", label: "Contato", icon: UserCheck },
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
    case "contact":
      return { icon: UserCheck, bgColor: "bg-cyan-500", textColor: "text-cyan-500", label: "Contato" };
    case "status_change":
      return { icon: Clock, bgColor: "bg-slate-500", textColor: "text-slate-500", label: "Status" };
    default:
      return { icon: StickyNote, bgColor: "bg-muted", textColor: "text-muted-foreground", label: "Evento" };
  }
};

export function LeadTimeline({ leadId, className }: LeadTimelineProps) {
  const [events, setEvents] = useState<LeadTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [eventType, setEventType] = useState("note");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null; account_id?: string } | null>(null);

  useEffect(() => {
    fetchEvents();
    fetchCurrentUser();
  }, [leadId]);

  const fetchCurrentUser = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, account_id")
      .single();
    if (data) setCurrentUser(data);
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_timeline")
      .select(`
        *,
        user:users(name, avatar_url)
      `)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching timeline:", error);
    } else {
      setEvents((data || []) as LeadTimelineEvent[]);
    }
    setLoading(false);
  };

  const handleAddEvent = async () => {
    if (!newNote.trim() || !currentUser?.account_id) return;

    setSubmitting(true);
    try {
      const selectedType = EVENT_TYPES.find(t => t.value === eventType);
      const { error } = await supabase.from("lead_timeline").insert({
        account_id: currentUser.account_id,
        lead_id: leadId,
        event_type: eventType,
        title: selectedType?.label || "Nota",
        description: newNote.trim(),
        user_id: currentUser.id,
      });

      if (error) throw error;

      setNewNote("");
      setEventType("note");
      fetchEvents();
      toast.success("Evento adicionado!");
    } catch (error: any) {
      console.error("Error adding event:", error);
      toast.error("Erro ao adicionar evento");
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Add new event */}
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2">
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
          placeholder="Descreva a interação com o lead..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleAddEvent}
            disabled={!newNote.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Adicionar
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum evento registrado ainda
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const config = getEventConfig(event.event_type);
            const Icon = config.icon;
            const userName = event.user?.name || "Usuário";
            const userAvatar = event.user?.avatar_url;

            return (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0", config.bgColor)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="w-px flex-1 bg-border mt-2" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={userAvatar || undefined} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{userName}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className={cn("text-xs font-medium", config.textColor)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(event.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}