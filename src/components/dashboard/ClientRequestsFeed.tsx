import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MessageSquare, 
  AlertTriangle, 
  HelpCircle, 
  Clock, 
  CheckCircle2,
  User,
  Radio,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  MoreVertical,
  Loader2
} from "lucide-react";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  client_name: string | null;
  client_phone: string;
  subject: string | null;
  status: string;
  priority: string | null;
  needs_human_attention: boolean;
  escalation_reason: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
}

interface CategoryCount {
  category: string;
  count: number;
  percentage: number;
}

// Updated status configuration with new logic
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  open: { label: "Aberto", color: "text-blue-600", bgColor: "bg-blue-500/10", icon: Clock },
  needs_attention: { label: "Requer Atenção", color: "text-destructive", bgColor: "bg-destructive/10", icon: AlertTriangle },
  in_progress: { label: "Em Andamento", color: "text-yellow-600", bgColor: "bg-yellow-500/10", icon: MessageSquare },
  resolved: { label: "Finalizada", color: "text-green-600", bgColor: "bg-green-500/10", icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Baixa", variant: "secondary" },
  normal: { label: "Normal", variant: "default" },
  medium: { label: "Média", variant: "default" },
  high: { label: "Alta", variant: "destructive" },
  urgent: { label: "Urgente", variant: "destructive" },
};

const categorizeTicket = (subject: string | null): string => {
  if (!subject) return "Outros";
  const lowerSubject = subject.toLowerCase();
  
  if (lowerSubject.includes("pagamento") || lowerSubject.includes("cobrança") || lowerSubject.includes("boleto") || lowerSubject.includes("fatura")) {
    return "Financeiro";
  }
  if (lowerSubject.includes("acesso") || lowerSubject.includes("login") || lowerSubject.includes("senha")) {
    return "Acesso";
  }
  if (lowerSubject.includes("erro") || lowerSubject.includes("bug") || lowerSubject.includes("problema")) {
    return "Problemas Técnicos";
  }
  if (lowerSubject.includes("cancelar") || lowerSubject.includes("cancelamento")) {
    return "Cancelamento";
  }
  if (lowerSubject.includes("dúvida") || lowerSubject.includes("como") || lowerSubject.includes("ajuda")) {
    return "Dúvidas";
  }
  if (lowerSubject.includes("agendar") || lowerSubject.includes("reunião") || lowerSubject.includes("horário")) {
    return "Agendamento";
  }
  if (lowerSubject.includes("contrato") || lowerSubject.includes("renovar") || lowerSubject.includes("upgrade")) {
    return "Contrato";
  }
  if (lowerSubject.includes("feedback") || lowerSubject.includes("sugestão") || lowerSubject.includes("reclamação")) {
    return "Feedback";
  }
  return "Outros";
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Financeiro: TrendingUp,
  Acesso: User,
  "Problemas Técnicos": AlertTriangle,
  Cancelamento: AlertTriangle,
  Dúvidas: HelpCircle,
  Agendamento: Clock,
  Contrato: MessageSquare,
  Feedback: MessageSquare,
  Outros: MessageSquare,
};

// Calculate effective status based on ticket data
const getEffectiveStatus = (ticket: SupportTicket): string => {
  // If already resolved, keep it
  if (ticket.status === "resolved") return "resolved";
  
  // If marked as needs_attention in DB
  if (ticket.status === "needs_attention") return "needs_attention";
  
  // If in_progress, check if needs attention (>24h without update)
  if (ticket.status === "in_progress") {
    const hoursSinceUpdate = differenceInHours(new Date(), new Date(ticket.updated_at));
    if (hoursSinceUpdate > 24 && !ticket.first_response_at) {
      return "needs_attention";
    }
    return "in_progress";
  }
  
  // For open tickets, check if needs attention
  if (ticket.status === "open") {
    const hoursSinceCreated = differenceInHours(new Date(), new Date(ticket.created_at));
    if (hoursSinceCreated > 24 || ticket.needs_human_attention) {
      return "needs_attention";
    }
    return "open";
  }
  
  return ticket.status;
};

