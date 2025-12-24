import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, ArrowRight, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, Package, ChevronRight, RefreshCw, MessageCircle, Settings2, LayoutGrid, List, User, Camera, X, Layers, Check, Clock, AlertTriangle, CalendarIcon, Pencil, FileText, Filter, ChevronDown, XCircle, Wifi, WifiOff, Lock, Trash2, Kanban } from "lucide-react";
import { ClientKanban } from "@/components/client/ClientKanban";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { VNPSBadge } from "@/components/ui/vnps-badge";
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
  const [clients, setClients] = useState<any[]>([]);
  const [vnpsMap, setVnpsMap] = useState<Record<string, any>>({});
  const [scoreMap, setScoreMap] = useState<Record<string, { escore: number; roizometer: number; quadrant: string; trend: string }>>({});
  const [contractMap, setContractMap] = useState<Record<string, { status: string; start_date: string | null; end_date: string | null }>>({});
  const [whatsappMap, setWhatsappMap] = useState<Record<string, { hasConversation: boolean; messageCount: number; lastMessageAt: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterVNPS, setFilterVNPS] = useState<string>("all");
  const [filterContract, setFilterContract] = useState<string>("all");
  const [filterResponsible, setFilterResponsible] = useState<string>("all");
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newClientData, setNewClientData] = useState<ClientFormData>(getEmptyClientFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // CSV Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);

  // Bulk Omie Sync state
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, any>>>({});
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table" | "kanban">("table");
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

  // Get required custom fields
  const requiredFields = customFields.filter(f => f.is_required);

  const fetchClients = async () => {
    // Use accountId from currentUser hook
    if (currentUser?.account_id) {
      setAccountId(currentUser.account_id);
    }

    const { data, error } = await supabase
      .from("clients")
      .select(`
        *,
        client_products (
          product_id,
          products (
            id,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (!error) {
      setClients(data || []);
      
      // Fetch V-NPS and WhatsApp data for all clients
      if (data && data.length > 0) {
        const clientIds = data.map(c => c.id);
        
        // Fetch V-NPS
        const { data: vnpsData } = await supabase
          .from("vnps_snapshots")
          .select("*")
          .in("client_id", clientIds)
          .order("computed_at", { ascending: false });
        
        // Group by client_id and take latest
        const vnpsGrouped: Record<string, any> = {};
        (vnpsData || []).forEach((v: any) => {
          if (!vnpsGrouped[v.client_id]) {
            vnpsGrouped[v.client_id] = v;
          }
        });
        setVnpsMap(vnpsGrouped);

        // Fetch score snapshots (Roizômetro, E-Score)
        const { data: scoresData } = await supabase
          .from("score_snapshots")
          .select("*")
          .in("client_id", clientIds)
          .order("computed_at", { ascending: false });

        // Group by client_id and take latest
        const scoresGrouped: Record<string, { escore: number; roizometer: number; quadrant: string; trend: string }> = {};
        (scoresData || []).forEach((s: any) => {
          if (!scoresGrouped[s.client_id]) {
            scoresGrouped[s.client_id] = {
              escore: s.escore,
              roizometer: s.roizometer,
              quadrant: s.quadrant,
              trend: s.trend,
            };
          }
        });
        setScoreMap(scoresGrouped);

        // Fetch active contracts for each client
        const { data: contractsData } = await supabase
          .from("client_contracts")
          .select("client_id, status, start_date, end_date")
          .in("client_id", clientIds)
          .eq("status", "active")
          .order("end_date", { ascending: false });

        // Group by client_id and take the first (latest end_date)
        const contractsGrouped: Record<string, { status: string; start_date: string | null; end_date: string | null }> = {};
        (contractsData || []).forEach((c: any) => {
          if (!contractsGrouped[c.client_id]) {
            contractsGrouped[c.client_id] = {
              status: c.status,
              start_date: c.start_date,
              end_date: c.end_date,
            };
          }
        });
        setContractMap(contractsGrouped);
        
        // Fetch WhatsApp conversations and message counts
        const { data: conversationsData } = await supabase
          .from("conversations")
          .select("client_id")
          .in("client_id", clientIds);
        
        // Fetch latest message per client
        const { data: messagesData } = await supabase
          .from("message_events")
          .select("client_id, sent_at")
          .in("client_id", clientIds)
          .order("sent_at", { ascending: false });
        
        // Build WhatsApp status map
        const whatsappGrouped: Record<string, { hasConversation: boolean; messageCount: number; lastMessageAt: string | null }> = {};
        
        // Initialize with conversation data
        (conversationsData || []).forEach((c: any) => {
          if (!whatsappGrouped[c.client_id]) {
            whatsappGrouped[c.client_id] = { hasConversation: true, messageCount: 0, lastMessageAt: null };
          }
        });
        
        // Add message counts and last message date
        const messageCountMap = new Map<string, number>();
        const lastMessageMap = new Map<string, string>();
        
        (messagesData || []).forEach((m: any) => {
          messageCountMap.set(m.client_id, (messageCountMap.get(m.client_id) || 0) + 1);
          if (!lastMessageMap.has(m.client_id)) {
            lastMessageMap.set(m.client_id, m.sent_at);
          }
        });
        
        messageCountMap.forEach((count, clientId) => {
          if (!whatsappGrouped[clientId]) {
            whatsappGrouped[clientId] = { hasConversation: true, messageCount: count, lastMessageAt: lastMessageMap.get(clientId) || null };
          } else {
            whatsappGrouped[clientId].messageCount = count;
            whatsappGrouped[clientId].lastMessageAt = lastMessageMap.get(clientId) || null;
          }
        });
        
        setWhatsappMap(whatsappGrouped);
      }
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
    fetchTeamUsers();
  }, []);

  // Fetch client stages when account is available
  useEffect(() => {
    if (accountId || currentUser?.account_id) {
      fetchClientStages();
    }
  }, [accountId, currentUser?.account_id]);

  // Fetch field values and pending form sends when clients are loaded
  useEffect(() => {
    if (clients.length > 0) {
      const clientIds = clients.map(c => c.id);
      fetchFieldValues(clientIds);
      fetchPendingFormSends(clientIds);
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
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
    
    // Validate required custom fields
    requiredFields.forEach(field => {
      const value = newClientFieldValues[field.id];
      const isEmpty = value === null || value === undefined || value === "" || 
                      (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        errors[`field_${field.id}`] = `${field.name} é obrigatório`;
      }
    });
    
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
        additional_phones: newClientData.additional_phones,
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

  const validCount = csvData.filter(r => r.valid).length;
  const invalidCount = csvData.filter(r => !r.valid).length;

  // Calculate active filter count
  const activeFilterCount = [
    filterStatus !== "all",
    filterProduct !== "all",
    filterVNPS !== "all",
    filterContract !== "all",
    filterResponsible !== "all",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterStatus("all");
    setFilterProduct("all");
    setFilterVNPS("all");
    setFilterContract("all");
    setFilterResponsible("all");
  };

  const filtered = clients.filter(c => {
    // Search filter
    const matchesSearch = c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone_e164.includes(searchQuery);
    if (!matchesSearch) return false;

    // Status filter
    if (filterStatus !== "all" && c.status !== filterStatus) return false;

    // Product filter
    if (filterProduct !== "all") {
      const clientProductIds = (c.client_products || []).map((cp: any) => cp.product_id);
      if (!clientProductIds.includes(filterProduct)) return false;
    }

    // V-NPS filter
    if (filterVNPS !== "all") {
      const vnps = vnpsMap[c.id];
      if (!vnps) {
        if (filterVNPS !== "none") return false;
      } else {
        if (filterVNPS !== vnps.vnps_class) return false;
      }
    }

    // Contract filter
    if (filterContract !== "all") {
      const expiryStatus = getContractExpiryStatus(c.contract_end_date);
      if (filterContract === "expired" && expiryStatus?.type !== "expired") return false;
      if (filterContract === "urgent" && expiryStatus?.type !== "urgent") return false;
      if (filterContract === "warning" && expiryStatus?.type !== "warning") return false;
      if (filterContract === "ok" && expiryStatus !== null) return false;
      if (filterContract === "none" && c.contract_end_date !== null) return false;
    }

    // Responsible filter
    if (filterResponsible !== "all") {
      if (filterResponsible === "none" && c.responsible_user_id) return false;
      if (filterResponsible !== "none" && c.responsible_user_id !== filterResponsible) return false;
    }

    return true;
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
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("kanban")}
              title="Kanban"
            >
              <Kanban className="h-4 w-4" />
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
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {validCount} válido(s)
                      </Badge>
                      {invalidCount > 0 && (
                        <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                          <AlertCircle className="h-3 w-3" />
                          {invalidCount} inválido(s)
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

                    <ScrollArea className="h-72 border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 sticky left-0 bg-background">Status</TableHead>
                            <TableHead className="min-w-[150px]">Nome</TableHead>
                            <TableHead className="min-w-[130px]">Telefone</TableHead>
                            <TableHead className="min-w-[150px]">Email</TableHead>
                            <TableHead className="min-w-[100px]">Empresa</TableHead>
                            <TableHead className="min-w-[100px]">Cidade/UF</TableHead>
                            <TableHead className="min-w-[80px]">Tags</TableHead>
                            <TableHead className="min-w-[150px]">Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvData.map((row, index) => (
                            <TableRow key={index} className={!row.valid ? "bg-destructive/5" : ""}>
                              <TableCell className="sticky left-0 bg-background">
                                {row.valid ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{row.full_name || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{row.phone_e164 || "-"}</TableCell>
                              <TableCell className="text-sm">{row.email || "-"}</TableCell>
                              <TableCell className="text-sm">{row.company_name || "-"}</TableCell>
                              <TableCell className="text-sm">
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
                  ...requiredFields.map(field => {
                    const value = newClientFieldValues[field.id];
                    const filled = value !== null && value !== undefined && value !== "" && 
                                   !(Array.isArray(value) && value.length === 0);
                    return { label: field.name, filled };
                  })
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

                  <ClientInfoForm 
                    data={newClientData} 
                    onChange={setNewClientData}
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

                        {/* Required Custom Fields */}
                        {requiredFields.length > 0 && (
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                              <Layers className="h-3.5 w-3.5" />
                              Campos Obrigatórios
                            </Label>
                            <div className={`border rounded-lg p-3 space-y-3 transition-colors bg-muted/20 ${
                              Object.keys(formErrors).some(k => k.startsWith('field_')) 
                                ? "border-destructive/50 bg-destructive/5" 
                                : ""
                            }`}>
                              {requiredFields.map((field) => {
                                const value = newClientFieldValues[field.id];
                                const hasError = formErrors[`field_${field.id}`];
                                
                                return (
                                  <div key={field.id} data-error={!!hasError} className={`space-y-1.5 ${hasError ? "animate-shake" : ""}`}>
                                    <Label className={`text-sm font-medium flex items-center gap-1.5 ${hasError ? "text-destructive" : ""}`}>
                                      {hasError && <AlertCircle className="h-3 w-3" />}
                                      {field.name} *
                                    </Label>
                              
                              {/* Boolean */}
                              {field.field_type === "boolean" && (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={value === true}
                                    onCheckedChange={(checked) => 
                                      setNewClientFieldValues(prev => ({ ...prev, [field.id]: checked }))
                                    }
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    {value === true ? "Sim" : value === false ? "Não" : "Não definido"}
                                  </span>
                                </div>
                              )}
                              
                              {/* Select */}
                              {field.field_type === "select" && (
                                <Select
                                  value={value || ""}
                                  onValueChange={(v) => 
                                    setNewClientFieldValues(prev => ({ ...prev, [field.id]: v }))
                                  }
                                >
                                  <SelectTrigger className={hasError ? "border-destructive" : ""}>
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {field.options.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              
                              {/* Multi-select */}
                              {field.field_type === "multi_select" && (
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  {field.options.map((opt) => {
                                    const selectedValues = Array.isArray(value) ? value : [];
                                    const isSelected = selectedValues.includes(opt.value);
                                    return (
                                      <label
                                        key={opt.value}
                                        className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border cursor-pointer transition-colors ${
                                          isSelected 
                                            ? "bg-primary text-primary-foreground border-primary" 
                                            : "hover:bg-muted border-input"
                                        }`}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => {
                                            const newValues = isSelected
                                              ? selectedValues.filter(v => v !== opt.value)
                                              : [...selectedValues, opt.value];
                                            setNewClientFieldValues(prev => ({ ...prev, [field.id]: newValues }));
                                          }}
                                          className="hidden"
                                        />
                                        <span className="text-xs sm:text-sm">{opt.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* User */}
                              {field.field_type === "user" && (
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  {teamUsers.map((user) => {
                                    const selectedUsers = Array.isArray(value) ? value : [];
                                    const isSelected = selectedUsers.includes(user.id);
                                    return (
                                      <label
                                        key={user.id}
                                        className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border cursor-pointer transition-colors ${
                                          isSelected 
                                            ? "bg-primary text-primary-foreground border-primary" 
                                            : "hover:bg-muted border-input"
                                        }`}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => {
                                            const newValues = isSelected
                                              ? selectedUsers.filter(id => id !== user.id)
                                              : [...selectedUsers, user.id];
                                            setNewClientFieldValues(prev => ({ ...prev, [field.id]: newValues }));
                                          }}
                                          className="hidden"
                                        />
                                        <User className="h-3 w-3" />
                                        <span className="text-xs sm:text-sm">{user.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Number / Currency */}
                              {(field.field_type === "number" || field.field_type === "currency") && (
                                <Input
                                  type="number"
                                  value={value ?? ""}
                                  onChange={(e) => 
                                    setNewClientFieldValues(prev => ({ 
                                      ...prev, 
                                      [field.id]: e.target.value ? parseFloat(e.target.value) : null 
                                    }))
                                  }
                                  placeholder={field.field_type === "currency" ? "R$ 0,00" : "0"}
                                  className={hasError ? "border-destructive" : ""}
                                />
                              )}
                              
                              {/* Date */}
                              {field.field_type === "date" && (
                                <Input
                                  type="date"
                                  value={value || ""}
                                  onChange={(e) => 
                                    setNewClientFieldValues(prev => ({ ...prev, [field.id]: e.target.value || null }))
                                  }
                                  className={hasError ? "border-destructive" : ""}
                                />
                              )}
                              
                              {/* Text */}
                              {field.field_type === "text" && (
                                <Input
                                  value={value || ""}
                                  onChange={(e) => 
                                    setNewClientFieldValues(prev => ({ ...prev, [field.id]: e.target.value || null }))
                                  }
                                  placeholder="Digite..."
                                  className={hasError ? "border-destructive" : ""}
                                />
                              )}
                              
                              {hasError && (
                                <p className="text-xs text-destructive">{hasError}</p>
                              )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
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
              {/* Status Filter */}
              <div className="space-y-1.5 min-w-[140px]">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="no_contract">Sem contrato</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="churn_risk">Risco de Churn</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
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

              {/* V-NPS Filter */}
              <div className="space-y-1.5 min-w-[140px]">
                <Label className="text-xs text-muted-foreground">V-NPS</Label>
                <Select value={filterVNPS} onValueChange={setFilterVNPS}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="promoter">Promotor</SelectItem>
                    <SelectItem value="neutral">Neutro</SelectItem>
                    <SelectItem value="detractor">Detrator</SelectItem>
                    <SelectItem value="none">Sem V-NPS</SelectItem>
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
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="urgent">Expira em 30 dias</SelectItem>
                    <SelectItem value="warning">Expira em 60 dias</SelectItem>
                    <SelectItem value="ok">Vigente</SelectItem>
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
                {filterStatus !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    Status: {filterStatus === "active" ? "Ativo" : filterStatus === "no_contract" ? "Sem contrato" : filterStatus === "paused" ? "Pausado" : filterStatus === "churn_risk" ? "Risco" : "Churned"}
                    <button onClick={() => setFilterStatus("all")} className="hover:text-destructive">
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
                {filterVNPS !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    V-NPS: {filterVNPS === "promoter" ? "Promotor" : filterVNPS === "neutral" ? "Neutro" : filterVNPS === "detractor" ? "Detrator" : "Sem V-NPS"}
                    <button onClick={() => setFilterVNPS("all")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filterContract !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                    Contrato: {filterContract === "expired" ? "Expirado" : filterContract === "urgent" ? "30 dias" : filterContract === "warning" ? "60 dias" : filterContract === "ok" ? "Vigente" : "Sem contrato"}
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
              </div>
            )}
          </Card>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            {activeFilterCount > 0 && ` (de ${clients.length} total)`}
          </span>
        </div>
      </div>

      {viewMode === "table" ? (
        <Card className="shadow-card">
          <div className="overflow-x-auto">
            <Table className="min-w-max">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-medium sticky left-0 bg-muted z-20 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Cliente</TableHead>
                    <TableHead className="font-medium text-center min-w-[120px]">Produto</TableHead>
                    <TableHead className="font-medium text-center min-w-[140px]">Contrato</TableHead>
                    <TableHead className="font-medium text-center min-w-[80px]">Roizômetro</TableHead>
                    <TableHead className="font-medium text-center min-w-[80px]">E-Score</TableHead>
                    <TableHead className="font-medium text-center min-w-[100px]">Conexão</TableHead>
                    <TableHead className="font-medium text-center min-w-[80px]">V-NPS</TableHead>
                    <TableHead className="font-medium text-center min-w-[120px]">Responsável</TableHead>
                    {customFields.map((field) => (
                      <TableHead key={field.id} className="font-medium text-center min-w-[120px]">
                        {field.name}
                      </TableHead>
                    ))}
                    <TableHead className="font-medium text-right min-w-[80px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5 + customFields.length} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5 + customFields.length} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((client) => (
                      <TableRow key={client.id} className="hover:bg-muted/30 group">
                        <TableCell className="sticky left-0 bg-background group-hover:bg-muted/30 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="min-w-[180px] flex items-center gap-2">
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
                                className="font-medium truncate hover:text-primary hover:underline transition-colors block"
                              >
                                {client.full_name}
                              </Link>
                              <p className="text-xs text-muted-foreground">{client.phone_e164}</p>
                            </div>
                            {/* Responsible user avatar */}
                            {(() => {
                              const responsible = getResponsibleUser(client);
                              if (!responsible) return null;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Avatar className="h-6 w-6 border-2 border-background flex-shrink-0">
                                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
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
                                          <AlertTriangle className="h-4 w-4" />
                                        ) : (
                                          <Clock className="h-4 w-4" />
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
                                      <FileText className="h-4 w-4" />
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
                        </TableCell>
                        <TableCell className="text-center">
                          {client.client_products && client.client_products.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-1">
                              {client.client_products.slice(0, 2).map((cp: any) => (
                                <Badge key={cp.product_id} variant="secondary" className="text-xs">
                                  {cp.products?.name || "Produto"}
                                </Badge>
                              ))}
                              {client.client_products.length > 2 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs">
                                        +{client.client_products.length - 2}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs">
                                        {client.client_products.slice(2).map((cp: any) => (
                                          <p key={cp.product_id}>{cp.products?.name}</p>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {contractMap[client.id] ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Ativo</span>
                                    {contractMap[client.id].end_date && (
                                      <span className="text-[10px] opacity-75">
                                        até {format(new Date(contractMap[client.id].end_date!), "dd/MM/yy", { locale: ptBR })}
                                      </span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <p className="font-medium text-green-600 dark:text-green-400">Contrato Ativo</p>
                                    {contractMap[client.id].start_date && (
                                      <p>Início: {format(new Date(contractMap[client.id].start_date!), "dd/MM/yyyy", { locale: ptBR })}</p>
                                    )}
                                    {contractMap[client.id].end_date && (
                                      <p>Fim: {format(new Date(contractMap[client.id].end_date!), "dd/MM/yyyy", { locale: ptBR })}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3" />
                              <span>Sem contrato</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {scoreMap[client.id] ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-md text-xs font-bold",
                                    scoreMap[client.id].roizometer >= 70
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : scoreMap[client.id].roizometer >= 40
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : "bg-destructive/10 text-destructive"
                                  )}>
                                    {scoreMap[client.id].roizometer}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <p className="font-medium">Roizômetro: {scoreMap[client.id].roizometer}%</p>
                                    <p className="text-muted-foreground">Percepção de ROI do cliente</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {scoreMap[client.id] ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-md text-xs font-bold",
                                    scoreMap[client.id].escore >= 70
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : scoreMap[client.id].escore >= 40
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : "bg-destructive/10 text-destructive"
                                  )}>
                                    {scoreMap[client.id].escore}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <p className="font-medium">E-Score: {scoreMap[client.id].escore}</p>
                                    <p className="text-muted-foreground">Engajamento do cliente</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const whatsappData = whatsappMap[client.id];
                            const hasMessages = whatsappData && whatsappData.messageCount > 0;
                            const lastMessage = whatsappData?.lastMessageAt;
                            
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={cn(
                                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                                      hasMessages 
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-muted text-muted-foreground"
                                    )}>
                                      {hasMessages ? (
                                        <>
                                          <Wifi className="h-3 w-3" />
                                          <span>{whatsappData.messageCount}</span>
                                        </>
                                      ) : (
                                        <>
                                          <WifiOff className="h-3 w-3" />
                                          <span>—</span>
                                        </>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {hasMessages ? (
                                      <div className="text-xs">
                                        <p className="font-medium text-green-600 dark:text-green-400">Conectado</p>
                                        <p>{whatsappData.messageCount} mensagem{whatsappData.messageCount !== 1 ? 's' : ''} capturada{whatsappData.messageCount !== 1 ? 's' : ''}</p>
                                        {lastMessage && (
                                          <p className="text-muted-foreground mt-1">
                                            Última: {format(new Date(lastMessage), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-xs">
                                        <p className="font-medium">Não conectado</p>
                                        <p className="text-muted-foreground">Nenhuma mensagem capturada ainda</p>
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          {vnpsMap[client.id] ? (
                            <VNPSBadge
                              score={vnpsMap[client.id].vnps_score}
                              vnpsClass={vnpsMap[client.id].vnps_class}
                              trend={vnpsMap[client.id].trend}
                              size="sm"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                        {customFields.map((field) => (
                          <TableCell key={field.id} className="text-center">
                            {accountId && (
                              <FieldValueEditor
                                field={field}
                                clientId={client.id}
                                accountId={accountId}
                                currentValue={fieldValues[client.id]?.[field.id]}
                                onValueChange={(fieldId, newValue) => handleFieldValueChange(client.id, fieldId, newValue)}
                              />
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
                            <Button variant="ghost" size="sm" asChild>
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
              </Table>
            </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((client) => {
            const clientProducts = client.client_products?.map((cp: any) => cp.products?.name).filter(Boolean) || [];
            
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
                        {clientProducts.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {clientProducts.map((productName: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                {productName}
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
                      
                      {vnpsMap[client.id] && (
                        <VNPSBadge
                          score={vnpsMap[client.id].vnps_score}
                          vnpsClass={vnpsMap[client.id].vnps_class}
                          trend={vnpsMap[client.id].trend}
                          size="sm"
                        />
                      )}
                      <StatusIndicator status={client.status} size="sm" />
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
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (accountId || currentUser?.account_id) && (
        <ClientKanban
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
    </div>
  );
}