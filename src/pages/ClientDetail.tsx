import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { QuadrantIndicator, TrendIndicator, StatusIndicator } from "@/components/ui/status-indicator";
import { VNPSBadge, VNPSExplanation } from "@/components/ui/vnps-badge";
import { Timeline, TimelineEvent } from "@/components/client/Timeline";
import { ClientFinancial } from "@/components/client/ClientFinancial";
import { SalesPerformance } from "@/components/client/SalesPerformance";
import { ClientInfoForm, ClientFormData, getEmptyClientFormData } from "@/components/client/ClientInfoForm";
import { validateCPF, validateCNPJ } from "@/lib/validators";
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Video,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Check,
  X,
  Clock,
  Package,
  Edit2,
  Loader2,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  status: "active" | "paused" | "churn_risk" | "churned";
  tags: string[];
  created_at: string;
  emails?: string[];
  additional_phones?: string[];
  cpf?: string;
  cnpj?: string;
  birth_date?: string;
  company_name?: string;
  notes?: string;
  street?: string;
  street_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface ScoreSnapshot {
  roizometer: number;
  escore: number;
  quadrant: "highE_lowROI" | "lowE_highROI" | "lowE_lowROI" | "highE_highROI";
  trend: "up" | "flat" | "down";
  computed_at: string;
}

interface VNPSSnapshot {
  vnps_score: number;
  vnps_class: "detractor" | "neutral" | "promoter";
  roizometer: number;
  escore: number;
  risk_index: number;
  trend: "up" | "flat" | "down";
  explanation: string | null;
  eligible_for_nps_ask: boolean;
  computed_at: string;
}

interface RoiEvent {
  id: string;
  roi_type: string;
  category: string;
  evidence_snippet: string | null;
  impact: string;
  happened_at: string;
}

interface Recommendation {
  id: string;
  title: string;
  action_text: string;
  priority: string;
  status: string;
  created_at: string;
}

interface ClientProduct {
  id: string;
  name: string;
}

interface AllProduct {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [clientProducts, setClientProducts] = useState<ClientProduct[]>([]);
  const [score, setScore] = useState<ScoreSnapshot | null>(null);
  const [vnps, setVnps] = useState<VNPSSnapshot | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [roiEvents, setRoiEvents] = useState<RoiEvent[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roiDialogOpen, setRoiDialogOpen] = useState(false);
  
  // Product editing state
  const [productsDialogOpen, setProductsDialogOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<AllProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [savingProducts, setSavingProducts] = useState(false);
  
  // ROI form state
  const [roiType, setRoiType] = useState<string>("tangible");
  const [roiCategory, setRoiCategory] = useState<string>("revenue");
  const [roiEvidence, setRoiEvidence] = useState("");
  const [roiImpact, setRoiImpact] = useState<string>("medium");

  // Edit client info state
  const [editInfoDialogOpen, setEditInfoDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<ClientFormData>(getEmptyClientFormData());
  const [savingInfo, setSavingInfo] = useState(false);

  // Omie sync state
  const [syncingOmie, setSyncingOmie] = useState(false);
  const fetchAllProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");
    
    if (!error) setAllProducts(data || []);
  };

  const openProductsDialog = () => {
    setSelectedProductIds(clientProducts.map(p => p.id));
    fetchAllProducts();
    setProductsDialogOpen(true);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSaveProducts = async () => {
    if (!id) return;
    setSavingProducts(true);

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) {
        toast.error("Perfil não encontrado");
        return;
      }

      // Delete existing client_products
      await supabase
        .from("client_products")
        .delete()
        .eq("client_id", id);

      // Insert new client_products
      if (selectedProductIds.length > 0) {
        const newClientProducts = selectedProductIds.map(productId => ({
          account_id: userData.account_id,
          client_id: id,
          product_id: productId,
        }));

        const { error } = await supabase
          .from("client_products")
          .insert(newClientProducts);

        if (error) throw error;
      }

      // Update local state
      const newProducts = allProducts
        .filter(p => selectedProductIds.includes(p.id))
        .map(p => ({ id: p.id, name: p.name }));
      setClientProducts(newProducts);

      toast.success("Produtos atualizados!");
      setProductsDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving products:", error);
      toast.error(error.message || "Erro ao salvar produtos");
    } finally {
      setSavingProducts(false);
    }
  };

