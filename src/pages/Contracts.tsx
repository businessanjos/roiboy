import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { useZapSign } from "@/hooks/useZapSign";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContractDetailSheet } from "@/components/contracts/ContractDetailSheet";

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
  contract_type: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  product?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  active: { label: "Ativo", icon: CheckCircle, className: "border-green-500 text-green-600 bg-green-50" },
  suspended: { label: "Suspenso", icon: Ban, className: "border-orange-500 text-orange-600 bg-orange-50" },
  paused: { label: "Pausado", icon: PauseCircle, className: "border-amber-500 text-amber-600 bg-amber-50" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "border-red-500 text-red-600 bg-red-50" },
  ended: { label: "Encerrado", icon: Ban, className: "border-slate-500 text-slate-600 bg-slate-50" },
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
];

const INSTALLMENT_OPTIONS = [
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
  { value: "4x", label: "4x" },
  { value: "6x", label: "6x" },
  { value: "10x", label: "10x" },
  { value: "12x", label: "12x" },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "cheque", label: "Cheque" },
];

interface Client {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function Contracts() {
  const navigate = useNavigate();
  const { syncDocumentStatus, getLocalDocuments, loading: zapSignLoading } = useZapSign();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  
  // New contract dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [formData, setFormData] = useState({
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    value: "",
    contract_type: "compra",
    payment_type: "",
    installments: "",
    payment_method: "",
    notes: "",
  });

  // Contract detail sheet state
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  useEffect(() => {
    fetchContracts();
    fetchClients();
    fetchProducts();
  }, []);

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from("client_contracts")
        .select(`
          *,
          client:clients(id, full_name, avatar_url),
          product:products(id, name, color)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, avatar_url, cpf, cnpj, phone_e164")
        .order("full_name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

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

  // Import contracts from CSV
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

      // Fetch team users to map responsible by name
      const { data: teamUsers } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", userProfile.account_id);

      const text = await file.text();
      // Handle multi-line fields by joining lines that are part of quoted content
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
      
      let created = 0;
      let updated = 0;
      let contractsCreated = 0;
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i], delimiter);
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || "";
          });

          // Support both formats: standard template and Eternum format
          const nome = row.nome || row.nome_completo || "";
          const telefone = row.telefone || "";
          const documento = row["cpf/cnpj"] || "";
          const cpfRaw = row.cpf || "";
          const cnpjRaw = row.cnpj || "";
          const email = row["e-mail"] || row.email || "";
          const produto = row.produto || "";
          const cidade = row.cidade || "";
          const estado = row.estado || "";
          const dataInicio = row.data_de_inicio || row.data_inicio || "";
          const dataVencimento = row.data_de_vencimento || row.data_fim || "";
          const statusContrato = row.contrato_status || row.status || "Ativo";
          const observacao = row.observacao || row.observacoes || "";
          const anja = row.anja || "";
          const engajamento = row.engajamento || "";
          const renovacao = row.renovacao || "";
          const clinicaRyka = row.clinica_ryka || "";
          const valorContrato = row.valor_contrato || "";
          const idContratoExterno = row.id_contrato || "";

          if (!nome || !telefone) {
            console.log(`Linha ${i + 1} ignorada: nome ou telefone vazio`);
            errors++;
            continue;
          }

          const phone = normalizePhone(telefone.replace(/\n/g, "").trim());
          
          // Parse document - could be CPF or CNPJ
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

          // Try to find existing client by CPF, CNPJ, or phone
          let clientId: string | null = null;
          
          if (cpf && cpf.length >= 11) {
            const { data: existingByCpf } = await supabase
              .from("clients")
              .select("id")
              .eq("account_id", userProfile.account_id)
              .eq("cpf", cpf)
              .maybeSingle();
            if (existingByCpf) clientId = existingByCpf.id;
          }

          if (!clientId && cnpj && cnpj.length >= 14) {
            const { data: existingByCnpj } = await supabase
              .from("clients")
              .select("id")
              .eq("account_id", userProfile.account_id)
              .eq("cnpj", cnpj)
              .maybeSingle();
            if (existingByCnpj) clientId = existingByCnpj.id;
          }

          if (!clientId) {
            const { data: existingByPhone } = await supabase
              .from("clients")
              .select("id")
              .eq("account_id", userProfile.account_id)
              .eq("phone_e164", phone)
              .maybeSingle();
            if (existingByPhone) clientId = existingByPhone.id;
          }

          // Find responsible user by name
          let responsibleUserId: string | null = null;
          if (anja && teamUsers) {
            const user = teamUsers.find(
              (u) => u.name?.toLowerCase().includes(anja.toLowerCase())
            );
            if (user) responsibleUserId = user.id;
          }

          // Create new client if not found
          if (!clientId) {
            const emails = email ? [{ email: email.trim(), label: "principal" }] : [];
            
            // Build notes with extra info
            const notesArr: string[] = [];
            if (engajamento) notesArr.push(`Engajamento: ${engajamento}`);
            if (renovacao) notesArr.push(`Renovação: ${renovacao}`);
            if (clinicaRyka) notesArr.push(`Clínica Ryka: ${clinicaRyka}`);
            if (idContratoExterno) notesArr.push(`ID Contrato Externo: ${idContratoExterno}`);
            
            const clientData = {
              account_id: userProfile.account_id,
              full_name: nome.replace(/\n/g, " ").trim(),
              phone_e164: phone,
              cpf: cpf && cpf.length === 11 ? cpf : null,
              cnpj: cnpj && cnpj.length >= 14 ? cnpj : null,
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
              console.error(`Erro criando cliente ${nome}:`, clientError);
              errors++;
              continue;
            }
            clientId = newClient.id;
            created++;
          } else {
            updated++;
          }

          // Find product by name
          let productId: string | null = null;
          if (produto) {
            const product = products.find(
              (p) => p.name.toLowerCase() === produto.toLowerCase().trim()
            );
            if (product) productId = product.id;
          }

          // Build contract notes
          const contractNotesArr: string[] = [];
          if (observacao) contractNotesArr.push(observacao.replace(/\n/g, " "));
          if (engajamento) contractNotesArr.push(`Engajamento: ${engajamento}`);
          if (renovacao) contractNotesArr.push(`Renovação: ${renovacao}`);
          if (clinicaRyka === "Sim") contractNotesArr.push("Clínica Ryka");
          if (idContratoExterno) contractNotesArr.push(`ID Externo: ${idContratoExterno}`);

          // Create contract
          const contractData = {
            account_id: userProfile.account_id,
            client_id: clientId,
            product_id: productId,
            value: valorContrato ? parseFloat(valorContrato) : 0,
            start_date: parseBrazilianDate(dataInicio) || format(new Date(), "yyyy-MM-dd"),
            end_date: parseBrazilianDate(dataVencimento) || null,
            payment_option: null,
            notes: contractNotesArr.join(" | ") || "Importado via CSV",
            status: mapContractStatus(statusContrato),
            status_reason: statusContrato.toLowerCase() === "suspenso" || statusContrato.toLowerCase() === "congelado" 
              ? observacao || "Importado com status pausado" 
              : null,
            contract_type: "compra",
          };

          const { error: contractError } = await supabase
            .from("client_contracts")
            .insert(contractData);

          if (contractError) {
            console.error(`Erro criando contrato para ${nome}:`, contractError);
            errors++;
          } else {
            contractsCreated++;
          }
        } catch (rowError) {
          console.error(`Erro processando linha ${i + 1}:`, rowError);
          errors++;
        }
      }

      await fetchContracts();
      await fetchClients();

      const message = [];
      if (created > 0) message.push(`${created} clientes criados`);
      if (updated > 0) message.push(`${updated} clientes já existiam`);
      if (contractsCreated > 0) message.push(`${contractsCreated} contratos criados`);
      if (errors > 0) message.push(`${errors} erros`);
      
      toast.success(`Importação concluída: ${message.join(", ")}`);
    } catch (error) {
      console.error("Error importing:", error);
      toast.error("Erro ao importar contratos");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setFormData({
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      value: "",
      contract_type: "compra",
      payment_type: "",
      installments: "",
      payment_method: "",
      notes: "",
    });
  };

  const openNewContractDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const buildPaymentOption = () => {
    if (!formData.payment_type) return null;
    if (formData.payment_type === "a_vista") {
      return formData.payment_method ? `a_vista_${formData.payment_method}` : "a_vista";
    }
    const installments = formData.installments || "1x";
    return formData.payment_method
      ? `parcelado_${installments}_${formData.payment_method}`
      : `parcelado_${installments}`;
  };

  const handleSaveContract = async () => {
    if (!selectedClient) {
      toast.error("Selecione um cliente");
      return;
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

      const contractData = {
        client_id: selectedClient.id,
        account_id: userProfile.account_id,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        value: parseFloat(formData.value) || 0,
        contract_type: formData.contract_type,
        payment_option: buildPaymentOption(),
        notes: formData.notes || null,
      };

      const { error } = await supabase
        .from("client_contracts")
        .insert(contractData);

      if (error) throw error;
      
      toast.success("Contrato criado com sucesso");
      setDialogOpen(false);
      fetchContracts();
    } catch (error) {
      console.error("Error saving contract:", error);
      toast.error("Erro ao salvar contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncZapSign = async () => {
    setSyncing(true);
    try {
      // Get all ZapSign documents from local database
      const documents = await getLocalDocuments();
      
      if (!documents || documents.length === 0) {
        toast.info("Nenhum documento ZapSign encontrado para sincronizar");
        setSyncing(false);
        return;
      }

      let syncedCount = 0;
      let errorCount = 0;

      // Sync each document status
      for (const doc of documents) {
        try {
          await syncDocumentStatus(doc.zapsign_doc_token);
          syncedCount++;
        } catch (error) {
          console.error(`Error syncing document ${doc.zapsign_doc_token}:`, error);
          errorCount++;
        }
      }

      // Refresh contracts list
      await fetchContracts();

      if (errorCount > 0) {
        toast.warning(`Sincronizados ${syncedCount} documentos. ${errorCount} erros.`);
      } else {
        toast.success(`${syncedCount} documentos sincronizados com ZapSign`);
      }
    } catch (error) {
      console.error("Error syncing ZapSign:", error);
      toast.error("Erro ao sincronizar com ZapSign");
    } finally {
      setSyncing(false);
    }
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesSearch = 
        contract.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const matchesType = typeFilter === "all" || contract.contract_type === typeFilter;
      const matchesProduct = productFilter === "all" || contract.product?.id === productFilter;
      
      return matchesSearch && matchesStatus && matchesType && matchesProduct;
    });
  }, [contracts, searchTerm, statusFilter, typeFilter, productFilter]);

  const stats = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === "active");
    const pendingContracts = contracts.filter(c => c.status === "pending");
    const suspendedContracts = contracts.filter(c => c.status === "suspended");
    const pausedContracts = contracts.filter(c => c.status === "paused");
    const cancelledContracts = contracts.filter(c => c.status === "cancelled");
    const endedContracts = contracts.filter(c => c.status === "ended");
    
    const totalValue = activeContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const expiringSoon = activeContracts.filter(c => {
      if (!c.end_date) return false;
      const daysUntilExpiry = differenceInDays(new Date(c.end_date), new Date());
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    });
    const expired = activeContracts.filter(c => {
      if (!c.end_date) return false;
      return isPast(new Date(c.end_date));
    });

    return {
      total: contracts.length,
      active: activeContracts.length,
      pending: pendingContracts.length,
      suspended: suspendedContracts.length,
      paused: pausedContracts.length,
      cancelled: cancelledContracts.length,
      ended: endedContracts.length,
      totalValue,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
    };
  }, [contracts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getExpiryBadge = (endDate: string | null) => {
    if (!endDate) return null;
    const daysUntilExpiry = differenceInDays(new Date(endDate), new Date());
    
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSyncZapSign}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            ZapSign
          </Button>
          <Button size="sm" onClick={openNewContractDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-primary/10 w-fit mx-auto mb-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-green-500/10 w-fit mx-auto mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-blue-500/10 w-fit mx-auto mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-orange-500/10 w-fit mx-auto mb-2">
              <Ban className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.suspended}</p>
            <p className="text-xs text-muted-foreground">Suspensos</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-amber-500/10 w-fit mx-auto mb-2">
              <PauseCircle className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.paused}</p>
            <p className="text-xs text-muted-foreground">Pausados</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-red-500/10 w-fit mx-auto mb-2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-slate-500/10 w-fit mx-auto mb-2">
              <Ban className="h-5 w-5 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-600">{stats.ended}</p>
            <p className="text-xs text-muted-foreground">Encerrados</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-emerald-500/10 w-fit mx-auto mb-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</p>
            <p className="text-xs text-muted-foreground">Valor Total</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-amber-500/10 w-fit mx-auto mb-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</p>
            <p className="text-xs text-muted-foreground">Vencendo</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-2 rounded-lg bg-red-500/10 w-fit mx-auto mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            <p className="text-xs text-muted-foreground">Vencidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
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
                <SelectItem value="suspended">Suspensos</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
                <SelectItem value="ended">Encerrados</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardContent className="p-0">
          {filteredContracts.length === 0 ? (
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
                {filteredContracts.map((contract) => {
                  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || CONTRACT_STATUS_CONFIG.active;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <TableRow key={contract.id} className="group">
                      <TableCell>
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => navigate(`/clients/${contract.client_id}`)}
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
                            <p className="font-medium text-sm hover:underline">{contract.client?.full_name || "Cliente"}</p>
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
                          {formatCurrency(contract.value)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">
                            {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}
                            {contract.end_date && (
                              <span className="text-muted-foreground"> →</span>
                            )}
                          </span>
                          {contract.end_date && (
                            <span className="text-sm">
                              {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                          {contract.status === "active" && getExpiryBadge(contract.end_date)}
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
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedContract(contract);
                              setDetailSheetOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Contrato
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Novo Contrato
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
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
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.full_name}
                            onSelect={() => {
                              setSelectedClient(client);
                              setClientPopoverOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                {client.avatar_url ? (
                                  <img src={client.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <span>{client.full_name}</span>
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

            {/* Contract Type */}
            <div className="space-y-2">
              <Label>Tipo de Contrato *</Label>
              <Select
                value={formData.contract_type}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, contract_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value and Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Valor (R$) *</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Pagamento</Label>
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
            </div>

            {/* Installments (if parcelado) */}
            {formData.payment_type === "parcelado" && (
              <div className="space-y-2">
                <Label>Número de Parcelas</Label>
                <Select
                  value={formData.installments}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, installments: value }))}
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
            )}

            {/* Payment Method */}
            {formData.payment_type && (
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Anotações sobre o contrato..."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
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
        </DialogContent>
      </Dialog>

      {/* Contract Detail Sheet */}
      <ContractDetailSheet
        contract={selectedContract}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onUpdate={fetchContracts}
      />
    </div>
  );
}
