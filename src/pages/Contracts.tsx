import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { usePersistedFilter } from "@/hooks/usePersistedFilter";
import { supabase } from "@/integrations/supabase/client";
import { notifyContractCreated } from "@/hooks/useContractNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClientInfoForm, ClientFormData, getEmptyClientFormData, normalizeAdditionalPhones } from "@/components/client/ClientInfoForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  FileText, 
  Search,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PauseCircle,
  Ban,
  Users,
  Eye,
  TrendingUp,
  TrendingDown,
  Clock,
  Plus,
  Loader2,
  Upload,
  Check,
  Download,
  FileUp,
  ChevronsUpDown,
  RefreshCw,
  ListChecks,
  ClipboardList,
  Settings2,
  Trash2,
  ArrowDownAZ,
  History,
} from "lucide-react";
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

import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dateUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContractDetailSheet } from "@/components/contracts/ContractDetailSheet";
import { InstallmentsEditor, InstallmentDetail } from "@/components/contracts/InstallmentsEditor";

import { ContractImportPreview, ImportRowWithDuplicate, DuplicateInfo } from "@/components/contracts/ContractImportPreview";
import { ContractTriageQueue } from "@/components/contracts/ContractTriageQueue";
import { ConciliateButton } from "@/components/contracts/ConciliateButton";
import { useBatchConciliationValidation } from "@/hooks/useConciliationValidation";
import { BarChart3, UserCheck } from "lucide-react";
import { VipBadge } from "@/components/client/VipBadge";

interface Contract {
  id: string;
  client_id: string;
  account_id: string;
  start_date: string;
  end_date: string | null;
  value: number;
  currency: string;
  payment_option: string | null;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  parent_contract_id: string | null;
  status: string;
  status_reason: string | null;
  status_changed_at: string | null;
  cancelled_at: string | null;
  contract_type: string;
  created_at: string;
  updated_at: string;
  negotiation_type: string | null;
  negotiation_description: string | null;
  payment_method: string | null;
  installments_count: number | null;
  first_due_date: string | null;
  receivables_generated: boolean | null;
  receivables_generated_at: string | null;
  client?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    responsible_user_id: string | null;
  };
  product?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  scheduled: { label: "A Iniciar", icon: Clock, className: "border-indigo-500 text-indigo-600 bg-indigo-50" },
  active: { label: "Ativo", icon: CheckCircle, className: "border-green-500 text-green-600 bg-green-50" },
  pending: { label: "Pendente", icon: FileText, className: "border-blue-500 text-blue-600 bg-blue-50" },
  suspended: { label: "Suspenso", icon: Ban, className: "border-orange-500 text-orange-600 bg-orange-50" },
  paused: { label: "Pausado", icon: PauseCircle, className: "border-amber-500 text-amber-600 bg-amber-50" },
  suspended_bonus: { label: "Suspenso Bônus", icon: Ban, className: "border-yellow-500 text-yellow-600 bg-yellow-50" },
  cancelled: { label: "Distrato de Cancelamento", icon: XCircle, className: "border-red-500 text-red-600 bg-red-50" },
  ended: { label: "Encerrado", icon: Ban, className: "border-slate-500 text-slate-600 bg-slate-50" },
  dismissed: { label: "Demitida", icon: XCircle, className: "border-rose-500 text-rose-600 bg-rose-50" },
  dismissal_termination: { label: "Distrato por Demissão", icon: XCircle, className: "border-rose-600 text-rose-700 bg-rose-50" },
  dropout_7d: { label: "Desistência 7D", icon: XCircle, className: "border-pink-500 text-pink-600 bg-pink-50" },
};

const CONTRACT_TYPES: Record<string, string> = {
  compra: "Compra",
  renovacao: "Renovação",
  migracao: "Migração",
  confissao_divida: "Confissão de Dívida",
  termo_congelamento: "Termo de Congelamento",
  distrato: "Distrato",
};

const PAYMENT_TYPES = [
  { value: "a_vista", label: "À Vista" },
  { value: "parcelado", label: "Parcelado" },
  { value: "personalizado", label: "Personalizado" },
];

const INSTALLMENT_OPTIONS = [
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
  { value: "4x", label: "4x" },
  { value: "6x", label: "6x" },
  { value: "10x", label: "10x" },
  { value: "12x", label: "12x" },
  { value: "custom", label: "Outro" },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "cheque", label: "Cheque" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
];

const formatCurrencyStatic = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getExpiryBadgeStatic = (endDate: string | null) => {
  if (!endDate) return null;
  const daysUntilExpiry = differenceInDays(parseLocalDate(endDate)!, new Date());
  
  if (daysUntilExpiry < 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Vencido há {Math.abs(daysUntilExpiry)} dias
      </Badge>
    );
  }
  if (daysUntilExpiry <= 30) {
    return (
      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50">
        <Clock className="h-3 w-3 mr-1" />
        Vence em {daysUntilExpiry} dias
      </Badge>
    );
  }
  return null;
};

interface ContractRowProps {
  contract: Contract;
  activeTab: string;
  validation?: any;
  onNavigate: (clientId: string) => void;
  onView: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
  onConciliateSuccess: () => void;
}

