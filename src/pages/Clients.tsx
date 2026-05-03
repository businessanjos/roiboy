import { useEffect, useState, useRef } from "react";
import { usePersistedFilter } from "@/hooks/usePersistedFilter";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useSector } from "@/contexts/SectorContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { VipBadge } from "@/components/client/VipBadge";
import { getCountryFromPhone } from "@/lib/phoneCountry";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, ArrowRight, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, Package, ChevronRight, RefreshCw, MessageCircle, Settings2, LayoutGrid, List, User, Camera, X, Layers, Check, Clock, AlertTriangle, CalendarIcon, Pencil, FileText, Filter, ChevronDown, XCircle, Lock, Trash2, Kanban, PauseCircle, Ban, GitMerge, ChevronLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { ClientKanban } from "@/components/client/ClientKanban";
import { OnboardingOrchestrated } from "@/components/client/OnboardingOrchestrated";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ClientInfoForm, ClientFormData, getEmptyClientFormData } from "@/components/client/ClientInfoForm";
import { validateCPF, validateCNPJ } from "@/lib/validators";
import { CustomFieldsManager, CustomField, FieldOption, FieldValueEditor } from "@/components/custom-fields";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";
import { ContractDialog } from "@/components/client/ContractDialog";
import { ProductDialog } from "@/components/client/ProductDialog";
import { DuplicateAlert } from "@/components/client/DuplicateAlert";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { MergeClientDialog } from "@/components/client/MergeClientDialog";
import { useClientMerge } from "@/hooks/useClientMerge";

// E.164 format: + followed by 1-15 digits
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const validateE164 = (phone: string): { valid: boolean; message?: string } => {
  if (!phone) return { valid: false, message: "Telefone é obrigatório" };
  if (!phone.startsWith("+")) return { valid: false, message: "Deve começar com +" };
  if (!E164_REGEX.test(phone)) return { valid: false, message: "Formato inválido. Ex: +5511999999999" };
  return { valid: true };
};

// Mask phone input to E.164 format
const formatPhoneE164 = (value: string): string => {
  let digits = value.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    digits = "+" + digits.replace(/\+/g, "");
  }
  digits = "+" + digits.slice(1).replace(/\+/g, "");
  return digits.slice(0, 16);
};

