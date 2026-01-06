import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Briefcase, 
  Users, 
  Plus, 
  Search, 
  ChevronRight,
  Phone,
  Mail,
  DollarSign,
  ArrowRight,
  GripVertical,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ZappCRMPanelProps {
  conversationPhone?: string | null;
  conversationClientId?: string | null;
  conversationLeadId?: string | null;
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
  lead_id: string | null;
  client_id: string | null;
  created_at: string;
  leads?: { full_name: string; phone: string | null } | null;
  clients?: { full_name: string; phone_e164: string | null } | null;
}

interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  created_at: string;
  responsible_user_id: string | null;
}

export function ZappCRMPanel({ conversationPhone, conversationClientId, conversationLeadId }: ZappCRMPanelProps) {
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"kanban" | "leads">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>("all");

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

  // Fetch deals
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ["deals-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          id, title, value, stage_id, lead_id, client_id, created_at,
          leads (full_name, phone),
          clients (full_name, phone_e164)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, phone, email, source, status, created_at, responsible_user_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!currentUser?.account_id,
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
      queryClient.invalidateQueries({ queryKey: ["deals-zapp"] });
      toast.success("Negócio movido!");
    },
  });

  // Filter deals by search and stage
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const matchesSearch = !searchQuery || 
        deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.leads?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.clients?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStage = selectedStageFilter === "all" || deal.stage_id === selectedStageFilter;
      
      return matchesSearch && matchesStage;
    });
  }, [deals, searchQuery, selectedStageFilter]);

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      return !searchQuery || 
        lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.includes(searchQuery) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [leads, searchQuery]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = filteredDeals.filter(d => d.stage_id === stage.id);
    });
    return grouped;
  }, [filteredDeals, stages]);

  // Stats
  const stats = useMemo(() => ({
    totalDeals: deals.length,
    totalValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
    totalLeads: leads.length,
    newLeadsToday: leads.filter(l => 
      new Date(l.created_at).toDateString() === new Date().toDateString()
    ).length,
  }), [deals, leads]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getContactName = (deal: Deal) => deal.leads?.full_name || deal.clients?.full_name || "Sem contato";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-zapp-accent" />
            <span className="font-medium text-zapp-text">CRM</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs"
            onClick={() => navigate("/sales")}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card className="p-2 bg-zapp-panel border-zapp-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-lg font-bold text-zapp-text">{stats.totalDeals}</p>
                <p className="text-[10px] text-zapp-text-muted">Negócios</p>
              </div>
            </div>
          </Card>
          <Card className="p-2 bg-zapp-panel border-zapp-border">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-zapp-accent" />
              <div>
                <p className="text-lg font-bold text-zapp-text">{formatCurrency(stats.totalValue)}</p>
                <p className="text-[10px] text-zapp-text-muted">Pipeline</p>
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
          <TabsList className="grid grid-cols-2 w-full h-8 bg-zapp-panel p-0.5">
            <TabsTrigger value="kanban" className="h-6 text-xs px-2 gap-1">
              <Briefcase className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Negócios</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="h-6 text-xs px-2 gap-1">
              <Users className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Leads</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === "kanban" ? (
          <div className="p-3">
            {/* Stage filter chips */}
            <div className="flex gap-1 flex-wrap mb-3">
              <Badge
                variant={selectedStageFilter === "all" ? "default" : "outline"}
                className="cursor-pointer text-[10px]"
                onClick={() => setSelectedStageFilter("all")}
              >
                Todos
              </Badge>
              {stages.map(stage => (
                <Badge
                  key={stage.id}
                  variant={selectedStageFilter === stage.id ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  style={selectedStageFilter === stage.id ? { backgroundColor: stage.color } : { borderColor: stage.color, color: stage.color }}
                  onClick={() => setSelectedStageFilter(stage.id)}
                >
                  {stage.name} ({dealsByStage[stage.id]?.length || 0})
                </Badge>
              ))}
            </div>

            {/* Deals list */}
            {dealsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-zapp-accent border-t-transparent rounded-full" />
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum negócio encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDeals.map(deal => {
                  const stage = stages.find(s => s.id === deal.stage_id);
                  return (
                    <Card 
                      key={deal.id} 
                      className="p-3 bg-zapp-panel border-zapp-border cursor-pointer hover:bg-zapp-panel/80"
                      onClick={() => navigate(`/sales?deal=${deal.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              className="text-[10px] px-1.5 py-0"
                              style={{ backgroundColor: stage?.color || '#6b7280' }}
                            >
                              {stage?.name || "Sem estágio"}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm text-zapp-text truncate">{deal.title}</p>
                          <p className="text-xs text-zapp-text-muted">{getContactName(deal)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-sm text-zapp-accent">{formatCurrency(deal.value)}</p>
                          <p className="text-[10px] text-zapp-text-muted">
                            {format(new Date(deal.created_at), "dd/MM", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Quick stage move buttons */}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-zapp-border">
                        {stages.slice(0, 4).map(s => (
                          <Button
                            key={s.id}
                            size="sm"
                            variant={s.id === deal.stage_id ? "default" : "ghost"}
                            className="h-5 text-[10px] px-1.5 flex-1"
                            style={s.id === deal.stage_id ? { backgroundColor: s.color } : {}}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (s.id !== deal.stage_id) {
                                moveDeal.mutate({ dealId: deal.id, stageId: s.id });
                              }
                            }}
                          >
                            {s.name.slice(0, 8)}
                          </Button>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">
            {/* Leads list */}
            {leadsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-zapp-accent border-t-transparent rounded-full" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum lead encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map(lead => (
                  <Card 
                    key={lead.id} 
                    className="p-3 bg-zapp-panel border-zapp-border cursor-pointer hover:bg-zapp-panel/80"
                    onClick={() => navigate(`/leads?lead=${lead.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-zapp-accent/20 text-zapp-accent">
                          {lead.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm text-zapp-text truncate">{lead.full_name}</p>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              lead.status === "new" && "border-green-500 text-green-500",
                              lead.status === "contacted" && "border-blue-500 text-blue-500",
                              lead.status === "qualified" && "border-purple-500 text-purple-500",
                            )}
                          >
                            {lead.status === "new" ? "Novo" : 
                             lead.status === "contacted" ? "Contato" : 
                             lead.status === "qualified" ? "Qualificado" : lead.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zapp-text-muted">
                          {lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                          {lead.source && (
                            <span className="truncate">{lead.source}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zapp-text-muted flex-shrink-0" />
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
