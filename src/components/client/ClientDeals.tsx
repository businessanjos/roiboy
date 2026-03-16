import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLinkedClients, getLinkedClientName } from "@/hooks/useLinkedClients";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trophy,
  XCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { DealDetailSheet } from "@/components/sales/DealDetailSheet";
import { Deal as DealType, DealStage as DealStageType } from "@/hooks/useDeals";

interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: "open" | "won" | "lost";
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  stage?: {
    id: string;
    name: string;
    color: string;
  } | null;
  lead_id: string | null;
  responsible_user?: {
    id: string;
    name: string;
  } | null;
}

interface DealStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

interface ClientDealsProps {
  clientId: string;
  clientName?: string;
}

export function ClientDeals({ clientId, clientName }: ClientDealsProps) {
  const navigate = useNavigate();
  const { linkedClientIds, linkedClients, hasLinkedClients } = useLinkedClients(clientId);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Deal detail sheet state
  const [selectedDeal, setSelectedDeal] = useState<DealType | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);

  // Products for "Item da Venda"
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    value: "",
    stage_id: "",
    expected_close_date: "",
    source: "",
    notes: "",
  });

  useEffect(() => {
    if (linkedClientIds.length > 0) {
      fetchDeals();
    }
    fetchStages();
  }, [clientId, linkedClientIds]);

  // Load products when dialog opens
  useEffect(() => {
    const loadProducts = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", authUser.id)
        .single();
      
      if (!userData) return;
      
      const { data } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("account_id", userData.account_id)
        .eq("is_active", true)
        .order("name");
      
      setProducts(data || []);
    };
    
    if (isDialogOpen) {
      loadProducts();
    }
  }, [isDialogOpen]);

  const fetchStages = async () => {
    const { data } = await supabase
      .from("deal_stages")
      .select("id, name, color, display_order")
      .order("display_order");
    
    if (data) setStages(data);
  };

  const fetchDeals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("deals")
      .select(`
        *,
        stage:deal_stages(id, name, color),
        responsible_user:users!deals_responsible_user_id_fkey(id, name)
      `)
      .in("client_id", linkedClientIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deals:", error);
    } else {
      setDeals((data || []) as Deal[]);
    }
    setLoading(false);
  };

  const handleCreateDeal = async () => {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setCreating(true);
    try {
      // Buscar usuário autenticado primeiro
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");

      // Filtrar pelo auth_user_id para evitar erro de múltiplas linhas
      const { data: userData } = await supabase
        .from("users")
        .select("account_id, id")
        .eq("auth_user_id", authUser.id)
        .single();

      if (!userData) throw new Error("Perfil de usuário não encontrado");

      const firstStage = stages.sort((a, b) => a.display_order - b.display_order)[0];

      const { data: newDeal, error } = await supabase.from("deals").insert({
        account_id: userData.account_id,
        client_id: clientId,
        title: formData.title.trim(),
        value: formData.value ? parseFloat(formData.value) : 0,
        stage_id: formData.stage_id || firstStage?.id,
        expected_close_date: formData.expected_close_date || null,
        source: formData.source || null,
        notes: formData.notes || null,
        responsible_user_id: userData.id,
      }).select("id").single();

      if (error) throw error;

      // Persist product_id in deal_field_values if selected
      if (newDeal && selectedProductId && selectedProductId !== "__none__") {
        await supabase.from("deal_field_values").insert({
          deal_id: newDeal.id,
          field_id: "033b91fb-3add-4c96-aec9-567fefbd0fb2",
          account_id: userData.account_id,
          value_text: selectedProductId,
        });
      }

      toast.success("Negócio criado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        title: "",
        value: "",
        stage_id: "",
        expected_close_date: "",
        source: "",
        notes: "",
      });
      setSelectedProductId("");
      fetchDeals();
    } catch (error: any) {
      console.error("Error creating deal:", error);
      toast.error(error.message || "Erro ao criar negócio");
    } finally {
      setCreating(false);
    }
  };

  const openDeals = deals.filter((d) => d.status === "open");
  const wonDeals = deals.filter((d) => d.status === "won");
  const lostDeals = deals.filter((d) => d.status === "lost");

  const totalOpen = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const totalWon = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const totalLost = lostDeals.reduce((sum, d) => sum + (d.value || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleOpenDealDetail = (deal: Deal) => {
    // Convert local Deal to DealType for the sheet
    const dealForSheet: DealType = {
      id: deal.id,
      account_id: "",
      title: deal.title,
      value: deal.value,
      currency: deal.currency,
      status: deal.status,
      probability: 50,
      expected_close_date: deal.expected_close_date,
      won_at: deal.won_at,
      lost_at: deal.lost_at,
      lost_reason: deal.lost_reason,
      notes: deal.notes,
      source: deal.source,
      tags: [],
      created_at: deal.created_at,
      updated_at: deal.created_at,
      stage_id: deal.stage?.id || null,
      client_id: clientId,
      lead_id: deal.lead_id ?? null,
      responsible_user_id: deal.responsible_user?.id || null,
      sdr_user_id: null,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      stage: deal.stage ? {
        id: deal.stage.id,
        account_id: "",
        name: deal.stage.name,
        color: deal.stage.color,
        display_order: 0,
        is_active: true,
        probability: 50,
        created_at: "",
        updated_at: "",
      } : undefined,
      responsible_user: deal.responsible_user ? {
        id: deal.responsible_user.id,
        name: deal.responsible_user.name,
        avatar_url: null,
      } : undefined,
    };
    setSelectedDeal(dealForSheet);
    setIsDetailSheetOpen(true);
  };

  const handleStageChange = async (dealId: string, newStageId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("deals")
        .update({ stage_id: newStageId })
        .eq("id", dealId);
      
      if (error) throw error;
      fetchDeals();
      return true;
    } catch (error) {
      console.error("Error changing stage:", error);
      return false;
    }
  };

  const handleMarkAsWon = async (dealId: string) => {
    try {
      const { error } = await supabase
        .from("deals")
        .update({ status: "won", won_at: new Date().toISOString() })
        .eq("id", dealId);
      
      if (error) throw error;
      toast.success("Negócio marcado como ganho!");
      fetchDeals();
      setIsDetailSheetOpen(false);
    } catch (error) {
      console.error("Error marking as won:", error);
      toast.error("Erro ao marcar como ganho");
    }
  };

  const handleMarkAsLost = async (dealId: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from("deals")
        .update({ 
          status: "lost", 
          lost_at: new Date().toISOString(),
          lost_reason: reason || null,
        })
        .eq("id", dealId);
      
      if (error) throw error;
      toast.success("Negócio marcado como perdido");
      fetchDeals();
      setIsDetailSheetOpen(false);
    } catch (error) {
      console.error("Error marking as lost:", error);
      toast.error("Erro ao marcar como perdido");
    }
  };

  const handleReopen = async (dealId: string) => {
    try {
      const { error } = await supabase
        .from("deals")
        .update({ 
          status: "open", 
          won_at: null,
          lost_at: null,
          lost_reason: null,
        })
        .eq("id", dealId);
      
      if (error) throw error;
      toast.success("Negócio reaberto!");
      fetchDeals();
      setIsDetailSheetOpen(false);
    } catch (error) {
      console.error("Error reopening deal:", error);
      toast.error("Erro ao reabrir negócio");
    }
  };

  const stagesForSheet: DealStageType[] = stages.map(s => ({
    id: s.id,
    account_id: "",
    name: s.name,
    color: s.color,
    display_order: s.display_order,
    is_active: true,
    probability: 50,
    created_at: "",
    updated_at: "",
  }));

  const DealCard = ({ deal }: { deal: Deal }) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => handleOpenDealDetail(deal)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">{deal.title}</span>
              {deal.stage && (
                <Badge
                  variant="secondary"
                  className="text-[10px]"
                  style={{
                    backgroundColor: `${deal.stage.color}20`,
                    color: deal.stage.color,
                  }}
                >
                  {deal.stage.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(deal.value || 0)}
              </span>
              {deal.responsible_user && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {deal.responsible_user.name.split(" ")[0]}
                </span>
              )}
              {deal.expected_close_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(deal.expected_close_date), "dd/MM/yy")}
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(deal.created_at), { locale: ptBR, addSuffix: true })}
          </div>
        </div>
        {deal.status === "lost" && deal.lost_reason && (
          <p className="text-xs text-muted-foreground mt-2 p-2 bg-destructive/10 rounded">
            Motivo: {deal.lost_reason}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Em Aberto</span>
          </div>
          <p className="text-lg font-bold">{openDeals.length}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(totalOpen)}</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Ganhos</span>
          </div>
          <p className="text-lg font-bold text-emerald-600">{wonDeals.length}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(totalWon)}</p>
        </div>
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Perdidos</span>
          </div>
          <p className="text-lg font-bold text-destructive">{lostDeals.length}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(totalLost)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Negócio
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/pipeline")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver Pipeline
        </Button>
      </div>

      {/* Deals List */}
      {deals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum negócio registrado para este cliente
        </div>
      ) : (
        <Tabs defaultValue="open">
          <TabsList className="w-full">
            <TabsTrigger value="open" className="flex-1">
              Em Aberto ({openDeals.length})
            </TabsTrigger>
            <TabsTrigger value="won" className="flex-1">
              Ganhos ({wonDeals.length})
            </TabsTrigger>
            <TabsTrigger value="lost" className="flex-1">
              Perdidos ({lostDeals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-3 space-y-2">
            {openDeals.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">
                Nenhum negócio em aberto
              </p>
            ) : (
              openDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
            )}
          </TabsContent>

          <TabsContent value="won" className="mt-3 space-y-2">
            {wonDeals.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">
                Nenhum negócio ganho
              </p>
            ) : (
              wonDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
            )}
          </TabsContent>

          <TabsContent value="lost" className="mt-3 space-y-2">
            {lostDeals.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">
                Nenhum negócio perdido
              </p>
            ) : (
              lostDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Create Deal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Negócio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={`Negócio com ${clientName || "cliente"}`}
              />
            </div>

            {/* Item da Venda */}
            <div className="space-y-2">
              <Label>Item da Venda</Label>
              <Select
                value={selectedProductId}
                onValueChange={(productId) => {
                  setSelectedProductId(productId);
                  if (productId && productId !== "__none__") {
                    const product = products.find(p => p.id === productId);
                    if (product) {
                      setFormData(prev => ({
                        ...prev,
                        value: product.price.toString()
                      }));
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Valor</Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">Etapa</Label>
                <Select
                  value={formData.stage_id}
                  onValueChange={(value) => setFormData({ ...formData, stage_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
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
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expected_close_date">Previsão de Fechamento</Label>
                <Input
                  id="expected_close_date"
                  type="date"
                  value={formData.expected_close_date}
                  onChange={(e) =>
                    setFormData({ ...formData, expected_close_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Origem</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Ex: Indicação, Site..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre o negócio..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDeal} disabled={creating}>
              {creating ? "Criando..." : "Criar Negócio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Detail Sheet */}
      <DealDetailSheet
        open={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
        deal={selectedDeal}
        stages={stagesForSheet}
        onEdit={() => navigate("/pipeline")}
        onMarkAsWon={handleMarkAsWon}
        onMarkAsLost={handleMarkAsLost}
        onReopen={handleReopen}
        onStageChange={handleStageChange}
      />
    </div>
  );
}