interface CsvRow {
  full_name: string;
  phone_e164: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  birth_date?: string;
  company_name?: string;
  tags?: string[];
  status?: string;
  zip_code?: string;
  street?: string;
  street_number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  valid: boolean;
  error?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

// Helper to find column index with multiple possible names
const findColumnIndex = (header: string[], ...names: string[]): number => {
  return header.findIndex(h => names.some(name => h.includes(name.toLowerCase()) || h === name.toLowerCase()));
};

// Parse date from various formats
const parseDate = (dateStr: string): string | undefined => {
  if (!dateStr || !dateStr.trim()) return undefined;
  
  // Try DD/MM/YYYY format (Brazilian)
  const brMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try YYYY-MM-DD format
  const isoMatch = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return undefined;
};

// Format CPF (remove non-digits and validate length)
const formatCPF = (cpf: string): string | undefined => {
  if (!cpf) return undefined;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return undefined;
  return digits;
};

// Format CNPJ (remove non-digits and validate length)
const formatCNPJ = (cnpj: string): string | undefined => {
  if (!cnpj) return undefined;
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return undefined;
  return digits;
};

// Parse tags from comma-separated or semicolon-separated string
const parseTags = (tagsStr: string): string[] => {
  if (!tagsStr) return [];
  return tagsStr.split(/[;|]/).map(t => t.trim()).filter(t => t.length > 0);
};

// Validate status
const validateStatus = (status: string): string | undefined => {
  const validStatuses = ['active', 'inactive', 'prospect', 'churned', 'paused'];
  const normalized = status?.toLowerCase().trim();
  
  // Map Portuguese to English status
  const statusMap: Record<string, string> = {
    'ativo': 'active',
    'inativo': 'inactive',
    'prospecto': 'prospect',
    'churn': 'churned',
    'cancelado': 'churned',
    'pausado': 'paused',
  };
  
  if (statusMap[normalized]) return statusMap[normalized];
  if (validStatuses.includes(normalized)) return normalized;
  return undefined;
};

const parseCSV = (content: string): CsvRow[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim().replace(/"/g, ""));
  
  // Required columns
  const nameIndex = findColumnIndex(header, "nome", "name", "full_name", "nome completo");
  const phoneIndex = findColumnIndex(header, "telefone", "phone", "phone_e164", "celular", "whatsapp");

  if (nameIndex === -1 || phoneIndex === -1) {
    return [];
  }
  
  // Optional columns
  const emailIndex = findColumnIndex(header, "email", "e-mail", "email principal");
  const cpfIndex = findColumnIndex(header, "cpf");
  const cnpjIndex = findColumnIndex(header, "cnpj");
  const birthDateIndex = findColumnIndex(header, "nascimento", "data_nascimento", "birth_date", "aniversário", "aniversario", "data de nascimento");
  const companyIndex = findColumnIndex(header, "empresa", "company", "company_name", "razão social", "razao social");
  const tagsIndex = findColumnIndex(header, "tags", "etiquetas", "categorias");
  const statusIndex = findColumnIndex(header, "status", "situação", "situacao");
  const zipIndex = findColumnIndex(header, "cep", "zip", "zip_code", "código postal");
  const streetIndex = findColumnIndex(header, "rua", "street", "logradouro", "endereço", "endereco");
  const numberIndex = findColumnIndex(header, "número", "numero", "street_number", "nº");
  const neighborhoodIndex = findColumnIndex(header, "bairro", "neighborhood");
  const cityIndex = findColumnIndex(header, "cidade", "city");
  const stateIndex = findColumnIndex(header, "estado", "state", "uf");
  const notesIndex = findColumnIndex(header, "observações", "observacoes", "notes", "notas", "anotações");

  return lines.slice(1).map(line => {
    const values = line.split(/[,;]/).map(v => v.trim().replace(/^"|"$/g, ""));
    const name = values[nameIndex] || "";
    let phone = values[phoneIndex] || "";
    
    // Auto-format phone
    phone = formatPhoneE164(phone);
    
    const phoneValidation = validateE164(phone);
    
    // Extract optional fields
    const email = emailIndex !== -1 ? values[emailIndex]?.trim() : undefined;
    const cpf = cpfIndex !== -1 ? formatCPF(values[cpfIndex]) : undefined;
    const cnpj = cnpjIndex !== -1 ? formatCNPJ(values[cnpjIndex]) : undefined;
    const birth_date = birthDateIndex !== -1 ? parseDate(values[birthDateIndex]) : undefined;
    const company_name = companyIndex !== -1 ? values[companyIndex]?.trim() : undefined;
    const tags = tagsIndex !== -1 ? parseTags(values[tagsIndex]) : undefined;
    const status = statusIndex !== -1 ? validateStatus(values[statusIndex]) : undefined;
    const zip_code = zipIndex !== -1 ? values[zipIndex]?.replace(/\D/g, '') : undefined;
    const street = streetIndex !== -1 ? values[streetIndex]?.trim() : undefined;
    const street_number = numberIndex !== -1 ? values[numberIndex]?.trim() : undefined;
    const neighborhood = neighborhoodIndex !== -1 ? values[neighborhoodIndex]?.trim() : undefined;
    const city = cityIndex !== -1 ? values[cityIndex]?.trim() : undefined;
    const state = stateIndex !== -1 ? values[stateIndex]?.trim().toUpperCase() : undefined;
    const notes = notesIndex !== -1 ? values[notesIndex]?.trim() : undefined;
    
    // Validate email format if provided
    const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    
    const errors: string[] = [];
    if (!name) errors.push("Nome vazio");
    if (!phoneValidation.valid) errors.push(phoneValidation.message || "Telefone inválido");
    if (email && !emailValid) errors.push("Email inválido");
    
    return {
      full_name: name,
      phone_e164: phone,
      email: emailValid ? email : undefined,
      cpf,
      cnpj,
      birth_date,
      company_name,
      tags,
      status,
      zip_code,
      street,
      street_number,
      neighborhood,
      city,
      state,
      notes,
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };
  });
};

export default function Clients() {
  const { currentUser } = useCurrentUser();
  const { canCreate, isNearLimit, data: planData } = usePlanLimits();
  const { logAudit } = useAuditLog();
  const { currentSector } = useSector();
  const [clients, setClients] = useState<any[]>([]);
  const [contractMap, setContractMap] = useState<Record<string, { status: string; start_date: string | null; end_date: string | null }>>({});
  const [whatsappMap, setWhatsappMap] = useState<Record<string, { hasConversation: boolean; messageCount: number; lastMessageAt: string | null }>>({});
  const [linksMap, setLinksMap] = useState<Record<string, { id: string; full_name: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination state
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filterClientStatus, setFilterClientStatus] = usePersistedFilter<string>("clients", "clientStatus", "all");
  const [filterStatus, setFilterStatus] = usePersistedFilter<string>("clients", "status", "all"); // Keep for backward compatibility
  const [filterProduct, setFilterProduct] = usePersistedFilter<string>("clients", "product", "all");
  
  const [filterContract, setFilterContract] = usePersistedFilter<string>("clients", "contract", "all");
  const [filterResponsible, setFilterResponsible] = usePersistedFilter<string>("clients", "responsible", "all");
  const [filterLinks, setFilterLinks] = usePersistedFilter<string>("clients", "links", "all");
  const [filterCountry, setFilterCountry] = usePersistedFilter<string>("clients", "country", "all");
  const [sortOrder, setSortOrder] = usePersistedFilter<"recent" | "alphabetical">("clients", "sortOrder", "recent");
  const [activeTab, setActiveTab] = usePersistedFilter<string>("clients", "activeTab", "active");

  // Tab → contract filter mapping (overrides filterContract on fetch)
  const tabContractFilter: Record<string, string | null> = {
    active: "active",
    awaiting: "none",
    hold: "paused,suspended",
    cancelled: "cancelled,dismissed,ended",
  };
  const effectiveContractFilter = tabContractFilter[activeTab] ?? (filterContract !== "all" ? filterContract : null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newClientData, setNewClientData] = useState<ClientFormData>(getEmptyClientFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // CSV Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);

  // Bulk Omie Sync state
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [syncingProducts, setSyncingProducts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, any>>>({});
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table" | "onboarding">("table");
  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [clientStages, setClientStages] = useState<Array<{ id: string; name: string; color: string; display_order: number }>>([]);
  
  // Avatar upload state for new client
  const [newClientAvatar, setNewClientAvatar] = useState<File | null>(null);
  const [newClientAvatarPreview, setNewClientAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Custom field values for new client
  const [newClientFieldValues, setNewClientFieldValues] = useState<Record<string, any>>({});
  
  // Saving state for new client
  const [savingClient, setSavingClient] = useState(false);

  // Pending form sends state - tracks clients with unanswered forms
  const [pendingFormSends, setPendingFormSends] = useState<Record<string, { formId: string; formTitle: string; sentAt: string }[]>>({});

  // Delete client state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);

  // Contract dialog state (for quick add from clients list)
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractClientData, setContractClientData] = useState<{ id: string; name: string } | null>(null);

  // Product dialog state (for quick add from clients list)
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productClientData, setProductClientData] = useState<{ id: string; name: string; productIds: string[] } | null>(null);

  // Duplicate detection
  const { duplicates, checkDuplicates, clearDuplicates, loading: checkingDuplicates } = useDuplicateDetection();
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false);

  // Required badges collapse state
  const [showRequiredBadges, setShowRequiredBadges] = useState(false);

  // Merge client state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [clientToMerge, setClientToMerge] = useState<any | null>(null);
  const { mergeClients } = useClientMerge();

  // Get required custom fields
  const requiredFields = customFields.filter(f => f.is_required);

  // Export clients function - fetches ALL clients with pagination
  const [exporting, setExporting] = useState(false);

  const exportClients = async (exportFormat: 'csv' | 'xlsx') => {
    if (exporting) return;
    setExporting(true);
    toast.info("Preparando exportação...");

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const accId = currentUser?.account_id;
      const userId = currentUser?.id;
      if (!accId || !userId) {
        toast.error("Usuário não autenticado");
        setExporting(false);
        return;
      }

      // Build filter params (same as fetchClients)
      const baseParams: Record<string, string> = {};
      if (searchQuery) baseParams["search"] = searchQuery;
      if (filterResponsible !== "all") baseParams["responsible_user_id"] = filterResponsible;
      if (filterProduct !== "all") baseParams["product_id"] = filterProduct;
      
      if (filterContract !== "all") baseParams["contract_filter"] = filterContract;
      if (filterClientStatus !== "all") baseParams["client_status"] = filterClientStatus;
      if (filterLinks === "with") baseParams["with_links"] = "true";
      if (filterCountry !== "all") baseParams["country"] = filterCountry;
      baseParams["sort"] = sortOrder;

      const pageSize = 200;
      let allClients: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          ...baseParams,
          limit: String(pageSize),
          offset: String(offset),
        });

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/list-clients?${params.toString()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-account-id": accId,
              "x-session-token": userId,
            },
          }
        );

        if (!response.ok) {
          toast.error("Erro ao buscar clientes para exportação");
          setExporting(false);
          return;
        }

        const result = await response.json();
        const batch = result.clients || [];
        allClients = [...allClients, ...batch];

        if (batch.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }

      if (allClients.length === 0) {
        toast.error("Nenhum cliente para exportar");
        setExporting(false);
        return;
      }

      // Helper to extract first email from emails field
      const getEmail = (client: any): string => {
        if (!client.emails) return "";
        if (Array.isArray(client.emails)) return client.emails[0] || "";
        if (typeof client.emails === "string") return client.emails;
        return "";
      };

      const rows = allClients.map((client: any) => {
        const contract = client.contract;
        const responsible = client.responsible_user;
        const productNames = client.products?.map((p: any) => p.name).filter(Boolean).join(", ") || "";
        const tags = Array.isArray(client.tags) ? client.tags.join(", ") : "";

        return {
          "Nome": client.full_name || "",
          "Telefone": client.phone_e164 || "",
          "Email": getEmail(client),
          "Instagram": client.instagram || "",
          "CPF": client.cpf || "",
          "CNPJ": client.cnpj || "",
          "Empresa": client.company_name || "",
          "Status": client.status || "",
          "Produto(s)": productNames,
          "Status Contrato": contract?.status || "",
          "Início Contrato": contract?.start_date || "",
          "Fim Contrato": contract?.end_date || "",
          "Responsável": responsible?.name || "",
          "Tags": tags,
          "Observações": client.notes || "",
        };
      });

      const fileName = `clientes_${new Date().toISOString().slice(0, 10)}.${exportFormat}`;

      if (exportFormat === 'csv') {
        const headers = Object.keys(rows[0]);
        const csvContent = [
          headers.join(";"),
          ...rows.map(row => headers.map(h => {
            const val = String((row as any)[h] ?? "").replace(/"/g, '""');
            return `"${val}"`;
          }).join(";"))
        ].join("\n");

        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clientes");
        XLSX.writeFile(wb, fileName);
      }

      toast.success(`Exportação concluída! ${allClients.length} clientes exportados.`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar clientes");
    } finally {
      setExporting(false);
    }
  };

  const fetchClients = async () => {
    // Use accountId from currentUser hook
    if (currentUser?.account_id) {
      setAccountId(currentUser.account_id);
    }

    const accId = currentUser?.account_id;
    const userId = currentUser?.id;
    if (!accId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      // Use optimized edge function for faster loading with server-side filters
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const offset = (currentPage - 1) * pageSize;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      
      // Add server-side filter parameters
      if (searchQuery) params.set("search", searchQuery);
      if (filterResponsible !== "all") params.set("responsible_user_id", filterResponsible);
      if (filterProduct !== "all") params.set("product_id", filterProduct);
      
      if (effectiveContractFilter) params.set("contract_filter", effectiveContractFilter);
      if (filterClientStatus !== "all" && activeTab === "all") params.set("client_status", filterClientStatus);
      if (filterLinks === "with") params.set("with_links", "true");
      if (filterCountry !== "all") params.set("country", filterCountry);
      params.set("sort", sortOrder);
      
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/list-clients?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-account-id": accId,
            "x-session-token": userId,
          },
        }
      );

      if (!response.ok) {
        console.error("Error fetching clients from edge function");
        setLoading(false);
        return;
      }

      const result = await response.json();
      
      // Transform enriched clients to match expected format
      const transformedClients = result.clients.map((c: any) => ({
        ...c,
        client_products: c.products?.map((p: any) => ({
          product_id: p.id,
          products: p
        })) || []
      }));
      
      setClients(transformedClients);
      setTotalClients(result.total || 0);
      if (result.team_users) {
        setTeamUsers(result.team_users);
      }
      
      // Build maps from enriched data
      const contractsGrouped: Record<string, { status: string; start_date: string | null; end_date: string | null }> = {};
      const whatsappGrouped: Record<string, { hasConversation: boolean; messageCount: number; lastMessageAt: string | null }> = {};
      const pendingFormsGrouped: Record<string, { formId: string; formTitle: string; sentAt: string }[]> = {};
      
      result.clients.forEach((client: any) => {
        if (client.contract) {
          contractsGrouped[client.id] = {
            status: client.contract.status,
            start_date: client.contract.start_date,
            end_date: client.contract.end_date,
          };
        }
        whatsappGrouped[client.id] = {
          hasConversation: client.has_conversation || false,
          messageCount: client.message_count || 0,
          lastMessageAt: null,
        };
        if (client.pending_forms && client.pending_forms.length > 0) {
          pendingFormsGrouped[client.id] = client.pending_forms.map((pf: any) => ({
            formId: "",
            formTitle: pf.form_title,
            sentAt: pf.sent_at,
          }));
        }
      });
      
      setContractMap(contractsGrouped);
      setWhatsappMap(whatsappGrouped);
      setPendingFormSends(pendingFormsGrouped);

      // Fetch relationship links for the visible clients
      const visibleIds = transformedClients.map((c: any) => c.id);
      if (visibleIds.length > 0) {
        const { data: rels } = await supabase
          .from("client_relationships")
          .select(`
            primary_client_id,
            related_client_id,
            primary_client:clients!client_relationships_primary_client_id_fkey(id, full_name),
            related_client:clients!client_relationships_related_client_id_fkey(id, full_name)
          `)
          .eq("is_active", true)
          .or(`primary_client_id.in.(${visibleIds.join(",")}),related_client_id.in.(${visibleIds.join(",")})`);

        const lm: Record<string, { id: string; full_name: string }[]> = {};
        (rels || []).forEach((r: any) => {
          if (visibleIds.includes(r.primary_client_id) && r.related_client) {
            (lm[r.primary_client_id] ||= []).push({ id: r.related_client.id, full_name: r.related_client.full_name });
          }
          if (visibleIds.includes(r.related_client_id) && r.primary_client) {
            (lm[r.related_client_id] ||= []).push({ id: r.primary_client.id, full_name: r.primary_client.full_name });
          }
        });
        setLinksMap(lm);
      } else {
        setLinksMap({});
      }

    } catch (error) {
      console.error("Error fetching clients:", error);
    }
    
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error) setProducts(data || []);
  };

  const fetchCustomFields = async () => {
    const { data, error } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("is_active", true)
      .eq("show_in_clients", true)
      .order("display_order");

    if (!error && data) {
      const mappedFields: CustomField[] = data.map(f => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type as CustomField["field_type"],
        options: (f.options as unknown as FieldOption[]) || [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
      }));
      setCustomFields(mappedFields);
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

  const fetchFieldValues = async (clientIds: string[]) => {
    if (clientIds.length === 0) return;

    const { data, error } = await supabase
      .from("client_field_values")
      .select("*")
      .in("client_id", clientIds);

    if (!error && data) {
      const valuesMap: Record<string, Record<string, any>> = {};
      data.forEach((v: any) => {
        if (!valuesMap[v.client_id]) {
          valuesMap[v.client_id] = {};
        }
        // Get the value based on field type
        const value = v.value_boolean !== null ? v.value_boolean :
                     v.value_number !== null ? v.value_number :
                     v.value_date !== null ? v.value_date :
                     v.value_json !== null ? v.value_json :
                     v.value_text;
        valuesMap[v.client_id][v.field_id] = value;
      });
      setFieldValues(valuesMap);
    }
  };

  const fetchPendingFormSends = async (clientIds: string[]) => {
    if (clientIds.length === 0) return;

    // Fetch pending form sends (sent but not responded)
    const { data, error } = await supabase
      .from("client_form_sends")
      .select("client_id, form_id, sent_at, forms!inner(title)")
      .in("client_id", clientIds)
      .is("responded_at", null);

    if (!error && data) {
      const pendingMap: Record<string, { formId: string; formTitle: string; sentAt: string }[]> = {};
      data.forEach((send: any) => {
        if (!pendingMap[send.client_id]) {
          pendingMap[send.client_id] = [];
        }
        pendingMap[send.client_id].push({
          formId: send.form_id,
          formTitle: send.forms?.title || "Formulário",
          sentAt: send.sent_at,
        });
      });
      setPendingFormSends(pendingMap);
    }
  };

  const fetchClientStages = async () => {
    const accId = accountId || currentUser?.account_id;
    if (!accId) return;
    
    const { data, error } = await supabase
      .from("client_stages")
      .select("id, name, color, display_order")
      .eq("account_id", accId)
      .order("display_order");
    
    if (!error) {
      setClientStages(data || []);
    } else {
      console.error("Error fetching client stages:", error);
    }
  };

  const handleClientStageChange = async (clientId: string, stageId: string | null) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({ stage_id: stageId })
        .eq("id", clientId);

      if (error) throw error;

      // Update local state
      setClients(prev => prev.map(c => 
        c.id === clientId ? { ...c, stage_id: stageId } : c
      ));
      toast.success("Cliente movido com sucesso");
    } catch (error) {
      console.error("Error updating client stage:", error);
      toast.error("Erro ao mover cliente");
    }
  };

  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchCustomFields();
    // Note: teamUsers now comes from edge function response
  }, [currentSector?.id, currentUser?.account_id, currentPage, pageSize]);
  
  // Refetch clients when filters change (server-side filtering) - 800ms debounce to reduce API calls
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    const timer = setTimeout(() => {
      fetchClients();
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, filterResponsible, filterProduct, filterContract, filterClientStatus, filterLinks, filterCountry, sortOrder, activeTab]);

  // Fetch client stages when account is available
  useEffect(() => {
    if (accountId || currentUser?.account_id) {
      fetchClientStages();
    }
  }, [accountId, currentUser?.account_id]);

  // Fetch field values when clients are loaded
  // Note: pendingFormSends now comes from edge function response
  useEffect(() => {
    if (clients.length > 0) {
      const clientIds = clients.map(c => c.id);
      fetchFieldValues(clientIds);
    }
  }, [clients]);

  // Avatar handlers for new client
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 50MB");
      return;
    }
    
    setNewClientAvatar(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewClientAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearNewClientAvatar = () => {
    setNewClientAvatar(null);
    setNewClientAvatarPreview(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleAddClient = async () => {
    const errors: Record<string, string> = {};
    if (!newClientData.full_name.trim()) errors.full_name = "Nome é obrigatório";
    if (!newClientData.phone_e164.trim() || !/^\+[1-9]\d{1,14}$/.test(newClientData.phone_e164)) {
      errors.phone_e164 = "Telefone inválido. Ex: +5511999999999";
    }
    // Validate at least one email is provided
    const validEmails = newClientData.emails.filter(e => e.trim());
    if (validEmails.length === 0) {
      errors.emails = "Pelo menos um email é obrigatório";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmail = validEmails.find(e => !emailRegex.test(e.trim()));
      if (invalidEmail) {
        errors.emails = "Email inválido: " + invalidEmail;
      }
    }
    if (newClientData.cpf && !validateCPF(newClientData.cpf)) errors.cpf = "CPF inválido";
    if (newClientData.cnpj && !validateCNPJ(newClientData.cnpj)) errors.cnpj = "CNPJ inválido";
    
    // Custom fields are NOT validated during creation - they are filled later
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const errorCount = Object.keys(errors).length;
      toast.error(`${errorCount} campo${errorCount > 1 ? 's' : ''} obrigatório${errorCount > 1 ? 's' : ''} não preenchido${errorCount > 1 ? 's' : ''}`, {
        description: "Preencha os campos destacados em vermelho"
      });
      
      // Scroll to first error field
      setTimeout(() => {
        const firstError = document.querySelector('[data-error="true"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }
    setFormErrors({});
    setSavingClient(true);

    try {
      if (!currentUser?.account_id) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Create client first
      const { data: newClient, error } = await supabase.from("clients").insert({
        account_id: currentUser.account_id,
        full_name: newClientData.full_name.trim(),
        phone_e164: newClientData.phone_e164.trim(),
        emails: newClientData.emails,
        additional_phones: newClientData.additional_phones as unknown as import("@/integrations/supabase/types").Json,
        cpf: newClientData.cpf?.replace(/\D/g, '') || null,
        cnpj: newClientData.cnpj?.replace(/\D/g, '') || null,
        birth_date: newClientData.birth_date || null,
        company_name: newClientData.company_name || null,
        notes: newClientData.notes || null,
        street: newClientData.street || null,
        street_number: newClientData.street_number || null,
        complement: newClientData.complement || null,
        neighborhood: newClientData.neighborhood || null,
        city: newClientData.city || null,
        state: newClientData.state || null,
        zip_code: newClientData.zip_code?.replace(/\D/g, '') || null,
        business_street: newClientData.business_street || null,
        business_street_number: newClientData.business_street_number || null,
        business_complement: newClientData.business_complement || null,
        business_neighborhood: newClientData.business_neighborhood || null,
        business_city: newClientData.business_city || null,
        business_state: newClientData.business_state || null,
        business_zip_code: newClientData.business_zip_code?.replace(/\D/g, '') || null,
        contract_start_date: newClientData.contract_start_date || null,
        contract_end_date: newClientData.contract_end_date || null,
        is_mls: newClientData.is_mls,
        mls_level: newClientData.is_mls ? (newClientData.mls_level || null) : null,
        responsible_user_id: newClientData.responsible_user_id || null,
      }).select().single();

      if (error) throw error;

      // Upload avatar if provided
      if (newClientAvatar && newClient) {
        try {
          const fileName = `clients/${newClient.id}-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, newClientAvatar, { 
              upsert: true,
              contentType: newClientAvatar.type
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("avatars")
              .getPublicUrl(fileName);

            await supabase
              .from("clients")
              .update({ avatar_url: urlData.publicUrl })
              .eq("id", newClient.id);
          }
        } catch (avatarError) {
          console.error("Error uploading avatar:", avatarError);
          // Don't fail the whole operation if avatar upload fails
        }
      }

      if (selectedProducts.length > 0 && newClient) {
        const clientProducts = selectedProducts.map(productId => ({
          account_id: currentUser.account_id,
          client_id: newClient.id,
          product_id: productId,
        }));
        await supabase.from("client_products").insert(clientProducts);
      }

      // Save custom field values
      if (Object.keys(newClientFieldValues).length > 0 && newClient) {
        const fieldValuesToInsert = Object.entries(newClientFieldValues).map(([fieldId, value]) => {
          const field = customFields.find(f => f.id === fieldId);
          if (!field) return null;
          
          const valueData: any = {
            account_id: currentUser.account_id,
            client_id: newClient.id,
            field_id: fieldId,
            value_text: null,
            value_number: null,
            value_boolean: null,
            value_date: null,
            value_json: null,
          };

          switch (field.field_type) {
            case "boolean":
              valueData.value_boolean = value;
              break;
            case "number":
            case "currency":
              valueData.value_number = value;
              break;
            case "date":
              valueData.value_date = value;
              break;
            case "select":
            case "text":
              valueData.value_text = value;
              break;
            case "multi_select":
            case "user":
              valueData.value_json = value;
              break;
          }

          return valueData;
        }).filter(Boolean);

        if (fieldValuesToInsert.length > 0) {
          await supabase.from("client_field_values").insert(fieldValuesToInsert);
        }
      }
      
      // Log audit
      logAudit({
        action: "create",
        entityType: "client",
        entityId: newClient.id,
        entityName: newClientData.full_name.trim(),
        details: { products: selectedProducts.length }
      });
      
      toast.success("Cliente adicionado!");
      setDialogOpen(false);
      setNewClientData(getEmptyClientFormData());
      setSelectedProducts([]);
      setNewClientAvatar(null);
      setNewClientAvatarPreview(null);
      setNewClientFieldValues({});
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar cliente");
    } finally {
      setSavingClient(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    
    setDeletingClient(true);
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientToDelete.id);

      if (error) throw error;

      // Log audit
      logAudit({
        action: "delete",
        entityType: "client",
        entityId: clientToDelete.id,
        entityName: clientToDelete.name,
      });

      toast.success("Cliente excluído com sucesso!");
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      fetchClients();
    } catch (error: any) {
      console.error("Error deleting client:", error);
      toast.error(error.message || "Erro ao excluir cliente");
    } finally {
      setDeletingClient(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      
      if (parsed.length === 0) {
        toast.error("CSV inválido. Certifique-se de ter colunas 'nome' e 'telefone'.");
        return;
      }
      
      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = csvData.filter(row => row.valid);
    if (validRows.length === 0) {
      toast.error("Nenhum registro válido para importar");
      return;
    }

    if (!currentUser?.account_id) {
      toast.error("Perfil não encontrado. Faça logout e login novamente.");
      return;
    }

    setImporting(true);
    try {
      const clientsToInsert = validRows.map(row => {
        const client: Record<string, any> = {
          account_id: currentUser.account_id,
          full_name: row.full_name,
          phone_e164: row.phone_e164,
        };
        
        // Add optional fields if present
        if (row.email) client.emails = [{ email: row.email, label: 'principal' }];
        if (row.cpf) client.cpf = row.cpf;
        if (row.cnpj) client.cnpj = row.cnpj;
        if (row.birth_date) client.birth_date = row.birth_date;
        if (row.company_name) client.company_name = row.company_name;
        if (row.tags && row.tags.length > 0) client.tags = row.tags;
        if (row.status) client.status = row.status;
        if (row.zip_code) client.zip_code = row.zip_code;
        if (row.street) client.street = row.street;
        if (row.street_number) client.street_number = row.street_number;
        if (row.neighborhood) client.neighborhood = row.neighborhood;
        if (row.city) client.city = row.city;
        if (row.state) client.state = row.state;
        if (row.notes) client.notes = row.notes;
        
        return client;
      });

      const { error } = await supabase.from("clients").insert(clientsToInsert as any);

      if (error) throw error;

      toast.success(`${validRows.length} cliente(s) importado(s) com sucesso!`);
      setImportDialogOpen(false);
      setCsvData([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchClients();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Erro ao importar clientes");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "nome", "telefone", "email", "cpf", "cnpj", "nascimento", 
      "empresa", "tags", "status", "cep", "rua", "número", 
      "bairro", "cidade", "estado", "observações"
    ];
    const example1 = [
      "João Silva", "+5511999999999", "joao@email.com", "12345678901", "",
      "15/03/1985", "Empresa ABC", "premium|vip", "ativo", "01310100",
      "Av. Paulista", "1000", "Bela Vista", "São Paulo", "SP", "Cliente desde 2020"
    ];
    const example2 = [
      "Maria Santos", "+5521988888888", "maria@email.com", "", "12345678000199",
      "22/07/1990", "Santos Ltda", "novo", "prospecto", "20040020",
      "Rua do Ouvidor", "50", "Centro", "Rio de Janeiro", "RJ", ""
    ];
    
    const template = [headers.join(","), example1.join(","), example2.join(",")].join("\n");
    const blob = new Blob(["\uFEFF" + template], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkOmieSync = async () => {
    if (clients.length === 0) {
      toast.error("Nenhum cliente para sincronizar");
      return;
    }

    setBulkSyncing(true);
    setSyncProgress({ current: 0, total: clients.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      setSyncProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const { error } = await supabase.functions.invoke('sync-omie', {
          body: { client_id: client.id }
        });

        if (error) {
          console.error(`Sync failed for ${client.full_name}:`, error);
          failed++;
        } else {
          success++;
        }
      } catch (err) {
        console.error(`Sync error for ${client.full_name}:`, err);
        failed++;
      }
    }

    setSyncProgress(prev => ({ ...prev, success, failed }));
    setBulkSyncing(false);

    if (failed === 0) {
      toast.success(`${success} cliente(s) sincronizado(s) com sucesso!`);
    } else {
      toast.warning(`Sincronização concluída: ${success} sucesso, ${failed} falha(s)`);
    }

    fetchClients();
  };

  // Sync products from contracts to client_products
  const syncProductsFromContracts = async () => {
    if (!accountId) return;
    
    setSyncingProducts(true);
    try {
      // Get all active/pending contracts with products
      const { data: contracts, error: contractsError } = await supabase
        .from("client_contracts")
        .select("client_id, product_id")
        .eq("account_id", accountId)
        .in("status", ["active", "pending"])
        .not("product_id", "is", null);

      if (contractsError) throw contractsError;

      if (!contracts || contracts.length === 0) {
        toast.info("Nenhum contrato com produto encontrado");
        setSyncingProducts(false);
        return;
      }

      // Get existing client_products
      const { data: existingProducts, error: existingError } = await supabase
        .from("client_products")
        .select("client_id, product_id")
        .eq("account_id", accountId);

      if (existingError) throw existingError;

      // Create a set of existing combinations
      const existingSet = new Set(
        (existingProducts || []).map(ep => `${ep.client_id}-${ep.product_id}`)
      );

      // Filter contracts to only those not already in client_products
      const toInsert = contracts
        .filter(c => c.product_id && !existingSet.has(`${c.client_id}-${c.product_id}`))
        .map(c => ({
          account_id: accountId,
          client_id: c.client_id,
          product_id: c.product_id!
        }));

      // Remove duplicates (same client-product combo might appear in multiple contracts)
      const uniqueToInsert = Array.from(
        new Map(toInsert.map(item => [`${item.client_id}-${item.product_id}`, item])).values()
      );

      if (uniqueToInsert.length === 0) {
        toast.success("Produtos já estão sincronizados!");
        setSyncingProducts(false);
        return;
      }

      // Insert new client_products
      const { error: insertError } = await supabase
        .from("client_products")
        .insert(uniqueToInsert);

      if (insertError) throw insertError;

      toast.success(`${uniqueToInsert.length} produto(s) vinculado(s) aos clientes!`);
      fetchClients();
    } catch (error) {
      console.error("Error syncing products:", error);
      toast.error("Erro ao sincronizar produtos");
    } finally {
      setSyncingProducts(false);
    }
  };

  const validCount = csvData.filter(r => r.valid).length;
  const invalidCount = csvData.filter(r => !r.valid).length;

  // Calculate active filter count
  const activeFilterCount = [
    filterClientStatus !== "all",
    filterProduct !== "all",
    filterContract !== "all",
    filterResponsible !== "all",
    filterLinks !== "all",
    filterCountry !== "all",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterClientStatus("all");
    setFilterProduct("all");
    setFilterContract("all");
    setFilterResponsible("all");
    setFilterLinks("all");
    setFilterCountry("all");
  };

  // Compute country options from loaded clients (DDI inferred from phone_e164)
  const countryOptions = (() => {
    const map = new Map<string, { code: string; name: string; flag: string; count: number }>();
    for (const c of clients as any[]) {
      const info = getCountryFromPhone(c.phone_e164);
      const key = info?.code || "UNKNOWN";
      const entry = map.get(key);
      if (entry) entry.count++;
      else map.set(key, {
        code: key,
        name: info?.name || "Sem país",
        flag: info?.flag || "🏳️",
        count: 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  // Client-side country filter (DDI is encoded in phone_e164, no server param)
  const filtered = filterCountry === "all"
    ? clients
    : (clients as any[]).filter((c) => {
        const info = getCountryFromPhone(c.phone_e164);
        const code = info?.code || "UNKNOWN";
        return code === filterCountry;
      });

  const handleFieldValueChange = (clientId: string, fieldId: string, newValue: any) => {
    setFieldValues(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [fieldId]: newValue
      }
    }));
  };

  // Helper to get responsible user for a client
  const getResponsibleUser = (client: any) => {
    if (!client.responsible_user_id) return null;
    return teamUsers.find(u => u.id === client.responsible_user_id) || null;
  };

  // Helper to get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Helper to check contract expiry status
  const getContractExpiryStatus = (contractEndDate?: string | null) => {
    if (!contractEndDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(contractEndDate);
    endDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { type: "expired", days: Math.abs(diffDays), label: `Expirado há ${Math.abs(diffDays)} dia(s)` };
    } else if (diffDays <= 30) {
      return { type: "urgent", days: diffDays, label: `Expira em ${diffDays} dia(s)` };
    } else if (diffDays <= 60) {
      return { type: "warning", days: diffDays, label: `Expira em ${diffDays} dia(s)` };
    }
    return null;
  };

  const updateContractDate = async (clientId: string, field: 'contract_start_date' | 'contract_end_date', date: Date | undefined) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({ [field]: date ? format(date, 'yyyy-MM-dd') : null })
        .eq("id", clientId);

      if (error) throw error;

      // Update local state
      setClients(prev => prev.map(c => 
        c.id === clientId 
          ? { ...c, [field]: date ? format(date, 'yyyy-MM-dd') : null }
          : c
      ));
      toast.success("Data do contrato atualizada");
    } catch (error: any) {
      console.error("Error updating contract date:", error);
      toast.error("Erro ao atualizar data do contrato");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
        <div className="flex gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("table")}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("cards")}
              title="Cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "onboarding" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none gap-2"
              onClick={() => setViewMode("onboarding")}
              title="Onboarding Orquestrado"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Onboarding</span>
            </Button>
          </div>

          {/* Custom Fields Manager */}
          <Dialog open={fieldsDialogOpen} onOpenChange={setFieldsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Campos</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Configurar Campos</DialogTitle>
                <DialogDescription>
                  Crie campos personalizados para acompanhar o processo dos clientes
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <CustomFieldsManager onFieldsChange={() => {
                  fetchCustomFields();
                  setFieldsDialogOpen(false);
                }} />
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Sync Products from Contracts */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={syncProductsFromContracts}
                  disabled={syncingProducts}
                >
                  {syncingProducts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sincronizar produtos dos contratos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="sm:size-default">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportClients('csv')}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar como CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportClients('xlsx')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar como Excel (XLSX)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Import CSV Dialog */}
          <Dialog open={importDialogOpen} onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) {
              setCsvData([]);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="sm:size-default">
                <Upload className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Importar CSV</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Importar Clientes via CSV
                </DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>Faça upload de um arquivo CSV. Colunas obrigatórias: <strong>nome</strong> e <strong>telefone</strong>.</p>
                  <p className="text-xs text-muted-foreground">
                    Colunas opcionais: email, cpf, cnpj, nascimento, empresa, tags, status, cep, rua, número, bairro, cidade, estado, observações
                  </p>
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template Completo
                  </Button>
                </div>

                {csvData.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          {validCount} válido(s)
                        </Badge>
                        {invalidCount > 0 && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "gap-1 cursor-pointer transition-colors",
                              showOnlyInvalid 
                                ? "bg-destructive text-destructive-foreground border-destructive" 
                                : "text-destructive border-destructive/30 hover:bg-destructive/10"
                            )}
                            onClick={() => setShowOnlyInvalid(!showOnlyInvalid)}
                          >
                            <AlertCircle className="h-3 w-3" />
                            {invalidCount} inválido(s)
                            {showOnlyInvalid && <X className="h-3 w-3 ml-1" />}
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {csvData.some(r => r.email) && "• Email "}
                          {csvData.some(r => r.cpf) && "• CPF "}
                          {csvData.some(r => r.cnpj) && "• CNPJ "}
                          {csvData.some(r => r.birth_date) && "• Nascimento "}
                          {csvData.some(r => r.company_name) && "• Empresa "}
                          {csvData.some(r => r.tags && r.tags.length > 0) && "• Tags "}
                          {csvData.some(r => r.city) && "• Endereço "}
                        </span>
                      </div>
                    </div>

                    <ScrollArea className="h-72 border rounded-lg">
                      <div className="overflow-x-auto">
                        <Table className="w-full table-fixed" style={{ minWidth: '1000px' }}>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">Status</TableHead>
                              <TableHead className="w-[180px]">Nome</TableHead>
                              <TableHead className="w-[150px]">Telefone</TableHead>
                              <TableHead className="w-[200px]">Email</TableHead>
                              <TableHead className="w-[130px]">Empresa</TableHead>
                              <TableHead className="w-[120px]">Cidade/UF</TableHead>
                              <TableHead className="w-[100px]">Tags</TableHead>
                              <TableHead className="w-[180px]">Erro</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(showOnlyInvalid ? csvData.filter(r => !r.valid) : csvData).map((row, index) => (
                              <TableRow key={index} className={!row.valid ? "bg-destructive/5" : ""}>
                                <TableCell>
                                  {row.valid ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium truncate">{row.full_name || "-"}</TableCell>
                                <TableCell className="font-mono text-sm truncate">{row.phone_e164 || "-"}</TableCell>
                                <TableCell className="text-sm truncate">{row.email || "-"}</TableCell>
                                <TableCell className="text-sm truncate">{row.company_name || "-"}</TableCell>
                                <TableCell className="text-sm truncate">
                                  {row.city && row.state ? `${row.city}/${row.state}` : (row.city || row.state || "-")}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.tags && row.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {row.tags.slice(0, 2).map((tag, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs px-1 py-0">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {row.tags.length > 2 && (
                                        <Badge variant="secondary" className="text-xs px-1 py-0">
                                          +{row.tags.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-destructive">{row.error || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importing || validCount === 0}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar {validCount} Cliente(s)
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Single Client Dialog */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setNewClientData(getEmptyClientFormData());
              setSelectedProducts([]);
              setFormErrors({});
              setNewClientAvatar(null);
              setNewClientAvatarPreview(null);
              setNewClientFieldValues({});
              clearDuplicates();
              setDismissedDuplicates(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                className="sm:size-default"
                disabled={!canCreate("clients")}
                title={!canCreate("clients") ? "Limite de clientes atingido. Faça upgrade do plano." : undefined}
              >
                {!canCreate("clients") ? <Lock className="h-4 w-4 sm:mr-2" /> : <Plus className="h-4 w-4 sm:mr-2" />}
                <span className="hidden sm:inline">{!canCreate("clients") ? "Limite atingido" : "Novo Cliente"}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh]">
              {(() => {
                // Calculate progress for required fields
                const requiredChecks = [
                  { label: "Nome", filled: !!newClientData.full_name.trim() },
                  { label: "Telefone", filled: /^\+[1-9]\d{1,14}$/.test(newClientData.phone_e164) },
                ];
                const filledCount = requiredChecks.filter(c => c.filled).length;
                const totalCount = requiredChecks.length;
                const progressPercent = totalCount > 0 ? (filledCount / totalCount) * 100 : 100;
                
                return (
                  <>
                    <DialogHeader className="space-y-3">
                      <DialogTitle>Novo Cliente</DialogTitle>
                      <DialogDescription className="hidden sm:block">Adicione um novo cliente com todos os dados cadastrais.</DialogDescription>
                      
                      {/* Progress Indicator */}
                      {totalCount > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Campos obrigatórios: {filledCount}/{totalCount}
                            </span>
                            {filledCount === totalCount ? (
                              <span className="text-green-600 dark:text-green-500 flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                Completo
                              </span>
                            ) : Object.keys(formErrors).length > 0 ? (
                              <span className="text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Pendente
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
                            )}
                          </div>
                          <Progress 
                            value={progressPercent} 
                            className={`h-1.5 ${Object.keys(formErrors).length > 0 && filledCount < totalCount ? "[&>div]:bg-destructive" : ""}`}
                          />
                          {requiredChecks.length <= 10 ? (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {requiredChecks.map((check, idx) => (
                                <span 
                                  key={idx}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-xs transition-colors ${
                                    check.filled 
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                      : Object.keys(formErrors).length > 0
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-shake"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  }`}
                                >
                                  {check.filled ? (
                                    <Check className="h-2.5 w-2.5" />
                                  ) : (
                                    <AlertCircle className="h-2.5 w-2.5" />
                                  )}
                                  {check.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => setShowRequiredBadges(!showRequiredBadges)}
                                className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                              >
                                {showRequiredBadges ? "Ocultar campos" : `Ver ${requiredChecks.length} campos`}
                              </button>
                              {showRequiredBadges && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-[80px] overflow-y-auto">
                                  {requiredChecks.map((check, idx) => (
                                    <span 
                                      key={idx}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-xs transition-colors ${
                                        check.filled 
                                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                          : Object.keys(formErrors).length > 0
                                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-shake"
                                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    }`}
                                    >
                                      {check.filled ? (
                                        <Check className="h-2.5 w-2.5" />
                                      ) : (
                                        <AlertCircle className="h-2.5 w-2.5" />
                                      )}
                                      {check.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </DialogHeader>
                    <ScrollArea className="max-h-[55vh] sm:max-h-[60vh] pr-3">
                      <div className="space-y-5 pb-2">
                        {/* Avatar Upload */}
                        <div className="flex flex-col items-center gap-2 pb-4 border-b border-border/50">
                          <div className="relative group">
                            {newClientAvatarPreview ? (
                              <div className="relative">
                                <Avatar className="h-16 w-16 sm:h-18 sm:w-18 ring-2 ring-primary/20 shadow-sm">
                                  <AvatarImage src={newClientAvatarPreview} alt="Preview" />
                                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                                    {newClientData.full_name ? newClientData.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <button
                                  type="button"
                                  onClick={clearNewClientAvatar}
                                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => avatarInputRef.current?.click()}
                                className="h-16 w-16 sm:h-18 sm:w-18 rounded-full border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-0.5 hover:border-primary/40 hover:bg-muted/30 transition-all"
                              >
                                <Camera className="h-5 w-5 text-muted-foreground/60" />
                                <span className="text-[9px] text-muted-foreground/60">Foto</span>
                              </button>
                            )}
                          </div>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarSelect}
                            className="hidden"
                          />
                        </div>

                  {/* Duplicate Alert */}
                  {duplicates.length > 0 && !dismissedDuplicates && (
                    <div className="pb-3">
                      <DuplicateAlert 
                        duplicates={duplicates}
                        onDismiss={() => setDismissedDuplicates(true)}
                        onSelectClient={(clientId) => {
                          setDialogOpen(false);
                          window.location.href = `/clients/${clientId}`;
                        }}
                      />
                    </div>
                  )}

                  <ClientInfoForm 
                    data={newClientData} 
                    onChange={(data) => {
                      setNewClientData(data);
                      // Check for duplicates when key fields change
                      const phoneDigits = data.phone_e164?.replace(/\D/g, '') || '';
                      const cpfDigits = data.cpf?.replace(/\D/g, '') || '';
                      const cnpjDigits = data.cnpj?.replace(/\D/g, '') || '';
                      if (phoneDigits.length >= 10 || cpfDigits.length === 11 || cnpjDigits.length === 14 || data.emails.length > 0) {
                        checkDuplicates({
                          phone: data.phone_e164,
                          cpf: data.cpf,
                          cnpj: data.cnpj,
                          emails: data.emails,
                        });
                        setDismissedDuplicates(false);
                      }
                    }}
                    errors={formErrors}
                    showBasicFields={true}
                    teamUsers={teamUsers}
                  />
                  
                        {/* Product Selection */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                            <Package className="h-3.5 w-3.5" />
                            Produtos
                          </Label>
                          {products.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              Nenhum produto cadastrado. <Link to="/products" className="text-primary hover:underline">Criar produtos</Link>
                            </p>
                          ) : (
                            <div className="border rounded-lg p-2 space-y-0.5 max-h-28 overflow-y-auto bg-muted/20">
                              {products.map((product) => (
                                <label
                                  key={product.id}
                                  className="flex items-center gap-2.5 p-2 rounded-md hover:bg-background cursor-pointer transition-colors"
                                >
                                  <Checkbox
                                    checked={selectedProducts.includes(product.id)}
                                    onCheckedChange={() => toggleProduct(product.id)}
                                    className="h-4 w-4"
                                  />
                                  <span className="flex-1 text-sm truncate">{product.name}</span>
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Custom fields removed from creation dialog - filled later in client profile */}
                      </div>
                    </ScrollArea>
                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4 border-t border-border/50">
                      <Button 
                        variant="ghost" 
                        onClick={() => setDialogOpen(false)} 
                        disabled={savingClient} 
                        className="w-full sm:w-auto h-9"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleAddClient} 
                        disabled={savingClient} 
                        className="w-full sm:w-auto h-9 min-w-[100px]"
                      >
                        {savingClient ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start bg-transparent border-b border-border rounded-none p-0 gap-6">
          <TabsTrigger
            value="active"
            className="group relative h-11 px-1 rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-600 data-[state=active]:border-emerald-600 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            <span className="font-medium">Ativos</span>
            {activeTab === "active" && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-semibold">
                {totalClients}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="awaiting"
            className="group relative h-11 px-1 rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-sky-600 data-[state=active]:border-sky-600 transition-colors"
          >
            <Clock className="h-4 w-4 mr-2" />
            <span className="font-medium">Aguardando Contrato</span>
          </TabsTrigger>
          <TabsTrigger
            value="hold"
            className="group relative h-11 px-1 rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-600 data-[state=active]:border-amber-600 transition-colors"
          >
            <PauseCircle className="h-4 w-4 mr-2" />
            <span className="font-medium">Hold</span>
          </TabsTrigger>
          <TabsTrigger
            value="cancelled"
            className="group relative h-11 px-1 rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-red-600 data-[state=active]:border-red-600 transition-colors"
          >
            <XCircle className="h-4 w-4 mr-2" />
            <span className="font-medium">Cancelados</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "recent" | "alphabetical")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="alphabetical">A-Z (Nome)</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant={showFilters ? "secondary" : "outline"} 
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4 bg-muted/30 border-dashed animate-fade-in">
            <div className="flex flex-wrap gap-3">
              {/* Client Status Filter */}
              <div className="space-y-1.5 min-w-[160px]">
                <Label className="text-xs text-muted-foreground">Status do Cliente</Label>
                <Select value={filterClientStatus} onValueChange={setFilterClientStatus}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="churn_risk">Risco de Churn</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                    <SelectItem value="no_contract">Sem contrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Filter */}
              <div className="space-y-1.5 min-w-[160px]">
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <Select value={filterProduct} onValueChange={setFilterProduct}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              {/* Contract Filter */}
              <div className="space-y-1.5 min-w-[160px]">
                <Label className="text-xs text-muted-foreground">Contrato</Label>
                <Select value={filterContract} onValueChange={setFilterContract}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="urgent">Expira em 30 dias</SelectItem>
                    <SelectItem value="warning">Expira em 60 dias</SelectItem>
                    
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="none">Sem contrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Responsible Filter */}
              {teamUsers.length > 0 && (
                <div className="space-y-1.5 min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <Select value={filterResponsible} onValueChange={setFilterResponsible}>
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {teamUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                      <SelectItem value="none">Sem responsável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Vínculos Filter */}
              <div className="space-y-1.5 min-w-[160px]">
                <Label className="text-xs text-muted-foreground">Vínculos</Label>
                <Select value={filterLinks} onValueChange={setFilterLinks}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="with">Com vínculos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* País (DDI) Filter */}
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">País (DDI)</Label>
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos os países</SelectItem>
                    {countryOptions.map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>
                        <span className="inline-flex items-center gap-2">
                          <span>{opt.flag}</span>
                          <span>{opt.name}</span>
                          <span className="text-muted-foreground text-xs">({opt.count})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters Button */}
              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-9 text-muted-foreground hover:text-foreground"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Limpar ({activeFilterCount})
                  </Button>
                </div>
              )}
            </div>

            {/* Active Filters Summary */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground mr-1">Filtros ativos:</span>
                {filterClientStatus !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    Status: {filterClientStatus === "active" ? "Ativo" : filterClientStatus === "churn_risk" ? "Risco de Churn" : filterClientStatus === "no_contract" ? "Sem contrato" : "Churned"}
                    <button onClick={() => setFilterClientStatus("all")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filterProduct !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    Produto: {products.find(p => p.id === filterProduct)?.name || "..."}
                    <button onClick={() => setFilterProduct("all")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filterContract !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    Contrato: {filterContract === "active" ? "Ativo" : filterContract === "expired" ? "Expirado" : filterContract === "urgent" ? "30 dias" : filterContract === "warning" ? "60 dias" : filterContract === "pending" ? "Pendente" : filterContract === "cancelled" ? "Cancelado" : filterContract === "suspended" ? "Suspenso" : "Sem contrato"}
                    <button onClick={() => setFilterContract("all")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filterResponsible !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    Responsável: {filterResponsible === "none" ? "Sem responsável" : teamUsers.find(u => u.id === filterResponsible)?.name || "..."}
                    <button onClick={() => setFilterResponsible("all")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filterLinks !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    Vínculos: Com vínculos
                    <button onClick={() => setFilterLinks("all")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filterCountry !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    País: {countryOptions.find(o => o.code === filterCountry)?.flag} {countryOptions.find(o => o.code === filterCountry)?.name || filterCountry}
                    <button onClick={() => setFilterCountry("all")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {totalClients > 0 
              ? `Mostrando ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, totalClients)} de ${totalClients} cliente${totalClients !== 1 ? "s" : ""}`
              : `${filtered.length} cliente${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`
            }
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Por página:</span>
            {[20, 50, 100].map(size => (
              <Button
                key={size}
                variant={pageSize === size ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </div>


      {viewMode === "table" ? (
        <Card className="shadow-card flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-260px)]" orientation="both">
            <table className="w-full caption-bottom text-sm min-w-max">
                <TableHeader className="sticky top-0 z-30">
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="font-medium sticky left-0 top-0 bg-muted z-40 w-[240px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Cliente</TableHead>
                    <TableHead className="font-medium text-center w-[160px] bg-muted">Produto</TableHead>
                    <TableHead className="font-medium text-center min-w-[160px] bg-muted">Vínculo</TableHead>
                    <TableHead className="font-medium text-center min-w-[140px] bg-muted">Contrato</TableHead>
                    
                    <TableHead className="font-medium text-center min-w-[120px] bg-muted">Responsável</TableHead>
                    <TableHead className="font-medium text-right min-w-[80px] bg-muted">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((client) => (
                      <TableRow key={client.id} className="hover:bg-muted/30 group">
                        <TableCell className="sticky left-0 bg-background group-hover:bg-muted/30 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="w-[220px] flex items-center gap-2">
                            {/* Client avatar */}
                            <Avatar className="h-9 w-9 flex-shrink-0">
                              {client.avatar_url ? (
                                <AvatarImage src={client.avatar_url} alt={client.full_name} />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {getInitials(client.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <Link 
                                to={`/clients/${client.id}`}
                                className="font-medium truncate hover:text-primary hover:underline transition-colors flex items-center gap-1.5"
                              >
                                <span className="truncate">{client.full_name}</span>
                                <VipBadge clientId={client.id} />
                              </Link>
                              <p className="text-xs text-muted-foreground">{client.phone_e164}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => {
                              const productIds = client.client_products?.map((cp: any) => cp.product_id) || [];
                              setProductClientData({ id: client.id, name: client.full_name, productIds });
                              setProductDialogOpen(true);
                            }}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            {client.client_products && client.client_products.length > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex flex-col gap-1 items-center">
                                      {client.client_products.slice(0, 2).map((cp: any) => (
                                        <Badge 
                                          key={cp.product_id} 
                                          className="text-xs font-medium whitespace-nowrap shadow-sm"
                                          style={{ 
                                            backgroundColor: cp.products?.color || '#6b7280',
                                            borderColor: cp.products?.color || '#6b7280',
                                            color: '#fff',
                                            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                            boxShadow: `0 0 8px ${cp.products?.color || '#6b7280'}50`
                                          }}
                                        >
                                          {cp.products?.name || "Produto"}
                                        </Badge>
                                      ))}
                                      {client.client_products.length > 2 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{client.client_products.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs space-y-1">
                                      {client.client_products.map((cp: any) => (
                                        <div key={cp.product_id} className="flex items-center gap-2">
                                          <div 
                                            className="w-2 h-2 rounded-full" 
                                            style={{ backgroundColor: cp.products?.color || '#6b7280' }}
                                          />
                                          <span>{cp.products?.name}</span>
                                        </div>
                                      ))}
                                      <p className="mt-1 text-primary">Clique para editar</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground">-</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Clique para adicionar produtos</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          {linksMap[client.id]?.length ? (
                            <div className="flex flex-col gap-1 items-center">
                              {linksMap[client.id].slice(0, 2).map((l) => (
                                <Link
                                  key={l.id}
                                  to={`/clients/${l.id}`}
                                  className="text-xs font-bold text-foreground hover:underline truncate max-w-[160px]"
                                  title={l.full_name}
                                >
                                  {l.full_name}
                                </Link>
                              ))}
                              {linksMap[client.id].length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{linksMap[client.id].length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => {
                              setContractClientData({ id: client.id, name: client.full_name });
                              setContractDialogOpen(true);
                            }}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            {contractMap[client.id] ? (
                              (() => {
                                const contractStatus = contractMap[client.id].status || 'active';
                                const statusConfig: Record<string, { 
                                  label: string; 
                                  labelTooltip: string; 
                                  icon: typeof CheckCircle2; 
                                  bgClass: string; 
                                  textClass: string 
                                }> = {
                                  active: { label: "Ativo", labelTooltip: "Contrato Ativo", icon: CheckCircle2, bgClass: "bg-green-100 dark:bg-green-900/30", textClass: "text-green-700 dark:text-green-400" },
                                  pending: { label: "Pendente", labelTooltip: "Contrato Pendente (em assinatura)", icon: Clock, bgClass: "bg-blue-100 dark:bg-blue-900/30", textClass: "text-blue-700 dark:text-blue-400" },
                                  paused: { label: "Pausado", labelTooltip: "Contrato Pausado", icon: PauseCircle, bgClass: "bg-amber-100 dark:bg-amber-900/30", textClass: "text-amber-700 dark:text-amber-400" },
                                  suspended: { label: "Suspenso", labelTooltip: "Contrato Suspenso", icon: AlertTriangle, bgClass: "bg-amber-100 dark:bg-amber-900/30", textClass: "text-amber-700 dark:text-amber-400" },
                                  cancelled: { label: "Cancelado", labelTooltip: "Contrato Cancelado", icon: XCircle, bgClass: "bg-red-100 dark:bg-red-900/30", textClass: "text-red-700 dark:text-red-400" },
                                  ended: { label: "Encerrado", labelTooltip: "Contrato Encerrado", icon: Ban, bgClass: "bg-slate-100 dark:bg-slate-900/30", textClass: "text-slate-700 dark:text-slate-400" },
                                  dismissed: { label: "Dispensado", labelTooltip: "Contrato Dispensado", icon: XCircle, bgClass: "bg-slate-100 dark:bg-slate-900/30", textClass: "text-slate-700 dark:text-slate-400" },
                                  dropout_7d: { label: "Desistência", labelTooltip: "Desistência em 7 dias", icon: XCircle, bgClass: "bg-red-100 dark:bg-red-900/30", textClass: "text-red-700 dark:text-red-400" },
                                };
                                const config = statusConfig[contractStatus] || statusConfig.active;
                                const StatusIcon = config.icon;
                                
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className={cn("inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium", config.bgClass, config.textClass)}>
                                          <StatusIcon className="h-3 w-3" />
                                          <span>{config.label}</span>
                                          {contractMap[client.id].end_date && (
                                            <span className="text-[10px] opacity-75">
                                              até {format(new Date(contractMap[client.id].end_date!), "dd/MM/yy", { locale: ptBR })}
                                            </span>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="text-xs">
                                          <p className={cn("font-medium", config.textClass)}>{config.labelTooltip}</p>
                                          {contractMap[client.id].start_date && (
                                            <p>Início: {format(new Date(contractMap[client.id].start_date!), "dd/MM/yyyy", { locale: ptBR })}</p>
                                          )}
                                          {contractMap[client.id].end_date && (
                                            <p>Fim: {format(new Date(contractMap[client.id].end_date!), "dd/MM/yyyy", { locale: ptBR })}</p>
                                          )}
                                          <p className="mt-1 text-primary">Clique para gerenciar</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })()
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                      <AlertCircle className="h-3 w-3" />
                                      <span>Sem contrato</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Clique para adicionar contrato</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select
                            value={client.responsible_user_id || "none"}
                            onValueChange={async (value) => {
                              const newValue = value === "none" ? null : value;
                              try {
                                const { error } = await supabase
                                  .from("clients")
                                  .update({ responsible_user_id: newValue })
                                  .eq("id", client.id);
                                if (error) throw error;
                                setClients(prev => prev.map(c => 
                                  c.id === client.id ? { ...c, responsible_user_id: newValue } : c
                                ));
                                toast.success("Responsável atualizado");
                              } catch (error) {
                                console.error("Error updating responsible:", error);
                                toast.error("Erro ao atualizar responsável");
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue>
                                {(() => {
                                  const responsible = getResponsibleUser(client);
                                  if (!responsible) return <span className="text-muted-foreground">Selecionar...</span>;
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                          {getInitials(responsible.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate">{responsible.name.split(' ')[0]}</span>
                                    </div>
                                  );
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Sem responsável</span>
                              </SelectItem>
                              {teamUsers.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                        {getInitials(user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{user.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setClientToMerge(client);
                                      setMergeDialogOpen(true);
                                    }}
                                  >
                                    <GitMerge className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Mesclar cliente</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                    onClick={() => {
                                      setClientToDelete({ id: client.id, name: client.full_name });
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Excluir cliente</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                              <Link to={`/clients/${client.id}`}>
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
          </ScrollArea>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid gap-3">
          {filtered.map((client) => {
            const clientProductsData = client.client_products || [];
            
            return (
              <Card key={client.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Client avatar */}
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {client.avatar_url ? (
                          <AvatarImage src={client.avatar_url} alt={client.full_name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(client.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{client.full_name}</p>
                          {/* Responsible user avatar */}
                          {(() => {
                            const responsible = getResponsibleUser(client);
                            if (!responsible) return null;
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Avatar className="h-5 w-5 border border-background flex-shrink-0">
                                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                                        {getInitials(responsible.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Responsável: {responsible.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                          {/* Contract expiry alert */}
                          {(() => {
                            const expiryStatus = getContractExpiryStatus(client.contract_end_date);
                            if (!expiryStatus) return null;
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`flex-shrink-0 p-1 rounded-full ${
                                      expiryStatus.type === "expired" 
                                        ? "bg-destructive/10 text-destructive" 
                                        : expiryStatus.type === "urgent"
                                          ? "bg-destructive/10 text-destructive animate-pulse"
                                          : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                    }`}>
                                      {expiryStatus.type === "expired" ? (
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                      ) : (
                                        <Clock className="h-3.5 w-3.5" />
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs font-medium">{expiryStatus.label}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                          {/* Pending form sends indicator */}
                          {pendingFormSends[client.id] && pendingFormSends[client.id].length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex-shrink-0 p-1 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                    <FileText className="h-3.5 w-3.5" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <p className="font-medium mb-1">Formulários pendentes:</p>
                                    {pendingFormSends[client.id].map((form, idx) => (
                                      <p key={idx}>{form.formTitle}</p>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{client.phone_e164}</p>
                        {clientProductsData.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {clientProductsData.map((cp: any, idx: number) => (
                              <Badge 
                                key={idx} 
                                className="text-xs text-white"
                                style={{ 
                                  backgroundColor: cp.products?.color || '#6b7280',
                                  borderColor: cp.products?.color || '#6b7280'
                                }}
                              >
                                <Package className="h-3 w-3 mr-1" />
                                {cp.products?.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                      {/* WhatsApp indicator */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                              whatsappMap[client.id]?.messageCount > 0 
                                ? "bg-emerald-500/10 text-emerald-600" 
                                : "bg-muted text-muted-foreground"
                            }`}>
                              <MessageCircle className="h-3.5 w-3.5" />
                              {whatsappMap[client.id]?.messageCount > 0 && (
                                <span className="font-medium">{whatsappMap[client.id].messageCount}</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {whatsappMap[client.id]?.messageCount > 0 ? (
                              <div className="text-xs">
                                <p className="font-medium">WhatsApp conectado</p>
                                <p>{whatsappMap[client.id].messageCount} mensagem(ns)</p>
                                {whatsappMap[client.id].lastMessageAt && (
                                  <p className="text-muted-foreground">
                                    Última: {new Date(whatsappMap[client.id].lastMessageAt!).toLocaleDateString('pt-BR')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs">Sem mensagens WhatsApp</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setClientToMerge(client);
                                setMergeDialogOpen(true);
                              }}
                            >
                              <GitMerge className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Mesclar cliente</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setClientToDelete({ id: client.id, name: client.full_name });
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Excluir cliente</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" size="sm" asChild className="ml-auto sm:ml-0">
                        <Link to={`/clients/${client.id}`}>
                          <span className="hidden sm:inline">Ver</span>
                          <ArrowRight className="h-4 w-4 sm:ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</p>
          )}
        </div>
      ) : null}

      {/* Pagination Controls */}
      {(viewMode === "table" || viewMode === "cards") && totalClients > pageSize && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(Math.ceil(totalClients / pageSize), 7) }, (_, i) => {
              const totalPages = Math.ceil(totalClients / pageSize);
              let pageNum: number;
              
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  className="w-9 h-9"
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalClients / pageSize), p + 1))}
            disabled={currentPage >= Math.ceil(totalClients / pageSize) || loading}
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}


      {/* Onboarding Orquestrado View */}
      {viewMode === "onboarding" && (accountId || currentUser?.account_id) && (
        <OnboardingOrchestrated
          clients={filtered.map(c => ({
            id: c.id,
            full_name: c.full_name,
            phone_e164: c.phone_e164,
            emails: c.emails,
            company_name: c.company_name,
            avatar_url: c.avatar_url,
            stage_id: c.stage_id,
            status: c.status,
            client_products: c.client_products,
          }))}
          stages={clientStages}
          accountId={accountId || currentUser?.account_id || ''}
          onStageChange={handleClientStageChange}
          onRefreshStages={fetchClientStages}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{clientToDelete?.name}</strong>? 
              Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingClient}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={deletingClient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingClient ? (
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

      {/* Contract Dialog for quick add/edit from clients list */}
      <ContractDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        clientId={contractClientData?.id || ""}
        clientName={contractClientData?.name}
        onSuccess={() => {
          fetchClients();
          setContractClientData(null);
        }}
      />

      {/* Product Dialog for quick add/edit from clients list */}
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        clientId={productClientData?.id || ""}
        clientName={productClientData?.name}
        currentProductIds={productClientData?.productIds || []}
        onSuccess={() => {
          fetchClients();
          setProductClientData(null);
        }}
      />

      {/* Merge Client Dialog */}
      {clientToMerge && (
        <MergeClientDialog
          open={mergeDialogOpen}
          onOpenChange={(open) => {
            setMergeDialogOpen(open);
            if (!open) setClientToMerge(null);
          }}
          sourceClient={clientToMerge}
          clients={clients}
          onMerge={async (sourceId, targetId, mergedData, sourceName) => {
            const success = await mergeClients(sourceId, targetId, mergedData, sourceName);
            if (success) {
              fetchClients();
            }
            return success;
          }}
        />
      )}
    </div>
  );
}