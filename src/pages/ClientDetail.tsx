import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/ui/loading-screen";
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
import { Timeline, TimelineEvent } from "@/components/client/Timeline";

import { ClientFinancial } from "@/components/client/ClientFinancial";
import { SalesPerformance } from "@/components/client/SalesPerformance";
import { ClientAgenda } from "@/components/client/ClientAgenda";
import { ClientInfoForm, ClientFormData, getEmptyClientFormData, normalizeAdditionalPhones } from "@/components/client/ClientInfoForm";
import { ClientLifeEvents } from "@/components/client/ClientLifeEvents";
import { ClientFieldsSummary } from "@/components/client/ClientFieldsSummary";
import { ClientAvatarUpload } from "@/components/client/ClientAvatarUpload";
import { ClientLogoUpload } from "@/components/client/ClientLogoUpload";
import { ContractTimer } from "@/components/client/ContractTimer";
import { ClientContracts } from "@/components/client/ClientContracts";
import { ClientFormResponses } from "@/components/client/ClientFormResponses";
import { OperationBriefingForm } from "@/components/operations/OperationBriefingForm";
import { ClientRelationships } from "@/components/client/ClientRelationships";
import { ClientDeals } from "@/components/client/ClientDeals";
import { validateCPF, validateCNPJ } from "@/lib/validators";
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Video,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Lock,
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
  Instagram,
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
  instagram?: string;
  bio?: string;
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
  responsible_user_id?: string | null;
  sales_user_id?: string | null;
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

