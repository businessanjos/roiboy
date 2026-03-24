import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";
import { CustomField, FieldOption } from "@/components/custom-fields";
import { ClientFormData, getEmptyClientFormData } from "@/components/client/ClientInfoForm";

// E.164 format: + followed by 1-15 digits
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const validateE164 = (phone: string): { valid: boolean; message?: string } => {
  if (!phone) return { valid: false, message: "Telefone é obrigatório" };
  if (!phone.startsWith("+")) return { valid: false, message: "Deve começar com +" };
  if (!E164_REGEX.test(phone)) return { valid: false, message: "Formato inválido. Ex: +5511999999999" };
  return { valid: true };
};

// Mask phone input to E.164 format
export const formatPhoneE164 = (value: string): string => {
  let digits = value.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    digits = "+" + digits.replace(/\+/g, "");
  }
  digits = "+" + digits.slice(1).replace(/\+/g, "");
  return digits.slice(0, 16);
};

export interface Product {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export interface ClientStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
}

export interface VNPSData {
  vnps_score: number;
  vnps_class: string;
  trend: string;
}

export interface ScoreData {
  escore: number;
  roizometer: number;
  quadrant: string;
  trend: string;
}

export interface ContractData {
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export interface WhatsAppData {
  hasConversation: boolean;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface PendingFormSend {
  formId: string;
  formTitle: string;
  sentAt: string;
}

export function useClientsPage() {
  const { currentUser } = useCurrentUser();
  const { canCreate, isNearLimit, data: planData } = usePlanLimits();
  const { logAudit } = useAuditLog();

  const [clients, setClients] = useState<any[]>([]);
  const [vnpsMap, setVnpsMap] = useState<Record<string, VNPSData>>({});
  const [scoreMap, setScoreMap] = useState<Record<string, ScoreData>>({});
  const [contractMap, setContractMap] = useState<Record<string, ContractData>>({});
  const [whatsappMap, setWhatsappMap] = useState<Record<string, WhatsAppData>>({});
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, any>>>({});
  const [accountId, setAccountId] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [clientStages, setClientStages] = useState<ClientStage[]>([]);
  const [pendingFormSends, setPendingFormSends] = useState<Record<string, PendingFormSend[]>>({});

  const fetchClients = useCallback(async () => {
    if (currentUser?.account_id) {
      setAccountId(currentUser.account_id);
    }

    const { data, error } = await supabase
      .from("clients")
      .select(`
        id, full_name, phone_e164, status, responsible_user_id, stage_id, 
        instagram, emails, tags, created_at, account_id, company_name,
        birth_date, cnpj, cpf, notes, additional_phones,
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
      
      if (data && data.length > 0) {
        const clientIds = data.map(c => c.id);
        
        // Fetch V-NPS and Scores using optimized RPCs (1 row per client)
        const [vnpsRes, scoresRes] = await Promise.all([
          supabase.rpc("get_latest_vnps_for_clients", { p_client_ids: clientIds }),
          supabase.rpc("get_latest_scores_for_clients", { p_client_ids: clientIds }),
        ]);
        
        const vnpsGrouped: Record<string, VNPSData> = {};
        (vnpsRes.data || []).forEach((v: any) => {
          vnpsGrouped[v.client_id] = v;
        });
        setVnpsMap(vnpsGrouped);

        const scoresGrouped: Record<string, ScoreData> = {};
        (scoresRes.data || []).forEach((s: any) => {
          scoresGrouped[s.client_id] = {
            escore: s.escore,
            roizometer: s.roizometer,
            quadrant: s.quadrant,
            trend: s.trend,
          };
        });
        setScoreMap(scoresGrouped);

        // Fetch ALL contracts (all statuses to show contracts correctly)
        const { data: contractsData } = await supabase
          .from("client_contracts")
          .select("client_id, status, start_date, end_date")
          .in("client_id", clientIds)
          .order("end_date", { ascending: false });

        // Group by client_id - prioritize by status importance
        const contractsGrouped: Record<string, ContractData> = {};
        const statusPriority: Record<string, number> = { 
          active: 6, 
          pending: 5, 
          paused: 4, 
          suspended: 3, 
          ended: 2, 
          cancelled: 1, 
          dismissed: 0, 
          dropout_7d: 0 
        };
        (contractsData || []).forEach((c: any) => {
          const existing = contractsGrouped[c.client_id];
          const newPriority = statusPriority[c.status] ?? 0;
          const existingPriority = existing ? (statusPriority[existing.status] ?? 0) : -1;
          
          if (!existing || newPriority > existingPriority) {
            contractsGrouped[c.client_id] = {
              status: c.status,
              start_date: c.start_date,
              end_date: c.end_date,
            };
          }
        });
        setContractMap(contractsGrouped);
        
        // Fetch WhatsApp data from zapp_conversations (lightweight, already has last_message_at)
        const { data: zappConvData } = await supabase
          .from("zapp_conversations")
          .select("client_id, last_message_at, unread_count")
          .in("client_id", clientIds)
          .not("client_id", "is", null);
        
        const whatsappGrouped: Record<string, WhatsAppData> = {};
        (zappConvData || []).forEach((c: any) => {
          if (!whatsappGrouped[c.client_id]) {
            whatsappGrouped[c.client_id] = { 
              hasConversation: true, 
              messageCount: c.unread_count || 0, 
              lastMessageAt: c.last_message_at 
            };
          }
        });
        setWhatsappMap(whatsappGrouped);
      }
    }
    setLoading(false);
  }, [currentUser?.account_id]);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error) setProducts(data || []);
  }, []);

  const fetchCustomFields = useCallback(async () => {
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
  }, []);

  const fetchTeamUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email")
      .order("name");
    
    if (!error && data) {
      setTeamUsers(data);
    }
  }, []);

  const fetchFieldValues = useCallback(async (clientIds: string[]) => {
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
        const value = v.value_boolean !== null ? v.value_boolean :
                     v.value_number !== null ? v.value_number :
                     v.value_date !== null ? v.value_date :
                     v.value_json !== null ? v.value_json :
                     v.value_text;
        valuesMap[v.client_id][v.field_id] = value;
      });
      setFieldValues(valuesMap);
    }
  }, []);

  const fetchPendingFormSends = useCallback(async (clientIds: string[]) => {
    if (clientIds.length === 0) return;

    const { data, error } = await supabase
      .from("client_form_sends")
      .select("client_id, form_id, sent_at, forms!inner(title)")
      .in("client_id", clientIds)
      .is("responded_at", null);

    if (!error && data) {
      const pendingMap: Record<string, PendingFormSend[]> = {};
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
  }, []);

  const fetchClientStages = useCallback(async () => {
    const accId = accountId || currentUser?.account_id;
    if (!accId) return;
    
    const { data, error } = await supabase
      .from("client_stages")
      .select("id, name, color, display_order")
      .eq("account_id", accId)
      .order("display_order");
    
    if (!error) {
      setClientStages(data || []);
    }
  }, [accountId, currentUser?.account_id]);

  const handleClientStageChange = useCallback(async (clientId: string, stageId: string | null) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({ stage_id: stageId })
        .eq("id", clientId);

      if (error) throw error;

      setClients(prev => prev.map(c => 
        c.id === clientId ? { ...c, stage_id: stageId } : c
      ));
      toast.success("Cliente movido com sucesso");
    } catch (error) {
      console.error("Error updating client stage:", error);
      toast.error("Erro ao mover cliente");
    }
  }, []);

  const handleFieldValueChange = useCallback((clientId: string, fieldId: string, newValue: any) => {
    setFieldValues(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [fieldId]: newValue
      }
    }));
  }, []);

  // Load all initial data in parallel
  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([
        fetchClients(),
        fetchProducts(),
        fetchCustomFields(),
        fetchTeamUsers(),
      ]);
    };
    loadAll();
  }, [fetchClients, fetchProducts, fetchCustomFields, fetchTeamUsers]);

  useEffect(() => {
    if (accountId || currentUser?.account_id) {
      fetchClientStages();
    }
  }, [accountId, currentUser?.account_id, fetchClientStages]);

  useEffect(() => {
    if (clients.length > 0) {
      const clientIds = clients.map(c => c.id);
      // Parallelize secondary data fetches
      Promise.all([
        fetchFieldValues(clientIds),
        fetchPendingFormSends(clientIds),
      ]);
    }
  }, [clients, fetchFieldValues, fetchPendingFormSends]);

  return {
    // Data
    clients,
    vnpsMap,
    scoreMap,
    contractMap,
    whatsappMap,
    products,
    customFields,
    fieldValues,
    accountId,
    teamUsers,
    clientStages,
    pendingFormSends,
    loading,
    
    // User & Plan
    currentUser,
    canCreate,
    isNearLimit,
    planData,
    logAudit,
    
    // Actions
    fetchClients,
    fetchProducts,
    fetchCustomFields,
    fetchClientStages,
    handleClientStageChange,
    handleFieldValueChange,
    setClients,
  };
}

// Helper functions
export const getInitials = (name: string) => {
  return name
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

export const getContractExpiryStatus = (contractEndDate?: string | null) => {
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

export const getResponsibleUser = (client: any, teamUsers: TeamUser[]) => {
  if (!client.responsible_user_id) return null;
  return teamUsers.find(u => u.id === client.responsible_user_id) || null;
};
