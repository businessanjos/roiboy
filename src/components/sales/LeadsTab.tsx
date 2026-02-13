import { useState, useCallback, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useDeals, Deal } from "@/hooks/useDeals";
import { useSectorUsers } from "@/hooks/useSectorUsers";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLeadDuplicateDetection, LeadDuplicateMatch } from "@/hooks/useLeadDuplicateDetection";
import { LeadDuplicateAlert } from "@/components/leads/LeadDuplicateAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Pencil,
  Trash2,
  Phone,
  Mail,
  Users,
  UserCheck,
  MessageSquare,
  MessageCircle,
  Clock,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Upload,
  User,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { DealDetailSheet } from "@/components/sales/DealDetailSheet";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import { toast } from "sonner";
import { LeadImportPreview, ImportLeadRow } from "@/components/leads/LeadImportPreview";
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

// Interface for products
interface Product {
  id: string;
  name: string;
  price: number;
}

export default function LeadsTab() {
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
  const { openZappConversation, loading: zappLoading, PinDialog, InstanceSelectorDialog } = useZappNavigation();
  const { users: salesUsers, loading: usersLoading } = useSectorUsers({ sectorId: "vendas" });
  const { duplicates: leadDuplicates, checkDuplicates: checkLeadDuplicates, clearDuplicates: clearLeadDuplicates } = useLeadDuplicateDetection();
  const { currentUser } = useCurrentUser();

  // Product state for deal creation
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  
  
  // Import state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportLeadRow[]>([]);
  const [importing, setImporting] = useState(false);
  
  // Deal detail state
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDealDetailOpen, setIsDealDetailOpen] = useState(false);
  
  // Flow state for new lead creation and deal conversion
  const [dialogStep, setDialogStep] = useState<'phone' | 'lead-form' | 'deal-form' | 'duplicate-found'>('phone');
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
    responsible_user_id: "",
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      source: "",
      notes: "",
      responsible_user_id: "",
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
    clearLeadDuplicates();
    setSelectedProductId("");
  };

  // Load products when deal-form dialog opens
  useEffect(() => {
    const loadProducts = async () => {
      if (!currentUser?.account_id) return;
      
      const { data } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("account_id", currentUser.account_id)
        .eq("is_active", true)
        .order("name");
      
      setProducts(data || []);
    };
    
    if (dialogStep === 'deal-form') {
      loadProducts();
    }
  }, [dialogStep, currentUser?.account_id]);

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
      responsible_user_id: lead.responsible_user_id || "",
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
        // No client - check for duplicate leads
        const duplicates = await checkLeadDuplicates({ phone: formData.phone });
        setExistingClient(null);
        
        if (duplicates.length > 0) {
          // Block creation - show duplicate found step
          setDialogStep('duplicate-found');
        } else {
          setDialogStep('lead-form');
        }
      }
    } catch (error) {
      console.error("Error checking phone:", error);
      toast.error("Erro ao verificar telefone");
    } finally {
      setCheckingPhone(false);
    }
  };

  // Handle selecting an existing duplicate lead (edit instead of create)
  const handleSelectDuplicateLead = (duplicateLead: LeadDuplicateMatch) => {
    const foundLead = leads.find(l => l.id === duplicateLead.id);
    if (foundLead) {
      setIsDialogOpen(false);
      resetForm();
      setDetailLead(foundLead);
    }
  };

  // Handle viewing a duplicate lead
  const handleViewDuplicateLead = (leadId: string) => {
    const foundLead = leads.find(l => l.id === leadId);
    if (foundLead) {
      setIsDialogOpen(false);
      resetForm();
      setDetailLead(foundLead);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) return;

    const dataToSave = {
      ...formData,
      responsible_user_id: formData.responsible_user_id || undefined,
    };

    if (selectedLead) {
      await updateLead(selectedLead.id, dataToSave);
      setIsDialogOpen(false);
      resetForm();
      return;
    }

    // FINAL VALIDATION: Check for duplicates before creating
    if (formData.phone) {
      const duplicates = await checkLeadDuplicates({ 
        phone: formData.phone,
        email: formData.email,
      });
      if (duplicates.length > 0) {
        toast.error("Já existe um lead com este telefone. Por favor, use o lead existente.");
        setDialogStep('duplicate-found');
        return;
      }
    }

    await createLead(dataToSave);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleCreateDeal = async () => {
    setCreatingDeal(true);
    try {
      const productId = selectedProductId && selectedProductId !== "__none__" 
        ? selectedProductId 
        : undefined;

      if (existingClient) {
        const deal = await createDeal({
          title: dealFormData.title || `Novo negócio - ${existingClient.full_name}`,
          client_id: existingClient.id,
          stage_id: dealFormData.stage_id || undefined,
          value: dealFormData.value ? parseFloat(dealFormData.value) : undefined,
          notes: dealFormData.notes || undefined,
          product_id: productId,
        });

        if (deal) {
          toast.success("Negócio criado com sucesso!");
          setIsDialogOpen(false);
          resetForm();
        }
      } else if (leadForDeal) {
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
          product_id: productId,
        });

        if (deal) {
          await markAsConvertedToDeal(leadForDeal.id, deal.id);
          toast.success("Lead convertido em negócio!");
          setIsDialogOpen(false);
          resetForm();
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
    
    // Map column indices - store arrays for multiple columns
    const colMap: Record<string, number[]> = {
      full_name: [],
      phone: [],
      phone2: [],
      email: [],
      email2: [],
      source: [],
      notes: [],
      instagram: [],
      instagram2: [],
      revenue_range: [],
      external_id: [],
      cpf: [],
      rg: [],
      cnpj: [],
      company_name: [],
      birth_date: [],
      business_segment: [],
      business_niche: [],
      // Residential address
      zip_code: [],
      street: [],
      street_number: [],
      complement: [],
      neighborhood: [],
      city: [],
      state: [],
      // Business address
      business_zip_code: [],
      business_street: [],
      business_street_number: [],
      business_complement: [],
      business_neighborhood: [],
      business_city: [],
      business_state: [],
      // Banking
      bank_name: [],
      bank_code: [],
      bank_agency: [],
      bank_account: [],
      bank_account_type: [],
      pix_key: [],
      pix_key_type: [],
    };
    
    headers.forEach((h, i) => {
      const normalized = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Basic info
      if (normalized.includes("nome") && !normalized.includes("razao")) colMap.full_name.push(i);
      if (normalized.includes("telefone") || normalized.includes("phone") || normalized.includes("celular") || normalized.includes("whatsapp")) {
        if (normalized.includes("2") || normalized.includes("secundario") || normalized.includes("outro")) {
          colMap.phone2.push(i);
        } else {
          colMap.phone.push(i);
        }
      }
      if (normalized.includes("email") || normalized.includes("e-mail")) {
        if (normalized.includes("2") || normalized.includes("secundario")) {
          colMap.email2.push(i);
        } else {
          colMap.email.push(i);
        }
      }
      if (normalized.includes("origem") || normalized.includes("source") || normalized.includes("fonte") || normalized.includes("lead source")) colMap.source.push(i);
      if (normalized.includes("observ") || normalized.includes("nota") || normalized.includes("note") || normalized.includes("anotac")) colMap.notes.push(i);
      
      // Documents
      if (normalized.includes("cpf") && !normalized.includes("cnpj")) colMap.cpf.push(i);
      if (normalized.includes("rg") && !normalized.includes("origem")) colMap.rg.push(i);
      if (normalized.includes("cnpj")) colMap.cnpj.push(i);
      
      // Birth date
      if (normalized.includes("nascimento") || normalized.includes("birth") || normalized.includes("aniversario")) colMap.birth_date.push(i);
      
      // Company/Business
      if (normalized.includes("empresa") || normalized.includes("company") || normalized.includes("razao social")) colMap.company_name.push(i);
      if (normalized.includes("segmento") || normalized.includes("segment")) colMap.business_segment.push(i);
      if (normalized.includes("nicho") || normalized.includes("niche")) colMap.business_niche.push(i);
      
      // Social
      if (normalized.includes("instagram") || normalized.includes("insta")) {
        if (normalized.includes("2") || normalized.includes("empresa")) {
          colMap.instagram2.push(i);
        } else {
          colMap.instagram.push(i);
        }
      }
      
      // Revenue
      if (normalized.includes("faturamento") || normalized.includes("revenue") || normalized.includes("receita")) colMap.revenue_range.push(i);
      
      // Residential address
      if (normalized.includes("cep") || normalized.includes("zip") || normalized.includes("codigo postal")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_zip_code.push(i);
        } else {
          colMap.zip_code.push(i);
        }
      }
      if ((normalized.includes("rua") || normalized.includes("endereco") || normalized.includes("logradouro") || normalized.includes("street")) && !normalized.includes("numero")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_street.push(i);
        } else {
          colMap.street.push(i);
        }
      }
      if (normalized.includes("numero") || normalized.includes("number")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_street_number.push(i);
        } else {
          colMap.street_number.push(i);
        }
      }
      if (normalized.includes("complemento") || normalized.includes("complement")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_complement.push(i);
        } else {
          colMap.complement.push(i);
        }
      }
      if (normalized.includes("bairro") || normalized.includes("neighborhood")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_neighborhood.push(i);
        } else {
          colMap.neighborhood.push(i);
        }
      }
      if (normalized.includes("cidade") || normalized.includes("city")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_city.push(i);
        } else {
          colMap.city.push(i);
        }
      }
      if (normalized.includes("estado") || normalized.includes("uf") || normalized.includes("state")) {
        if (normalized.includes("comercial") || normalized.includes("empresa") || normalized.includes("business")) {
          colMap.business_state.push(i);
        } else {
          colMap.state.push(i);
        }
      }
      
      // Banking
      if ((normalized.includes("banco") || normalized.includes("bank")) && !normalized.includes("agencia") && !normalized.includes("conta") && !normalized.includes("codigo")) {
        colMap.bank_name.push(i);
      }
      if (normalized.includes("codigo banco") || normalized.includes("bank code") || (normalized.includes("banco") && normalized.includes("codigo"))) {
        colMap.bank_code.push(i);
      }
      if (normalized.includes("agencia") || normalized.includes("agency")) colMap.bank_agency.push(i);
      if ((normalized.includes("conta") || normalized.includes("account")) && !normalized.includes("tipo")) {
        colMap.bank_account.push(i);
      }
      if ((normalized.includes("tipo") && normalized.includes("conta")) || normalized.includes("account type")) {
        colMap.bank_account_type.push(i);
      }
      if (normalized.includes("pix") && !normalized.includes("tipo")) colMap.pix_key.push(i);
      if (normalized.includes("tipo") && normalized.includes("pix")) colMap.pix_key_type.push(i);
      
      // External ID (Pipedrive)
      if ((normalized.includes("id") && !normalized.includes("email")) || normalized.includes("external")) colMap.external_id.push(i);
    });

    if (colMap.full_name.length === 0) {
      toast.error("Coluna 'Nome' não encontrada no CSV");
      return;
    }

    // Helper to get first non-empty value from multiple columns
    const getFirstValue = (values: string[], indices: number[]): string | undefined => {
      for (const idx of indices) {
        const val = values[idx]?.trim();
        if (val && val !== "N/A" && val !== "-" && val !== "null") {
          return val;
        }
      }
      return undefined;
    };

    // Fetch ALL existing leads without limit to properly detect duplicates
    // Use pagination to get all records (Supabase default limit is 1000)
    const allExistingLeads: Array<{ id: string; phone: string | null; email: string | null; full_name: string; external_id: string | null }> = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: pageData } = await supabase
        .from("leads")
        .select("id, phone, email, full_name, external_id")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
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
    const existingExternalIds = new Set(allExistingLeads.map(l => l.external_id).filter(Boolean));
    const existingLeadsByExternalId = new Map(allExistingLeads.filter(l => l.external_id).map(l => [l.external_id, l]));

    // Track duplicates within the CSV file itself
    const csvExternalIds = new Set<string>();
    const csvPhones = new Set<string>();
    const csvEmails = new Set<string>();
    
    const rows: ImportLeadRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
      
      const phone = getFirstValue(values, colMap.phone);
      const email = getFirstValue(values, colMap.email);
      const source = getFirstValue(values, colMap.source)?.toLowerCase();
      const instagram = getFirstValue(values, colMap.instagram);
      
      // Build emails array if we have multiple email columns
      const emailsArr: string[] = [];
      const e1 = getFirstValue(values, colMap.email);
      const e2 = getFirstValue(values, colMap.email2);
      if (e1) emailsArr.push(e1);
      if (e2) emailsArr.push(e2);
      
      // Build instagrams array
      const instagramsArr: string[] = [];
      const i1 = getFirstValue(values, colMap.instagram);
      const i2 = getFirstValue(values, colMap.instagram2);
      if (i1) instagramsArr.push(i1);
      if (i2) instagramsArr.push(i2);
      
      // Build additional_phones array
      const additionalPhonesArr: { label?: string; number: string }[] = [];
      const phone2 = getFirstValue(values, colMap.phone2);
      if (phone2) additionalPhonesArr.push({ label: "Secundário", number: phone2 });
      
      const row: ImportLeadRow = {
        lineNumber: i,
        full_name: getFirstValue(values, colMap.full_name) || "",
        phone,
        email,
        emails: emailsArr.length > 1 ? emailsArr : undefined,
        source,
        notes: getFirstValue(values, colMap.notes),
        // Documents
        cpf: getFirstValue(values, colMap.cpf),
        rg: getFirstValue(values, colMap.rg),
        cnpj: getFirstValue(values, colMap.cnpj),
        // Company
        company_name: getFirstValue(values, colMap.company_name),
        business_segment: getFirstValue(values, colMap.business_segment),
        business_niche: getFirstValue(values, colMap.business_niche),
        // Social
        instagram,
        instagrams: instagramsArr.length > 1 ? instagramsArr : undefined,
        // Personal
        birth_date: getFirstValue(values, colMap.birth_date),
        revenue_range: getFirstValue(values, colMap.revenue_range),
        external_id: getFirstValue(values, colMap.external_id),
        external_source: getFirstValue(values, colMap.external_id) ? "pipedrive" : undefined,
        // Residential address
        zip_code: getFirstValue(values, colMap.zip_code),
        street: getFirstValue(values, colMap.street),
        street_number: getFirstValue(values, colMap.street_number),
        complement: getFirstValue(values, colMap.complement),
        neighborhood: getFirstValue(values, colMap.neighborhood),
        city: getFirstValue(values, colMap.city),
        state: getFirstValue(values, colMap.state),
        // Business address
        business_zip_code: getFirstValue(values, colMap.business_zip_code),
        business_street: getFirstValue(values, colMap.business_street),
        business_street_number: getFirstValue(values, colMap.business_street_number),
        business_complement: getFirstValue(values, colMap.business_complement),
        business_neighborhood: getFirstValue(values, colMap.business_neighborhood),
        business_city: getFirstValue(values, colMap.business_city),
        business_state: getFirstValue(values, colMap.business_state),
        // Banking
        bank_name: getFirstValue(values, colMap.bank_name),
        bank_code: getFirstValue(values, colMap.bank_code),
        bank_agency: getFirstValue(values, colMap.bank_agency),
        bank_account: getFirstValue(values, colMap.bank_account),
        bank_account_type: getFirstValue(values, colMap.bank_account_type),
        pix_key: getFirstValue(values, colMap.pix_key),
        pix_key_type: getFirstValue(values, colMap.pix_key_type),
        // Additional phones
        additional_phones: additionalPhonesArr.length > 0 ? additionalPhonesArr : undefined,
      };

      if (!row.full_name.trim()) {
        row.hasError = true;
        row.errorMessage = "Nome obrigatório";
      }

      const normalizedPhone = row.phone?.replace(/\D/g, "");
      const normalizedEmail = row.email?.toLowerCase();

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
      }

      // Track for CSV internal duplicate detection
      if (row.external_id) csvExternalIds.add(row.external_id);
      if (normalizedPhone) csvPhones.add(normalizedPhone);
      if (normalizedEmail) csvEmails.add(normalizedEmail);

      rows.push(row);
    }

    setImportRows(rows);
    setImportPreviewOpen(true);
    event.target.value = "";
  };

  const handleConfirmImport = async (selectedRows: ImportLeadRow[]) => {
    setImporting(true);
    let successCount = 0;
    let errorCount = 0;
    let skippedDuplicates = 0;
    
    // Track external_ids already imported in this session to avoid duplicates
    const importedExternalIds = new Set<string>();

    for (const row of selectedRows) {
      if (row.duplicateAction === "skip") {
        skippedDuplicates++;
        continue;
      }
      if (row.hasError) continue;
      
      // Skip if this external_id was already imported in this session
      if (row.external_id && importedExternalIds.has(row.external_id)) {
        skippedDuplicates++;
        continue;
      }

      try {
        await createLead({
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
        });
        
        // Track imported external_id
        if (row.external_id) importedExternalIds.add(row.external_id);
        successCount++;
      } catch (error: any) {
        // Check if it's a duplicate key error and skip silently
        if (error?.message?.includes('duplicate key') || error?.code === '23505') {
          skippedDuplicates++;
          console.log("Skipped duplicate:", row.external_id || row.full_name);
        } else {
          errorCount++;
          console.error("Error importing lead:", error);
        }
      }
    }

    setImporting(false);
    setImportPreviewOpen(false);
    setImportRows([]);

    if (successCount > 0) {
      toast.success(`${successCount} leads importados com sucesso!`);
    }
    if (skippedDuplicates > 0) {
      toast.info(`${skippedDuplicates} leads pulados (duplicatas)`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} leads falharam ao importar`);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const search = searchQuery.toLowerCase();
    const matchesSearch = 
      lead.full_name.toLowerCase().includes(search) ||
      lead.phone?.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search);
    
    const matchesOwner = selectedOwnerFilter === "all" || 
      lead.responsible_user_id === selectedOwnerFilter ||
      (selectedOwnerFilter === "unassigned" && !lead.responsible_user_id);
    
    return matchesSearch && matchesOwner;
  });

  const getStatusInfo = (status: string) => {
    return LEAD_STATUS.find((s) => s.value === status) || LEAD_STATUS[0];
  };

  const getSourceLabel = (source: string | null) => {
    return LEAD_SOURCES.find((s) => s.value === source)?.label || source || "—";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Fixed Section: Stats + Search */}
      <div className="flex-shrink-0 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{newLeads.length}</p>
                  <p className="text-xs text-muted-foreground">Novos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contactedLeads.length}</p>
                  <p className="text-xs text-muted-foreground">Contatados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <UserCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{qualifiedLeads.length}</p>
                  <p className="text-xs text-muted-foreground">Qualificados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Header with search and actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Owner Filter */}
        <Select value={selectedOwnerFilter} onValueChange={setSelectedOwnerFilter}>
          <SelectTrigger className="w-[200px]">
            <User className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Todos proprietários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Todos proprietários
              </span>
            </SelectItem>
            <SelectItem value="unassigned">
              <span className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                Sem proprietário
              </span>
            </SelectItem>
            {salesUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <span className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  {user.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(selectedOwnerFilter !== "all" || searchQuery) && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSelectedOwnerFilter("all");
              setSearchQuery("");
            }}
          >
            Limpar
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => document.getElementById('csv-upload-tab')?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Importar
        </Button>
        <input
          id="csv-upload-tab"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
        </div>
      </div>

      {/* Leads List - Scrollable */}
      <Card className="flex-1 min-h-0 overflow-hidden mt-4">
        <ScrollArea className="h-full">
          <CardContent className="p-0">
          {filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum lead encontrado
            </div>
          ) : (
            <div className="divide-y">
              {filteredLeads.map((lead) => {
                const statusInfo = getStatusInfo(lead.status);
                const leadDeals = getLeadDeals(lead.id);
                return (
                  <div
                    key={lead.id}
                    className="p-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setDetailLead(lead)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {/* Avatar - tamanho fixo menor */}
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {lead.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Main content - com overflow hidden */}
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate max-w-[140px]">{lead.full_name}</span>
                          <Badge className={`${statusInfo.color} text-white text-[9px] px-1 py-0 flex-shrink-0`}>
                            {statusInfo.label}
                          </Badge>
                          {leadDeals.length > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0">
                              <DollarSign className="h-2.5 w-2.5" />
                              {leadDeals.length}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          {lead.phone && (
                            <span className="truncate max-w-[90px]">{lead.phone}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Right side - ações com tamanho fixo */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* WhatsApp Button */}
                        {lead.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-emerald-500/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              openZappConversation({
                                phone: lead.phone,
                                leadId: lead.id,
                                name: lead.full_name,
                                openInNewTab: true,
                              });
                            }}
                            disabled={zappLoading}
                            title="Abrir conversa no RoyZapp"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(lead);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {lead.phone && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openZappConversation({
                                    phone: lead.phone,
                                    leadId: lead.id,
                                    name: lead.full_name,
                                    openInNewTab: true,
                                  });
                                }}
                              >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Conversar no RoyZapp
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openDealDialogForLead(lead);
                              }}
                            >
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Criar Negócio
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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
                  </div>
                );
              })}
            </div>
          )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Lead Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedLead
                ? "Editar Lead"
                : dialogStep === 'phone'
                ? "Novo Lead"
                : dialogStep === 'duplicate-found'
                ? "Lead já cadastrado"
                : dialogStep === 'deal-form'
                ? "Criar Negócio"
                : "Novo Lead"}
            </DialogTitle>
            <DialogDescription>
              {dialogStep === 'phone' && "Digite o telefone para verificar se já é cliente"}
              {dialogStep === 'duplicate-found' && "Já existe um lead com este telefone"}
              {dialogStep === 'lead-form' && "Preencha os dados do lead"}
              {dialogStep === 'deal-form' && existingClient && `Cliente encontrado: ${existingClient.full_name}`}
              {dialogStep === 'deal-form' && leadForDeal && `Converter lead: ${leadForDeal.full_name}`}
            </DialogDescription>
          </DialogHeader>

          {dialogStep === 'phone' && !selectedLead && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={handlePhoneCheck}
                  disabled={checkingPhone || !formData.phone}
                  className="w-full"
                >
                  {checkingPhone ? "Verificando..." : "Continuar"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step: Duplicate Found - Block Creation */}
          {dialogStep === 'duplicate-found' && (
            <div className="space-y-4">
              <LeadDuplicateAlert 
                duplicates={leadDuplicates}
                onSelectLead={handleSelectDuplicateLead}
                onViewLead={handleViewDuplicateLead}
                allowIgnore={false}
              />
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setDialogStep('phone')}
                >
                  Voltar e usar outro telefone
                </Button>
              </DialogFooter>
            </div>
          )}

          {dialogStep === 'lead-form' && (
            <div className="space-y-4">

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>
              {!selectedLead && (
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    disabled
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => setFormData({ ...formData, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Proprietário</Label>
                <Select
                  value={formData.responsible_user_id || "none"}
                  onValueChange={(v) => setFormData({ ...formData, responsible_user_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Sem proprietário</span>
                    </SelectItem>
                    {salesUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <span className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          {user.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Notas sobre o lead..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={!formData.full_name}>
                  {selectedLead ? "Salvar" : "Criar Lead"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {dialogStep === 'deal-form' && (
            <div className="space-y-4">
              {existingClient && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Cliente:</span>{" "}
                    {existingClient.full_name}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs"
                    onClick={handleCreateLeadAnyway}
                  >
                    Criar lead de qualquer forma
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <Label>Título do Negócio</Label>
                <Input
                  placeholder="Ex: Consultoria - João"
                  value={dealFormData.title}
                  onChange={(e) =>
                    setDealFormData({ ...dealFormData, title: e.target.value })
                  }
                />
              </div>
              {/* Item da Venda + Valor em grid de 2 colunas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item da Venda</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={(productId) => {
                      setSelectedProductId(productId);
                      // Auto-fill value with product price
                      if (productId && productId !== "__none__") {
                        const product = products.find(p => p.id === productId);
                        if (product) {
                          setDealFormData(prev => ({
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
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(product.price)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={dealFormData.value}
                    onChange={(e) =>
                      setDealFormData({ ...dealFormData, value: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select
                  value={dealFormData.stage_id}
                  onValueChange={(v) =>
                    setDealFormData({ ...dealFormData, stage_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Notas sobre o negócio..."
                  value={dealFormData.notes}
                  onChange={(e) =>
                    setDealFormData({ ...dealFormData, notes: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateDeal} disabled={creatingDeal}>
                  {creatingDeal ? "Criando..." : "Criar Negócio"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        open={!!detailLead}
        onOpenChange={(open) => !open && setDetailLead(null)}
        leadId={detailLead?.id || null}
        onEdit={(lead) => {
          setDetailLead(null);
          openEditDialog(lead as Lead);
        }}
        onDelete={(leadId) => {
          setDetailLead(null);
          setDeleteLeadId(leadId);
        }}
        onCreateDeal={(lead) => {
          setDetailLead(null);
          openDealDialogForLead(lead as Lead);
        }}
        onDealClick={(deal) => {
          setSelectedDeal(deal as Deal);
          setIsDealDetailOpen(true);
        }}
      />

      {/* Deal Detail Sheet */}
      <DealDetailSheet
        open={isDealDetailOpen}
        onOpenChange={setIsDealDetailOpen}
        deal={selectedDeal}
        stages={stages}
        onEdit={() => {}}
        onStageChange={async (dealId, stageId) => { return await moveDeal(dealId, stageId); }}
        onMarkAsWon={async (dealId) => { await markAsWon(dealId); }}
        onMarkAsLost={async (dealId, reason) => { await markAsLost(dealId, reason); }}
        onReopen={async (dealId) => { await reopenDeal(dealId); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteLeadId}
        onOpenChange={(open) => !open && setDeleteLeadId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead será permanentemente
              excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview */}
      <LeadImportPreview
        open={importPreviewOpen}
        onOpenChange={setImportPreviewOpen}
        rows={importRows}
        onConfirmImport={handleConfirmImport}
        importing={importing}
      />
      
      {/* Dialogs for WhatsApp instance selection and PIN */}
      {InstanceSelectorDialog}
      {PinDialog}
    </div>
  );
}
