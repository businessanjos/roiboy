import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useDeals, Deal, DealStage } from "@/hooks/useDeals";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Search,
  MoreHorizontal,
  UserPlus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Users,
  UserCheck,
  MessageSquare,
  MessageCircle,
  X,
  Clock,
  TrendingUp,
  Settings2,
  Trophy,
  XCircle,
  DollarSign,
  ChevronRight,
  Upload,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { DealDetailSheet } from "@/components/sales/DealDetailSheet";
import { toast } from "sonner";
import { LeadCustomFieldsManager, LeadFieldValueEditor, type LeadCustomField, FieldValueBadge, type FieldOption } from "@/components/custom-fields";
import { CustomField } from "@/components/custom-fields";
import { LeadImportPreview, ImportLeadRow, ExistingLeadInfo, DuplicateMatchType } from "@/components/leads/LeadImportPreview";
import { useZappNavigation } from "@/hooks/useZappNavigation";

const LEAD_SOURCES = [
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "indicacao", label: "Indicação" },
  { value: "evento", label: "Evento" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

const LEAD_STATUS = [
  { value: "new", label: "Novo", color: "bg-blue-500" },
  { value: "contacted", label: "Contatado", color: "bg-amber-500" },
  { value: "qualified", label: "Qualificado", color: "bg-emerald-500" },
  { value: "unqualified", label: "Não Qualificado", color: "bg-gray-500" },
];

const REVENUE_RANGES = [
  { value: "ate_81k", label: "Até R$ 81 mil" },
  { value: "81k_360k", label: "R$ 81 mil - R$ 360 mil" },
  { value: "360k_1m", label: "R$ 360 mil - R$ 1 milhão" },
  { value: "1m_5m", label: "R$ 1 milhão - R$ 5 milhões" },
  { value: "acima_5m", label: "Acima de R$ 5 milhões" },
];

// Normalize revenue range from various formats to our standard values
const normalizeRevenueRange = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  if (normalized.includes("81") && normalized.includes("360")) return "81k_360k";
  if (normalized.includes("360") && (normalized.includes("1m") || normalized.includes("milhao") || normalized.includes("1.000"))) return "360k_1m";
  if ((normalized.includes("1m") || normalized.includes("milhao") || normalized.includes("1.000")) && (normalized.includes("5m") || normalized.includes("5.000"))) return "1m_5m";
  if (normalized.includes("acima") || normalized.includes("5m") || normalized.includes("5.000") || normalized.includes("mais")) return "acima_5m";
  if (normalized.includes("ate") || normalized.includes("81") || normalized.includes("menor")) return "ate_81k";
  
  return undefined;
};