interface FormResponseSummary {
  id: string;
  title: string;
  submitted_at: string;
  fieldCount: number;
}

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

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [clientProducts, setClientProducts] = useState<ClientProduct[]>([]);
  const [score, setScore] = useState<ScoreSnapshot | null>(null);
  const [vnps, setVnps] = useState<VNPSSnapshot | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [roiEvents, setRoiEvents] = useState<RoiEvent[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<{ type: 'network' | 'not_found' | 'permission'; message: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [reprocessingMessages, setReprocessingMessages] = useState(false);
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
  const [formResponseSummaries, setFormResponseSummaries] = useState<FormResponseSummary[]>([]);
  
  // Team users for responsible user selection
  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  
  // Active contract from client_contracts table
  const [activeContract, setActiveContract] = useState<{ start_date: string; end_date: string } | null>(null);
  
  // Account ID for relationships
  const [accountId, setAccountId] = useState<string | null>(null);

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
    
    if (!error) {
      const filtered = (data || []).filter(
        (f) => f.title?.trim().toLowerCase() !== "diagnóstico empresarial"
      );
      setAvailableForms(filtered);
    }
  };

  const fetchTeamUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email")
      .order("name");
    
    if (!error && data) {
      setTeamUsers(data);
    }
  };

  const openFichasTab = () => {
    setSearchParams({ tab: "fichas" });
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
    
    if (userLoading) {
      toast.info("Aguarde, carregando perfil...");
      return;
    }
    
    if (!currentUser?.account_id) {
      toast.error("Perfil não encontrado. Recarregue a página.");
      return;
    }
    
    setSavingProducts(true);

    try {
      // Delete existing client_products
      await supabase
        .from("client_products")
        .delete()
        .eq("client_id", id);

      // Insert new client_products
      if (selectedProductIds.length > 0) {
        const newClientProducts = selectedProductIds.map(productId => ({
          account_id: currentUser.account_id,
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

  // Helper to ensure array fields are always valid arrays (filtering null/undefined)
  const ensureArray = <T,>(value: unknown): T[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is T => item != null);
  };

  const openEditInfoDialog = () => {
    if (!client) return;
    setEditFormData({
      full_name: client.full_name,
      phone_e164: client.phone_e164,
      emails: ensureArray<string>(client.emails),
      additional_phones: normalizeAdditionalPhones(client.additional_phones || []),
      cpf: client.cpf || "",
      rg: (client as any).rg || "",
      cnpj: client.cnpj || "",
      birth_date: client.birth_date || "",
      company_name: client.company_name || "",
      notes: client.notes || "",
      instagram: client.instagram || "",
      instagrams: ensureArray<string>((client as any).instagrams),
      bio: client.bio || "",
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
      business_segment: (client as any).business_segment || "",
      business_niche: (client as any).business_niche || "",
      contract_start_date: client.contract_start_date || "",
      contract_end_date: client.contract_end_date || "",
      is_mls: client.is_mls || false,
      mls_level: client.mls_level || "",
      responsible_user_id: client.responsible_user_id || "",
      pix_key_type: (client as any).pix_key_type || "",
      pix_key: (client as any).pix_key || "",
      additional_pix_keys: ensureArray((client as any).additional_pix_keys),
      bank_code: (client as any).bank_code || "",
      bank_name: (client as any).bank_name || "",
      bank_agency: (client as any).bank_agency || "",
      bank_account: (client as any).bank_account || "",
      bank_account_type: (client as any).bank_account_type || "checking",
      additional_bank_accounts: ensureArray((client as any).additional_bank_accounts),
      companies: ensureArray((client as any).companies),
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
          phone_e164: editFormData.phone_e164,
          emails: editFormData.emails,
          additional_phones: editFormData.additional_phones as unknown as import("@/integrations/supabase/types").Json,
          cpf: editFormData.cpf.replace(/\D/g, '') || null,
          cnpj: editFormData.cnpj.replace(/\D/g, '') || null,
          birth_date: editFormData.birth_date || null,
          company_name: editFormData.company_name || null,
          notes: editFormData.notes || null,
          instagram: editFormData.instagram || null,
          instagrams: editFormData.instagrams || [],
          bio: editFormData.bio || null,
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
          responsible_user_id: editFormData.responsible_user_id || null,
          companies: JSON.parse(JSON.stringify(editFormData.companies || [])),
        })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setClient({
        ...client,
        full_name: editFormData.full_name.trim(),
        phone_e164: editFormData.phone_e164,
        emails: editFormData.emails,
        additional_phones: editFormData.additional_phones,
        cpf: editFormData.cpf,
        cnpj: editFormData.cnpj,
        birth_date: editFormData.birth_date,
        company_name: editFormData.company_name,
        notes: editFormData.notes,
        instagram: editFormData.instagram,
        instagrams: editFormData.instagrams,
        bio: editFormData.bio,
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
        responsible_user_id: editFormData.responsible_user_id,
        companies: editFormData.companies,
      } as any);

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
    setFetchError(null);

    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientError) {
        console.error("Client fetch error:", clientError);
        
        // Network error (Failed to fetch, ETIMEDOUT, etc)
        if (clientError.message?.includes('Failed to fetch') || 
            clientError.message?.includes('NetworkError') ||
            clientError.message?.includes('fetch')) {
          setFetchError({ 
            type: 'network', 
            message: 'Erro de conexão. Verifique sua internet.' 
          });
          setLoading(false);
          return;
        }
        
        // Client not found (PGRST116 = single row not found)
        if (clientError.code === 'PGRST116') {
          setFetchError({ 
            type: 'not_found', 
            message: 'Cliente não encontrado.' 
          });
          setLoading(false);
          return;
        }
        
        // Permission error (RLS)
        if (clientError.code === '42501' || clientError.code === 'PGRST301') {
          setFetchError({ 
            type: 'permission', 
            message: 'Sem permissão para visualizar este cliente.' 
          });
          setLoading(false);
          return;
        }
        
        // Other errors - treat as network
        setFetchError({ 
          type: 'network', 
          message: clientError.message || 'Erro desconhecido.' 
        });
        setLoading(false);
        return;
      }
      
      if (!clientData) {
        console.error("Client not found for ID:", id);
        setFetchError({ 
          type: 'not_found', 
          message: 'Cliente não encontrado.' 
        });
        setLoading(false);
        return;
      }
      
      setAccountId(clientData.account_id);
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

      // Fetch all independent data in parallel
      const [
        clientProductsResult,
        activeContractResult,
        scoreResult,
        vnpsResult,
        roiResult,
        riskResult,
        recResult,
        messagesResult,
        followupsResult,
        lifeEventsResult,
        formResponsesResult,
        attendanceResult,
        subscriptionsResult,
        allRiskResult,
      ] = await Promise.all([
        supabase.from("client_products").select("product_id, products(id, name)").eq("client_id", id),
        supabase.from("client_contracts").select("start_date, end_date").eq("client_id", id).eq("status", "active").order("start_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("score_snapshots").select("*").eq("client_id", id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("vnps_snapshots").select("*").eq("client_id", id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("roi_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }),
        supabase.from("risk_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }),
        supabase.from("recommendations").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("message_events").select("*").eq("client_id", id).order("sent_at", { ascending: false }).limit(200),
        supabase.from("client_followups").select("*, users(name, avatar_url)").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("client_life_events").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
        supabase.from("form_responses").select("*, forms(title)").eq("client_id", id).order("submitted_at", { ascending: false }).limit(100),
        supabase.from("attendance").select("*, events(title, address, scheduled_at)").eq("client_id", id).not("event_id", "is", null).order("join_time", { ascending: false }).limit(100),
        supabase.from("client_subscriptions").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
        supabase.from("risk_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }).limit(100),
      ]);

      // Process client products
      const products = (clientProductsResult.data || [])
        .map((cp: any) => cp.products)
        .filter(Boolean) as ClientProduct[];
      setClientProducts(products);

      // Process active contract
      setActiveContract(activeContractResult.data || null);

      // Process score
      if (scoreResult.data) {
        setScore(scoreResult.data as ScoreSnapshot);
      }

      // Process V-NPS
      if (vnpsResult.data) {
        setVnps(vnpsResult.data as VNPSSnapshot);
      }

      // Process ROI events
      const roiData = roiResult.data || [];
      setRoiEvents(roiData as RoiEvent[]);

      // Process risk events
      setRiskEvents(riskResult.data || []);

      // Process recommendations
      const recData = recResult.data || [];
      setRecommendations(recData as Recommendation[]);

      // Build timeline
      const timelineItems: TimelineEvent[] = [];

      // Add messages
      (messagesResult.data || []).forEach((msg: any) => {
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
      roiData.forEach((roi: any) => {
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

      // Add risk events
      (allRiskResult.data || []).forEach((risk: any) => {
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
      recData.forEach((rec: any) => {
        timelineItems.push({
          id: rec.id,
          type: "recommendation",
          title: rec.title,
          description: rec.action_text,
          timestamp: rec.created_at,
          metadata: { priority: rec.priority, status: rec.status },
        });
      });

      // Add followups
      (followupsResult.data || []).forEach((followup: any) => {
        const isNote = followup.type === "note";
        const isFinancialNote = followup.type === "financial_note";
        const isSalesNote = followup.type === "sales_note";
        timelineItems.push({
          id: followup.id,
          type: isSalesNote ? "sales" : isFinancialNote ? "financial" : isNote ? "comment" : "followup",
          title: followup.title || (isNote ? "Comentário" : isFinancialNote ? "Nota Financeira" : isSalesNote ? "Nota de Vendas" : followup.file_name || "Arquivo anexado"),
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
            updated_at: followup.updated_at,
          },
        });
      });

      // Add life events
      (lifeEventsResult.data || []).forEach((event: any) => {
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
      const formResponseData = (formResponsesResult.data || []).map((response: any) => ({
        id: response.id,
        title: response.forms?.title || "Formulário",
        submitted_at: response.submitted_at,
        fieldCount: Object.keys(response.responses || {}).length,
      }));
      setFormResponseSummaries(formResponseData);

      (formResponsesResult.data || []).forEach((response: any) => {
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

      // Add attendance records
      (attendanceResult.data || []).forEach((att: any) => {
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

      // Add subscriptions
      (subscriptionsResult.data || []).forEach((sub: any) => {
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
      setTimeline(timelineItems);

    } catch (error: any) {
      console.error("Error fetching client data:", error);
      
      // Handle non-Supabase errors (pure network errors)
      if (error?.message?.includes('Failed to fetch') || 
          error?.message?.includes('fetch') ||
          error instanceof TypeError) {
        setFetchError({ 
          type: 'network', 
          message: 'Falha na conexão. Tente novamente.' 
        });
      } else {
        setFetchError({ 
          type: 'network', 
          message: error?.message || 'Erro ao carregar dados.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Reprocess missing messages from UAZAPI for this client
  const handleReprocessMessages = async () => {
    if (!client?.phone_e164) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    if (!accountId) {
      toast.error("Conta não carregada");
      return;
    }
    setReprocessingMessages(true);
    try {
      // Find an active WhatsApp integration for this account
      const { data: integration, error: integrationError } = await (supabase as any)
        .from("integrations")
        .select("id")
        .eq("account_id", accountId)
        .eq("provider", "uazapi")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (integrationError || !integration) {
        toast.error("Nenhuma integração WhatsApp ativa encontrada");
        return;
      }

      // Sync last 30 days of messages for this phone only
      const start = new Date();
      start.setDate(start.getDate() - 30);

      const { data, error } = await supabase.functions.invoke("sync-uazapi-history-to-zapp", {
        body: {
          integration_id: integration.id,
          target_phone: client.phone_e164,
          start: start.toISOString(),
          max_messages_per_chat: 5000,
        },
      });

      if (error) throw error;

      const inserted = (data as any)?.stats?.messagesInserted ?? 0;
      const duplicates = (data as any)?.stats?.duplicates ?? 0;
      toast.success(
        inserted > 0
          ? `${inserted} mensagem(ns) recuperada(s)${duplicates ? ` • ${duplicates} já existiam` : ""}`
          : "Nenhuma mensagem nova encontrada"
      );
      await refreshTimeline();
    } catch (err: any) {
      console.error("Erro ao reprocessar mensagens:", err);
      toast.error(err?.message || "Erro ao reprocessar mensagens");
    } finally {
      setReprocessingMessages(false);
    }
  };

  // Lightweight timeline-only refresh (no full page loading state)
  const refreshTimeline = async () => {
    if (!id || !accountId) return;
    
    try {
      const [
        messagesResult,
        followupsResult,
        lifeEventsResult,
        formResponsesResult,
        attendanceResult,
        subscriptionsResult,
        allRiskResult,
        roiResult,
        recResult,
      ] = await Promise.all([
        supabase.from("message_events").select("*").eq("client_id", id).order("sent_at", { ascending: false }).limit(200),
        supabase.from("client_followups").select("*, users(name, avatar_url)").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("client_life_events").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
        supabase.from("form_responses").select("*, forms(title)").eq("client_id", id).order("submitted_at", { ascending: false }).limit(100),
        supabase.from("attendance").select("*, events(title, address, scheduled_at)").eq("client_id", id).not("event_id", "is", null).order("join_time", { ascending: false }).limit(100),
        supabase.from("client_subscriptions").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
        supabase.from("risk_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }).limit(100),
        supabase.from("roi_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }),
        supabase.from("recommendations").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      ]);

      const timelineItems: TimelineEvent[] = [];

      // Add messages
      (messagesResult.data || []).forEach((msg: any) => {
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
      (roiResult.data || []).forEach((roi: any) => {
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

      // Add risk events
      (allRiskResult.data || []).forEach((risk: any) => {
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
      (recResult.data || []).forEach((rec: any) => {
        timelineItems.push({
          id: rec.id,
          type: "recommendation",
          title: rec.title,
          description: rec.action_text,
          timestamp: rec.created_at,
          metadata: { priority: rec.priority, status: rec.status },
        });
      });

      // Add followups
      (followupsResult.data || []).forEach((followup: any) => {
        const isNote = followup.type === "note";
        const isFinancialNote = followup.type === "financial_note";
        const isSalesNote = followup.type === "sales_note";
        timelineItems.push({
          id: followup.id,
          type: isSalesNote ? "sales" : isFinancialNote ? "financial" : isNote ? "comment" : "followup",
          title: followup.title || (isNote ? "Comentário" : isFinancialNote ? "Nota Financeira" : isSalesNote ? "Nota de Vendas" : followup.file_name || "Arquivo anexado"),
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
            updated_at: followup.updated_at,
          },
        });
      });

      // Add life events
      (lifeEventsResult.data || []).forEach((event: any) => {
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
      const formResponseData = (formResponsesResult.data || []).map((response: any) => ({
        id: response.id,
        title: response.forms?.title || "Formulário",
        submitted_at: response.submitted_at,
        fieldCount: Object.keys(response.responses || {}).length,
      }));
      setFormResponseSummaries(formResponseData);

      (formResponsesResult.data || []).forEach((response: any) => {
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

      // Add attendance records
      (attendanceResult.data || []).forEach((att: any) => {
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

      // Add subscriptions
      (subscriptionsResult.data || []).forEach((sub: any) => {
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

      // Sort by timestamp - no limit, show all
      timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimeline(timelineItems);

      // Also update ROI and recommendations state
      setRoiEvents(roiResult.data || []);
      setRecommendations((recResult.data || []) as Recommendation[]);
    } catch (error) {
      console.error("Error refreshing timeline:", error);
      // Don't clear existing timeline data on error
    }
  };

  useEffect(() => {
    const maxRetries = 2;
    
    const fetchWithRetry = async () => {
      await fetchData();
    };
    
    fetchWithRetry();
    fetchAvailableForms();
    fetchTeamUsers();
    
    // Reset retry count when id changes
    setRetryCount(0);
  }, [id]);
  
  // Auto-retry on network errors
  useEffect(() => {
    const maxRetries = 2;
    if (fetchError?.type === 'network' && retryCount < maxRetries && !loading) {
      const timer = setTimeout(() => {
        console.log(`Auto-retrying fetch (attempt ${retryCount + 1}/${maxRetries})...`);
        setRetryCount(prev => prev + 1);
        fetchData();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [fetchError, retryCount, loading]);

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
            return updated;
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
            return updated;
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
            return updated;
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
              return updated;
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
              title: followup.title || (isNote ? "Comentário" : isFinancialNote ? "Nota Financeira" : isSalesNote ? "Nota de Vendas" : followup.file_name || "Arquivo anexado"),
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
                updated_at: followup.updated_at,
              },
            };
            const updated = [newEvent, ...prev.filter(e => e.id !== followup.id)];
            updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return updated;
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
            return updated;
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
    if (!id || !client || !currentUser?.account_id) return;

    setUploadingRoi(true);
    try {

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
        account_id: currentUser.account_id,
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
    return <LoadingScreen message="Carregando cliente..." fullScreen={false} />;
  }

  // Network error - show retry button
  if (fetchError?.type === 'network') {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Erro de Conexão</h2>
        <p className="text-muted-foreground mb-4 text-center">{fetchError.message}</p>
        <Button onClick={() => { setRetryCount(0); fetchData(); }} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar Novamente
        </Button>
        <Button variant="ghost" asChild className="mt-2">
          <Link to="/clients">Voltar para Clientes</Link>
        </Button>
      </div>
    );
  }

  // Permission error - show access denied
  if (fetchError?.type === 'permission') {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Lock className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Acesso Negado</h2>
        <p className="text-muted-foreground mb-4 text-center">{fetchError.message}</p>
        <Button asChild>
          <Link to="/clients">Voltar para Clientes</Link>
        </Button>
      </div>
    );
  }

  // Client not found or no client data
  if (fetchError?.type === 'not_found' || !client) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Cliente Não Encontrado</h2>
        <p className="text-muted-foreground mb-4">O cliente solicitado não existe ou foi removido.</p>
        <Button asChild>
          <Link to="/clients">Voltar para Clientes</Link>
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
            <Link to="/clients">
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
                  <span className="truncate max-w-[150px]">
                    {typeof client.emails[0] === 'object' && client.emails[0] !== null
                      ? (client.emails[0] as any).email
                      : client.emails[0]}
                  </span>
                  {client.emails.length > 1 && ` +${client.emails.length - 1}`}
                </span>
              )}
              {client.instagram && (
                <a
                  href={`https://instagram.com/${client.instagram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-pink-600 hover:text-pink-700 hover:underline transition-colors"
                >
                  <Instagram className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[120px]">
                    @{client.instagram.replace(/^@/, '')}
                  </span>
                </a>
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
            
            {/* Responsáveis: Consultor (Operações) e Vendedor (Vendas) */}
            {(client.responsible_user_id || client.sales_user_id) && (
              <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-muted-foreground">
                {client.responsible_user_id && (() => {
                  const consultant = teamUsers.find(u => u.id === client.responsible_user_id);
                  return consultant ? (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">Consultor:</span>
                      <span className="font-medium text-foreground">{consultant.name}</span>
                    </span>
                  ) : null;
                })()}
                {client.sales_user_id && (() => {
                  const salesperson = teamUsers.find(u => u.id === client.sales_user_id);
                  return salesperson ? (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-emerald-600" />
                      <span className="text-muted-foreground">Vendedor:</span>
                      <span className="font-medium text-foreground">{salesperson.name}</span>
                    </span>
                  ) : null;
                })()}
              </div>
            )}
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
                  showBasicFields={true}
                  teamUsers={teamUsers}
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

      {formResponseSummaries.length > 0 && searchParams.get("tab") !== "fichas" && (
        <Card className="shadow-card border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Ficha preenchida encontrada</p>
                  <p className="text-sm text-muted-foreground">
                    {formResponseSummaries[0].title} • {formResponseSummaries[0].fieldCount} campo(s) • {format(new Date(formResponseSummaries[0].submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <Button onClick={openFichasTab} className="shrink-0">
                <FileText className="h-4 w-4 mr-2" />
                Abrir ficha
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content based on active tab from sidebar */}
      {(() => {
        const activeTab = searchParams.get("tab") || "timeline";
        switch (activeTab) {
          case "timeline":
            return (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Histórico Completo</CardTitle>
                      <CardDescription>
                        Todas as interações e eventos do cliente em um só lugar
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReprocessMessages}
                      disabled={reprocessingMessages || !client?.phone_e164}
                      title={!client?.phone_e164 ? "Cliente sem telefone cadastrado" : "Reenviar eventos do WhatsApp ao backend"}
                    >
                      {reprocessingMessages ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Reprocessar mensagens faltantes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <Timeline 
                    events={timeline} 
                    clientId={id!} 
                    clientName={client?.full_name}
                    onCommentAdded={refreshTimeline}
                  />
                </CardContent>
              </Card>
            );
          case "deals":
            return (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Negócios
                  </CardTitle>
                  <CardDescription>
                    Negociações e oportunidades de vendas com este cliente
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <ClientDeals clientId={id!} clientName={client?.full_name} />
                </CardContent>
              </Card>
            );
          case "fichas":
            return (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Fichas
                  </CardTitle>
                  <CardDescription>
                    Formulários preenchidos pelo cliente
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <ClientFormResponses clientId={id!} />
                </CardContent>
              </Card>
            );
          case "briefing":
            return (
              <OperationBriefingForm
                clientId={id!}
              />
            );
          case "campos":
            return (
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
            );
          case "agenda":
            return (
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
                    key={id}
                    clientId={id!} 
                    clientProductIds={clientProducts.map(p => p.id)} 
                  />
                </CardContent>
              </Card>
            );
          case "cx":
            return (
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
            );
          case "vinculos":
            return accountId ? (
              <ClientRelationships clientId={id!} accountId={accountId} />
            ) : null;
          case "contracts":
            return (
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
            );
          case "subscriptions":
            return (
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <ClientFinancial clientId={id!} />
                </CardContent>
              </Card>
            );
          case "sales":
            return (
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <SalesPerformance clientId={id!} />
                </CardContent>
              </Card>
            );
          case "roi":
            return (
              <>
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
                                <Badge variant={roi.roi_type === "tangible" ? "default" : "secondary"}>
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
                                  {roi.impact === "high" ? "Alto" : roi.impact === "medium" ? "Médio" : "Baixo"}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {roi.source === "manual" ? "Manual" : roi.source === "financial" ? "Financeiro" : "Auto"}
                                </Badge>
                              </div>
                              {roi.evidence_snippet && (
                                <p className="text-sm text-muted-foreground mt-2">{roi.evidence_snippet}</p>
                              )}
                              {roi.image_url && (
                                <a href={roi.image_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                  <img src={roi.image_url} alt="Evidência" className="max-w-xs h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(roi.happened_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              {roi.source === "manual" && (
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRoiDialog(roi)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingRoiId(roi.id)}>
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
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tangible">Tangível</SelectItem>
                              <SelectItem value="intangible">Intangível</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <Select value={editRoiCategory} onValueChange={setEditRoiCategory}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
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
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixo</SelectItem>
                            <SelectItem value="medium">Médio</SelectItem>
                            <SelectItem value="high">Alto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Evidência</Label>
                        <Textarea placeholder="Descreva a evidência de ROI..." value={editRoiEvidence} onChange={(e) => setEditRoiEvidence(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingRoiId(null)}>Cancelar</Button>
                      <Button onClick={handleSaveEditRoi} disabled={savingEditRoi}>
                        {savingEditRoi ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>) : "Salvar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog open={!!deletingRoiId} onOpenChange={(open) => !open && !isDeleting && setDeletingRoiId(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir evento de ROI?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteRoi} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>) : "Excluir"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            );
          case "risks":
            return (
              <>
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-base">Eventos de Risco</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {riskEvents.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhum evento de risco registrado.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {riskEvents.map((risk) => (
                          <div key={risk.id} className="p-4 rounded-lg border border-border">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <AlertTriangle className={`h-4 w-4 ${
                                    risk.risk_level === "high" ? "text-destructive" : risk.risk_level === "medium" ? "text-warning" : "text-muted-foreground"
                                  }`} />
                                  <Badge variant="outline" className={
                                    risk.risk_level === "high" ? "border-destructive text-destructive" : risk.risk_level === "medium" ? "border-warning text-warning" : "border-muted-foreground"
                                  }>
                                    {risk.risk_level === "high" ? "Alto" : risk.risk_level === "medium" ? "Médio" : "Baixo"}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {risk.source === "whatsapp_text" ? "WhatsApp" : risk.source === "whatsapp_audio" ? "Áudio" : risk.source === "zoom" ? "Zoom" : risk.source === "google_meet" ? "Google Meet" : risk.source === "financial" ? "Financeiro" : "Manual"}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium mt-2">{risk.reason}</p>
                                {risk.evidence_snippet && (
                                  <p className="text-sm text-muted-foreground mt-1 italic">"{risk.evidence_snippet}"</p>
                                )}
                                {risk.image_url && (
                                  <a href={risk.image_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                    <img src={risk.image_url} alt="Evidência" className="max-w-xs h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(risk.happened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                                {risk.source === "system" && (
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRiskDialog(risk)}>
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingRiskId(risk.id)}>
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

                <Dialog open={!!editingRiskId} onOpenChange={(open) => !open && setEditingRiskId(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Risco</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Nível de Risco</Label>
                        <Select value={editRiskLevel} onValueChange={setEditRiskLevel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixo</SelectItem>
                            <SelectItem value="medium">Médio</SelectItem>
                            <SelectItem value="high">Alto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Motivo *</Label>
                        <Input placeholder="Ex: Cliente demonstrou frustração..." value={editRiskReason} onChange={(e) => setEditRiskReason(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Evidência (opcional)</Label>
                        <Textarea placeholder="Trecho de conversa ou contexto adicional..." value={editRiskEvidence} onChange={(e) => setEditRiskEvidence(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingRiskId(null)}>Cancelar</Button>
                      <Button onClick={handleSaveEditRisk} disabled={savingEditRisk}>
                        {savingEditRisk ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>) : "Salvar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog open={!!deletingRiskId} onOpenChange={(open) => !open && !isDeleting && setDeletingRiskId(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir evento de risco?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteRisk} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>) : "Excluir"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            );
          case "recommendations":
            return (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-base">Recomendações</CardTitle>
                </CardHeader>
                <CardContent>
                  {recommendations.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma recomendação disponível.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recommendations.map((rec) => (
                        <div key={rec.id} className="p-4 rounded-lg border border-border">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Lightbulb className="h-4 w-4 text-warning" />
                                <Badge variant="outline">{rec.priority}</Badge>
                                <Badge variant={rec.status === "open" ? "default" : "secondary"}>
                                  {rec.status === "open" ? "Aberta" : rec.status === "done" ? "Feita" : "Descartada"}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium mt-2">{rec.title}</p>
                              {rec.action_text && (
                                <p className="text-sm text-muted-foreground mt-1">{rec.action_text}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(rec.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              {rec.status === "open" && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-success hover:text-success"
                                    onClick={() => handleUpdateRecommendation(rec.id, "done")}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => handleUpdateRecommendation(rec.id, "dismissed")}
                                  >
                                    <X className="h-3.5 w-3.5" />
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
            );
          default:
            return null;
        }
      })()}
    </div>
  );
}
