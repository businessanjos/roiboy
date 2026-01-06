import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Briefcase, 
  Plus, 
  DollarSign,
  ExternalLink,
  ArrowRight,
  User,
  Phone,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ZappCRMPanelProps {
  conversationPhone?: string | null;
  conversationClientId?: string | null;
  conversationLeadId?: string | null;
  conversationContactName?: string | null;
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
  status: string;
  created_at: string;
}

interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
}

export function ZappCRMPanel({ 
  conversationPhone, 
  conversationClientId, 
  conversationLeadId,
  conversationContactName 
}: ZappCRMPanelProps) {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");

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

  // Fetch lead info if we have a lead_id
  const { data: leadInfo, isLoading: leadLoading } = useQuery({
    queryKey: ["lead-info-zapp", conversationLeadId],
    queryFn: async () => {
      if (!conversationLeadId) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, phone, email, status")
        .eq("id", conversationLeadId)
        .maybeSingle();
      if (error) throw error;
      return data as Lead | null;
    },
    enabled: !!conversationLeadId,
  });

  // Fetch deals for this lead/client
  const { data: deals = [], isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ["contact-deals-zapp", conversationLeadId, conversationClientId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("id, title, value, stage_id, status, created_at")
        .neq("status", "lost")
        .order("created_at", { ascending: false });

      if (conversationLeadId) {
        query = query.eq("lead_id", conversationLeadId);
      } else if (conversationClientId) {
        query = query.eq("client_id", conversationClientId);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!(conversationLeadId || conversationClientId),
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
      refetchDeals();
      toast.success("Negócio movido!");
    },
  });

  // Create deal mutation
  const createDeal = useMutation({
    mutationFn: async () => {
      if (!currentUser?.account_id || !stages[0]) throw new Error("Dados insuficientes");
      
      const { error } = await supabase
        .from("deals")
        .insert({
          account_id: currentUser.account_id,
          title: newDealTitle || conversationContactName || "Novo negócio",
          value: parseFloat(newDealValue.replace(/\D/g, "")) / 100 || 0,
          stage_id: stages[0].id,
          lead_id: conversationLeadId || null,
          client_id: conversationClientId || null,
          status: "open",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDeals();
      setShowCreateDeal(false);
      setNewDealTitle("");
      setNewDealValue("");
      toast.success("Negócio criado!");
    },
    onError: () => {
      toast.error("Erro ao criar negócio");
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCurrencyInput = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (numericValue) {
      const formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(parseInt(numericValue) / 100);
      setNewDealValue(formatted);
    } else {
      setNewDealValue("");
    }
  };

  const isLoading = leadLoading || dealsLoading;
  const hasContact = conversationLeadId || conversationClientId;
  const activeDeal = deals.find(d => d.status === "open");

  if (!hasContact) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-zapp-accent" />
            <span className="font-medium text-zapp-text">CRM</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-zapp-text-muted">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Selecione uma conversa com lead ou cliente para ver o CRM</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
        <div className="flex items-center justify-between">
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
            Pipeline
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Contact Info */}
          <Card className="p-3 bg-zapp-panel border-zapp-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zapp-accent/20 flex items-center justify-center">
                <User className="h-5 w-5 text-zapp-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zapp-text truncate">
                  {conversationContactName || leadInfo?.full_name || "Contato"}
                </p>
                <div className="flex items-center gap-2 text-xs text-zapp-text-muted">
                  <Phone className="h-3 w-3" />
                  <span>{conversationPhone || leadInfo?.phone || "-"}</span>
                </div>
              </div>
              {conversationLeadId && (
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">
                  Lead
                </Badge>
              )}
              {conversationClientId && (
                <Badge variant="outline" className="text-[10px] border-green-500 text-green-500">
                  Cliente
                </Badge>
              )}
            </div>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
            </div>
          ) : activeDeal ? (
            /* Active Deal Card */
            <Card className="p-3 bg-zapp-panel border-zapp-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-zapp-text">Negócio Ativo</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => navigate(`/sales?deal=${activeDeal.id}`)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ver
                </Button>
              </div>

              <div className="mb-3">
                <p className="font-medium text-zapp-text truncate">{activeDeal.title}</p>
                <p className="text-lg font-bold text-zapp-accent">{formatCurrency(activeDeal.value)}</p>
              </div>

              {/* Stage selector */}
              <div className="space-y-2">
                <Label className="text-xs text-zapp-text-muted">Mover para estágio:</Label>
                <div className="flex flex-wrap gap-1">
                  {stages.map(stage => {
                    const isActive = stage.id === activeDeal.stage_id;
                    return (
                      <Button
                        key={stage.id}
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className={cn(
                          "h-7 text-xs px-2",
                          isActive && "pointer-events-none"
                        )}
                        style={isActive ? { backgroundColor: stage.color } : { borderColor: stage.color, color: stage.color }}
                        onClick={() => {
                          if (!isActive) {
                            moveDeal.mutate({ dealId: activeDeal.id, stageId: stage.id });
                          }
                        }}
                        disabled={moveDeal.isPending}
                      >
                        {stage.name}
                        {isActive && <CheckCircle className="h-3 w-3 ml-1" />}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </Card>
          ) : showCreateDeal ? (
            /* Create Deal Form */
            <Card className="p-3 bg-zapp-panel border-zapp-border">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="h-4 w-4 text-zapp-accent" />
                <span className="text-sm font-medium text-zapp-text">Criar Negócio</span>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-zapp-text-muted">Título</Label>
                  <Input
                    value={newDealTitle}
                    onChange={(e) => setNewDealTitle(e.target.value)}
                    placeholder={conversationContactName || "Nome do negócio"}
                    className="h-8 text-sm bg-zapp-bg border-zapp-border text-zapp-text mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs text-zapp-text-muted">Valor</Label>
                  <Input
                    value={newDealValue}
                    onChange={(e) => handleCurrencyInput(e.target.value)}
                    placeholder="R$ 0,00"
                    className="h-8 text-sm bg-zapp-bg border-zapp-border text-zapp-text mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8"
                    onClick={() => setShowCreateDeal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => createDeal.mutate()}
                    disabled={createDeal.isPending}
                  >
                    {createDeal.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Criar"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            /* No active deal - show create button */
            <Card className="p-4 bg-zapp-panel border-zapp-border border-dashed">
              <div className="text-center">
                <Briefcase className="h-8 w-8 mx-auto mb-2 text-zapp-text-muted opacity-50" />
                <p className="text-sm text-zapp-text-muted mb-3">
                  Nenhum negócio ativo para este contato
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowCreateDeal(true)}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Criar Negócio
                </Button>
              </div>
            </Card>
          )}

          {/* Past deals (won) */}
          {deals.filter(d => d.status === "won").length > 0 && (
            <div>
              <p className="text-xs text-zapp-text-muted mb-2">Negócios ganhos</p>
              <div className="space-y-2">
                {deals.filter(d => d.status === "won").map(deal => (
                  <Card 
                    key={deal.id}
                    className="p-2 bg-zapp-panel/50 border-zapp-border cursor-pointer hover:bg-zapp-panel"
                    onClick={() => navigate(`/sales?deal=${deal.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zapp-text truncate">{deal.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-500 font-medium">{formatCurrency(deal.value)}</span>
                        <Badge className="text-[10px] bg-green-500/20 text-green-500">Ganho</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