export default function Leads() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const {
    leads,
    loading,
    newLeads,
    contactedLeads,
    qualifiedLeads,
    createLead,
    updateLead,
    deleteLead,
    markAsConvertedToDeal,
  } = useLeads();
  const { deals, createDeal, stages, moveDeal, markAsWon, markAsLost, reopenDeal } = useDeals();
  const { openZappConversation, loading: zappLoading } = useZappNavigation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterRevenueRange, setFilterRevenueRange] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  
  // Import state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportLeadRow[]>([]);
  const [importing, setImporting] = useState(false);
  // Deal detail state
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDealDetailOpen, setIsDealDetailOpen] = useState(false);
  
  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, any>>>({});
  
  // Flow state for new lead creation and deal conversion
  const [dialogStep, setDialogStep] = useState<'phone' | 'lead-form' | 'deal-form'>('phone');
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [existingClient, setExistingClient] = useState<{ id: string; full_name: string; phone_e164: string } | null>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [leadForDeal, setLeadForDeal] = useState<Lead | null>(null);

  // Get deals for the current lead
  const getLeadDeals = useCallback((leadId: string) => {
    return deals.filter(d => d.lead_id === leadId);
  }, [deals]);
  
  // Deal form state
  const [dealFormData, setDealFormData] = useState({
    title: "",
    value: "",
    stage_id: "",
    notes: "",
  });

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    source: "",
    notes: "",
  });

  // Fetch custom fields
  const fetchCustomFields = useCallback(async () => {
    const { data } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("is_active", true)
      .eq("show_in_leads", true)
      .order("display_order");
    
    if (data) {
      setCustomFields(data.map(f => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type as CustomField["field_type"],
        options: (f.options as unknown as FieldOption[]) || [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
        show_in_clients: f.show_in_clients,
      })));
    }
  }, []);

  // Fetch field values for leads
  const fetchFieldValues = useCallback(async () => {
    if (leads.length === 0) return;
    
    const leadIds = leads.map(l => l.id);
    const { data } = await supabase
      .from("lead_field_values")
      .select("*")
      .in("lead_id", leadIds);
    
    if (data) {
      const valuesMap: Record<string, Record<string, any>> = {};
      data.forEach(fv => {
        if (!valuesMap[fv.lead_id]) valuesMap[fv.lead_id] = {};
        const value = fv.value_boolean ?? fv.value_number ?? fv.value_text ?? fv.value_date ?? fv.value_json;
        valuesMap[fv.lead_id][fv.field_id] = value;
      });
      setFieldValues(valuesMap);
    }
  }, [leads]);

  useEffect(() => {
    fetchCustomFields();
  }, [fetchCustomFields]);

  useEffect(() => {
    if (leads.length > 0) {
      fetchFieldValues();
    }
  }, [leads, fetchFieldValues]);

  const handleFieldValueChange = (leadId: string, fieldId: string, newValue: any) => {
    setFieldValues(prev => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || {}),
        [fieldId]: newValue
      }
    }));
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      source: "",
      notes: "",
    });
    setDealFormData({
      title: "",
      value: "",
      stage_id: "",
      notes: "",
    });
    setSelectedLead(null);
    setExistingClient(null);
    setLeadForDeal(null);
    setDialogStep('phone');
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      full_name: lead.full_name,
      phone: lead.phone || "",
      email: lead.email || "",
      source: lead.source || "",
      notes: lead.notes || "",
    });
    setDialogStep('lead-form');
    setIsDialogOpen(true);
  };

  const handlePhoneCheck = async () => {
    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 8) {
      toast.error("Informe um telefone válido");
      return;
    }
    
    setCheckingPhone(true);
    try {
      const normalizedPhone = formData.phone.replace(/\D/g, '');
      
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164")
        .or(`phone_e164.ilike.%${normalizedPhone}%`)
        .limit(1);
      
      if (data && data.length > 0) {
        // Client exists - go to deal form
        setExistingClient(data[0]);
        const firstStage = stages.sort((a, b) => a.display_order - b.display_order)[0];
        setDealFormData({
          title: `Novo negócio - ${data[0].full_name}`,
          value: "",
          stage_id: firstStage?.id || "",
          notes: "",
        });
        setDialogStep('deal-form');
      } else {
        // No client - go to lead form
        setExistingClient(null);
        setDialogStep('lead-form');
      }
    } catch (error) {
      console.error("Error checking phone:", error);
      toast.error("Erro ao verificar telefone");
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) return;

    // If editing, just update
    if (selectedLead) {
      await updateLead(selectedLead.id, formData);
      setIsDialogOpen(false);
      resetForm();
      return;
    }

    // Create new lead
    await createLead(formData);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleCreateDeal = async () => {
    setCreatingDeal(true);
    try {
      // Create deal from existing client or lead
      if (existingClient) {
        const deal = await createDeal({
          title: dealFormData.title || `Novo negócio - ${existingClient.full_name}`,
          client_id: existingClient.id,
          stage_id: dealFormData.stage_id || undefined,
          value: dealFormData.value ? parseFloat(dealFormData.value) : undefined,
          notes: dealFormData.notes || undefined,
        });

        if (deal) {
          toast.success("Negócio criado com sucesso!");
          setIsDialogOpen(false);
          resetForm();
          navigate("/pipeline");
        }
      } else if (leadForDeal) {
        // Create deal from lead
        const deal = await createDeal({
          title: dealFormData.title || `Novo negócio - ${leadForDeal.full_name}`,
          lead_id: leadForDeal.id,
          contact_name: leadForDeal.full_name,
          contact_phone: leadForDeal.phone || undefined,
          contact_email: leadForDeal.email || undefined,
          stage_id: dealFormData.stage_id || undefined,
          value: dealFormData.value ? parseFloat(dealFormData.value) : undefined,
          notes: dealFormData.notes || leadForDeal.notes || undefined,
          source: leadForDeal.source || undefined,
        });

        if (deal) {
          await markAsConvertedToDeal(leadForDeal.id, deal.id);
          toast.success("Lead convertido em negócio!");
          setIsDialogOpen(false);
          resetForm();
          navigate("/pipeline");
        }
      }
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Erro ao criar negócio");
    } finally {
      setCreatingDeal(false);
    }
  };

  const handleCreateLeadAnyway = () => {
    setExistingClient(null);
    setDialogStep('lead-form');
  };

  const handleDelete = async () => {
    if (deleteLeadId) {
      await deleteLead(deleteLeadId);
      setDeleteLeadId(null);
    }
  };

  const openDealDialogForLead = (lead: Lead) => {
    setLeadForDeal(lead);
    const firstStage = stages.sort((a, b) => a.display_order - b.display_order)[0];
    setDealFormData({
      title: `Novo negócio - ${lead.full_name}`,
      value: "",
      stage_id: firstStage?.id || "",
      notes: "",
    });
    setDialogStep('deal-form');
    setIsDialogOpen(true);
  };

  const handleStatusChange = async (leadId: string, status: string) => {
    await updateLead(leadId, { status });
  };

  // Import CSV handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast.error("Arquivo CSV vazio ou inválido");
      return;
    }

    // Detect delimiter: pipe, semicolon, or comma
    const firstLine = lines[0];
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    
    const delimiter = pipeCount > semicolonCount && pipeCount > commaCount 
      ? "|" 
      : semicolonCount > commaCount ? ";" : ",";

    const headerLine = firstLine.toLowerCase();
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ""));
    
    // Map column headers to field names (supports Portuguese, English, Pipedrive formats)
    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const normalized = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Clean N/A values helper - will be used later
      
      // Basic info
      if (normalized.includes("nome") || normalized.includes("name")) colMap.full_name = colMap.full_name ?? i;
      if (normalized.includes("telefone") || normalized.includes("phone") || normalized.includes("celular") || normalized.includes("whatsapp")) {
        // Check if it's a secondary phone
        if (normalized.includes("2") || normalized.includes("secundario") || normalized.includes("outro")) {
          colMap.phone2 = colMap.phone2 ?? i;
        } else {
          colMap.phone = colMap.phone ?? i;
        }
      }
      if (normalized.includes("email") || normalized.includes("e-mail")) {
        if (normalized.includes("2") || normalized.includes("secundario")) {
          colMap.email2 = colMap.email2 ?? i;
        } else {
          colMap.email = colMap.email ?? i;
        }
      }
      if (normalized.includes("origem") || normalized.includes("source") || normalized.includes("fonte") || normalized.includes("lead source")) colMap.source = colMap.source ?? i;
      if (normalized.includes("observ") || normalized.includes("nota") || normalized.includes("note") || normalized.includes("anotac")) colMap.notes = colMap.notes ?? i;
      
      // Documents
      if (normalized.includes("cpf") && !normalized.includes("cnpj")) colMap.cpf = colMap.cpf ?? i;
      if (normalized.includes("rg") && !normalized.includes("origem")) colMap.rg = colMap.rg ?? i;
      if (normalized.includes("cnpj")) colMap.cnpj = colMap.cnpj ?? i;
      
      // Birth date
      if (normalized.includes("nascimento") || normalized.includes("birth") || normalized.includes("aniversario")) colMap.birth_date = colMap.birth_date ?? i;
      
      // Company/Business
      if (normalized.includes("empresa") || normalized.includes("company") || normalized.includes("razao social")) colMap.company_name = colMap.company_name ?? i;
      if (normalized.includes("segmento") || normalized.includes("segment")) colMap.business_segment = colMap.business_segment ?? i;
      if (normalized.includes("nicho") || normalized.includes("niche")) colMap.business_niche = colMap.business_niche ?? i;
      
      // Social
      if (normalized.includes("instagram") || normalized.includes("insta")) {
        if (normalized.includes("2") || normalized.includes("empresa")) {
          colMap.instagram2 = colMap.instagram2 ?? i;
        } else {
          colMap.instagram = colMap.instagram ?? i;
        }
      }
      
      // Revenue
      if (normalized.includes("faturamento") || normalized.includes("revenue") || normalized.includes("receita")) colMap.revenue_range = colMap.revenue_range ?? i;
      
      // Residential address
      if (normalized.includes("cep") || normalized.includes("zip") || normalized.includes("codigo postal")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_zip_code = colMap.business_zip_code ?? i;
        } else {
          colMap.zip_code = colMap.zip_code ?? i;
        }
      }
      if ((normalized.includes("rua") || normalized.includes("endereco") || normalized.includes("logradouro") || normalized.includes("street")) && !normalized.includes("numero")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_street = colMap.business_street ?? i;
        } else {
          colMap.street = colMap.street ?? i;
        }
      }
      if (normalized.includes("numero") || normalized.includes("number")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_street_number = colMap.business_street_number ?? i;
        } else {
          colMap.street_number = colMap.street_number ?? i;
        }
      }
      if (normalized.includes("complemento") || normalized.includes("complement")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_complement = colMap.business_complement ?? i;
        } else {
          colMap.complement = colMap.complement ?? i;
        }
      }
      if (normalized.includes("bairro") || normalized.includes("neighborhood")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_neighborhood = colMap.business_neighborhood ?? i;
        } else {
          colMap.neighborhood = colMap.neighborhood ?? i;
        }
      }
      if (normalized.includes("cidade") || normalized.includes("city")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_city = colMap.business_city ?? i;
        } else {
          colMap.city = colMap.city ?? i;
        }
      }
      if (normalized.includes("estado") || normalized.includes("uf") || normalized.includes("state")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_state = colMap.business_state ?? i;
        } else {
          colMap.state = colMap.state ?? i;
        }
      }
      
      // Banking
      if ((normalized.includes("banco") || normalized.includes("bank")) && !normalized.includes("agencia") && !normalized.includes("conta") && !normalized.includes("codigo")) {
        colMap.bank_name = colMap.bank_name ?? i;
      }
      if (normalized.includes("codigo banco") || normalized.includes("bank code") || (normalized.includes("banco") && normalized.includes("codigo"))) {
        colMap.bank_code = colMap.bank_code ?? i;
      }
      if (normalized.includes("agencia") || normalized.includes("agency")) colMap.bank_agency = colMap.bank_agency ?? i;
      if ((normalized.includes("conta") || normalized.includes("account")) && !normalized.includes("tipo")) {
        colMap.bank_account = colMap.bank_account ?? i;
      }
      if ((normalized.includes("tipo") && normalized.includes("conta")) || normalized.includes("account type")) {
        colMap.bank_account_type = colMap.bank_account_type ?? i;
      }
      if (normalized.includes("pix") && !normalized.includes("tipo")) colMap.pix_key = colMap.pix_key ?? i;
      if (normalized.includes("tipo") && normalized.includes("pix")) colMap.pix_key_type = colMap.pix_key_type ?? i;
      
      // External ID (Pipedrive)
      if (normalized.includes("id") && (normalized.includes("pessoa") || normalized.includes("person") || normalized.includes("externo") || normalized.includes("external"))) {
        colMap.external_id = colMap.external_id ?? i;
      }
    });

    if (colMap.full_name === undefined) {
      toast.error("Coluna 'Nome' não encontrada no CSV");
      return;
    }

    // Fetch existing leads for duplicate check (must filter by account_id for RLS)
    if (!currentUser?.account_id) {
      toast.error("Erro de autenticação");
      return;
    }
    
    // Fetch ALL existing leads with pagination to avoid 1000 row limit
    type ExistingLead = { id: string; phone: string | null; email: string | null; cpf: string | null; full_name: string; external_id: string | null; external_source: string | null };
    const allExistingLeads: ExistingLead[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: pageData, error: fetchError } = await supabase
        .from("leads")
        .select("id, phone, email, cpf, full_name, external_id, external_source")
        .eq("account_id", currentUser.account_id)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (fetchError) {
        console.error("Error fetching existing leads:", fetchError);
        toast.error("Erro ao verificar leads existentes");
        return;
      }
      
      if (pageData && pageData.length > 0) {
        allExistingLeads.push(...pageData);
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    const existingPhones = new Set(allExistingLeads.map(l => l.phone?.replace(/\D/g, "")).filter(Boolean));
    const existingEmails = new Set(allExistingLeads.map(l => l.email?.toLowerCase()).filter(Boolean));
    const existingCpfs = new Set(allExistingLeads.map(l => l.cpf?.replace(/\D/g, "")).filter(Boolean));
    const existingExternalIds = new Set(allExistingLeads.map(l => l.external_id).filter(Boolean));
    const existingLeadsByExternalId = new Map(allExistingLeads.filter(l => l.external_id).map(l => [l.external_id!, l]));
    
    // Track duplicates within the CSV file itself
    const csvExternalIds = new Set<string>();
    const csvPhones = new Set<string>();
    const csvEmails = new Set<string>();

    // Fetch existing active clients
    const { data: existingClients, error: clientFetchError } = await supabase
      .from("clients")
      .select("id, phone_e164, emails, cpf, full_name, status")
      .eq("account_id", currentUser.account_id)
      .in("status", ["active"]);
    
    if (clientFetchError) {
      console.error("Error fetching existing clients:", clientFetchError);
      // Continue without client check
    }
    // Build client lookup maps
    type ClientInfo = { id: string; full_name: string; phone?: string; email?: string; status?: string };
    const clientByPhone = new Map<string, ClientInfo>();
    const clientByEmail = new Map<string, ClientInfo>();
    const clientByCpf = new Map<string, ClientInfo>();
    
    (existingClients || []).forEach(c => {
      const normalizedPhone = c.phone_e164?.replace(/\D/g, "");
      // emails can be JSON array or string
      let primaryEmail: string | undefined;
      if (c.emails) {
        const emailsData = Array.isArray(c.emails) ? c.emails : 
          (typeof c.emails === 'string' ? [c.emails] : []);
        const firstEmail = emailsData[0];
        primaryEmail = typeof firstEmail === 'string' ? firstEmail.toLowerCase() : undefined;
      }
      const normalizedCpf = c.cpf?.replace(/\D/g, "");
      
      const clientInfo: ClientInfo = {
        id: c.id,
        full_name: c.full_name,
        phone: c.phone_e164 || undefined,
        email: primaryEmail,
        status: c.status || undefined,
      };
      
      if (normalizedPhone) clientByPhone.set(normalizedPhone, clientInfo);
      if (primaryEmail) clientByEmail.set(primaryEmail, clientInfo);
      if (normalizedCpf) clientByCpf.set(normalizedCpf, clientInfo);
    });

    // Helper to clean empty/N/A values
    const cleanValue = (val: string | undefined): string | undefined => {
      if (!val) return undefined;
      const cleaned = val.trim();
      if (!cleaned || cleaned.toLowerCase() === "n/a" || cleaned === "-" || cleaned.toLowerCase() === "null") {
        return undefined;
      }
      return cleaned;
    };

    const rows: ImportLeadRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
      
      // Build emails array if we have multiple email columns
      const emailsArr: string[] = [];
      if (colMap.email !== undefined && cleanValue(values[colMap.email])) emailsArr.push(cleanValue(values[colMap.email])!);
      if (colMap.email2 !== undefined && cleanValue(values[colMap.email2])) emailsArr.push(cleanValue(values[colMap.email2])!);
      
      // Build instagrams array if we have multiple instagram columns
      const instagramsArr: string[] = [];
      if (colMap.instagram !== undefined && cleanValue(values[colMap.instagram])) instagramsArr.push(cleanValue(values[colMap.instagram])!);
      if (colMap.instagram2 !== undefined && cleanValue(values[colMap.instagram2])) instagramsArr.push(cleanValue(values[colMap.instagram2])!);
      
      // Build additional_phones array
      const additionalPhonesArr: { label?: string; number: string }[] = [];
      if (colMap.phone2 !== undefined && cleanValue(values[colMap.phone2])) {
        additionalPhonesArr.push({ label: "Secundário", number: cleanValue(values[colMap.phone2])! });
      }
      
      const row: ImportLeadRow = {
        lineNumber: i,
        full_name: values[colMap.full_name] || "",
        phone: colMap.phone !== undefined ? cleanValue(values[colMap.phone]) : undefined,
        email: emailsArr[0],
        emails: emailsArr.length > 1 ? emailsArr : undefined,
        source: colMap.source !== undefined ? cleanValue(values[colMap.source])?.toLowerCase() : undefined,
        notes: colMap.notes !== undefined ? cleanValue(values[colMap.notes]) : undefined,
        // Documents
        cpf: colMap.cpf !== undefined ? cleanValue(values[colMap.cpf]) : undefined,
        rg: colMap.rg !== undefined ? cleanValue(values[colMap.rg]) : undefined,
        cnpj: colMap.cnpj !== undefined ? cleanValue(values[colMap.cnpj]) : undefined,
        // Company
        company_name: colMap.company_name !== undefined ? cleanValue(values[colMap.company_name]) : undefined,
        business_segment: colMap.business_segment !== undefined ? cleanValue(values[colMap.business_segment]) : undefined,
        business_niche: colMap.business_niche !== undefined ? cleanValue(values[colMap.business_niche]) : undefined,
        // Social
        instagram: instagramsArr[0],
        instagrams: instagramsArr.length > 1 ? instagramsArr : undefined,
        // Personal
        birth_date: colMap.birth_date !== undefined ? cleanValue(values[colMap.birth_date]) : undefined,
        revenue_range: colMap.revenue_range !== undefined ? normalizeRevenueRange(values[colMap.revenue_range]) : undefined,
        // Residential address
        zip_code: colMap.zip_code !== undefined ? cleanValue(values[colMap.zip_code]) : undefined,
        street: colMap.street !== undefined ? cleanValue(values[colMap.street]) : undefined,
        street_number: colMap.street_number !== undefined ? cleanValue(values[colMap.street_number]) : undefined,
        complement: colMap.complement !== undefined ? cleanValue(values[colMap.complement]) : undefined,
        neighborhood: colMap.neighborhood !== undefined ? cleanValue(values[colMap.neighborhood]) : undefined,
        city: colMap.city !== undefined ? cleanValue(values[colMap.city]) : undefined,
        state: colMap.state !== undefined ? cleanValue(values[colMap.state]) : undefined,
        // Business address
        business_zip_code: colMap.business_zip_code !== undefined ? cleanValue(values[colMap.business_zip_code]) : undefined,
        business_street: colMap.business_street !== undefined ? cleanValue(values[colMap.business_street]) : undefined,
        business_street_number: colMap.business_street_number !== undefined ? cleanValue(values[colMap.business_street_number]) : undefined,
        business_complement: colMap.business_complement !== undefined ? cleanValue(values[colMap.business_complement]) : undefined,
        business_neighborhood: colMap.business_neighborhood !== undefined ? cleanValue(values[colMap.business_neighborhood]) : undefined,
        business_city: colMap.business_city !== undefined ? cleanValue(values[colMap.business_city]) : undefined,
        business_state: colMap.business_state !== undefined ? cleanValue(values[colMap.business_state]) : undefined,
        // Banking
        bank_name: colMap.bank_name !== undefined ? cleanValue(values[colMap.bank_name]) : undefined,
        bank_code: colMap.bank_code !== undefined ? cleanValue(values[colMap.bank_code]) : undefined,
        bank_agency: colMap.bank_agency !== undefined ? cleanValue(values[colMap.bank_agency]) : undefined,
        bank_account: colMap.bank_account !== undefined ? cleanValue(values[colMap.bank_account]) : undefined,
        bank_account_type: colMap.bank_account_type !== undefined ? cleanValue(values[colMap.bank_account_type]) : undefined,
        pix_key: colMap.pix_key !== undefined ? cleanValue(values[colMap.pix_key]) : undefined,
        pix_key_type: colMap.pix_key_type !== undefined ? cleanValue(values[colMap.pix_key_type]) : undefined,
        // External ID
        external_id: colMap.external_id !== undefined ? cleanValue(values[colMap.external_id]) : undefined,
        external_source: colMap.external_id !== undefined ? "pipedrive" : undefined,
        // Additional phones
        additional_phones: additionalPhonesArr.length > 0 ? additionalPhonesArr : undefined,
      };

      // Validate
      if (!row.full_name.trim()) {
        row.hasError = true;
        row.errorMessage = "Nome obrigatório";
      }

      // Check for matching clients first (higher priority)
      const normalizedPhone = row.phone?.replace(/\D/g, "");
      const normalizedEmail = row.email?.toLowerCase();
      const normalizedCpf = row.cpf?.replace(/\D/g, "");

      const matchedClient = 
        (normalizedPhone && clientByPhone.get(normalizedPhone)) ||
        (normalizedEmail && clientByEmail.get(normalizedEmail)) ||
        (normalizedCpf && clientByCpf.get(normalizedCpf));

      if (matchedClient) {
        row.isClientMatch = true;
        row.clientInfo = matchedClient;
      } else {
        // Check lead duplicates only if not a client
        // Check external_id first (for update detection against DB)
        if (row.external_id && existingExternalIds.has(row.external_id)) {
          const existingLead = existingLeadsByExternalId.get(row.external_id);
          row.isDuplicate = true;
          row.duplicateInfo = { 
            type: "external_id", 
            matchValue: row.external_id,
            existingLead: existingLead ? {
              id: existingLead.id,
              full_name: existingLead.full_name,
              phone: existingLead.phone || undefined,
              email: existingLead.email || undefined,
              external_id: existingLead.external_id || undefined,
            } : undefined
          };
        }
        // Check for duplicates within the CSV file itself
        else if (row.external_id && csvExternalIds.has(row.external_id)) {
          row.isDuplicate = true;
          row.duplicateInfo = { type: "external_id", matchValue: row.external_id };
          row.errorMessage = "ID duplicado no arquivo";
        } else if (normalizedPhone && csvPhones.has(normalizedPhone)) {
          row.isDuplicate = true;
          row.duplicateInfo = { type: "phone", matchValue: normalizedPhone };
          row.errorMessage = "Telefone duplicado no arquivo";
        } else if (normalizedEmail && csvEmails.has(normalizedEmail)) {
          row.isDuplicate = true;
          row.duplicateInfo = { type: "email", matchValue: normalizedEmail };
          row.errorMessage = "Email duplicado no arquivo";
        }
        // Check against existing database records
        else if (normalizedPhone && existingPhones.has(normalizedPhone)) {
          row.isDuplicate = true;
          row.duplicateInfo = { type: "phone", matchValue: normalizedPhone };
        } else if (normalizedEmail && existingEmails.has(normalizedEmail)) {
          row.isDuplicate = true;
          row.duplicateInfo = { type: "email", matchValue: normalizedEmail };
        } else if (normalizedCpf && existingCpfs.has(normalizedCpf)) {
          row.isDuplicate = true;
          row.duplicateInfo = { type: "cpf", matchValue: normalizedCpf };
        }
        
        // Track for CSV internal duplicate detection
        if (row.external_id) csvExternalIds.add(row.external_id);
        if (normalizedPhone) csvPhones.add(normalizedPhone);
        if (normalizedEmail) csvEmails.add(normalizedEmail);
      }

      rows.push(row);
    }

    setImportRows(rows);
    setImportPreviewOpen(true);
    
    // Reset file input
    event.target.value = "";
  };

  const handleConfirmImport = async (selectedRows: ImportLeadRow[]) => {
    setImporting(true);
    try {
      // Filter out clients and skipped duplicates
      const rowsToImport = selectedRows.filter(r => !r.isClientMatch && r.duplicateAction !== "skip");
      
      if (rowsToImport.length === 0) {
        toast.error("Nenhum lead para importar");
        return;
      }

      let successCount = 0;
      let updateCount = 0;
      let skippedDuplicates = 0;
      
      // Track external_ids already imported in this session to avoid duplicates
      const importedExternalIds = new Set<string>();
      
      for (const row of rowsToImport) {
        // Skip if this external_id was already imported in this session
        if (row.external_id && importedExternalIds.has(row.external_id)) {
          skippedDuplicates++;
          continue;
        }
        
        try {
          // Build the lead data object with all fields
          const leadData = {
            full_name: row.full_name,
            phone: row.phone,
            email: row.email,
            emails: row.emails,
            source: row.source,
            notes: row.notes,
            cpf: row.cpf,
            rg: row.rg,
            cnpj: row.cnpj,
            company_name: row.company_name,
            instagram: row.instagram,
            instagrams: row.instagrams,
            birth_date: row.birth_date,
            revenue_range: row.revenue_range,
            external_id: row.external_id,
            external_source: row.external_source,
            // Residential address
            zip_code: row.zip_code,
            street: row.street,
            street_number: row.street_number,
            complement: row.complement,
            neighborhood: row.neighborhood,
            city: row.city,
            state: row.state,
            // Business address
            business_zip_code: row.business_zip_code,
            business_street: row.business_street,
            business_street_number: row.business_street_number,
            business_complement: row.business_complement,
            business_neighborhood: row.business_neighborhood,
            business_city: row.business_city,
            business_state: row.business_state,
            business_segment: row.business_segment,
            business_niche: row.business_niche,
            // Banking
            bank_name: row.bank_name,
            bank_code: row.bank_code,
            bank_agency: row.bank_agency,
            bank_account: row.bank_account,
            bank_account_type: row.bank_account_type,
            pix_key: row.pix_key,
            pix_key_type: row.pix_key_type,
            // Additional arrays
            additional_phones: row.additional_phones,
          };
          
          if (row.duplicateAction === "update" && row.duplicateInfo?.existingLead?.id) {
            // Update existing lead with all fields
            await updateLead(row.duplicateInfo.existingLead.id, leadData);
            updateCount++;
          } else {
            // Create new lead with all fields
            await createLead(leadData);
            // Track imported external_id
            if (row.external_id) importedExternalIds.add(row.external_id);
            successCount++;
          }
        } catch (err: any) {
          // Check if it's a duplicate key error and skip silently
          if (err?.message?.includes('duplicate key') || err?.code === '23505') {
            skippedDuplicates++;
            if (row.external_id) importedExternalIds.add(row.external_id);
            console.log("Skipped duplicate:", row.external_id || row.full_name);
          } else {
            console.error("Error importing lead:", err);
          }
        }
      }

      const messages = [];
      if (successCount > 0) messages.push(`${successCount} criados`);
      if (updateCount > 0) messages.push(`${updateCount} atualizados`);
      if (skippedDuplicates > 0) messages.push(`${skippedDuplicates} pulados (duplicatas)`);
      
      if (messages.length > 0) {
        toast.success(`Leads importados: ${messages.join(", ")}!`);
      } else {
        toast.info("Nenhum lead novo para importar");
      }
      setImportPreviewOpen(false);
      setImportRows([]);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao importar leads");
    } finally {
      setImporting(false);
    }
  };

  const hasActiveFilters = filterSource !== "all" || filterRevenueRange !== "all";
  
  const clearFilters = () => {
    setFilterSource("all");
    setFilterRevenueRange("all");
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSource = filterSource === "all" || lead.source === filterSource;
    const matchesRevenue = filterRevenueRange === "all" || lead.revenue_range === filterRevenueRange;
    
    return matchesSearch && matchesSource && matchesRevenue;
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const s = LEAD_STATUS.find((s) => s.value === status);
    return (
      <Badge variant="secondary" className={`${s?.color || "bg-gray-500"} text-white text-[10px]`}>
        {s?.label || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Fixed Section */}
        <div className="flex-shrink-0 p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-xs">
              Gerencie seus leads antes de se tornarem clientes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFieldsDialogOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Campos
            </Button>
            <input
              id="csv-upload-leads"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => document.getElementById('csv-upload-leads')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={openNewDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 min-w-fit">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{leads.length}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 min-w-fit">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">{newLeads.length}</span>
            <span className="text-xs text-muted-foreground">Novos</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 min-w-fit">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium">{contactedLeads.length}</span>
            <span className="text-xs text-muted-foreground">Contatados</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 min-w-fit">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">{qualifiedLeads.length}</span>
            <span className="text-xs text-muted-foreground">Qualificados</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterRevenueRange} onValueChange={setFilterRevenueRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Faturamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos faturamentos</SelectItem>
                {REVENUE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        </div>

        {/* Scrollable Leads List */}
        <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
          <ScrollArea className="h-full">
            {filteredLeads.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  {searchQuery ? "Nenhum lead encontrado" : "Nenhum lead cadastrado ainda"}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 pr-2">
                {filteredLeads.map((lead) => (
                  <Card 
                    key={lead.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setDetailLead(lead)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 w-full overflow-hidden">
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(lead.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-medium text-sm truncate max-w-[150px]">{lead.full_name}</span>
                            {getStatusBadge(lead.status)}
                            {/* Custom field badges - limit to 1, hide on small screens */}
                            {customFields.slice(0, 1).map(field => {
                              const value = fieldValues[lead.id]?.[field.id];
                              if (value === undefined || value === null) return null;
                              return (
                                <div key={field.id} onClick={(e) => e.stopPropagation()} className="hidden sm:block flex-shrink-0">
                                  <LeadFieldValueEditor
                                    field={field}
                                    leadId={lead.id}
                                    accountId={currentUser?.account_id || ""}
                                    currentValue={value}
                                    onValueChange={(fId, nv) => handleFieldValueChange(lead.id, fId, nv)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 overflow-hidden">
                            {lead.phone && (
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <Phone className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate max-w-[90px]">{lead.phone}</span>
                              </span>
                            )}
                            {lead.email && (
                              <span className="hidden md:flex items-center gap-1 truncate max-w-[120px]">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{lead.email}</span>
                              </span>
                            )}
                            {lead.source && (
                              <Badge variant="outline" className="text-[10px] flex-shrink-0 hidden sm:inline-flex">
                                {LEAD_SOURCES.find((s) => s.value === lead.source)?.label || lead.source}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground text-right flex-shrink-0 whitespace-nowrap hidden sm:block">
                          {format(new Date(lead.created_at), "dd/MM/yy", { locale: ptBR })}
                        </div>

                        {/* Action buttons container */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {/* WhatsApp Button */}
                          {lead.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-emerald-500/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                openZappConversation({
                                  phone: lead.phone,
                                  leadId: lead.id,
                                  name: lead.full_name,
                                });
                              }}
                              disabled={zappLoading}
                              title="Abrir conversa no RoyZapp"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {lead.phone && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  openZappConversation({
                                    phone: lead.phone,
                                    leadId: lead.id,
                                    name: lead.full_name,
                                  });
                                }}>
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Conversar no RoyZapp
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(lead.id, "contacted");
                              }}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Marcar Contatado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(lead.id, "qualified");
                              }}>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Marcar Qualificado
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                openDealDialogForLead(lead);
                              }}>
                                <TrendingUp className="h-4 w-4 mr-2" />
                                Criar Negócio
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(lead);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteLeadId(lead.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Create/Edit Dialog with Step Flow */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { 
        setIsDialogOpen(open); 
        if (!open) resetForm(); 
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedLead ? "Editar Lead" : 
                dialogStep === 'phone' ? "Verificar Telefone" :
                dialogStep === 'deal-form' ? "Criar Negócio" : "Novo Lead"}
            </DialogTitle>
            {dialogStep === 'phone' && !selectedLead && (
              <DialogDescription>
                Informe o telefone para verificar se já é um cliente
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Step 1: Phone Check */}
          {dialogStep === 'phone' && !selectedLead && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                  autoFocus
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handlePhoneCheck} 
                  disabled={checkingPhone || !formData.phone.trim()}
                >
                  {checkingPhone ? "Verificando..." : "Continuar"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2a: Lead Form (if no existing client) */}
          {(dialogStep === 'lead-form' || selectedLead) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nome completo"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+55 11 99999-9999"
                    disabled={!selectedLead}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Origem</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="De onde veio o lead?" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Anotações sobre o lead..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                {!selectedLead && (
                  <Button variant="ghost" onClick={() => setDialogStep('phone')}>
                    Voltar
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={!formData.full_name.trim()}>
                  {selectedLead ? "Salvar" : "Criar Lead"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2b: Deal Form (if existing client found OR converting from lead) */}
          {dialogStep === 'deal-form' && (existingClient || leadForDeal) && !selectedLead && (
            <div className="space-y-4">
              {/* Client/Lead Info */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {(existingClient?.full_name || leadForDeal?.full_name || "").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{existingClient?.full_name || leadForDeal?.full_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {existingClient?.phone_e164 || leadForDeal?.phone || "Sem telefone"}
                    </p>
                  </div>
                  {existingClient ? (
                    <Badge className="ml-auto bg-emerald-500 text-white">
                      <UserCheck className="h-3 w-3 mr-1" />
                      Cliente
                    </Badge>
                  ) : (
                    <Badge className="ml-auto bg-blue-500 text-white">
                      <Users className="h-3 w-3 mr-1" />
                      Lead
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deal_title">Título do Negócio</Label>
                <Input
                  id="deal_title"
                  value={dealFormData.title}
                  onChange={(e) => setDealFormData({ ...dealFormData, title: e.target.value })}
                  placeholder="Ex: Consultoria inicial"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deal_value">Valor (R$)</Label>
                  <Input
                    id="deal_value"
                    type="number"
                    value={dealFormData.value}
                    onChange={(e) => setDealFormData({ ...dealFormData, value: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal_stage">Etapa</Label>
                  <Select
                    value={dealFormData.stage_id}
                    onValueChange={(value) => setDealFormData({ ...dealFormData, stage_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.sort((a, b) => a.display_order - b.display_order).map((stage) => (
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

              <div className="space-y-2">
                <Label htmlFor="deal_notes">Observações</Label>
                <Textarea
                  id="deal_notes"
                  value={dealFormData.notes}
                  onChange={(e) => setDealFormData({ ...dealFormData, notes: e.target.value })}
                  placeholder="Anotações sobre o negócio..."
                  rows={2}
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {existingClient && (
                  <Button variant="ghost" onClick={handleCreateLeadAnyway} className="sm:mr-auto">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar lead mesmo assim
                  </Button>
                )}
                <Button variant="outline" onClick={() => {
                  if (leadForDeal) {
                    setIsDialogOpen(false);
                    resetForm();
                  } else {
                    setDialogStep('phone');
                  }
                }}>
                  {leadForDeal ? "Cancelar" : "Voltar"}
                </Button>
                <Button onClick={handleCreateDeal} disabled={creatingDeal}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {creatingDeal ? "Criando..." : "Criar Negócio"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLeadId} onOpenChange={() => setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lead Detail Sheet with Timeline */}
      <Sheet open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
        <SheetContent className="sm:max-w-md flex flex-col p-0">
          <SheetHeader className="flex-shrink-0 p-6 pb-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {detailLead ? getInitials(detailLead.full_name) : ""}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="block">{detailLead?.full_name}</span>
                  {detailLead && getStatusBadge(detailLead.status)}
                </div>
              </SheetTitle>
            </div>
          </SheetHeader>

          {detailLead && (
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4 pb-6">
                {/* Lead Info */}
                <div className="space-y-2 pb-4 border-b">
                  {detailLead.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{detailLead.phone}</span>
                    </div>
                  )}
                  {detailLead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{detailLead.email}</span>
                    </div>
                  )}
                  {detailLead.source && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">
                        {LEAD_SOURCES.find((s) => s.value === detailLead.source)?.label || detailLead.source}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Criado em {format(new Date(detailLead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                  {detailLead.notes && (
                    <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                      {detailLead.notes}
                    </p>
                  )}
                </div>

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="py-4 border-b">
                    <h3 className="text-sm font-semibold mb-3">Campos Personalizados</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {customFields.map(field => (
                        <div key={field.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground shrink-0">{field.name}:</span>
                          <LeadFieldValueEditor
                            field={field}
                            leadId={detailLead.id}
                            accountId={currentUser?.account_id || ""}
                            currentValue={fieldValues[detailLead.id]?.[field.id]}
                            onValueChange={(fId, nv) => handleFieldValueChange(detailLead.id, fId, nv)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deals Section */}
                {(() => {
                  const leadDeals = getLeadDeals(detailLead.id);
                  return leadDeals.length > 0 ? (
                    <div className="py-4 border-b">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Negócios ({leadDeals.length})
                      </h3>
                      <div className="space-y-2">
                        {leadDeals.map((deal) => {
                          const stage = stages.find(s => s.id === deal.stage_id);
                          return (
                            <div
                              key={deal.id}
                              className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedDeal(deal);
                                setIsDealDetailOpen(true);
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{deal.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {stage && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5"
                                        style={{ 
                                          borderColor: stage.color,
                                          color: stage.color,
                                        }}
                                      >
                                        {stage.name}
                                      </Badge>
                                    )}
                                    {deal.status === 'won' && (
                                      <Badge className="bg-emerald-500 text-[10px] px-1.5 gap-0.5">
                                        <Trophy className="h-2.5 w-2.5" />
                                        Ganha
                                      </Badge>
                                    )}
                                    {deal.status === 'lost' && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 gap-0.5">
                                        <XCircle className="h-2.5 w-2.5" />
                                        Perdida
                                      </Badge>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(deal.created_at), { locale: ptBR, addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-primary">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Timeline */}
                <div className="pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Jornada de Compra
                  </h3>
                  <LeadTimeline leadId={detailLead.id} />
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Actions - Fixed at bottom */}
          {detailLead && (
            <div className="flex-shrink-0 p-6 pt-4 border-t flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  openEditDialog(detailLead);
                  setDetailLead(null);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  openDealDialogForLead(detailLead);
                  setDetailLead(null);
                }}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Criar Negócio
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Deal Detail Sheet */}
      <DealDetailSheet
        open={isDealDetailOpen}
        onOpenChange={setIsDealDetailOpen}
        deal={selectedDeal}
        stages={stages}
        onEdit={() => {
          // Navigate to pipeline page for editing
          setIsDealDetailOpen(false);
          navigate('/pipeline');
        }}
        onMarkAsWon={async (dealId) => {
          await markAsWon(dealId);
          setIsDealDetailOpen(false);
          setSelectedDeal(null);
        }}
        onMarkAsLost={async (dealId, reason) => {
          await markAsLost(dealId, reason);
          setIsDealDetailOpen(false);
          setSelectedDeal(null);
        }}
        onReopen={async (dealId) => {
          await reopenDeal(dealId);
          setIsDealDetailOpen(false);
          setSelectedDeal(null);
        }}
        onStageChange={async (dealId, stageId) => {
          return await moveDeal(dealId, stageId);
        }}
      />

      {/* Custom Fields Manager Dialog */}
      <Dialog open={fieldsDialogOpen} onOpenChange={setFieldsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campos Personalizados de Leads</DialogTitle>
          </DialogHeader>
          <LeadCustomFieldsManager 
            open={true} 
            onOpenChange={() => {}} 
            onFieldsChange={fetchCustomFields}
          />
        </DialogContent>
      </Dialog>

      {/* Import Preview */}
      <LeadImportPreview
        open={importPreviewOpen}
        onOpenChange={setImportPreviewOpen}
        rows={importRows}
        onConfirmImport={handleConfirmImport}
        importing={importing}
      />
    </>
  );
}
