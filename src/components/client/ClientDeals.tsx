import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  TrendingUp,
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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

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
    fetchDeals();
    fetchStages();
  }, [clientId]);

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
        responsible_user:users(id, name)
      `)
      .eq("client_id", clientId)
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
      const { data: userData } = await supabase
        .from("users")
        .select("account_id, id")
        .single();

      if (!userData) throw new Error("Usuário não encontrado");

      const firstStage = stages.sort((a, b) => a.display_order - b.display_order)[0];

      const { error } = await supabase.from("deals").insert({
        account_id: userData.account_id,
        client_id: clientId,
        title: formData.title.trim(),
        value: formData.value ? parseFloat(formData.value) : 0,
        stage_id: formData.stage_id || firstStage?.id,
        expected_close_date: formData.expected_close_date || null,
        source: formData.source || null,
        notes: formData.notes || null,
        responsible_user_id: userData.id,
      });

      if (error) throw error;

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

  const DealCard = ({ deal }: { deal: Deal }) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate("/pipeline")}
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
    </div>
  );
}