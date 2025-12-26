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
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

interface CategoryCount {
  category: string;
  count: number;
  percentage: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: "Aberto", color: "bg-blue-500", icon: Clock },
  in_progress: { label: "Em andamento", color: "bg-yellow-500", icon: MessageSquare },
  resolved: { label: "Resolvido", color: "bg-green-500", icon: CheckCircle2 },
  closed: { label: "Fechado", color: "bg-muted", icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Baixa", variant: "secondary" },
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

export function ClientRequestsFeed() {
  const { currentUser } = useCurrentUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryStats, setCategoryStats] = useState<CategoryCount[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      (ticket.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       ticket.client_phone.includes(searchQuery) ||
       ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || categorizeTicket(ticket.subject) === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Stats
  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const needsAttentionCount = tickets.filter(t => t.needs_human_attention).length;

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
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
          <h2 className="text-lg font-semibold">Solicitações via WhatsApp</h2>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abertos</p>
                <p className="text-2xl font-bold">{openCount}</p>
              </div>
              <div className="p-2 rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold">{inProgressCount}</p>
              </div>
              <div className="p-2 rounded-full bg-yellow-500/10">
                <MessageSquare className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Requer Atenção</p>
                <p className="text-2xl font-bold text-destructive">{needsAttentionCount}</p>
              </div>
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
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
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
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
                const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const priority = ticket.priority ? PRIORITY_CONFIG[ticket.priority] : null;
                const category = categorizeTicket(ticket.subject);
                const CategoryIcon = CATEGORY_ICONS[category] || MessageSquare;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={ticket.id}
                    className={`relative flex items-start gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/30 ${
                      ticket.needs_human_attention ? "border-destructive/50 bg-destructive/5" : ""
                    }`}
                  >
                    {/* Live indicator for recent tickets */}
                    {new Date().getTime() - new Date(ticket.created_at).getTime() < 300000 && (
                      <div className="absolute top-3 right-3">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                      </div>
                    )}

                    <div className={`flex-shrink-0 p-2.5 rounded-full ${status.color}/10`}>
                      <CategoryIcon className={`h-5 w-5 ${status.color.replace("bg-", "text-")}`} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {ticket.client_name || ticket.client_phone}
                        </span>
                        {ticket.needs_human_attention && (
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
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50">
                          <StatusIcon className="h-3 w-3" />
                          <span>{status.label}</span>
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
