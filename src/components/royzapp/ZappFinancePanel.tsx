import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, differenceInDays, isPast, isToday, addDays } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  ExternalLink,
  Clock,
  ChevronRight,
  Search,
  Loader2,
  User,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ZappFinancePanelProps {
  sectorId?: string;
}

interface FinancialEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  entry_type: "income" | "expense";
  client_id: string | null;
  supplier_id: string | null;
  clients?: { full_name: string } | null;
  suppliers?: { name: string } | null;
}

interface DelinquentClient {
  client_id: string;
  client_name: string;
  total_overdue: number;
  oldest_due_date: string;
  overdue_count: number;
}

export function ZappFinancePanel({ sectorId }: ZappFinancePanelProps) {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"receivables" | "payables" | "delinquent">("receivables");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch receivables (income entries pending)
  const { data: receivables = [], isLoading: receivablesLoading } = useQuery({
    queryKey: ["receivables-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          id, description, amount, due_date, status, entry_type, client_id, supplier_id,
          clients (full_name)
        `)
        .eq("entry_type", "income")
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data as FinancialEntry[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Fetch payables (expense entries pending)
  const { data: payables = [], isLoading: payablesLoading } = useQuery({
    queryKey: ["payables-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          id, description, amount, due_date, status, entry_type, client_id, supplier_id,
          suppliers (name)
        `)
        .eq("entry_type", "expense")
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data as FinancialEntry[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Calculate delinquent clients from receivables
  const delinquentClients = useMemo(() => {
    const now = new Date();
    const overdueByClient = new Map<string, DelinquentClient>();
    
    receivables
      .filter(r => r.client_id && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date)))
      .forEach(r => {
        const existing = overdueByClient.get(r.client_id!);
        if (existing) {
          existing.total_overdue += r.amount;
          existing.overdue_count += 1;
          if (new Date(r.due_date) < new Date(existing.oldest_due_date)) {
            existing.oldest_due_date = r.due_date;
          }
        } else {
          overdueByClient.set(r.client_id!, {
            client_id: r.client_id!,
            client_name: r.clients?.full_name || "Cliente",
            total_overdue: r.amount,
            oldest_due_date: r.due_date,
            overdue_count: 1,
          });
        }
      });
    
    return Array.from(overdueByClient.values())
      .sort((a, b) => b.total_overdue - a.total_overdue);
  }, [receivables]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const next7Days = addDays(now, 7);
    
    const receivablesDue = receivables.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate <= next7Days;
    });
    
    const payablesDue = payables.filter(p => {
      const dueDate = new Date(p.due_date);
      return dueDate <= next7Days;
    });
    
    return {
      totalReceivables: receivables.reduce((sum, r) => sum + r.amount, 0),
      totalPayables: payables.reduce((sum, p) => sum + p.amount, 0),
      receivablesDueCount: receivablesDue.length,
      payablesDueCount: payablesDue.length,
      delinquentCount: delinquentClients.length,
      totalDelinquent: delinquentClients.reduce((sum, d) => sum + d.total_overdue, 0),
    };
  }, [receivables, payables, delinquentClients]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getDaysOverdue = (dueDate: string) => {
    const days = differenceInDays(new Date(), new Date(dueDate));
    return days > 0 ? days : 0;
  };

  const getDueDateBadge = (dueDate: string) => {
    const date = new Date(dueDate);
    const daysOverdue = getDaysOverdue(dueDate);
    
    if (isToday(date)) {
      return <Badge className="bg-amber-500 text-white text-[10px]">Hoje</Badge>;
    }
    if (isPast(date)) {
      return <Badge variant="destructive" className="text-[10px]">{daysOverdue}d atraso</Badge>;
    }
    const daysUntil = differenceInDays(date, new Date());
    if (daysUntil <= 7) {
      return <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">{daysUntil}d</Badge>;
    }
    return null;
  };

  // Filter entries
  const filteredReceivables = useMemo(() => 
    receivables.filter(r => 
      !searchQuery || 
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.clients?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [receivables, searchQuery]);

  const filteredPayables = useMemo(() => 
    payables.filter(p => 
      !searchQuery || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [payables, searchQuery]);

  const filteredDelinquent = useMemo(() => 
    delinquentClients.filter(d => 
      !searchQuery || d.client_name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [delinquentClients, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-zapp-accent" />
            <span className="font-medium text-zapp-text">Financeiro</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs"
            onClick={() => navigate("/financial")}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Card className="p-2 bg-zapp-panel border-zapp-border">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <div>
                <p className="text-xs font-bold text-green-500">{formatCurrency(stats.totalReceivables)}</p>
                <p className="text-[9px] text-zapp-text-muted">A receber</p>
              </div>
            </div>
          </Card>
          <Card className="p-2 bg-zapp-panel border-zapp-border">
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="h-3 w-3 text-red-500" />
              <div>
                <p className="text-xs font-bold text-red-500">{formatCurrency(stats.totalPayables)}</p>
                <p className="text-[9px] text-zapp-text-muted">A pagar</p>
              </div>
            </div>
          </Card>
          <Card className="p-2 bg-zapp-panel border-zapp-border">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <div>
                <p className="text-xs font-bold text-amber-500">{stats.delinquentCount}</p>
                <p className="text-[9px] text-zapp-text-muted">Inadimplentes</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 h-8 text-sm bg-zapp-panel border-zapp-border text-zapp-text"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full h-8 bg-zapp-panel">
            <TabsTrigger value="receivables" className="flex-1 h-6 text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Receber
            </TabsTrigger>
            <TabsTrigger value="payables" className="flex-1 h-6 text-xs">
              <TrendingDown className="h-3 w-3 mr-1" />
              Pagar
            </TabsTrigger>
            <TabsTrigger value="delinquent" className="flex-1 h-6 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Atraso
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === "receivables" && (
          <div className="p-3">
            {receivablesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
              </div>
            ) : filteredReceivables.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum recebível pendente
              </div>
            ) : (
              <div className="space-y-2">
                {filteredReceivables.map(entry => (
                  <Card 
                    key={entry.id} 
                    className="p-3 bg-zapp-panel border-zapp-border cursor-pointer hover:bg-zapp-panel/80"
                    onClick={() => navigate(`/financial?entry=${entry.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-sm text-zapp-text truncate">{entry.description}</p>
                          {getDueDateBadge(entry.due_date)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zapp-text-muted">
                          {entry.clients?.full_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.clients.full_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(entry.due_date), "dd/MM", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <p className="font-bold text-sm text-green-500 flex-shrink-0">
                        {formatCurrency(entry.amount)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "payables" && (
          <div className="p-3">
            {payablesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
              </div>
            ) : filteredPayables.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum pagável pendente
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPayables.map(entry => (
                  <Card 
                    key={entry.id} 
                    className="p-3 bg-zapp-panel border-zapp-border cursor-pointer hover:bg-zapp-panel/80"
                    onClick={() => navigate(`/financial?entry=${entry.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-sm text-zapp-text truncate">{entry.description}</p>
                          {getDueDateBadge(entry.due_date)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zapp-text-muted">
                          {entry.suppliers?.name && (
                            <span className="truncate">{entry.suppliers.name}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(entry.due_date), "dd/MM", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <p className="font-bold text-sm text-red-500 flex-shrink-0">
                        {formatCurrency(entry.amount)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "delinquent" && (
          <div className="p-3">
            {filteredDelinquent.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum cliente inadimplente 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDelinquent.map(client => (
                  <Card 
                    key={client.client_id} 
                    className="p-3 bg-zapp-panel border-zapp-border cursor-pointer hover:bg-zapp-panel/80"
                    onClick={() => navigate(`/clients/${client.client_id}?tab=financial`)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-red-500/20 text-red-500">
                          {client.client_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-zapp-text truncate">{client.client_name}</p>
                        <div className="flex items-center gap-2 text-xs text-zapp-text-muted">
                          <Badge variant="destructive" className="text-[10px]">
                            {getDaysOverdue(client.oldest_due_date)}d atraso
                          </Badge>
                          <span>{client.overdue_count} título(s)</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm text-red-500">{formatCurrency(client.total_overdue)}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
