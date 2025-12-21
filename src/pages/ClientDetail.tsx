import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { QuadrantIndicator, TrendIndicator, StatusIndicator } from "@/components/ui/status-indicator";
import { VNPSBadge } from "@/components/ui/vnps-badge";
import { Timeline, TimelineEvent } from "@/components/client/Timeline";
import { ClientFinancial } from "@/components/client/ClientFinancial";
import { SalesPerformance } from "@/components/client/SalesPerformance";
import { ClientAgenda } from "@/components/client/ClientAgenda";
import { ClientInfoForm, ClientFormData, getEmptyClientFormData } from "@/components/client/ClientInfoForm";
import { ClientLifeEvents } from "@/components/client/ClientLifeEvents";
import { ClientFieldsSummary } from "@/components/client/ClientFieldsSummary";
import { ClientAvatarUpload } from "@/components/client/ClientAvatarUpload";
import { ClientLogoUpload } from "@/components/client/ClientLogoUpload";
import { ContractTimer } from "@/components/client/ContractTimer";
import { ClientContracts } from "@/components/client/ClientContracts";
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
  Calendar,
  FileText,
  Heart,
  ImageIcon,
  Trash2,
  Send,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  status: "active" | "paused" | "churn_risk" | "churned" | "no_contract";
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
  business_street?: string;
  business_street_number?: string;
  business_complement?: string;
  business_neighborhood?: string;
  business_city?: string;
  business_state?: string;
  business_zip_code?: string;
  avatar_url?: string | null;
  logo_url?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  is_mls?: boolean;
  mls_level?: string | null;
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
  source: string;
  image_url?: string | null;
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
  const [roiScreenshot, setRoiScreenshot] = useState<File | null>(null);
  const [roiScreenshotPreview, setRoiScreenshotPreview] = useState<string | null>(null);
  const [uploadingRoi, setUploadingRoi] = useState(false);

  // Risk form state
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [riskLevel, setRiskLevel] = useState<string>("medium");
  const [riskReason, setRiskReason] = useState("");
  const [riskEvidence, setRiskEvidence] = useState("");
  const [riskScreenshot, setRiskScreenshot] = useState<File | null>(null);
  const [riskScreenshotPreview, setRiskScreenshotPreview] = useState<string | null>(null);
  const [uploadingRisk, setUploadingRisk] = useState(false);

  // Edit ROI state
  const [editingRoiId, setEditingRoiId] = useState<string | null>(null);
  const [editRoiType, setEditRoiType] = useState<string>("tangible");
  const [editRoiCategory, setEditRoiCategory] = useState<string>("revenue");
  const [editRoiEvidence, setEditRoiEvidence] = useState("");
  const [editRoiImpact, setEditRoiImpact] = useState<string>("medium");
  const [savingEditRoi, setSavingEditRoi] = useState(false);

  // Edit Risk state
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const [editRiskLevel, setEditRiskLevel] = useState<string>("medium");
  const [editRiskReason, setEditRiskReason] = useState("");
  const [editRiskEvidence, setEditRiskEvidence] = useState("");
  const [savingEditRisk, setSavingEditRisk] = useState(false);

  // Delete confirmation state
  const [deletingRoiId, setDeletingRoiId] = useState<string | null>(null);
  const [deletingRiskId, setDeletingRiskId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit client info state
  const [editInfoDialogOpen, setEditInfoDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<ClientFormData>(getEmptyClientFormData());
  const [savingInfo, setSavingInfo] = useState(false);

  // Forms for sending to client
  const [availableForms, setAvailableForms] = useState<{ id: string; title: string }[]>([]);

  const fetchAllProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");
    
    if (!error) setAllProducts(data || []);
  };

  const fetchAvailableForms = async () => {
    const { data, error } = await supabase
      .from("forms")
      .select("id, title")
      .eq("is_active", true)
      .order("title");
    
    if (!error) setAvailableForms(data || []);
  };

  const copyFormLink = async (formId: string, formTitle: string) => {
    const baseUrl = window.location.origin;
    const formUrl = `${baseUrl}/f/${formId}?clientId=${id}`;
    navigator.clipboard.writeText(formUrl);
    toast.success(`Link do formulário "${formTitle}" copiado!`);
    
    // Record form send
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();
      
      if (userData && id) {
        await supabase
          .from("client_form_sends")
          .upsert({
            account_id: userData.account_id,
            client_id: id,
            form_id: formId,
            sent_at: new Date().toISOString(),
          }, { onConflict: 'client_id,form_id' });
      }
    } catch (error) {
      console.warn("Could not record form send:", error);
    }
  };

  const openFormInNewTab = async (formId: string, formTitle: string) => {
    const baseUrl = window.location.origin;
    const formUrl = `${baseUrl}/f/${formId}?clientId=${id}`;
    window.open(formUrl, '_blank');
    
    // Record form send
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();
      
      if (userData && id) {
        await supabase
          .from("client_form_sends")
          .upsert({
            account_id: userData.account_id,
            client_id: id,
            form_id: formId,
            sent_at: new Date().toISOString(),
          }, { onConflict: 'client_id,form_id' });
      }
    } catch (error) {
      console.warn("Could not record form send:", error);
    }
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
      business_street: client.business_street || "",
      business_street_number: client.business_street_number || "",
      business_complement: client.business_complement || "",
      business_neighborhood: client.business_neighborhood || "",
      business_city: client.business_city || "",
      business_state: client.business_state || "",
      business_zip_code: client.business_zip_code || "",
      contract_start_date: client.contract_start_date || "",
      contract_end_date: client.contract_end_date || "",
      is_mls: client.is_mls || false,
      mls_level: client.mls_level || "",
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
          business_street: editFormData.business_street || null,
          business_street_number: editFormData.business_street_number || null,
          business_complement: editFormData.business_complement || null,
          business_neighborhood: editFormData.business_neighborhood || null,
          business_city: editFormData.business_city || null,
          business_state: editFormData.business_state || null,
          business_zip_code: editFormData.business_zip_code?.replace(/\D/g, '') || null,
          contract_start_date: editFormData.contract_start_date || null,
          contract_end_date: editFormData.contract_end_date || null,
          is_mls: editFormData.is_mls,
          mls_level: editFormData.is_mls ? (editFormData.mls_level || null) : null,
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
        business_street: editFormData.business_street,
        business_street_number: editFormData.business_street_number,
        business_complement: editFormData.business_complement,
        business_neighborhood: editFormData.business_neighborhood,
        business_city: editFormData.business_city,
        business_state: editFormData.business_state,
        business_zip_code: editFormData.business_zip_code,
        contract_start_date: editFormData.contract_start_date,
        contract_end_date: editFormData.contract_end_date,
        is_mls: editFormData.is_mls,
        mls_level: editFormData.mls_level,
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
        business_street: clientData.business_street || "",
        business_street_number: clientData.business_street_number || "",
        business_complement: clientData.business_complement || "",
        business_neighborhood: clientData.business_neighborhood || "",
        business_city: clientData.business_city || "",
        business_state: clientData.business_state || "",
        business_zip_code: clientData.business_zip_code || "",
        avatar_url: clientData.avatar_url || null,
        logo_url: (clientData as any).logo_url || null,
        contract_start_date: clientData.contract_start_date || null,
        contract_end_date: clientData.contract_end_date || null,
        is_mls: clientData.is_mls || false,
        mls_level: clientData.mls_level || null,
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

      // Fetch risk events (all for the Risks tab)
      const { data: riskData } = await supabase
        .from("risk_events")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false });

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

      (messagesData || []).forEach((msg: any) => {
        const isGroup = msg.is_group === true;
        timelineItems.push({
          id: msg.id,
          type: "message",
          title: isGroup 
            ? `Mensagem no grupo ${msg.group_name || ""}` 
            : msg.direction === "client_to_team" ? "Mensagem do cliente" : "Mensagem para cliente",
          description: msg.content_text || "(Áudio transcrito)",
          timestamp: msg.sent_at,
          metadata: { 
            source: msg.source, 
            direction: msg.direction,
            is_group: msg.is_group,
            group_name: msg.group_name,
          },
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
            source: roi.source,
            image_url: roi.image_url,
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
          metadata: { level: risk.risk_level, source: risk.source, image_url: risk.image_url },
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

      // Add followups - notes as comments, files/images as followups
      const { data: followupsData } = await supabase
        .from("client_followups")
        .select(`
          *,
          users (name, avatar_url)
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(30);

      (followupsData || []).forEach((followup: any) => {
        const isNote = followup.type === "note";
        const isFinancialNote = followup.type === "financial_note";
        const isSalesNote = followup.type === "sales_note";
        timelineItems.push({
          id: followup.id,
          type: isSalesNote ? "sales" : isFinancialNote ? "financial" : isNote ? "comment" : "followup",
          title: followup.title || (isNote ? "Comentário" : isFinancialNote ? "Nota Financeira" : isSalesNote ? "Nota de Vendas" : "Arquivo anexado"),
          description: followup.content,
          timestamp: followup.created_at,
          metadata: {
            user_id: followup.user_id,
            user_name: followup.users?.name || "Usuário",
            user_avatar: followup.users?.avatar_url,
            file_url: followup.file_url,
            file_name: followup.file_name,
            file_size: followup.file_size,
            followup_type: followup.type as "note" | "file" | "image" | "financial_note" | "sales_note",
          },
        });
      });

      // Add life events (Momentos CX)
      const { data: lifeEventsData } = await supabase
        .from("client_life_events")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      (lifeEventsData || []).forEach((event: any) => {
        timelineItems.push({
          id: event.id,
          type: "life_event",
          title: event.title,
          description: event.description,
          timestamp: event.created_at,
          metadata: {
            event_type: event.event_type,
            is_recurring: event.is_recurring,
            source: event.source,
          },
        });
      });

      // Add form responses
      const { data: formResponsesData } = await supabase
        .from("form_responses")
        .select(`
          *,
          forms (title)
        `)
        .eq("client_id", id)
        .order("submitted_at", { ascending: false })
        .limit(20);

      (formResponsesData || []).forEach((response: any) => {
        const responseCount = Object.keys(response.responses || {}).length;
        timelineItems.push({
          id: response.id,
          type: "form_response",
          title: response.forms?.title || "Formulário",
          description: `${responseCount} campo(s) preenchido(s)`,
          timestamp: response.submitted_at,
          metadata: {
            form_title: response.forms?.title,
            form_responses: response.responses,
          },
        });
      });

      // Add attendance records (event check-ins)
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select(`
          *,
          events (title, address, scheduled_at)
        `)
        .eq("client_id", id)
        .not("event_id", "is", null)
        .order("join_time", { ascending: false })
        .limit(20);

      (attendanceData || []).forEach((att: any) => {
        timelineItems.push({
          id: att.id,
          type: "attendance",
          title: `Presença confirmada: ${att.events?.title || "Evento"}`,
          description: att.events?.address || undefined,
          timestamp: att.join_time,
          metadata: {
            event_title: att.events?.title,
            event_address: att.events?.address,
          },
        });
      });

      // Add financial events (subscriptions)
      const { data: subscriptionsData } = await supabase
        .from("client_subscriptions")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      (subscriptionsData || []).forEach((sub: any) => {
        timelineItems.push({
          id: sub.id,
          type: "financial",
          title: sub.product_name,
          description: `Status: ${sub.payment_status === "active" ? "Ativo" : sub.payment_status === "overdue" ? "Em atraso" : sub.payment_status}`,
          timestamp: sub.created_at,
          metadata: {
            payment_status: sub.payment_status,
            amount: sub.amount,
            currency: sub.currency,
          },
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
    fetchAvailableForms();
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
          const isGroup = msg.is_group === true;
          setTimeline((prev) => {
            const newEvent: TimelineEvent = {
              id: msg.id,
              type: "message",
              title: isGroup 
                ? `Mensagem no grupo ${msg.group_name || ""}` 
                : msg.direction === "client_to_team" ? "Mensagem do cliente" : "Mensagem para cliente",
              description: msg.content_text || "(Áudio transcrito)",
              timestamp: msg.sent_at,
              metadata: { 
                source: msg.source, 
                direction: msg.direction,
                is_group: msg.is_group,
                group_name: msg.group_name,
              },
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
                source: roi.source,
                image_url: roi.image_url,
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
          setRiskEvents((prev) => [risk, ...prev]);
          setTimeline((prev) => {
            const newEvent: TimelineEvent = {
              id: risk.id,
              type: "risk",
              title: "Sinal de Risco Detectado",
              description: risk.reason + (risk.evidence_snippet ? `: "${risk.evidence_snippet}"` : ""),
              timestamp: risk.happened_at,
              metadata: { level: risk.risk_level, source: risk.source, image_url: risk.image_url },
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_followups',
          filter: `client_id=eq.${id}`,
        },
        async (payload) => {
          console.log('New followup:', payload);
          const followup = payload.new as any;
          
          // Fetch user info for the followup
          const { data: userData } = await supabase
            .from("users")
            .select("name, avatar_url")
            .eq("id", followup.user_id)
            .single();
          
          setTimeline((prev) => {
            const isNote = followup.type === "note";
            const isFinancialNote = followup.type === "financial_note";
            const isSalesNote = followup.type === "sales_note";
            const newEvent: TimelineEvent = {
              id: followup.id,
              type: isSalesNote ? "sales" : isFinancialNote ? "financial" : isNote ? "comment" : "followup",
              title: followup.title || (isNote ? "Comentário" : isFinancialNote ? "Nota Financeira" : isSalesNote ? "Nota de Vendas" : "Arquivo anexado"),
              description: followup.content,
              timestamp: followup.created_at,
              metadata: {
                user_id: followup.user_id,
                user_name: userData?.name || "Usuário",
                user_avatar: userData?.avatar_url,
                file_url: followup.file_url,
                file_name: followup.file_name,
                file_size: followup.file_size,
                followup_type: followup.type as "note" | "file" | "image" | "financial_note" | "sales_note",
              },
            };
            const updated = [newEvent, ...prev.filter(e => e.id !== followup.id)];
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
          table: 'form_responses',
          filter: `client_id=eq.${id}`,
        },
        async (payload) => {
          console.log('New form response:', payload);
          const response = payload.new as any;
          
          // Fetch form title
          const { data: formData } = await supabase
            .from("forms")
            .select("title")
            .eq("id", response.form_id)
            .single();
          
          const responseCount = Object.keys(response.responses || {}).length;
          setTimeline((prev) => {
            const newEvent: TimelineEvent = {
              id: response.id,
              type: "form_response",
              title: formData?.title || "Formulário",
              description: `${responseCount} campo(s) preenchido(s)`,
              timestamp: response.submitted_at,
              metadata: {
                form_title: formData?.title,
                form_responses: response.responses,
              },
            };
            const updated = [newEvent, ...prev.filter(e => e.id !== response.id)];
            updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return updated.slice(0, 50);
          });
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

  const handleRoiScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRoiScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRoiScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRoiScreenshotDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setRoiScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRoiScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearRoiScreenshot = () => {
    setRoiScreenshot(null);
    setRoiScreenshotPreview(null);
  };

  const handleAddRoi = async () => {
    if (!id || !client) return;

    setUploadingRoi(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) throw new Error("User not found");

      let imageUrl: string | null = null;

      // Upload screenshot if present
      if (roiScreenshot) {
        const fileExt = roiScreenshot.name.split(".").pop();
        const fileName = `${id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("roi-screenshots")
          .upload(fileName, roiScreenshot);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("roi-screenshots")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("roi_events").insert({
        account_id: userData.account_id,
        client_id: id,
        source: "manual" as const,
        roi_type: roiType as "tangible" | "intangible",
        category: roiCategory as any,
        evidence_snippet: roiEvidence,
        impact: roiImpact as "low" | "medium" | "high",
        happened_at: new Date().toISOString(),
        image_url: imageUrl,
      });

      if (error) throw error;

      toast.success("ROI adicionado com sucesso!");
      setRoiDialogOpen(false);
      setRoiEvidence("");
      setRoiScreenshot(null);
      setRoiScreenshotPreview(null);
      fetchData();
    } catch (error) {
      console.error("Error adding ROI:", error);
      toast.error("Erro ao adicionar ROI");
    } finally {
      setUploadingRoi(false);
    }
  };

  const handleRiskScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRiskScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRiskScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRiskScreenshotDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setRiskScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRiskScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearRiskScreenshot = () => {
    setRiskScreenshot(null);
    setRiskScreenshotPreview(null);
  };

  const handleAddRisk = async () => {
    if (!id || !client || !riskReason.trim()) {
      toast.error("Preencha o motivo do risco");
      return;
    }

    setUploadingRisk(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) throw new Error("User not found");

      let imageUrl: string | null = null;

      if (riskScreenshot) {
        const fileExt = riskScreenshot.name.split(".").pop();
        const fileName = `${id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("roi-screenshots")
          .upload(fileName, riskScreenshot);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("roi-screenshots")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("risk_events").insert({
        account_id: userData.account_id,
        client_id: id,
        source: "system" as const,
        risk_level: riskLevel as "low" | "medium" | "high",
        reason: riskReason,
        evidence_snippet: riskEvidence || null,
        happened_at: new Date().toISOString(),
        image_url: imageUrl,
      });

      if (error) throw error;

      toast.success("Risco adicionado com sucesso!");
      setRiskDialogOpen(false);
      setRiskReason("");
      setRiskEvidence("");
      setRiskScreenshot(null);
      setRiskScreenshotPreview(null);
      fetchData();
    } catch (error) {
      console.error("Error adding risk:", error);
      toast.error("Erro ao adicionar risco");
    } finally {
      setUploadingRisk(false);
    }
  };

  // Edit ROI handlers
  const openEditRoiDialog = (roi: RoiEvent) => {
    setEditingRoiId(roi.id);
    setEditRoiType(roi.roi_type);
    setEditRoiCategory(roi.category);
    setEditRoiEvidence(roi.evidence_snippet || "");
    setEditRoiImpact(roi.impact);
  };

  const handleSaveEditRoi = async () => {
    if (!editingRoiId) return;
    setSavingEditRoi(true);
    try {
      const { error } = await supabase
        .from("roi_events")
        .update({
          roi_type: editRoiType as "tangible" | "intangible",
          category: editRoiCategory as any,
          evidence_snippet: editRoiEvidence || null,
          impact: editRoiImpact as "low" | "medium" | "high",
        })
        .eq("id", editingRoiId);

      if (error) throw error;
      toast.success("ROI atualizado com sucesso!");
      setEditingRoiId(null);
      fetchData();
    } catch (error) {
      console.error("Error updating ROI:", error);
      toast.error("Erro ao atualizar ROI");
    } finally {
      setSavingEditRoi(false);
    }
  };

  const handleDeleteRoi = async () => {
    if (!deletingRoiId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("roi_events")
        .delete()
        .eq("id", deletingRoiId);

      if (error) throw error;
      toast.success("ROI excluído com sucesso!");
      setDeletingRoiId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting ROI:", error);
      toast.error("Erro ao excluir ROI");
    } finally {
      setIsDeleting(false);
    }
  };

  // Edit Risk handlers
  const openEditRiskDialog = (risk: any) => {
    setEditingRiskId(risk.id);
    setEditRiskLevel(risk.risk_level);
    setEditRiskReason(risk.reason);
    setEditRiskEvidence(risk.evidence_snippet || "");
  };

  const handleSaveEditRisk = async () => {
    if (!editingRiskId || !editRiskReason.trim()) {
      toast.error("Preencha o motivo do risco");
      return;
    }
    setSavingEditRisk(true);
    try {
      const { error } = await supabase
        .from("risk_events")
        .update({
          risk_level: editRiskLevel as "low" | "medium" | "high",
          reason: editRiskReason,
          evidence_snippet: editRiskEvidence || null,
        })
        .eq("id", editingRiskId);

      if (error) throw error;
      toast.success("Risco atualizado com sucesso!");
      setEditingRiskId(null);
      fetchData();
    } catch (error) {
      console.error("Error updating risk:", error);
      toast.error("Erro ao atualizar risco");
    } finally {
      setSavingEditRisk(false);
    }
  };

  const handleDeleteRisk = async () => {
    if (!deletingRiskId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("risk_events")
        .delete()
        .eq("id", deletingRiskId);

      if (error) throw error;
      toast.success("Risco excluído com sucesso!");
      setDeletingRiskId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting risk:", error);
      toast.error("Erro ao excluir risco");
    } finally {
      setIsDeleting(false);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0 mt-0.5">
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <ClientAvatarUpload
            clientId={client.id}
            clientName={client.full_name}
            currentAvatarUrl={client.avatar_url}
            onAvatarChange={(url) => setClient({ ...client, avatar_url: url })}
            size="lg"
          />
          <ClientLogoUpload
            clientId={client.id}
            clientName={client.full_name}
            currentLogoUrl={client.logo_url}
            onLogoChange={(url) => setClient({ ...client, logo_url: url })}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{client.full_name}</h1>
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {client.phone_e164}
              </span>
              {client.emails && client.emails.length > 0 && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[150px]">{client.emails[0]}</span>
                  {client.emails.length > 1 && ` +${client.emails.length - 1}`}
                </span>
              )}
              {client.company_name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[120px]">{client.company_name}</span>
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

        <div className="flex gap-2 flex-wrap">
          {/* Send Form Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Send className="h-4 w-4 mr-2" />
                Enviar Formulário
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {availableForms.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  Nenhum formulário disponível
                </div>
              ) : (
                availableForms.map((form) => (
                  <DropdownMenuItem
                    key={form.id}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    onClick={() => copyFormLink(form.id, form.title)}
                  >
                    <span className="truncate flex-1">{form.title}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFormInNewTab(form.id, form.title);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyFormLink(form.id, form.title);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
              <div className="space-y-2">
                <Label>Print (opcional)</Label>
                {roiScreenshotPreview ? (
                  <div className="relative">
                    <img
                      src={roiScreenshotPreview}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={clearRoiScreenshot}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleRoiScreenshotDrop}
                    onClick={() => document.getElementById("roi-screenshot-input")?.click()}
                  >
                    <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Arraste uma imagem ou clique para selecionar
                    </p>
                    <input
                      id="roi-screenshot-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleRoiScreenshotSelect}
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoiDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddRoi} disabled={uploadingRoi}>
                {uploadingRoi ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

          <Dialog open={riskDialogOpen} onOpenChange={setRiskDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Adicionar Risco
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Sinal de Risco</DialogTitle>
                <DialogDescription>
                  Registre um sinal de risco identificado no cliente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nível de Risco</Label>
                  <Select value={riskLevel} onValueChange={setRiskLevel}>
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
                  <Label>Motivo *</Label>
                  <Input
                    placeholder="Ex: Cliente demonstrou frustração..."
                    value={riskReason}
                    onChange={(e) => setRiskReason(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Evidência (opcional)</Label>
                  <Textarea
                    placeholder="Trecho de conversa ou contexto adicional..."
                    value={riskEvidence}
                    onChange={(e) => setRiskEvidence(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Print (opcional)</Label>
                  {riskScreenshotPreview ? (
                    <div className="relative">
                      <img
                        src={riskScreenshotPreview}
                        alt="Preview"
                        className="w-full h-40 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={clearRiskScreenshot}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleRiskScreenshotDrop}
                      onClick={() => document.getElementById("risk-screenshot-input")?.click()}
                    >
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Arraste uma imagem ou clique para selecionar
                      </p>
                      <input
                        id="risk-screenshot-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleRiskScreenshotSelect}
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRiskDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddRisk} disabled={uploadingRisk}>
                  {uploadingRisk ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Scores Header */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
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
                <VNPSBadge
                  score={vnps.vnps_score}
                  vnpsClass={vnps.vnps_class}
                  trend={vnps.trend}
                  explanation={vnps.explanation || undefined}
                  eligible={vnps.eligible_for_nps_ask}
                  roizometer={vnps.roizometer}
                  escore={vnps.escore}
                  riskIndex={vnps.risk_index}
                  size="lg"
                  showClass
                />
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
                clientStatus={client?.status}
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

        {/* Contract Timer */}
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-medium text-muted-foreground">Vigência</p>
              {(client.contract_start_date || client.contract_end_date) ? (
                <ContractTimer 
                  startDate={client.contract_start_date}
                  endDate={client.contract_end_date}
                  variant="compact"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Sem contrato</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
              {riskEvents.slice(0, 3).map((risk) => (
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
      <Tabs defaultValue="timeline" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="campos">Campos</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="cx">Momentos CX</TabsTrigger>
            <TabsTrigger value="contracts">Contratos</TabsTrigger>
            <TabsTrigger value="subscriptions">Financeiro</TabsTrigger>
            <TabsTrigger value="sales">Metas & Vendas</TabsTrigger>
            <TabsTrigger value="roi">ROI ({roiEvents.length})</TabsTrigger>
            <TabsTrigger value="risks">Riscos ({riskEvents.length})</TabsTrigger>
            <TabsTrigger value="recommendations">
              Recomendações ({recommendations.filter((r) => r.status === "open").length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agenda">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Agenda de Entregas
              </CardTitle>
              <CardDescription>
                Eventos e materiais incluídos nos produtos do cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ClientAgenda 
                clientId={id!} 
                clientProductIds={clientProducts.map(p => p.id)} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cx">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Momentos CX
              </CardTitle>
              <CardDescription>
                Eventos importantes da vida do cliente para um atendimento humanizado
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ClientLifeEvents clientId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Contratos
              </CardTitle>
              <CardDescription>
                Gerencie os contratos do cliente com arquivos PDF anexados
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ClientContracts clientId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

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

        <TabsContent value="campos">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Campos Personalizados
              </CardTitle>
              <CardDescription>
                Informações personalizadas do cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ClientFieldsSummary clientId={id!} expanded />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Histórico Completo</CardTitle>
              <CardDescription>
                Todas as interações e eventos do cliente em um só lugar
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Timeline 
                events={timeline} 
                clientId={id!} 
                clientName={client?.full_name}
                onCommentAdded={fetchData}
              />
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                          <Badge variant="secondary" className="text-xs">
                            {roi.source === "manual" ? "Manual" : roi.source === "financial" ? "Financeiro" : "Auto"}
                          </Badge>
                        </div>
                        {roi.evidence_snippet && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {roi.evidence_snippet}
                          </p>
                        )}
                        {roi.image_url && (
                          <a 
                            href={roi.image_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block mt-2"
                          >
                            <img
                              src={roi.image_url}
                              alt="Evidência"
                              className="max-w-xs h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                            />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(roi.happened_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {roi.source === "manual" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditRoiDialog(roi)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeletingRoiId(roi.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit ROI Dialog */}
          <Dialog open={!!editingRoiId} onOpenChange={(open) => !open && setEditingRoiId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar ROI</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={editRoiType} onValueChange={setEditRoiType}>
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
                    <Select value={editRoiCategory} onValueChange={setEditRoiCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editRoiType === "tangible" ? (
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
                  <Select value={editRoiImpact} onValueChange={setEditRoiImpact}>
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
                    value={editRoiEvidence}
                    onChange={(e) => setEditRoiEvidence(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRoiId(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEditRoi} disabled={savingEditRoi}>
                  {savingEditRoi ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete ROI Confirmation */}
          <AlertDialog open={!!deletingRoiId} onOpenChange={(open) => !open && !isDeleting && setDeletingRoiId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir evento de ROI?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O evento de ROI será permanentemente removido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteRoi} 
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    "Excluir"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="risks">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Eventos de Risco</CardTitle>
            </CardHeader>
            <CardContent>
              {riskEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum evento de risco registrado. Clique em "Adicionar Risco" para começar.
                </p>
              ) : (
                <div className="space-y-3">
                  {riskEvents.map((risk) => (
                    <div
                      key={risk.id}
                      className="p-4 rounded-lg border border-border"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <AlertTriangle className={`h-4 w-4 ${
                              risk.risk_level === "high"
                                ? "text-red-500"
                                : risk.risk_level === "medium"
                                ? "text-amber-500"
                                : "text-muted-foreground"
                            }`} />
                            <Badge
                              variant="outline"
                              className={
                                risk.risk_level === "high"
                                  ? "border-red-500 text-red-500"
                                  : risk.risk_level === "medium"
                                  ? "border-amber-500 text-amber-500"
                                  : "border-muted-foreground"
                              }
                            >
                              {risk.risk_level === "high"
                                ? "Alto"
                                : risk.risk_level === "medium"
                                ? "Médio"
                                : "Baixo"}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {risk.source === "whatsapp_text" ? "WhatsApp" 
                                : risk.source === "whatsapp_audio" ? "Áudio"
                                : risk.source === "zoom" ? "Zoom"
                                : risk.source === "google_meet" ? "Google Meet"
                                : risk.source === "financial" ? "Financeiro"
                                : "Manual"}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mt-2">{risk.reason}</p>
                          {risk.evidence_snippet && (
                            <p className="text-sm text-muted-foreground mt-1 italic">
                              "{risk.evidence_snippet}"
                            </p>
                          )}
                          {risk.image_url && (
                            <a 
                              href={risk.image_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block mt-2"
                            >
                              <img
                                src={risk.image_url}
                                alt="Evidência"
                                className="max-w-xs h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                              />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(risk.happened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          {risk.source === "system" && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditRiskDialog(risk)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeletingRiskId(risk.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Risk Dialog */}
          <Dialog open={!!editingRiskId} onOpenChange={(open) => !open && setEditingRiskId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Risco</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nível de Risco</Label>
                  <Select value={editRiskLevel} onValueChange={setEditRiskLevel}>
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
                  <Label>Motivo *</Label>
                  <Input
                    placeholder="Ex: Cliente demonstrou frustração..."
                    value={editRiskReason}
                    onChange={(e) => setEditRiskReason(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Evidência (opcional)</Label>
                  <Textarea
                    placeholder="Trecho de conversa ou contexto adicional..."
                    value={editRiskEvidence}
                    onChange={(e) => setEditRiskEvidence(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRiskId(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEditRisk} disabled={savingEditRisk}>
                  {savingEditRisk ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Risk Confirmation */}
          <AlertDialog open={!!deletingRiskId} onOpenChange={(open) => !open && !isDeleting && setDeletingRiskId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir evento de risco?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O evento de risco será permanentemente removido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteRisk} 
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    "Excluir"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