const ContractTableRow = memo(function ContractTableRow({
  contract,
  activeTab,
  validation,
  onNavigate,
  onView,
  onDelete,
  onConciliateSuccess,
}: ContractRowProps) {
  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || CONTRACT_STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  return (
    <TableRow className="group">
      <TableCell>
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onNavigate(contract.client_id)}
        >
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            {contract.client?.avatar_url ? (
              <img 
                src={contract.client.avatar_url} 
                alt={contract.client.full_name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <Users className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm hover:underline flex items-center gap-1.5">
              <span className="truncate">{contract.client?.full_name || "Cliente"}</span>
              <VipBadge clientId={contract.client?.id} />
            </p>
            {contract.product && (
              <Badge 
                className="text-xs font-medium whitespace-nowrap shadow-sm mt-1"
                style={{ 
                  backgroundColor: contract.product.color || '#6b7280',
                  borderColor: contract.product.color || '#6b7280',
                  color: '#fff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  boxShadow: `0 0 8px ${contract.product.color || '#6b7280'}50`
                }}
              >
                {contract.product.name}
              </Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {CONTRACT_TYPES[contract.contract_type] || contract.contract_type}
        </span>
      </TableCell>
      <TableCell>
        <span className="font-medium text-sm">
          {formatCurrencyStatic(contract.value)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">
            {format(parseLocalDate(contract.start_date)!, "dd/MM/yyyy", { locale: ptBR })}
            {contract.end_date && (
              <span className="text-muted-foreground"> →</span>
            )}
          </span>
          {contract.end_date && (
            <span className="text-sm">
              {format(parseLocalDate(contract.end_date)!, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
          {contract.status === "active" && getExpiryBadgeStatic(contract.end_date)}
        </div>
      </TableCell>
      <TableCell>
        <Badge 
          variant="outline" 
          className={cn("text-xs", statusConfig.className)}
        >
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {activeTab === "fila" && (
            <ConciliateButton
              contractId={contract.id}
              validation={validation}
              onSuccess={onConciliateSuccess}
            />
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => onView(contract)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Ver Contrato
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(contract);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

interface Client {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone_e164?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
}

export default function Contracts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = usePersistedFilter<string>("contracts", "searchTerm", "");
  const [statusFilter, setStatusFilter] = usePersistedFilter<string>("contracts", "statusFilter", "all");
  const [typeFilter, setTypeFilter] = usePersistedFilter<string>("contracts", "typeFilter", "all");
  const [productFilter, setProductFilter] = usePersistedFilter<string>("contracts", "productFilter", "all");
  const [sortOrder, setSortOrder] = usePersistedFilter<"az" | "recent">("contracts", "sortOrder", "recent");
  const [activeTab, setActiveTab] = useState<string>("fila");
  const [contractsPage, setContractsPage] = useState(1);
  const [contractsPageSize, setContractsPageSize] = useState(20);
  
  // New contract dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [formData, setFormData] = useState({
    // Contract tab
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    value: "",
    contract_type: "compra",
    product_id: "",
    notes: "",
    // Payment tab
    payment_type: "",
    installments: "",
    custom_installments: "",
    payment_method: "",
    first_due_date: "",
    // Financial tab
    bank_account_id: "",
    category_id: "",
    cost_center_id: "",
    seller_id: "",
    generate_receivables: true,
    receivable_description: "",
  });
  const [installmentsDetail, setInstallmentsDetail] = useState<InstallmentDetail[]>([]);
  const [formTab, setFormTab] = useState<string>("contrato");
  
  // Client registration data
  const [clientFormData, setClientFormData] = useState<ClientFormData>(getEmptyClientFormData());
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  
  // Client search state for server-side search
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [searchingClients, setSearchingClients] = useState(false);
  
  // Financial data
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; bank_name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  // Contract detail sheet state
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Delete contract state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import preview state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportRowWithDuplicate[]>([]);
  const [importUserProfile, setImportUserProfile] = useState<{ account_id: string } | null>(null);
  const [importTeamUsers, setImportTeamUsers] = useState<{ id: string; name: string }[] | null>(null);
  
  // Track if contract is from deal win (for notifications)
  const fromDealRef = useRef(false);

  // Fetch client data when selected
  const fetchClientData = async (clientId: string) => {
    setLoadingClientData(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setClientFormData({
          full_name: data.full_name || "",
          phone_e164: data.phone_e164 || "",
          emails: Array.isArray(data.emails) ? (data.emails as string[]) : [],
          additional_phones: normalizeAdditionalPhones(Array.isArray(data.additional_phones) ? data.additional_phones : []),
          cpf: data.cpf || "",
          rg: data.rg || "",
          cnpj: data.cnpj || "",
          birth_date: data.birth_date || "",
          company_name: data.company_name || "",
          notes: data.notes || "",
          instagram: data.instagram || "",
          instagrams: Array.isArray(data.instagrams) ? (data.instagrams as string[]) : [],
          bio: data.bio || "",
          street: data.street || "",
          street_number: data.street_number || "",
          complement: data.complement || "",
          neighborhood: data.neighborhood || "",
          city: data.city || "",
          state: data.state || "",
          zip_code: data.zip_code || "",
          business_street: data.business_street || "",
          business_street_number: data.business_street_number || "",
          business_complement: data.business_complement || "",
          business_neighborhood: data.business_neighborhood || "",
          business_city: data.business_city || "",
          business_state: data.business_state || "",
          business_zip_code: data.business_zip_code || "",
          business_segment: data.business_segment || "",
          business_niche: data.business_niche || "",
          timezone: (data as any).timezone || "",
          companies: Array.isArray(data.companies) ? (data.companies as any[]) : [],
          contract_start_date: data.contract_start_date || "",
          contract_end_date: data.contract_end_date || "",
          is_mls: data.is_mls || false,
          mls_level: data.mls_level || "",
          responsible_user_id: data.responsible_user_id || "",
          pix_key_type: data.pix_key_type || "",
          pix_key: data.pix_key || "",
          additional_pix_keys: Array.isArray(data.additional_pix_keys) ? (data.additional_pix_keys as any[]) : [],
          bank_code: data.bank_code || "",
          bank_name: data.bank_name || "",
          bank_agency: data.bank_agency || "",
          bank_account: data.bank_account || "",
          bank_account_type: data.bank_account_type || "",
          additional_bank_accounts: Array.isArray(data.additional_bank_accounts) ? (data.additional_bank_accounts as any[]) : [],
        });
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setLoadingClientData(false);
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchClients();
    fetchProducts();
    fetchFinancialData();
  }, []);

  // Handle query params for opening new contract dialog from pipeline
  useEffect(() => {
    const newContract = searchParams.get('newContract');
    const clientId = searchParams.get('clientId');
    const dealValue = searchParams.get('value');
    const dealId = searchParams.get('dealId');
    
    if (newContract === 'true' && clientId && clients.length > 0) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        resetForm();
        setSelectedClient(client);
        if (dealValue) {
          setFormData(prev => ({ ...prev, value: dealValue }));
        }
        // Mark as coming from deal for notifications
        fromDealRef.current = !!dealId;
        setDialogOpen(true);
        
        // Clean up URL params
        setSearchParams({});
      }
    }
  }, [searchParams, clients]);

  const fetchFinancialData = async () => {
    try {
      const [bankAccountsRes, categoriesRes, costCentersRes, usersRes] = await Promise.all([
        supabase.from("bank_accounts").select("id, name, bank_name").eq("is_active", true).order("name"),
        supabase.from("financial_categories").select("id, name, type").eq("is_active", true).order("name"),
        supabase.from("cost_centers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("users").select("id, name, email").order("name"),
      ]);

      if (bankAccountsRes.data) setBankAccounts(bankAccountsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (costCentersRes.data) setCostCenters(costCentersRes.data);
      if (usersRes.data) setTeamUsers(usersRes.data);
    } catch (error) {
      console.error("Error fetching financial data:", error);
    }
  };

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from("client_contracts")
        .select(`
          *,
          client:clients(id, full_name, avatar_url, responsible_user_id),
          product:products(id, name, color)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
      
      // Sync selectedContract with fresh data to prevent stale state
      if (selectedContract) {
        const updatedContract = (data || []).find(c => c.id === selectedContract.id);
        if (updatedContract) {
          setSelectedContract(updatedContract);
        }
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async (searchTerm?: string) => {
    try {
      setSearchingClients(true);
      let query = supabase
        .from("clients")
        .select("id, full_name, avatar_url, cpf, cnpj, phone_e164")
        .order("full_name");
      
      // If search term provided, search by name, phone or company
      if (searchTerm && searchTerm.length >= 2) {
        // Split search into terms for better matching
        const terms = searchTerm.trim().split(/\s+/).filter(t => t.length > 0);
        if (terms.length > 0) {
          // Build OR conditions for each term matching name, phone or company
          const orConditions = terms.map(term => 
            `full_name.ilike.%${term}%,phone_e164.ilike.%${term}%,company_name.ilike.%${term}%`
          ).join(',');
          query = query.or(orConditions);
        }
        query = query.limit(50);
      } else {
        // No search - just get first 50 sorted
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setSearchingClients(false);
    }
  };
  
  // Debounced client search - 800ms debounce to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients(clientSearchTerm);
    }, 800);
    return () => clearTimeout(timer);
  }, [clientSearchTerm]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleDeleteContract = async () => {
    if (!contractToDelete) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("client_contracts")
        .delete()
        .eq("id", contractToDelete.id);
      
      if (error) throw error;
      
      toast.success("Contrato excluído com sucesso");
      setDeleteDialogOpen(false);
      setContractToDelete(null);
      fetchContracts();
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast.error("Erro ao excluir contrato");
    } finally {
      setDeleting(false);
    }
  };

  // Normalize phone to E.164 format
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) {
      return `+${digits}`;
    }
    if (digits.length >= 10 && digits.length <= 11) {
      return `+55${digits}`;
    }
    return `+${digits}`;
  };

  // Normalize CPF/CNPJ (remove formatting)
  const normalizeDocument = (doc: string): string => {
    return doc.replace(/\D/g, "");
  };

  // Download import template
  const handleDownloadTemplate = () => {
    const headers = [
      "nome_completo",
      "telefone",
      "cpf",
      "cnpj",
      "email",
      "produto",
      "valor_contrato",
      "data_inicio",
      "data_fim",
      "forma_pagamento",
      "observacoes",
    ];
    
    const exampleRows = [
      [
        "João Silva",
        "(11) 99999-9999",
        "123.456.789-00",
        "",
        "joao@email.com",
        "Makers Club",
        "84000",
        "2025-01-01",
        "2026-01-01",
        "pix",
        "Cliente migrado",
      ],
      [
        "Maria Santos",
        "(21) 98888-8888",
        "",
        "12.345.678/0001-90",
        "maria@empresa.com",
        "Eternum Club",
        "156000",
        "2025-02-01",
        "2026-02-01",
        "boleto",
        "",
      ],
    ];

    const csvContent = [
      headers.join(";"),
      ...exampleRows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_importacao_contratos.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template baixado!");
  };

  // Parse CSV with proper handling of quoted fields
  const parseCSVLine = (line: string, delimiter: string = ","): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ""));
    return result;
  };

  // Parse Brazilian date format (dd/mm/yyyy) to ISO format
  const parseBrazilianDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  // Map contract status from Portuguese to system status
  const mapContractStatus = (status: string): string => {
    const statusLower = status.toLowerCase().trim();
    if (statusLower === "ativo") return "active";
    if (statusLower === "suspenso") return "suspended";
    if (statusLower === "pausado" || statusLower === "congelado") return "paused";
    if (statusLower === "cancelado") return "cancelled";
    if (statusLower === "encerrado") return "ended";
    return "active";
  };

  // Parse CSV and show preview with duplicate detection
  const handleImportContracts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: userProfile } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!userProfile) throw new Error("Perfil não encontrado");

      setImportUserProfile(userProfile);

      // Fetch team users to map responsible by name
      const { data: teamUsers } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", userProfile.account_id);
      
      setImportTeamUsers(teamUsers);

      // Fetch all existing clients for duplicate detection
      const { data: existingClients } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164, cpf, cnpj")
        .eq("account_id", userProfile.account_id);

      // Fetch clients with active contracts
      const { data: clientsWithContracts } = await supabase
        .from("client_contracts")
        .select("client_id")
        .eq("account_id", userProfile.account_id)
        .in("status", ["active", "pending"]);
      
      const clientIdsWithContracts = new Set(clientsWithContracts?.map(c => c.client_id) || []);

      const text = await file.text();
      const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const allLines = normalizedText.split("\n");
      
      // Reconstruct lines handling multi-line quoted fields
      const lines: string[] = [];
      let currentLine = "";
      let openQuotes = false;
      
      for (const line of allLines) {
        const quoteCount = (line.match(/"/g) || []).length;
        if (openQuotes) {
          currentLine += "\n" + line;
          if (quoteCount % 2 === 1) {
            openQuotes = false;
            lines.push(currentLine);
            currentLine = "";
          }
        } else {
          if (quoteCount % 2 === 1) {
            openQuotes = true;
            currentLine = line;
          } else {
            if (line.trim()) lines.push(line);
          }
        }
      }
      
      if (!lines.length) {
        toast.error("Arquivo vazio");
        setImporting(false);
        return;
      }

      // Detect delimiter (comma or semicolon)
      const firstLine = lines[0];
      const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
      
      const headers = parseCSVLine(lines[0], delimiter).map((h) => 
        h.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "_")
      );

      const previewRows: ImportRowWithDuplicate[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i], delimiter);
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || "";
          });

          const nome = row.nome || row.nome_completo || "";
          const telefone = row.telefone || "";
          const documento = row["cpf/cnpj"] || "";
          const cpfRaw = row.cpf || "";
          const cnpjRaw = row.cnpj || "";
          const email = row["e-mail"] || row.email || "";
          const produto = row.produto || "";
          const dataInicio = row.data_de_inicio || row.data_inicio || "";
          const dataVencimento = row.data_de_vencimento || row.data_fim || "";
          const statusContratoRaw = row.contrato_status || row.status || "Ativo";
          const observacao = row.observacao || row.observacoes || "";
          const valorContrato = row.valor_contrato || "";

          // Map status from CSV to internal status
          const mapStatusToInternal = (status: string): string => {
            const normalized = status.toLowerCase().trim();
            if (normalized === "ativo" || normalized === "active") return "active";
            if (normalized === "cancelado" || normalized === "cancelled") return "cancelled";
            if (normalized === "encerrado" || normalized === "ended") return "ended";
            if (normalized === "inativo" || normalized === "inativos" || normalized === "inactive") return "ended";
            if (normalized === "suspenso" || normalized === "suspended") return "suspended";
            if (normalized === "pausado" || normalized === "paused") return "paused";
            if (normalized === "pendente" || normalized === "pending") return "pending";
            if (normalized === "demitida" || normalized === "demitidas" || normalized === "dismissed") return "dismissed";
            if (normalized === "desistência 7d" || normalized === "desistencia 7d" || normalized === "dropout_7d") return "dropout_7d";
            if (normalized === "a iniciar" || normalized === "scheduled") return "scheduled";
            return "active"; // Default
          };
          const statusContrato = mapStatusToInternal(statusContratoRaw);

          // Check for errors
          let hasError = false;
          let errorMessage = "";
          if (!nome) {
            hasError = true;
            errorMessage = "Nome vazio";
          } else if (!telefone) {
            hasError = true;
            errorMessage = "Telefone vazio";
          }

          const phone = telefone ? normalizePhone(telefone.replace(/\n/g, "").trim()) : "";
          
          // Parse document
          let cpf: string | null = null;
          let cnpj: string | null = null;
          
          if (documento) {
            const docNormalized = normalizeDocument(documento);
            if (docNormalized.length === 11) {
              cpf = docNormalized;
            } else if (docNormalized.length >= 14) {
              cnpj = docNormalized;
            } else if (docNormalized.length > 11) {
              cnpj = docNormalized;
            } else {
              cpf = docNormalized;
            }
          }
          if (cpfRaw) cpf = normalizeDocument(cpfRaw);
          if (cnpjRaw) cnpj = normalizeDocument(cnpjRaw);

          // Detect duplicates
          const duplicates: DuplicateInfo[] = [];
          
          if (existingClients) {
            // Check by CPF
            if (cpf && cpf.length >= 11) {
              const matchByCpf = existingClients.find(c => c.cpf === cpf);
              if (matchByCpf) {
                duplicates.push({
                  type: "cpf",
                  existingClientId: matchByCpf.id,
                  existingClientName: matchByCpf.full_name,
                  matchValue: cpf,
                  hasActiveContract: clientIdsWithContracts.has(matchByCpf.id),
                });
              }
            }

            // Check by CNPJ
            if (cnpj && cnpj.length >= 14) {
              const matchByCnpj = existingClients.find(c => c.cnpj === cnpj);
              if (matchByCnpj && !duplicates.find(d => d.existingClientId === matchByCnpj.id)) {
                duplicates.push({
                  type: "cnpj",
                  existingClientId: matchByCnpj.id,
                  existingClientName: matchByCnpj.full_name,
                  matchValue: cnpj,
                  hasActiveContract: clientIdsWithContracts.has(matchByCnpj.id),
                });
              }
            }

            // Check by phone
            if (phone) {
              const matchByPhone = existingClients.find(c => c.phone_e164 === phone);
              if (matchByPhone && !duplicates.find(d => d.existingClientId === matchByPhone.id)) {
                duplicates.push({
                  type: "phone",
                  existingClientId: matchByPhone.id,
                  existingClientName: matchByPhone.full_name,
                  matchValue: phone,
                  hasActiveContract: clientIdsWithContracts.has(matchByPhone.id),
                });
              }
            }
          }

          previewRows.push({
            lineNumber: i + 1,
            nome: nome.replace(/\n/g, " ").trim(),
            telefone: telefone.replace(/\n/g, "").trim(),
            cpf,
            cnpj,
            email: email || null,
            produto: produto || null,
            valorContrato: valorContrato ? parseFloat(valorContrato) : 0,
            dataInicio: parseBrazilianDate(dataInicio) || null,
            dataFim: parseBrazilianDate(dataVencimento) || null,
            status: statusContrato,
            observacao: observacao || null,
            rawData: row,
            duplicates,
            selected: !hasError,
            hasError,
            errorMessage,
          });
        } catch (rowError) {
          console.error(`Erro analisando linha ${i + 1}:`, rowError);
          previewRows.push({
            lineNumber: i + 1,
            nome: "",
            telefone: "",
            cpf: null,
            cnpj: null,
            email: null,
            produto: null,
            valorContrato: 0,
            dataInicio: null,
            dataFim: null,
            status: "Ativo",
            observacao: null,
            rawData: {},
            duplicates: [],
            selected: false,
            hasError: true,
            errorMessage: "Erro ao processar linha",
          });
        }
      }

      setImportPreviewRows(previewRows);
      setImportPreviewOpen(true);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast.error("Erro ao processar arquivo CSV");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  // Confirm and execute import after preview
  const handleConfirmImport = async (selectedRows: ImportRowWithDuplicate[], createNewClients: boolean, overrideStatus: string | null) => {
    if (!importUserProfile) return;

    setImporting(true);
    try {
      // Fetch existing clients for linking
      const { data: existingClients } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164, cpf, cnpj")
        .eq("account_id", importUserProfile.account_id);

      let created = 0;
      let linked = 0;
      let contractsCreated = 0;
      let errors = 0;

      for (const row of selectedRows) {
        try {
          const phone = normalizePhone(row.telefone);
          let clientId: string | null = null;

          // Check for existing client
          if (row.duplicates.length > 0) {
            // Use the first duplicate match
            clientId = row.duplicates[0].existingClientId;
            linked++;
          } else if (createNewClients) {
            // Create new client
            const rawData = row.rawData;
            const email = row.email;
            const cidade = rawData.cidade || "";
            const estado = rawData.estado || "";
            const anja = rawData.anja || "";
            const engajamento = rawData.engajamento || "";
            const renovacao = rawData.renovacao || "";
            const clinicaRyka = rawData.clinica_ryka || "";
            const idContratoExterno = rawData.id_contrato || "";

            let responsibleUserId: string | null = null;
            if (anja && importTeamUsers) {
              const user = importTeamUsers.find(
                (u) => u.name?.toLowerCase().includes(anja.toLowerCase())
              );
              if (user) responsibleUserId = user.id;
            }

            const emails = email ? [{ email: email.trim(), label: "principal" }] : [];
            
            const notesArr: string[] = [];
            if (engajamento) notesArr.push(`Engajamento: ${engajamento}`);
            if (renovacao) notesArr.push(`Renovação: ${renovacao}`);
            if (clinicaRyka) notesArr.push(`Clínica Ryka: ${clinicaRyka}`);
            if (idContratoExterno) notesArr.push(`ID Contrato Externo: ${idContratoExterno}`);
            
            const clientData = {
              account_id: importUserProfile.account_id,
              full_name: row.nome,
              phone_e164: phone,
              cpf: row.cpf && row.cpf.length === 11 ? row.cpf : null,
              cnpj: row.cnpj && row.cnpj.length >= 14 ? row.cnpj : null,
              emails: emails,
              city: cidade || null,
              state: estado || null,
              responsible_user_id: responsibleUserId,
              notes: notesArr.length > 0 ? notesArr.join(" | ") : null,
              status: "active" as const,
            };

            const { data: newClient, error: clientError } = await supabase
              .from("clients")
              .insert(clientData)
              .select("id")
              .single();

            if (clientError) {
              console.error(`Erro criando cliente ${row.nome}:`, clientError);
              errors++;
              continue;
            }
            clientId = newClient.id;
            created++;
          } else {
            // Skip if not creating new clients and no duplicate found
            errors++;
            continue;
          }

          // Find product by name
          let productId: string | null = null;
          if (row.produto) {
            const product = products.find(
              (p) => p.name.toLowerCase() === row.produto?.toLowerCase().trim()
            );
            if (product) productId = product.id;
          }

          // Build contract notes
          const rawData = row.rawData;
          const contractNotesArr: string[] = [];
          if (row.observacao) contractNotesArr.push(row.observacao.replace(/\n/g, " "));
          if (rawData.engajamento) contractNotesArr.push(`Engajamento: ${rawData.engajamento}`);
          if (rawData.renovacao) contractNotesArr.push(`Renovação: ${rawData.renovacao}`);
          if (rawData.clinica_ryka === "Sim") contractNotesArr.push("Clínica Ryka");
          if (rawData.id_contrato) contractNotesArr.push(`ID Externo: ${rawData.id_contrato}`);

          // Create contract
          const contractData = {
            account_id: importUserProfile.account_id,
            client_id: clientId,
            product_id: productId,
            value: row.valorContrato,
            start_date: row.dataInicio || format(new Date(), "yyyy-MM-dd"),
            end_date: row.dataFim || null,
            payment_option: null,
            notes: contractNotesArr.join(" | ") || "Importado via CSV",
            status: overrideStatus || mapContractStatus(row.status),
            status_reason: row.status.toLowerCase() === "suspenso" || row.status.toLowerCase() === "congelado" 
              ? row.observacao || "Importado com status pausado" 
              : null,
            contract_type: "compra",
          };

          const { error: contractError } = await supabase
            .from("client_contracts")
            .insert(contractData);

          if (contractError) {
            console.error(`Erro criando contrato para ${row.nome}:`, contractError);
            errors++;
          } else {
            contractsCreated++;
          }
        } catch (rowError) {
          console.error(`Erro processando linha ${row.lineNumber}:`, rowError);
          errors++;
        }
      }

      await fetchContracts();
      await fetchClients();

      const message = [];
      if (created > 0) message.push(`${created} clientes criados`);
      if (linked > 0) message.push(`${linked} vinculados a existentes`);
      if (contractsCreated > 0) message.push(`${contractsCreated} contratos criados`);
      if (errors > 0) message.push(`${errors} erros`);
      
      toast.success(`Importação concluída: ${message.join(", ")}`);
      setImportPreviewOpen(false);
      setImportPreviewRows([]);
    } catch (error) {
      console.error("Error importing:", error);
      toast.error("Erro ao importar contratos");
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setFormData({
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      value: "",
      contract_type: "compra",
      product_id: "",
      notes: "",
      payment_type: "",
      installments: "",
      custom_installments: "",
      payment_method: "",
      first_due_date: "",
      bank_account_id: "",
      category_id: "",
      cost_center_id: "",
      seller_id: "",
      generate_receivables: true,
      receivable_description: "",
    });
    setInstallmentsDetail([]);
    setClientFormData(getEmptyClientFormData());
    setIsCreatingNewClient(false);
    setFormTab("contrato");
  };

  const openNewContractDialog = () => {
    resetForm();
    fromDealRef.current = false; // Reset deal flag for manual creation
    setDialogOpen(true);
  };

  const getInstallmentsCount = (): number => {
    if (formData.payment_type === "a_vista") return 1;
    if (formData.installments === "custom") {
      return parseInt(formData.custom_installments) || 0;
    }
    return parseInt(formData.installments?.replace("x", "")) || 0;
  };

  const buildPaymentOption = () => {
    if (!formData.payment_type) return null;
    if (formData.payment_type === "a_vista") {
      return formData.payment_method ? `a_vista_${formData.payment_method}` : "a_vista";
    }
    if (formData.payment_type === "personalizado") {
      return "personalizado";
    }
    const installments = formData.installments === "custom" 
      ? `${formData.custom_installments}x` 
      : formData.installments || "1x";
    return formData.payment_method
      ? `parcelado_${installments}_${formData.payment_method}`
      : `parcelado_${installments}`;
  };

  const handleSaveContract = async () => {
    // Validate based on mode
    if (isCreatingNewClient) {
      if (!clientFormData.full_name.trim() || !clientFormData.phone_e164.trim()) {
        toast.error("Preencha o nome e telefone do cliente");
        return;
      }
    } else {
      if (!selectedClient) {
        toast.error("Selecione um cliente");
        return;
      }
    }
    
    if (!formData.start_date || !formData.value) {
      toast.error("Preencha a data de início e o valor");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: userProfile } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!userProfile) throw new Error("Perfil não encontrado");

      let clientId = selectedClient?.id;

      // If creating new client, check for duplicate phone first
      if (isCreatingNewClient) {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id, full_name")
          .eq("account_id", userProfile.account_id)
          .eq("phone_e164", clientFormData.phone_e164)
          .maybeSingle();
        
        if (existingClient) {
          toast.error(`Este telefone já está cadastrado para: ${existingClient.full_name}. Use "Selecionar existente" para vincular ao cliente.`);
          setSaving(false);
          return;
        }

        const newClientData = {
          account_id: userProfile.account_id,
          full_name: clientFormData.full_name,
          phone_e164: clientFormData.phone_e164,
          status: "active" as const,
          emails: clientFormData.emails.length > 0 ? clientFormData.emails : null,
          additional_phones: clientFormData.additional_phones.length > 0 ? clientFormData.additional_phones : null,
          cpf: clientFormData.cpf || null,
          rg: clientFormData.rg || null,
          cnpj: clientFormData.cnpj || null,
          birth_date: clientFormData.birth_date || null,
          company_name: clientFormData.company_name || null,
          notes: clientFormData.notes || null,
          instagram: clientFormData.instagram || null,
          instagrams: clientFormData.instagrams.length > 0 ? clientFormData.instagrams : null,
          bio: clientFormData.bio || null,
          street: clientFormData.street || null,
          street_number: clientFormData.street_number || null,
          complement: clientFormData.complement || null,
          neighborhood: clientFormData.neighborhood || null,
          city: clientFormData.city || null,
          state: clientFormData.state || null,
          zip_code: clientFormData.zip_code || null,
          business_street: clientFormData.business_street || null,
          business_street_number: clientFormData.business_street_number || null,
          business_complement: clientFormData.business_complement || null,
          business_neighborhood: clientFormData.business_neighborhood || null,
          business_city: clientFormData.business_city || null,
          business_state: clientFormData.business_state || null,
          business_zip_code: clientFormData.business_zip_code || null,
          business_segment: clientFormData.business_segment || null,
          business_niche: clientFormData.business_niche || null,
          timezone: clientFormData.timezone || null,
          companies: clientFormData.companies.length > 0 ? clientFormData.companies : null,
          is_mls: clientFormData.is_mls,
          mls_level: clientFormData.mls_level || null,
          responsible_user_id: clientFormData.responsible_user_id || null,
          pix_key_type: clientFormData.pix_key_type || null,
          pix_key: clientFormData.pix_key || null,
          additional_pix_keys: clientFormData.additional_pix_keys.length > 0 ? clientFormData.additional_pix_keys : null,
          bank_code: clientFormData.bank_code || null,
          bank_name: clientFormData.bank_name || null,
          bank_agency: clientFormData.bank_agency || null,
          bank_account: clientFormData.bank_account || null,
          bank_account_type: clientFormData.bank_account_type || null,
          additional_bank_accounts: clientFormData.additional_bank_accounts.length > 0 ? clientFormData.additional_bank_accounts : null,
        };

        console.log('[Contract] Creating new client:', {
          full_name: clientFormData.full_name,
          phone: clientFormData.phone_e164,
          account_id: userProfile.account_id
        });

        const { data: newClient, error: createClientError } = await supabase
          .from("clients")
          .insert(newClientData as any)
          .select("id")
          .single();

        if (createClientError) {
          console.error('[Contract] Client creation error:', createClientError);
          if (createClientError.code === '23505') {
            toast.error("Este telefone já está cadastrado. Use 'Selecionar existente'.");
          } else if (createClientError.code === '42501') {
            toast.error("Sem permissão para criar cliente. Verifique suas credenciais.");
          } else {
            toast.error(`Erro ao criar cliente: ${createClientError.message}`);
          }
          setSaving(false);
          return;
        }
        clientId = newClient.id;
        
        // Refresh clients list
        fetchClients();
      } else if (selectedClient) {
        // Update existing client data
        const clientUpdateData = {
          full_name: clientFormData.full_name,
          phone_e164: clientFormData.phone_e164,
          emails: clientFormData.emails.length > 0 ? clientFormData.emails : null,
          additional_phones: clientFormData.additional_phones.length > 0 ? clientFormData.additional_phones : null,
          cpf: clientFormData.cpf || null,
          rg: clientFormData.rg || null,
          cnpj: clientFormData.cnpj || null,
          birth_date: clientFormData.birth_date || null,
          company_name: clientFormData.company_name || null,
          notes: clientFormData.notes || null,
          instagram: clientFormData.instagram || null,
          instagrams: clientFormData.instagrams.length > 0 ? clientFormData.instagrams : null,
          bio: clientFormData.bio || null,
          street: clientFormData.street || null,
          street_number: clientFormData.street_number || null,
          complement: clientFormData.complement || null,
          neighborhood: clientFormData.neighborhood || null,
          city: clientFormData.city || null,
          state: clientFormData.state || null,
          zip_code: clientFormData.zip_code || null,
          business_street: clientFormData.business_street || null,
          business_street_number: clientFormData.business_street_number || null,
          business_complement: clientFormData.business_complement || null,
          business_neighborhood: clientFormData.business_neighborhood || null,
          business_city: clientFormData.business_city || null,
          business_state: clientFormData.business_state || null,
          business_zip_code: clientFormData.business_zip_code || null,
          business_segment: clientFormData.business_segment || null,
          business_niche: clientFormData.business_niche || null,
          companies: clientFormData.companies.length > 0 ? clientFormData.companies : null,
          is_mls: clientFormData.is_mls,
          mls_level: clientFormData.mls_level || null,
          responsible_user_id: clientFormData.responsible_user_id || null,
          pix_key_type: clientFormData.pix_key_type || null,
          pix_key: clientFormData.pix_key || null,
          additional_pix_keys: clientFormData.additional_pix_keys.length > 0 ? clientFormData.additional_pix_keys : null,
          bank_code: clientFormData.bank_code || null,
          bank_name: clientFormData.bank_name || null,
          bank_agency: clientFormData.bank_agency || null,
          bank_account: clientFormData.bank_account || null,
          bank_account_type: clientFormData.bank_account_type || null,
          additional_bank_accounts: clientFormData.additional_bank_accounts.length > 0 ? clientFormData.additional_bank_accounts : null,
        };

        const { error: clientError } = await supabase
          .from("clients")
          .update(clientUpdateData as any)
          .eq("id", selectedClient.id);

        if (clientError) {
          console.error("Error updating client:", clientError);
        }
      }

      // Determine status based on start_date
      const startDate = parseLocalDate(formData.start_date) || new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFutureStart = startDate > today;

      const contractData = {
        client_id: clientId,
        account_id: userProfile.account_id,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        value: parseFloat(formData.value) || 0,
        contract_type: formData.contract_type,
        product_id: formData.product_id || null,
        payment_option: buildPaymentOption(),
        payment_method: formData.payment_method || null,
        installments_count: getInstallmentsCount() || null,
        first_due_date: formData.first_due_date || null,
        notes: formData.notes || null,
        status: isFutureStart ? "scheduled" : "active",
        installments_detail: formData.payment_type === "personalizado" && installmentsDetail.length > 0 
          ? installmentsDetail 
          : null,
      };

      console.log('[Contract] Creating contract:', {
        client_id: clientId,
        start_date: formData.start_date,
        value: formData.value,
        status: isFutureStart ? "scheduled" : "active"
      });

      const { data: newContract, error } = await supabase
        .from("client_contracts")
        .insert(contractData as any)
        .select("id")
        .single();

      if (error) {
        console.error('[Contract] Contract creation error:', error);
        if (error.code === '23503') {
          toast.error("Cliente ou produto inválido. Verifique os dados.");
        } else if (error.code === '23514') {
          toast.error("Status do contrato inválido.");
        } else if (error.code === '42501') {
          toast.error("Sem permissão para criar contrato.");
        } else {
          toast.error(`Erro ao salvar contrato: ${error.message}`);
        }
        setSaving(false);
        return;
      }
      
      // Send notifications if contract is from a deal win
      if (fromDealRef.current && newContract) {
        const { data: currentUser } = await supabase
          .from("users")
          .select("id")
          .eq("auth_user_id", userData.user.id)
          .single();
        
        if (currentUser) {
          notifyContractCreated({
            contractId: newContract.id,
            clientName: isCreatingNewClient ? clientFormData.full_name : (selectedClient?.full_name || ""),
            contractValue: parseFloat(formData.value) || 0,
            fromDeal: true,
            createdByUserId: currentUser.id,
            accountId: userProfile.account_id,
          });
        }
        fromDealRef.current = false;
      }
      
      toast.success(isCreatingNewClient ? "Cliente e contrato criados com sucesso" : "Contrato criado com sucesso");
      setDialogOpen(false);
      fetchContracts();
    } catch (error: any) {
      console.error("Error saving contract:", error);
      
      // Handle specific constraint violation errors
      if (error?.code === '23505' && error?.message?.includes('phone_e164')) {
        toast.error("Este telefone já está cadastrado para outro cliente. Use 'Selecionar existente'.");
      } else {
        const msg = error?.message || "Erro desconhecido";
        toast.error(`Erro ao salvar contrato: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };


  // Filter out child contracts (renewals linked via parent_contract_id) to avoid duplication
  const rootContracts = useMemo(() => {
    return contracts.filter(c => !c.parent_contract_id);
  }, [contracts]);

  // Separate contracts by reconciliation status
  const reconciledContracts = useMemo(() => {
    return rootContracts.filter(c => c.receivables_generated === true);
  }, [rootContracts]);

  const queueContracts = useMemo(() => {
    return rootContracts.filter(c => !c.receivables_generated);
  }, [rootContracts]);

  // Contracts for triage queue (clients without responsible)
  const triageContracts = useMemo(() => {
    return rootContracts.filter(c => !c.client?.responsible_user_id);
  }, [rootContracts]);

  const validationContracts = useMemo(() => (
    queueContracts.map((c) => ({
      id: c.id,
      client_id: c.client_id,
      product: c.product,
    }))
  ), [queueContracts]);

  // Batch validation for queue contracts
  const { validations: conciliationValidations, isLoading: validationsLoading } = useBatchConciliationValidation(
    validationContracts
  );

  // Get current contracts based on active tab
  const currentContracts = activeTab === "conciliados" ? reconciledContracts : 
    activeTab === "triagem" ? triageContracts : queueContracts;

  const filteredContracts = useMemo(() => {
    const filtered = currentContracts.filter((contract) => {
      const matchesSearch = 
        contract.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isExpired = contract.end_date && isPast(parseLocalDate(contract.end_date)!) && contract.status === "active";
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "expired" ? isExpired : contract.status === statusFilter);
      const matchesType = typeFilter === "all" || contract.contract_type === typeFilter;
      const matchesProduct = productFilter === "all" || contract.product?.id === productFilter;
      
      return matchesSearch && matchesStatus && matchesType && matchesProduct;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      if (sortOrder === "az") {
        const nameA = a.client?.full_name?.toLowerCase() || "";
        const nameB = b.client?.full_name?.toLowerCase() || "";
        return nameA.localeCompare(nameB, "pt-BR");
      } else {
        // Recent first (by created_at)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [currentContracts, searchTerm, statusFilter, typeFilter, productFilter, sortOrder]);

  // Reset page when filters or tab change
  const filterKey = `${searchTerm}-${statusFilter}-${typeFilter}-${productFilter}-${activeTab}`;
  const prevFilterKeyRef = useRef(filterKey);
  if (prevFilterKeyRef.current !== filterKey) {
    prevFilterKeyRef.current = filterKey;
    if (contractsPage !== 1) setContractsPage(1);
  }

  // Paginated contracts for display
  const totalFilteredContracts = filteredContracts.length;
  const totalPages = Math.ceil(totalFilteredContracts / contractsPageSize);
  const paginatedContracts = useMemo(() => {
    const start = (contractsPage - 1) * contractsPageSize;
    return filteredContracts.slice(start, start + contractsPageSize);
  }, [filteredContracts, contractsPage, contractsPageSize]);


  // Check if any filter is active
  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || typeFilter !== "all" || productFilter !== "all";

  const stats = useMemo(() => {
    // Use filtered contracts if filter is active, otherwise current tab's contracts
    let baseContracts;
    baseContracts = hasActiveFilters ? filteredContracts : currentContracts;
    
    const scheduledContracts = baseContracts.filter(c => c.status === "scheduled");
    const activeContracts = baseContracts.filter(c => c.status === "active");
    const pendingContracts = baseContracts.filter(c => c.status === "pending");
    const suspendedContracts = baseContracts.filter(c => c.status === "suspended");
    const pausedContracts = baseContracts.filter(c => c.status === "paused");
    const cancelledContracts = baseContracts.filter(c => c.status === "cancelled");
    const endedContracts = baseContracts.filter(c => c.status === "ended");
    const dismissedContracts = baseContracts.filter(c => c.status === "dismissed");
    const dropout7dContracts = baseContracts.filter(c => c.status === "dropout_7d");
    
    const totalValue = activeContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const expiringSoon = activeContracts.filter(c => {
      if (!c.end_date) return false;
      const daysUntilExpiry = differenceInDays(parseLocalDate(c.end_date)!, new Date());
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    });
    const expired = activeContracts.filter(c => {
      if (!c.end_date) return false;
      return isPast(parseLocalDate(c.end_date)!);
    });

    return {
      total: baseContracts.length,
      scheduled: scheduledContracts.length,
      active: activeContracts.length,
      pending: pendingContracts.length,
      suspended: suspendedContracts.length,
      paused: pausedContracts.length,
      cancelled: cancelledContracts.length,
      ended: endedContracts.length,
      dismissed: dismissedContracts.length,
      dropout_7d: dropout7dContracts.length,
      totalValue,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
    };
  }, [filteredContracts, currentContracts, hasActiveFilters]);

  const formatCurrency = formatCurrencyStatic;
  const getExpiryBadge = getExpiryBadgeStatic;

  // Stable callbacks for memoized row component
  const handleNavigateToClient = useCallback((clientId: string) => {
    navigate(`/clients/${clientId}`);
  }, [navigate]);

  const handleViewContract = useCallback((contract: Contract) => {
    setSelectedContract(contract);
    setDetailSheetOpen(true);
  }, []);

  const handleRequestDeleteContract = useCallback((contract: Contract) => {
    setContractToDelete(contract);
    setDeleteDialogOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contratos</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie todos os contratos dos seus clientes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDownloadTemplate}
          >
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            disabled={importing}
            asChild
          >
            <label className="cursor-pointer">
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4 mr-2" />
              )}
              Importar CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImportContracts}
                className="hidden"
                disabled={importing}
              />
            </label>
          </Button>
          <Button size="sm" onClick={openNewContractDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* Compact Stats Strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0">
          <FileText className="h-3 w-3" />
          {stats.total} Total
        </Badge>
        <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-green-600 border-green-600/30 bg-green-500/5">
          <CheckCircle className="h-3 w-3" />
          {stats.active} Ativos
        </Badge>
        {stats.pending > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-blue-600 border-blue-600/30 bg-blue-500/5">
            <Clock className="h-3 w-3" />
            {stats.pending} Pendentes
          </Badge>
        )}
        {stats.scheduled > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-indigo-600 border-indigo-600/30 bg-indigo-500/5">
            <Clock className="h-3 w-3" />
            {stats.scheduled} A Iniciar
          </Badge>
        )}
        {stats.suspended > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-orange-600 border-orange-600/30 bg-orange-500/5">
            <Ban className="h-3 w-3" />
            {stats.suspended} Suspensos
          </Badge>
        )}
        {stats.paused > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-amber-600 border-amber-600/30 bg-amber-500/5">
            <PauseCircle className="h-3 w-3" />
            {stats.paused} Pausados
          </Badge>
        )}
        {stats.cancelled > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-red-600 border-red-600/30 bg-red-500/5">
            <XCircle className="h-3 w-3" />
            {stats.cancelled} Cancelados
          </Badge>
        )}
        {stats.ended > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-muted-foreground">
            <Ban className="h-3 w-3" />
            {stats.ended} Encerrados
          </Badge>
        )}
        {stats.dismissed > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-rose-600 border-rose-600/30 bg-rose-500/5">
            <XCircle className="h-3 w-3" />
            {stats.dismissed} Demitidas
          </Badge>
        )}
        {stats.dropout_7d > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-pink-600 border-pink-600/30 bg-pink-500/5">
            <XCircle className="h-3 w-3" />
            {stats.dropout_7d} Desist. 7D
          </Badge>
        )}
        <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-emerald-600 border-emerald-600/30 bg-emerald-500/5">
          <TrendingUp className="h-3 w-3" />
          {formatCurrency(stats.totalValue)}
        </Badge>
        {stats.expiringSoon > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-amber-600 border-amber-600/30 bg-amber-500/5">
            <Clock className="h-3 w-3" />
            {stats.expiringSoon} Vencendo
          </Badge>
        )}
        {stats.expired > 0 && (
          <Badge variant="outline" className="gap-1 py-0.5 px-2 text-[11px] font-medium whitespace-nowrap shrink-0 text-red-600 border-red-600/30 bg-red-500/5">
            <AlertTriangle className="h-3 w-3" />
            {stats.expired} Vencidos
          </Badge>
        )}
      </div>

      {/* Tabs for Reconciliation Status */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="fila" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Conciliação</span>
            <span className="sm:hidden">Fila</span>
            {queueContracts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {queueContracts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="triagem" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Triagem</span>
            <span className="sm:hidden">Triagem</span>
            {triageContracts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {triageContracts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="conciliados" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Conciliados
            {reconciledContracts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {reconciledContracts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Filters - visible on all tabs */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, produto ou notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="scheduled">A Iniciar</SelectItem>
                  <SelectItem value="suspended">Suspensos</SelectItem>
                  <SelectItem value="paused">Pausados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                  <SelectItem value="ended">Encerrados</SelectItem>
                  <SelectItem value="dismissed">Demitidas</SelectItem>
                  <SelectItem value="dropout_7d">Desistência 7D</SelectItem>
                  <SelectItem value="expired">Vencidos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "az" ? "recent" : "az")}
                title={sortOrder === "az" ? "Ordenar por recentes" : "Ordenar A-Z"}
                className={cn(
                  "shrink-0",
                  sortOrder === "az" && "bg-primary/10 border-primary text-primary"
                )}
              >
                {sortOrder === "az" ? (
                  <ArrowDownAZ className="h-4 w-4" />
                ) : (
                  <History className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        
          <TabsContent value={activeTab} className="space-y-4">
            {/* Queue Status Info */}
            {activeTab === "fila" && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Contratos aguardando conciliação</p>
                    <p className="text-sm text-amber-700">
                      O botão "Conciliar" será liberado quando:
                    </p>
                    <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                      <li>Lançamentos financeiros gerados</li>
                      <li>CPF ou CNPJ preenchido</li>
                      <li>Endereço completo cadastrado</li>
                      <li>Produto vinculado ao contrato</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "triagem" && (
            <>
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Clientes aguardando atribuição</p>
                      <p className="text-sm text-blue-700">
                        Estes clientes ainda não possuem um consultor responsável. 
                        Clique em "Puxar" para assumir o atendimento ou inicie uma conversa no ROY zAPP.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <ContractTriageQueue
                contracts={triageContracts as any}
                teamUsers={teamUsers}
                onRefresh={fetchContracts}
                onViewContract={(contract) => {
                  setSelectedContract(contract as any);
                  setDetailSheetOpen(true);
                }}
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                typeFilter={typeFilter}
                productFilter={productFilter}
                sortOrder={sortOrder}
              />
            </>
          )}

      {/* Contracts Table - hide on triagem tab since it has its own component */}
      {activeTab !== "triagem" && (
        <>
        <Card>
          <CardContent className="p-0">
            {totalFilteredContracts === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum contrato encontrado</p>
                <p className="text-sm">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                    ? "Tente ajustar os filtros"
                    : "Os contratos criados nos clientes aparecerão aqui"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContracts.map((contract) => (
                    <ContractTableRow
                      key={contract.id}
                      contract={contract}
                      activeTab={activeTab}
                      validation={conciliationValidations.get(contract.id)}
                      onNavigate={handleNavigateToClient}
                      onView={handleViewContract}
                      onDelete={handleRequestDeleteContract}
                      onConciliateSuccess={fetchContracts}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        {totalFilteredContracts > contractsPageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {((contractsPage - 1) * contractsPageSize) + 1}–{Math.min(contractsPage * contractsPageSize, totalFilteredContracts)} de {totalFilteredContracts} contratos
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-4">
                {[20, 50, 100].map((size) => (
                  <Button
                    key={size}
                    variant={contractsPageSize === size ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-10 text-xs"
                    onClick={() => {
                      setContractsPageSize(size);
                      setContractsPage(1);
                    }}
                  >
                    {size}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContractsPage(p => Math.max(1, p - 1))}
                disabled={contractsPage <= 1}
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (contractsPage <= 4) {
                    pageNum = i + 1;
                  } else if (contractsPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = contractsPage - 3 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === contractsPage ? "default" : "outline"}
                      size="sm"
                      className="w-9 h-9"
                      onClick={() => setContractsPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContractsPage(p => Math.min(totalPages, p + 1))}
                disabled={contractsPage >= totalPages}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
        </>
      )}
          </TabsContent>

      </Tabs>

      {/* New Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Novo Contrato
            </DialogTitle>
          </DialogHeader>

          <Tabs value={formTab} onValueChange={setFormTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="contrato" className="text-xs">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Contrato
              </TabsTrigger>
              <TabsTrigger value="cliente" className="text-xs" disabled={!selectedClient && !isCreatingNewClient}>
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Cliente
              </TabsTrigger>
              <TabsTrigger value="pagamento" className="text-xs">
                <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                Pagamento
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Financeiro
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4 pr-1">
              {/* Contract Tab */}
              <TabsContent value="contrato" className="mt-0 space-y-4">
                {/* Client Selection Mode */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Cliente *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        if (isCreatingNewClient) {
                          setIsCreatingNewClient(false);
                          setClientFormData(getEmptyClientFormData());
                        } else {
                          setIsCreatingNewClient(true);
                          setSelectedClient(null);
                          setClientFormData(getEmptyClientFormData());
                          setFormTab("cliente");
                        }
                      }}
                    >
                      {isCreatingNewClient ? (
                        <>
                          <Search className="h-3.5 w-3.5 mr-1" />
                          Selecionar existente
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Criar novo cliente
                        </>
                      )}
                    </Button>
                  </div>

                  {isCreatingNewClient ? (
                    <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Novo cliente será criado junto com o contrato</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome *</Label>
                          <Input
                            placeholder="Nome completo"
                            value={clientFormData.full_name}
                            onChange={(e) => setClientFormData(prev => ({ ...prev, full_name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Telefone *</Label>
                          <Input
                            placeholder="+5511999999999"
                            value={clientFormData.phone_e164}
                            onChange={(e) => setClientFormData(prev => ({ ...prev, phone_e164: e.target.value }))}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Complete os dados na aba "Cliente" para preencher mais informações
                      </p>
                    </div>
                  ) : (
                    <Popover open={clientPopoverOpen} onOpenChange={(open) => {
                      setClientPopoverOpen(open);
                      if (open) {
                        // Reset search when opening
                        setClientSearchTerm("");
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={clientPopoverOpen}
                          className="w-full justify-between"
                        >
                          {selectedClient ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                {selectedClient.avatar_url ? (
                                  <img src={selectedClient.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <span className="truncate">{selectedClient.full_name}</span>
                            </div>
                          ) : (
                            "Selecione um cliente..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Buscar cliente por nome ou telefone..." 
                            value={clientSearchTerm}
                            onValueChange={setClientSearchTerm}
                          />
                          <CommandList>
                            {searchingClients ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : clients.length === 0 ? (
                              <CommandEmpty>
                                {clientSearchTerm.length < 2 
                                  ? "Digite ao menos 2 caracteres para buscar" 
                                  : "Nenhum cliente encontrado."
                                }
                              </CommandEmpty>
                            ) : (
                              <CommandGroup className="max-h-64 overflow-auto">
                                {clients.map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    value={client.id}
                                    onSelect={() => {
                                      setSelectedClient(client);
                                      setClientPopoverOpen(false);
                                      fetchClientData(client.id);
                                    }}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                        {client.avatar_url ? (
                                          <img src={client.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <Users className="h-3 w-3 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">{client.full_name}</span>
                                        {client.phone_e164 && (
                                          <span className="text-xs text-muted-foreground truncate">{client.phone_e164}</span>
                                        )}
                                      </div>
                                    </div>
                                    <Check
                                      className={cn(
                                        "ml-auto h-4 w-4 shrink-0",
                                        selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Data de Início *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">Data de Término</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Contract Type & Product */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Contrato *</Label>
                    <Select
                      value={formData.contract_type}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, contract_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Select
                      value={formData.product_id}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, product_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Value */}
                <div className="space-y-2">
                  <Label htmlFor="value">Valor Total do Contrato (R$) *</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.value}
                    onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Anotações sobre o contrato..."
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                  />
                </div>
              </TabsContent>

              {/* Client Tab */}
              <TabsContent value="cliente" className="mt-0">
                {loadingClientData ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Carregando dados do cliente...</span>
                  </div>
                ) : (selectedClient || isCreatingNewClient) ? (
                  <ScrollArea className="h-[calc(60vh-100px)]">
                    <div className="space-y-4 pr-2">
                      {isCreatingNewClient && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-primary/5 border-primary/20">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Plus className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-primary">Novo cliente</p>
                            <p className="text-xs text-muted-foreground">
                              Será criado junto com o contrato
                            </p>
                          </div>
                        </div>
                      )}
                      <ClientInfoForm
                        data={clientFormData}
                        onChange={setClientFormData}
                        teamUsers={teamUsers}
                        compact
                      />
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-50" />
                    <p>Selecione um cliente na aba Contrato para editar seus dados</p>
                  </div>
                )}
              </TabsContent>

              {/* Payment Tab */}
              <TabsContent value="pagamento" className="mt-0 space-y-4">
                {/* Payment Type */}
                <div className="space-y-2">
                  <Label>Tipo de Pagamento *</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(value) => setFormData((prev) => ({
                      ...prev,
                      payment_type: value,
                      installments: value === "a_vista" ? "" : prev.installments
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Installments (if parcelado or personalizado) */}
                {(formData.payment_type === "parcelado" || formData.payment_type === "personalizado") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Número de Parcelas</Label>
                      <Select
                        value={formData.installments}
                        onValueChange={(value) => {
                          setFormData((prev) => ({ ...prev, installments: value }));
                          setInstallmentsDetail([]);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {INSTALLMENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.installments === "custom" ? (
                      <div className="space-y-2">
                        <Label>Qtd. Parcelas</Label>
                        <Input
                          type="number"
                          min="1"
                          max="60"
                          placeholder="Ex: 8"
                          value={formData.custom_installments}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, custom_installments: e.target.value }));
                            setInstallmentsDetail([]);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>1º Vencimento</Label>
                        <Input
                          type="date"
                          value={formData.first_due_date}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, first_due_date: e.target.value }));
                            setInstallmentsDetail([]);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.installments === "custom" && (formData.payment_type === "parcelado" || formData.payment_type === "personalizado") && (
                  <div className="space-y-2">
                    <Label>1º Vencimento</Label>
                    <Input
                      type="date"
                      value={formData.first_due_date}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, first_due_date: e.target.value }));
                        setInstallmentsDetail([]);
                      }}
                    />
                  </div>
                )}

                {/* Payment Method (for non-personalized) */}
                {formData.payment_type && formData.payment_type !== "personalizado" && (
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, payment_method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Personalized Installments Editor */}
                {formData.payment_type === "personalizado" && getInstallmentsCount() > 0 && formData.first_due_date && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Configurar Parcelas
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {getInstallmentsCount()} parcelas
                      </span>
                    </div>
                    <InstallmentsEditor
                      totalValue={parseFloat(formData.value) || 0}
                      installmentsCount={getInstallmentsCount()}
                      firstDueDate={formData.first_due_date}
                      value={installmentsDetail}
                      onChange={setInstallmentsDetail}
                    />
                  </div>
                )}
              </TabsContent>

              {/* Financial Tab */}
              <TabsContent value="financeiro" className="mt-0 space-y-4">
                <Card className="border-dashed">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <Switch
                          id="generate_receivables"
                          checked={formData.generate_receivables}
                          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, generate_receivables: checked }))}
                        />
                        <Label htmlFor="generate_receivables" className="text-sm font-medium cursor-pointer">
                          Gerar lançamentos a receber automaticamente
                        </Label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Ao ativar, o financeiro receberá os lançamentos prontos para cobrança
                    </p>
                  </CardContent>
                </Card>

                {formData.generate_receivables && (
                  <>
                    {/* Bank Account & Category */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Conta Bancária</Label>
                        <Select
                          value={formData.bank_account_id}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, bank_account_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} ({account.bank_name})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select
                          value={formData.category_id}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories
                              .filter(c => c.type === "income")
                              .map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Cost Center & Seller */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Centro de Custo</Label>
                        <Select
                          value={formData.cost_center_id}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, cost_center_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {costCenters.map((cc) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Vendedor/Responsável</Label>
                        <Select
                          value={formData.seller_id}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, seller_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Receivable Description */}
                    <div className="space-y-2">
                      <Label htmlFor="receivable_description">Descrição dos Lançamentos</Label>
                      <Input
                        id="receivable_description"
                        placeholder={`Ex: Parcela {n}/{total} - ${selectedClient?.full_name || "Cliente"}`}
                        value={formData.receivable_description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, receivable_description: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {"{n}"} para número da parcela e {"{total}"} para total de parcelas
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <div className="text-xs text-muted-foreground">
                {formData.value && (
                  <span>
                    Total: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(formData.value) || 0)}</strong>
                    {getInstallmentsCount() > 1 && (
                      <> em <strong>{getInstallmentsCount()}x</strong></>
                    )}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveContract} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Contrato
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Contract Detail Sheet */}
      <ContractDetailSheet
        contract={selectedContract}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onUpdate={fetchContracts}
      />

      {/* Delete Contract Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir o contrato de{" "}
              <span className="font-medium text-foreground">
                {contractToDelete?.client?.full_name || "cliente"}
              </span>
              . Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContract}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <ContractImportPreview
        open={importPreviewOpen}
        onOpenChange={setImportPreviewOpen}
        rows={importPreviewRows}
        onConfirmImport={handleConfirmImport}
        importing={importing}
        products={products}
      />
    </div>
  );
}