export function ClientRequestsFeed() {
  const { currentUser } = useCurrentUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryStats, setCategoryStats] = useState<CategoryCount[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [aiProcessingTicketId, setAiProcessingTicketId] = useState<string | null>(null);

  const fetchTickets = async () => {
    if (!currentUser?.account_id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("account_id", currentUser.account_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tickets:", error);
      setLoading(false);
      return;
    }

    setTickets(data || []);
    
    // Calculate category stats
    const categoryCounts: Record<string, number> = {};
    (data || []).forEach(ticket => {
      const category = categorizeTicket(ticket.subject);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const total = data?.length || 1;
    const stats: CategoryCount[] = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    setCategoryStats(stats);
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, [currentUser?.account_id]);

  // Real-time subscription
  useEffect(() => {
    if (!currentUser?.account_id) return;

    const channel = supabase
      .channel("support-tickets-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
          filter: `account_id=eq.${currentUser.account_id}`,
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.account_id]);

  // Update ticket status manually
  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    setUpdatingTicketId(ticketId);
    
    const updateData: Record<string, any> = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    
    // If resolving, set resolved_at
    if (newStatus === "resolved") {
      updateData.resolved_at = new Date().toISOString();
    }
    
    // If responding for first time
    if (newStatus === "in_progress") {
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && !ticket.first_response_at) {
        updateData.first_response_at = new Date().toISOString();
      }
    }

    const { error } = await supabase
      .from("support_tickets")
      .update(updateData)
      .eq("id", ticketId);

    if (error) {
      console.error("Error updating ticket:", error);
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Status atualizado para "${STATUS_CONFIG[newStatus]?.label || newStatus}"`);
      fetchTickets();
    }
    
    setUpdatingTicketId(null);
  };

  // AI-based status suggestion
  const suggestStatusWithAI = async (ticket: SupportTicket) => {
    setAiProcessingTicketId(ticket.id);
    
    try {
      const response = await supabase.functions.invoke("analyze-ticket-status", {
        body: {
          ticketId: ticket.id,
          subject: ticket.subject,
          createdAt: ticket.created_at,
          updatedAt: ticket.updated_at,
          currentStatus: ticket.status,
          firstResponseAt: ticket.first_response_at,
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const suggestedStatus = response.data?.suggestedStatus;
      if (suggestedStatus && suggestedStatus !== ticket.status) {
        await updateTicketStatus(ticket.id, suggestedStatus);
        toast.success(`IA atualizou o status para "${STATUS_CONFIG[suggestedStatus]?.label || suggestedStatus}"`);
      } else {
        toast.info("IA analisou e o status atual está correto");
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      // Fallback: use local logic
      const effectiveStatus = getEffectiveStatus(ticket);
      if (effectiveStatus !== ticket.status) {
        await updateTicketStatus(ticket.id, effectiveStatus);
        toast.success(`Status atualizado automaticamente para "${STATUS_CONFIG[effectiveStatus]?.label}"`);
      } else {
        toast.info("Status atual está correto");
      }
    }
    
    setAiProcessingTicketId(null);
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      (ticket.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       ticket.client_phone.includes(searchQuery) ||
       ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const effectiveStatus = getEffectiveStatus(ticket);
    const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter;
    const matchesCategory = categoryFilter === "all" || categorizeTicket(ticket.subject) === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Stats with effective status
  const stats = {
    open: tickets.filter(t => getEffectiveStatus(t) === "open").length,
    needsAttention: tickets.filter(t => getEffectiveStatus(t) === "needs_attention").length,
    inProgress: tickets.filter(t => getEffectiveStatus(t) === "in_progress").length,
    resolved: tickets.filter(t => getEffectiveStatus(t) === "resolved").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary animate-pulse" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Central de Suporte</h2>
          <Badge variant="secondary" className="text-xs">
            Tempo real
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abertos</p>
                <p className="text-2xl font-bold">{stats.open}</p>
              </div>
              <div className="p-2 rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter(statusFilter === "needs_attention" ? "all" : "needs_attention")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Requer Atenção</p>
                <p className="text-2xl font-bold text-destructive">{stats.needsAttention}</p>
              </div>
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <div className="p-2 rounded-full bg-yellow-500/10">
                <MessageSquare className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter(statusFilter === "resolved" ? "all" : "resolved")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Finalizadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              </div>
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Stats */}
      {categoryStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tipos mais frequentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categoryStats.map((stat) => {
                const Icon = CATEGORY_ICONS[stat.category] || MessageSquare;
                return (
                  <button
                    key={stat.category}
                    onClick={() => setCategoryFilter(categoryFilter === stat.category ? "all" : stat.category)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-colors ${
                      categoryFilter === stat.category 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-medium">{stat.category}</span>
                    <span className={categoryFilter === stat.category ? "opacity-80" : "text-muted-foreground"}>
                      ({stat.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou assunto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="needs_attention">Requer Atenção</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="resolved">Finalizadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Todas as solicitações</CardTitle>
            <Badge variant="secondary">{filteredTickets.length} tickets</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {tickets.length === 0 
                  ? "Nenhuma solicitação recebida ainda" 
                  : "Nenhuma solicitação encontrada com os filtros aplicados"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => {
                const effectiveStatus = getEffectiveStatus(ticket);
                const status = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.open;
                const priority = ticket.priority ? PRIORITY_CONFIG[ticket.priority] : null;
                const category = categorizeTicket(ticket.subject);
                const CategoryIcon = CATEGORY_ICONS[category] || MessageSquare;
                const StatusIcon = status.icon;
                const isUpdating = updatingTicketId === ticket.id;
                const isAiProcessing = aiProcessingTicketId === ticket.id;

                return (
                  <div
                    key={ticket.id}
                    className={`relative flex items-start gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/30 ${
                      effectiveStatus === "needs_attention" ? "border-destructive/50 bg-destructive/5" : ""
                    }`}
                  >
                    {/* Live indicator for recent tickets */}
                    {new Date().getTime() - new Date(ticket.created_at).getTime() < 300000 && (
                      <div className="absolute top-3 right-12">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                      </div>
                    )}

                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute top-2 right-2 h-8 w-8"
                          disabled={isUpdating || isAiProcessing}
                        >
                          {isUpdating || isAiProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => suggestStatusWithAI(ticket)}
                          className="gap-2"
                        >
                          <Sparkles className="h-4 w-4 text-primary" />
                          Analisar com IA
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateTicketStatus(ticket.id, "open")}
                          disabled={effectiveStatus === "open"}
                          className="gap-2"
                        >
                          <Clock className="h-4 w-4 text-blue-500" />
                          Marcar como Aberto
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateTicketStatus(ticket.id, "in_progress")}
                          disabled={effectiveStatus === "in_progress"}
                          className="gap-2"
                        >
                          <MessageSquare className="h-4 w-4 text-yellow-500" />
                          Marcar Em Andamento
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateTicketStatus(ticket.id, "resolved")}
                          disabled={effectiveStatus === "resolved"}
                          className="gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Marcar como Finalizada
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className={`flex-shrink-0 p-2.5 rounded-full ${status.bgColor}`}>
                      <CategoryIcon className={`h-5 w-5 ${status.color}`} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2 pr-10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {ticket.client_name || ticket.client_phone}
                        </span>
                        {effectiveStatus === "needs_attention" && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Requer Atenção
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {ticket.subject || "Sem assunto"}
                      </p>

                      {ticket.escalation_reason && (
                        <p className="text-xs text-destructive/80 italic bg-destructive/5 p-2 rounded">
                          {ticket.escalation_reason}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${status.bgColor}`}>
                          <StatusIcon className={`h-3 w-3 ${status.color}`} />
                          <span className={status.color}>{status.label}</span>
                        </div>
                        {priority && (
                          <Badge variant={priority.variant} className="text-xs">
                            {priority.label}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {category}
                        </Badge>
                        <span className="text-muted-foreground ml-auto">
                          {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          {" · "}
                          {formatDistanceToNow(new Date(ticket.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
