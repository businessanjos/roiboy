import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ArrowRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

// Common issue categories based on subject keywords
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

  const fetchTickets = async () => {
    if (!currentUser?.account_id) return;

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("account_id", currentUser.account_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching tickets:", error);
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle className="text-lg">Solicitações em Tempo Real</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Solicitações via WhatsApp</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <Link to="/requests">
              Ver todos
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
        <CardDescription>
          Problemas e solicitações dos clientes em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Stats */}
        {categoryStats.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Tipos mais frequentes</p>
            <div className="flex flex-wrap gap-2">
              {categoryStats.slice(0, 5).map((stat) => {
                const Icon = CATEGORY_ICONS[stat.category] || MessageSquare;
                return (
                  <div
                    key={stat.category}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 text-xs"
                  >
                    <Icon className="h-3 w-3" />
                    <span className="font-medium">{stat.category}</span>
                    <span className="text-muted-foreground">({stat.count})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tickets Feed */}
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma solicitação recebida ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Os tickets aparecerão aqui em tempo real
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-3">
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const priority = ticket.priority ? PRIORITY_CONFIG[ticket.priority] : null;
                const category = categorizeTicket(ticket.subject);
                const CategoryIcon = CATEGORY_ICONS[category] || MessageSquare;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={ticket.id}
                    className={`relative flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/30 ${
                      ticket.needs_human_attention ? "border-destructive/50 bg-destructive/5" : ""
                    }`}
                  >
                    {/* Live indicator for recent tickets */}
                    {new Date().getTime() - new Date(ticket.created_at).getTime() < 300000 && (
                      <div className="absolute top-2 right-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      </div>
                    )}

                    <div className={`flex-shrink-0 p-2 rounded-full ${status.color}/10`}>
                      <CategoryIcon className={`h-4 w-4 ${status.color.replace("bg-", "text-")}`} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {ticket.client_name || ticket.client_phone}
                        </span>
                        {ticket.needs_human_attention && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            Atenção
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.subject || "Sem assunto"}
                      </p>

                      {ticket.escalation_reason && (
                        <p className="text-xs text-destructive/80 italic">
                          {ticket.escalation_reason}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          <span>{status.label}</span>
                        </div>
                        {priority && (
                          <Badge variant={priority.variant} className="text-[10px] px-1.5 py-0">
                            {priority.label}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {category}
                        </Badge>
                        <span className="text-muted-foreground">
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
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
