import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  Phone,
  Loader2,
  ArrowLeft,
  RefreshCw
} from "lucide-react";

interface SupportTicket {
  id: string;
  account_id: string;
  client_phone: string;
  client_name: string | null;
  status: string;
  priority: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
  account?: { name: string };
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  message_type: string;
  created_at: string;
}

const STATUS_CONFIG = {
  open: { label: "Aberto", color: "bg-blue-500", icon: AlertCircle },
  in_progress: { label: "Em Andamento", color: "bg-yellow-500", icon: Clock },
  resolved: { label: "Resolvido", color: "bg-green-500", icon: CheckCircle2 },
  closed: { label: "Fechado", color: "bg-gray-500", icon: CheckCircle2 }
};

const PRIORITY_CONFIG = {
  low: { label: "Baixa", color: "text-gray-500" },
  normal: { label: "Normal", color: "text-blue-500" },
  high: { label: "Alta", color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" }
};

export function SupportTicketsManager() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch tickets
  const { data: tickets = [], isLoading: loadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["support-tickets", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          account:accounts(name)
        `)
        .order("updated_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    }
  });

  // Fetch messages for selected ticket
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["support-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: !!selectedTicket
  });

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`support-messages-${selectedTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedTicket.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket, queryClient]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedTicket) throw new Error("No ticket selected");

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_type: "admin",
        sender_id: userData?.id,
        content,
        message_type: "text"
      });

      if (error) throw error;

      // Update ticket status to in_progress if it was open
      if (selectedTicket.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", selectedTicket.id);
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: () => {
      toast.error("Erro ao enviar mensagem");
    }
  });

  // Update ticket status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      if (selectedTicket) {
        setSelectedTicket({
          ...selectedTicket,
          status: updateStatusMutation.variables?.status || selectedTicket.status
        });
      }
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    }
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  const openTickets = tickets.filter(t => t.status === "open").length;
  const inProgressTickets = tickets.filter(t => t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{tickets.length}</p>
              </div>
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Abertos</p>
                <p className="text-2xl font-bold text-blue-500">{openTickets}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-yellow-500">{inProgressTickets}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resolvidos</p>
                <p className="text-2xl font-bold text-green-500">
                  {tickets.filter(t => t.status === "resolved" || t.status === "closed").length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tickets List */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-medium">Tickets</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => refetchTickets()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>

            <ScrollArea className="h-[500px]">
              {loadingTickets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum ticket encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => {
                    const StatusIcon = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG]?.icon || AlertCircle;
                    return (
                      <div
                        key={ticket.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTicket?.id === ticket.id
                            ? "bg-accent border-primary"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG]?.color.replace('bg-', 'text-')}`} />
                            <span className="font-medium text-sm truncate max-w-[150px]">
                              {ticket.client_name || ticket.client_phone}
                            </span>
                          </div>
                          <Badge variant="outline" className={`text-xs ${PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG]?.color}`}>
                            {PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG]?.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">
                          {ticket.subject || "Sem assunto"}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {ticket.account?.name || "—"}
                          </span>
                          <span>
                            {format(new Date(ticket.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <>
              <CardHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      onClick={() => setSelectedTicket(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {selectedTicket.client_name || "Cliente"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedTicket.client_phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {selectedTicket.account?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(status) =>
                        updateStatusMutation.mutate({ ticketId: selectedTicket.id, status })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                        <SelectItem value="resolved">Resolvido</SelectItem>
                        <SelectItem value="closed">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[500px]">
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma mensagem ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.sender_type === "admin" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              message.sender_type === "admin"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                message.sender_type === "admin"
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Digite sua resposta..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[60px] max-h-[120px]"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      className="self-end"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[600px] text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione um ticket</p>
                <p className="text-sm">Escolha um ticket na lista para ver as mensagens</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