  const openEditInfoDialog = () => {
    if (!client) return;
    setEditFormData({
      full_name: client.full_name,
      phone_e164: client.phone_e164,
      emails: client.emails || [],
      additional_phones: client.additional_phones || [],
      cpf: client.cpf || "",
      cnpj: client.cnpj || "",
      birth_date: client.birth_date || "",
      company_name: client.company_name || "",
      notes: client.notes || "",
      street: client.street || "",
      street_number: client.street_number || "",
      complement: client.complement || "",
      neighborhood: client.neighborhood || "",
      city: client.city || "",
      state: client.state || "",
      zip_code: client.zip_code || "",
    });
    setEditInfoDialogOpen(true);
  };

  const handleSaveClientInfo = async () => {
    if (!id || !client) return;
    
    // Validate required fields
    if (!editFormData.full_name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    // Validate CPF if provided
    if (editFormData.cpf && !validateCPF(editFormData.cpf)) {
      toast.error("CPF inválido");
      return;
    }
    
    // Validate CNPJ if provided
    if (editFormData.cnpj && !validateCNPJ(editFormData.cnpj)) {
      toast.error("CNPJ inválido");
      return;
    }

    setSavingInfo(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          full_name: editFormData.full_name.trim(),
          emails: editFormData.emails,
          additional_phones: editFormData.additional_phones,
          cpf: editFormData.cpf.replace(/\D/g, '') || null,
          cnpj: editFormData.cnpj.replace(/\D/g, '') || null,
          birth_date: editFormData.birth_date || null,
          company_name: editFormData.company_name || null,
          notes: editFormData.notes || null,
          street: editFormData.street || null,
          street_number: editFormData.street_number || null,
          complement: editFormData.complement || null,
          neighborhood: editFormData.neighborhood || null,
          city: editFormData.city || null,
          state: editFormData.state || null,
          zip_code: editFormData.zip_code?.replace(/\D/g, '') || null,
        })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setClient({
        ...client,
        full_name: editFormData.full_name.trim(),
        emails: editFormData.emails,
        additional_phones: editFormData.additional_phones,
        cpf: editFormData.cpf,
        cnpj: editFormData.cnpj,
        birth_date: editFormData.birth_date,
        company_name: editFormData.company_name,
        notes: editFormData.notes,
        street: editFormData.street,
        street_number: editFormData.street_number,
        complement: editFormData.complement,
        neighborhood: editFormData.neighborhood,
        city: editFormData.city,
        state: editFormData.state,
        zip_code: editFormData.zip_code,
      });

      toast.success("Informações atualizadas!");
      setEditInfoDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving client info:", error);
      toast.error(error.message || "Erro ao salvar informações");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSyncOmie = async () => {
    if (!id || !client) return;
    setSyncingOmie(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-omie', {
        body: { 
          client_id: id,
          enrich_data: true,
          use_cpf_cnpj: true,
        },
      });

      if (error) throw error;

      if (data.synced > 0) {
        toast.success(`Sincronizado com sucesso! ${data.enriched > 0 ? 'Dados enriquecidos.' : ''}`);
        fetchData(); // Refresh client data
      } else if (data.not_found > 0) {
        toast.error("Cliente não encontrado na Omie. Verifique se CPF/CNPJ está correto.");
      } else if (data.details?.[0]?.status === 'no_receivables') {
        toast.info("Cliente encontrado na Omie, mas sem contas a receber.");
        fetchData();
      } else {
        toast.warning("Nenhum dado sincronizado.");
      }
    } catch (error: any) {
      console.error("Error syncing with Omie:", error);
      toast.error(error.message || "Erro ao sincronizar com Omie");
    } finally {
      setSyncingOmie(false);
    }
  };

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientError) throw clientError;
      setClient({
        ...clientData,
        tags: (clientData.tags as string[]) || [],
        emails: (clientData.emails as string[]) || [],
        additional_phones: (clientData.additional_phones as string[]) || [],
        cpf: clientData.cpf || "",
        cnpj: clientData.cnpj || "",
        birth_date: clientData.birth_date || "",
        company_name: clientData.company_name || "",
        notes: clientData.notes || "",
        street: clientData.street || "",
        street_number: clientData.street_number || "",
        complement: clientData.complement || "",
        neighborhood: clientData.neighborhood || "",
        city: clientData.city || "",
        state: clientData.state || "",
        zip_code: clientData.zip_code || "",
      });

      // Fetch client products
      const { data: clientProductsData } = await supabase
        .from("client_products")
        .select(`
          product_id,
          products (
            id,
            name
          )
        `)
        .eq("client_id", id);

      const products = (clientProductsData || [])
        .map((cp: any) => cp.products)
        .filter(Boolean) as ClientProduct[];
      setClientProducts(products);

      // Fetch latest score
      const { data: scoreData } = await supabase
        .from("score_snapshots")
        .select("*")
        .eq("client_id", id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scoreData) {
        setScore(scoreData as ScoreSnapshot);
      }

      // Fetch latest V-NPS
      const { data: vnpsData } = await supabase
        .from("vnps_snapshots")
        .select("*")
        .eq("client_id", id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vnpsData) {
        setVnps(vnpsData as VNPSSnapshot);
      }

      // Fetch ROI events
      const { data: roiData } = await supabase
        .from("roi_events")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false });

      setRoiEvents((roiData || []) as RoiEvent[]);

      // Fetch risk events
      const { data: riskData } = await supabase
        .from("risk_events")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false })
        .limit(3);

      setRiskEvents(riskData || []);

      // Fetch recommendations
      const { data: recData } = await supabase
        .from("recommendations")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      setRecommendations((recData || []) as Recommendation[]);

      // Build timeline
      const timelineItems: TimelineEvent[] = [];

      // Add messages
      const { data: messagesData } = await supabase
        .from("message_events")
        .select("*")
        .eq("client_id", id)
        .order("sent_at", { ascending: false })
        .limit(20);

      (messagesData || []).forEach((msg) => {
        timelineItems.push({
          id: msg.id,
          type: "message",
          title: msg.direction === "client_to_team" ? "Mensagem do cliente" : "Mensagem para cliente",
          description: msg.content_text || "(Áudio transcrito)",
          timestamp: msg.sent_at,
          metadata: { source: msg.source, direction: msg.direction },
        });
      });

      // Add ROI events
      (roiData || []).forEach((roi: any) => {
        timelineItems.push({
          id: roi.id,
          type: "roi",
          title: `ROI ${roi.roi_type === "tangible" ? "Tangível" : "Intangível"}: ${getCategoryLabel(roi.category)}`,
          description: roi.evidence_snippet,
          timestamp: roi.happened_at,
          metadata: { 
            impact: roi.impact, 
            category: roi.category, 
            roi_type: roi.roi_type,
            source: roi.source 
          },
        });
      });

      // Add risk events (fetch all, not just 3)
      const { data: allRiskData } = await supabase
        .from("risk_events")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false })
        .limit(20);

      (allRiskData || []).forEach((risk: any) => {
        timelineItems.push({
          id: risk.id,
          type: "risk",
          title: "Sinal de Risco Detectado",
          description: risk.reason + (risk.evidence_snippet ? `: "${risk.evidence_snippet}"` : ""),
          timestamp: risk.happened_at,
          metadata: { level: risk.risk_level, source: risk.source },
        });
      });

      // Add recommendations
      (recData || []).forEach((rec: any) => {
        timelineItems.push({
          id: rec.id,
          type: "recommendation",
          title: rec.title,
          description: rec.action_text,
          timestamp: rec.created_at,
          metadata: { priority: rec.priority, status: rec.status },
        });
      });

      // Sort by timestamp
      timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimeline(timelineItems.slice(0, 50));

    } catch (error) {
      console.error("Error fetching client data:", error);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`client-timeline-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_events',
          filter: `client_id=eq.${id}`,
        },
        (payload) => {
          console.log('New message:', payload);
          const msg = payload.new as any;
          setTimeline((prev) => {
            const newEvent: TimelineEvent = {
              id: msg.id,
              type: "message",
              title: msg.direction === "client_to_team" ? "Mensagem do cliente" : "Mensagem para cliente",
              description: msg.content_text || "(Áudio transcrito)",
              timestamp: msg.sent_at,
              metadata: { source: msg.source, direction: msg.direction },
            };
            const updated = [newEvent, ...prev.filter(e => e.id !== msg.id)];
            updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return updated.slice(0, 50);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'roi_events',
          filter: `client_id=eq.${id}`,
        },
        (payload) => {
          console.log('New ROI event:', payload);
          const roi = payload.new as any;
          setRoiEvents((prev) => [roi, ...prev]);
          setTimeline((prev) => {
            const newEvent: TimelineEvent = {
              id: roi.id,
              type: "roi",
              title: `ROI ${roi.roi_type === "tangible" ? "Tangível" : "Intangível"}: ${getCategoryLabel(roi.category)}`,
              description: roi.evidence_snippet,
              timestamp: roi.happened_at,
              metadata: { 
                impact: roi.impact, 
                category: roi.category, 
                roi_type: roi.roi_type,
                source: roi.source 
              },
            };
            const updated = [newEvent, ...prev.filter(e => e.id !== roi.id)];
            updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return updated.slice(0, 50);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'risk_events',
          filter: `client_id=eq.${id}`,
        },
        (payload) => {
          console.log('New risk event:', payload);
          const risk = payload.new as any;
          setRiskEvents((prev) => [risk, ...prev.slice(0, 2)]);
          setTimeline((prev) => {
            const newEvent: TimelineEvent = {
              id: risk.id,
              type: "risk",
              title: "Sinal de Risco Detectado",
              description: risk.reason + (risk.evidence_snippet ? `: "${risk.evidence_snippet}"` : ""),
              timestamp: risk.happened_at,
              metadata: { level: risk.risk_level, source: risk.source },
            };
            const updated = [newEvent, ...prev.filter(e => e.id !== risk.id)];
            updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return updated.slice(0, 50);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recommendations',
          filter: `client_id=eq.${id}`,
        },
        (payload) => {
          console.log('Recommendation change:', payload);
          if (payload.eventType === 'INSERT') {
            const rec = payload.new as any;
            setRecommendations((prev) => [rec, ...prev]);
            setTimeline((prev) => {
              const newEvent: TimelineEvent = {
                id: rec.id,
                type: "recommendation",
                title: rec.title,
                description: rec.action_text,
                timestamp: rec.created_at,
                metadata: { priority: rec.priority, status: rec.status },
              };
              const updated = [newEvent, ...prev.filter(e => e.id !== rec.id)];
              updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              return updated.slice(0, 50);
            });
          } else if (payload.eventType === 'UPDATE') {
            const rec = payload.new as any;
            setRecommendations((prev) => 
              prev.map(r => r.id === rec.id ? rec : r)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      revenue: "Receita",
      cost: "Custo",
      time: "Tempo",
      process: "Processo",
      clarity: "Clareza",
      confidence: "Confiança",
      tranquility: "Tranquilidade",
      status_direction: "Direção",
    };
    return labels[category] || category;
  };

  const handleAddRoi = async () => {
    if (!id || !client) return;

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) throw new Error("User not found");

      const { error } = await supabase.from("roi_events").insert({
        account_id: userData.account_id,
        client_id: id,
        source: "manual" as const,
        roi_type: roiType as "tangible" | "intangible",
        category: roiCategory as any,
        evidence_snippet: roiEvidence,
        impact: roiImpact as "low" | "medium" | "high",
        happened_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("ROI adicionado com sucesso!");
      setRoiDialogOpen(false);
      setRoiEvidence("");
      fetchData();
    } catch (error) {
      console.error("Error adding ROI:", error);
      toast.error("Erro ao adicionar ROI");
    }
  };

  const handleUpdateRecommendation = async (recId: string, status: "open" | "done" | "dismissed") => {
    try {
      const { error } = await supabase
        .from("recommendations")
        .update({ status })
        .eq("id", recId);

      if (error) throw error;
      toast.success("Recomendação atualizada!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar recomendação");
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button asChild className="mt-4">
          <Link to="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{client.full_name}</h1>
              <StatusIndicator status={client.status} size="sm" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={openEditInfoDialog}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {client.phone_e164}
              </span>
              {client.emails && client.emails.length > 0 && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {client.emails[0]}
                  {client.emails.length > 1 && ` +${client.emails.length - 1}`}
                </span>
              )}
              {client.company_name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {client.company_name}
                </span>
              )}
              {client.city && client.state && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {client.city}/{client.state}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {clientProducts.length > 0 ? (
                clientProducts.map((product) => (
                  <Badge key={product.id} variant="secondary" className="text-xs">
                    <Package className="h-3 w-3 mr-1" />
                    {product.name}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Nenhum produto</span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2"
                onClick={openProductsDialog}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Edit Info Dialog */}
        <Dialog open={editInfoDialogOpen} onOpenChange={setEditInfoDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Editar Informações do Cliente</DialogTitle>
              <DialogDescription>
                Atualize os dados cadastrais do cliente
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <ClientInfoForm 
                data={editFormData} 
                onChange={setEditFormData}
                showBasicFields={false}
              />
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditInfoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveClientInfo} disabled={savingInfo}>
                {savingInfo && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Products Edit Dialog */}
        <Dialog open={productsDialogOpen} onOpenChange={setProductsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Produtos</DialogTitle>
              <DialogDescription>
                Selecione os produtos vinculados a este cliente
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {allProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum produto cadastrado. <Link to="/products" className="text-primary underline">Criar produtos</Link>
                </p>
              ) : (
                <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                  {allProducts.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                      />
                      <span className="flex-1 text-sm">{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProductsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProducts} disabled={savingProducts}>
                {savingProducts && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSyncOmie} 
            disabled={syncingOmie}
            title="Sincronizar dados com Omie usando CPF/CNPJ"
          >
            {syncingOmie ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Omie
          </Button>
          
          <Dialog open={roiDialogOpen} onOpenChange={setRoiDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar ROI
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar ROI Manual</DialogTitle>
              <DialogDescription>
                Registre uma percepção de valor do cliente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={roiType} onValueChange={setRoiType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tangible">Tangível</SelectItem>
                      <SelectItem value="intangible">Intangível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={roiCategory} onValueChange={setRoiCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roiType === "tangible" ? (
                        <>
                          <SelectItem value="revenue">Receita</SelectItem>
                          <SelectItem value="cost">Redução de Custo</SelectItem>
                          <SelectItem value="time">Economia de Tempo</SelectItem>
                          <SelectItem value="process">Melhoria de Processo</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="clarity">Clareza</SelectItem>
                          <SelectItem value="confidence">Confiança</SelectItem>
                          <SelectItem value="tranquility">Tranquilidade</SelectItem>
                          <SelectItem value="status_direction">Direção</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Impacto</Label>
                <Select value={roiImpact} onValueChange={setRoiImpact}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Evidência</Label>
                <Textarea
                  placeholder="Descreva a evidência de ROI..."
                  value={roiEvidence}
                  onChange={(e) => setRoiEvidence(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoiDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddRoi}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Scores Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <ScoreGauge
              score={score?.roizometer ?? 0}
              label="ROIzômetro"
              size="lg"
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <ScoreGauge
              score={score?.escore ?? 0}
              label="E-Score"
              size="lg"
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-medium text-muted-foreground">V-NPS</p>
              {vnps ? (
                <div className="flex flex-col items-center gap-1">
                  <VNPSBadge
                    score={vnps.vnps_score}
                    vnpsClass={vnps.vnps_class}
                    trend={vnps.trend}
                    explanation={vnps.explanation || undefined}
                    eligible={vnps.eligible_for_nps_ask}
                    size="lg"
                    showClass
                  />
                </div>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">—</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-medium text-muted-foreground">Quadrante</p>
              <QuadrantIndicator
                quadrant={score?.quadrant ?? "lowE_lowROI"}
                size="lg"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-medium text-muted-foreground">Tendência</p>
              <TrendIndicator
                trend={score?.trend ?? "flat"}
                size="lg"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* V-NPS Explanation */}
      {vnps && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Por que esse V-NPS?
            </CardTitle>
            <CardDescription>
              Probabilidade real de recomendação, calculada continuamente a partir de ROI percebido, engajamento e risco.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VNPSExplanation
              explanation={vnps.explanation || "V-NPS calculado com base nos dados disponíveis."}
              roizometer={vnps.roizometer}
              escore={vnps.escore}
              riskIndex={vnps.risk_index}
              eligible={vnps.eligible_for_nps_ask}
            />
          </CardContent>
        </Card>
      )}

      {/* Risk Alerts */}
      {riskEvents.length > 0 && (
        <Card className="shadow-card border-warning/30 bg-warning-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Últimos Alertas de Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskEvents.map((risk) => (
                <div
                  key={risk.id}
                  className="flex items-start justify-between p-2 bg-card rounded-lg"
                >
                  <p className="text-sm text-foreground">{risk.reason}</p>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(risk.happened_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">Financeiro</TabsTrigger>
          <TabsTrigger value="sales">Metas & Vendas</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="roi">ROI ({roiEvents.length})</TabsTrigger>
          <TabsTrigger value="recommendations">
            Recomendações ({recommendations.filter((r) => r.status === "open").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <ClientFinancial clientId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <SalesPerformance clientId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Histórico Completo</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Mensagens</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>ROI</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Riscos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    <span>Ações</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <Timeline events={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roi">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Eventos de ROI</CardTitle>
            </CardHeader>
            <CardContent>
              {roiEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum evento de ROI registrado. Clique em "Adicionar ROI" para começar.
                </p>
              ) : (
                <div className="space-y-3">
                  {roiEvents.map((roi) => (
                    <div
                      key={roi.id}
                      className="flex items-start justify-between p-4 rounded-lg border border-border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={roi.roi_type === "tangible" ? "default" : "secondary"}
                          >
                            {roi.roi_type === "tangible" ? "Tangível" : "Intangível"}
                          </Badge>
                          <Badge variant="outline">{getCategoryLabel(roi.category)}</Badge>
                          <Badge
                            variant="outline"
                            className={
                              roi.impact === "high"
                                ? "border-success text-success"
                                : roi.impact === "medium"
                                ? "border-warning text-warning"
                                : "border-muted-foreground"
                            }
                          >
                            {roi.impact === "high"
                              ? "Alto"
                              : roi.impact === "medium"
                              ? "Médio"
                              : "Baixo"}
                          </Badge>
                        </div>
                        {roi.evidence_snippet && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {roi.evidence_snippet}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(roi.happened_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma recomendação gerada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-lg border ${
                        rec.status === "done"
                          ? "border-success/30 bg-success-muted/30"
                          : rec.status === "dismissed"
                          ? "border-muted bg-muted/30 opacity-60"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Lightbulb className="h-4 w-4 text-warning" />
                            <span className="font-medium text-sm">{rec.title}</span>
                            <Badge
                              variant="outline"
                              className={
                                rec.priority === "high"
                                  ? "border-danger text-danger"
                                  : rec.priority === "medium"
                                  ? "border-warning text-warning"
                                  : ""
                              }
                            >
                              {rec.priority === "high"
                                ? "Alta"
                                : rec.priority === "medium"
                                ? "Média"
                                : "Baixa"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.action_text}</p>
                        </div>
                        {rec.status === "open" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                              onClick={() => handleUpdateRecommendation(rec.id, "done")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
                              onClick={() => handleUpdateRecommendation(rec.id, "dismissed")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {rec.status !== "open" && (
                          <Badge variant="secondary">
                            {rec.status === "done" ? "Concluída" : "Descartada"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
