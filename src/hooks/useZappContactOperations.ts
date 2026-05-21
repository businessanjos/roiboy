import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConversationAssignment, Agent } from "@/components/royzapp/types";
import { SectorId } from "@/config/sectors";
import { isManagementUser } from "@/lib/access/managementRoles";

interface UseZappContactOperationsParams {
  currentUser: any;
  isAdmin: boolean;
  currentAgent: Agent | null;
  agents: Agent[];
  selectedConversation: ConversationAssignment | null;
  selectedSectorId: SectorId | null;
  selectedIntegrationId: string | undefined;
  currentSectorDepartmentId: string | null;
  hasVendasAccess: boolean;
  setAssignments: React.Dispatch<React.SetStateAction<ConversationAssignment[]>>;
  setSelectedConversation: React.Dispatch<React.SetStateAction<ConversationAssignment | null>>;
  setInboxTab: React.Dispatch<React.SetStateAction<"mine" | "queue">>;
  setFilterConversationType?: React.Dispatch<React.SetStateAction<"all" | "individual" | "group">>;
  fetchData: () => void;
  fetchMessages: (conversationId: string) => void;
  getContactInfo: (assignment: ConversationAssignment) => any;
}

export function useZappContactOperations({
  currentUser,
  isAdmin,
  currentAgent,
  agents,
  selectedConversation,
  selectedSectorId,
  selectedIntegrationId,
  currentSectorDepartmentId,
  hasVendasAccess,
  setAssignments,
  setSelectedConversation,
  setInboxTab,
  setFilterConversationType,
  fetchData,
  fetchMessages,
  getContactInfo,
}: UseZappContactOperationsParams) {
  // Add client/lead from contact state
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [addContactPhone, setAddContactPhone] = useState("");
  const [addContactName, setAddContactName] = useState("");
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [savingNewLead, setSavingNewLead] = useState(false);

  // New conversation with client state
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [newConversationSearch, setNewConversationSearch] = useState("");
  const [newConversationClients, setNewConversationClients] = useState<any[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Helper: find or create assignment, select it, add to local list
  const selectAndAddAssignment = useCallback(async (assignmentId: string) => {
    const { data: assignmentData } = await supabase
      .from("zapp_conversation_assignments")
      .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
      .eq("id", assignmentId)
      .single();

    if (assignmentData) {
      setSelectedConversation(assignmentData);
      setAssignments(prev => {
        const exists = prev.some(a => a.id === assignmentData.id);
        if (exists) return prev.map(a => a.id === assignmentData.id ? assignmentData : a);
        return [assignmentData, ...prev];
      });
    }
    setTimeout(() => fetchData(), 2000);
    return assignmentData;
  }, [setSelectedConversation, setAssignments, fetchData]);

  // Find existing conversation by phone + integration (with legacy fallback)
  const findConversationByPhone = useCallback(async (normalizedPhone: string) => {
    let convByPhone = await supabase
      .from("zapp_conversations")
      .select("id, lead_id, client_id, integration_id")
      .eq("account_id", currentUser.account_id)
      .eq("phone_e164", normalizedPhone)
      .eq("integration_id", selectedIntegrationId)
      .eq("is_group", false)
      .maybeSingle();

    // Legacy fallback
    if (!convByPhone?.data && selectedSectorId) {
      const { data: legacyConv } = await supabase
        .from("zapp_conversations")
        .select("id, lead_id, client_id, integration_id")
        .eq("account_id", currentUser.account_id)
        .eq("phone_e164", normalizedPhone)
        .eq("sector_id", selectedSectorId)
        .is("integration_id", null)
        .eq("is_group", false)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (legacyConv) {
        console.log("[ContactOps] Conversa legada encontrada e migrada:", legacyConv.id);
        await supabase
          .from("zapp_conversations")
          .update({ integration_id: selectedIntegrationId })
          .eq("id", legacyConv.id);
        convByPhone = { data: legacyConv, error: null, count: null, status: 200, statusText: "OK" };
      }
    }

    return convByPhone;
  }, [currentUser?.account_id, selectedIntegrationId, selectedSectorId]);

  // Handle existing assignment (active or closed) - returns true if handled
  const handleExistingAssignment = useCallback(async (
    zappConvId: string,
    options?: { closeDialog?: () => void }
  ): Promise<boolean> => {
    const { data: existingAssignments } = await supabase
      .from("zapp_conversation_assignments")
      .select("id, agent_id, status, department_id")
      .eq("zapp_conversation_id", zappConvId)
      .order("created_at", { ascending: false });

    const activeAssignment = existingAssignments?.find(a => a.status !== 'closed');
    const closedAssignment = existingAssignments?.find(a => a.status === 'closed');

    if (activeAssignment) {
      // Isolation check
      const isManager = isManagementUser(currentUser);
      const hasFullVisibility = isAdmin || isManager;

      if (activeAssignment.agent_id && activeAssignment.agent_id !== currentAgent?.id && !hasFullVisibility) {
        const responsibleAgent = agents.find(ag => ag.id === activeAssignment.agent_id);
        const agentName = responsibleAgent?.user?.name || "outro atendente";
        toast.warning(`Este contato já está em atendimento por ${agentName}`);
        options?.closeDialog?.();
        return true;
      }

      // If assignment is in a different department, migrate it to current sector
      if (currentSectorDepartmentId && activeAssignment.department_id !== currentSectorDepartmentId) {
        await supabase
          .from("zapp_conversation_assignments")
          .update({ department_id: currentSectorDepartmentId, updated_at: new Date().toISOString() })
          .eq("id", activeAssignment.id);
        if (selectedSectorId) {
          await supabase
            .from("zapp_conversations")
            .update({ sector_id: selectedSectorId, integration_id: selectedIntegrationId })
            .eq("id", zappConvId);
        }
      }

      await selectAndAddAssignment(activeAssignment.id);
      toast.info("Abrindo conversa existente");
      options?.closeDialog?.();
      return true;
    } else if (closedAssignment) {
      await supabase
        .from("zapp_conversation_assignments")
        .update({
          status: "triage",
          agent_id: null,
          assigned_at: null,
          closed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", closedAssignment.id);

      toast.success("Conversa reaberta na Fila!");
      setInboxTab("queue");
      await selectAndAddAssignment(closedAssignment.id);
      options?.closeDialog?.();
      return true;
    }

    return false;
  }, [currentUser, isAdmin, currentAgent, agents, currentSectorDepartmentId, selectedSectorId, selectedIntegrationId, selectAndAddAssignment, setInboxTab]);

  // Create assignment in queue for a conversation
  const createQueueAssignment = useCallback(async (zappConvId: string) => {
    const { error: assignError } = await supabase
      .from("zapp_conversation_assignments")
      .insert({
        account_id: currentUser.account_id,
        zapp_conversation_id: zappConvId,
        agent_id: null,
        status: "triage",
        department_id: currentSectorDepartmentId,
      });

    if (assignError) throw assignError;

    toast.success("Conversa criada na Fila! Puxe-a para iniciar o atendimento.");
    setInboxTab("queue");

    const { data: newAssignmentData } = await supabase
      .from("zapp_conversation_assignments")
      .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
      .eq("zapp_conversation_id", zappConvId)
      .is("agent_id", null)
      .neq("status", "closed")
      .single();

    if (newAssignmentData) {
      setSelectedConversation(newAssignmentData);
      setAssignments(prev => {
        const exists = prev.some(a => a.id === newAssignmentData.id);
        if (exists) return prev;
        return [newAssignmentData, ...prev];
      });
    }
    setTimeout(() => fetchData(), 2000);
  }, [currentUser?.account_id, currentSectorDepartmentId, setSelectedConversation, setAssignments, setInboxTab, fetchData]);

  // Create conversation from URL params
  const createConversationFromUrl = useCallback(async (
    contact: { id: string; full_name: string; phone_e164: string; avatar_url: null },
    isLead: boolean
  ) => {
    if (!currentUser?.account_id || !currentAgent) return;

    setCreatingConversation(true);
    try {
      const normalizedPhone = contact.phone_e164.startsWith('+')
        ? contact.phone_e164
        : `+${contact.phone_e164}`;

      const convByPhone = await findConversationByPhone(normalizedPhone);
      let zappConvId: string | null = null;

      if (convByPhone?.data) {
        zappConvId = convByPhone.data.id;

        // Update lead_id/client_id if not linked
        if (isLead && !convByPhone.data.lead_id && contact.id) {
          await supabase.from("zapp_conversations")
            .update({ lead_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        } else if (!isLead && !convByPhone.data.client_id && contact.id) {
          await supabase.from("zapp_conversations")
            .update({ client_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        }
      }

      if (zappConvId) {
        const handled = await handleExistingAssignment(zappConvId);
        if (handled) {
          setCreatingConversation(false);
          return;
        }
      } else {
        // Create new conversation
        const baseData = {
          account_id: currentUser.account_id,
          phone_e164: normalizedPhone,
          contact_name: contact.full_name,
          avatar_url: contact.avatar_url,
          sector_id: selectedSectorId,
          integration_id: selectedIntegrationId,
        };
        const insertData = isLead
          ? { ...baseData, lead_id: contact.id }
          : { ...baseData, client_id: contact.id };

        const { data: newConv, error: convError } = await supabase
          .from("zapp_conversations")
          .insert(insertData)
          .select("id")
          .single();

        if (convError) throw convError;
        zappConvId = newConv.id;
      }

      await createQueueAssignment(zappConvId!);
    } catch (error) {
      console.error("Error creating conversation from URL:", error);
      toast.error("Erro ao criar conversa");
    } finally {
      setCreatingConversation(false);
    }
  }, [currentUser?.account_id, currentAgent, selectedSectorId, selectedIntegrationId, findConversationByPhone, handleExistingAssignment, createQueueAssignment]);

  // Save new client from contact
  const saveNewClient = useCallback(async (data: { full_name: string; phone_e164: string }) => {
    if (!currentUser?.account_id || !selectedConversation?.zapp_conversation) return;
    if (!data.full_name.trim() || !data.phone_e164.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    setSavingNewClient(true);
    try {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          account_id: currentUser.account_id,
          full_name: data.full_name.trim(),
          phone_e164: data.phone_e164.trim(),
          status: "active",
        })
        .select("id")
        .single();

      if (clientError) throw clientError;

      const { error: linkError } = await supabase
        .from("zapp_conversations")
        .update({ client_id: newClient.id })
        .eq("id", selectedConversation.zapp_conversation.id);

      if (linkError) throw linkError;

      toast.success("Cliente cadastrado com sucesso!");
      setAddContactDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error creating client:", error);
      if (error.code === "23505") {
        toast.error("Já existe um cliente com este telefone");
      } else {
        toast.error(error.message || "Erro ao cadastrar cliente");
      }
    } finally {
      setSavingNewClient(false);
    }
  }, [currentUser?.account_id, selectedConversation, fetchData]);

  // Save new lead from contact
  const saveNewLead = useCallback(async (data: {
    full_name: string;
    phone: string;
    email?: string;
    source?: string;
    notes?: string;
    cpf?: string;
    rg?: string;
    birth_date?: string;
    cnpj?: string;
    company_name?: string;
    business_segment?: string;
    business_niche?: string;
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
    bank_code?: string;
    bank_name?: string;
    bank_agency?: string;
    bank_account?: string;
    bank_account_type?: string;
    pix_key?: string;
    pix_key_type?: string;
    instagram?: string;
  }) => {
    if (!currentUser?.account_id || !selectedConversation?.zapp_conversation) return;
    if (!data.full_name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSavingNewLead(true);
    try {
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          account_id: currentUser.account_id,
          full_name: data.full_name.trim(),
          phone: data.phone.trim() || null,
          email: data.email?.trim() || null,
          source: data.source || "whatsapp",
          notes: data.notes?.trim() || null,
          status: "new",
          responsible_user_id: currentUser.id,
          cpf: data.cpf?.trim() || null,
          rg: data.rg?.trim() || null,
          birth_date: data.birth_date || null,
          cnpj: data.cnpj?.trim() || null,
          company_name: data.company_name?.trim() || null,
          business_segment: data.business_segment?.trim() || null,
          business_niche: data.business_niche?.trim() || null,
          street: data.street?.trim() || null,
          street_number: data.street_number?.trim() || null,
          complement: data.complement?.trim() || null,
          neighborhood: data.neighborhood?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state || null,
          zip_code: data.zip_code?.trim() || null,
          business_street: data.business_street?.trim() || null,
          business_street_number: data.business_street_number?.trim() || null,
          business_complement: data.business_complement?.trim() || null,
          business_neighborhood: data.business_neighborhood?.trim() || null,
          business_city: data.business_city?.trim() || null,
          business_state: data.business_state || null,
          business_zip_code: data.business_zip_code?.trim() || null,
          bank_code: data.bank_code?.trim() || null,
          bank_name: data.bank_name?.trim() || null,
          bank_agency: data.bank_agency?.trim() || null,
          bank_account: data.bank_account?.trim() || null,
          bank_account_type: data.bank_account_type || "checking",
          pix_key: data.pix_key?.trim() || null,
          pix_key_type: data.pix_key_type || null,
          instagram: data.instagram?.trim() || null,
          emails: data.email ? [data.email.trim()] : [],
        })
        .select("id")
        .single();

      if (leadError) throw leadError;

      const { error: linkError } = await supabase
        .from("zapp_conversations")
        .update({
          lead_id: newLead.id,
          contact_name: data.full_name.trim()
        })
        .eq("id", selectedConversation.zapp_conversation.id);

      if (linkError) throw linkError;

      toast.success("Lead cadastrado com sucesso!");
      setAddContactDialogOpen(false);

      // Update local state
      setSelectedConversation(prev => {
        if (!prev || !prev.zapp_conversation) return prev;
        return {
          ...prev,
          zapp_conversation: {
            ...prev.zapp_conversation,
            lead_id: newLead.id,
            lead: {
              id: newLead.id,
              full_name: data.full_name.trim(),
              phone: data.phone.trim() || null,
              email: data.email?.trim() || null,
              status: "new",
            } as any,
          },
        };
      });

      setAssignments(prev => prev.map(a => {
        if (a.id !== selectedConversation.id) return a;
        return {
          ...a,
          zapp_conversation: a.zapp_conversation ? {
            ...a.zapp_conversation,
            lead_id: newLead.id,
            lead: {
              id: newLead.id,
              full_name: data.full_name.trim(),
              phone: data.phone.trim() || null,
              email: data.email?.trim() || null,
              status: "new",
            } as any,
          } : a.zapp_conversation,
        };
      }));

      fetchData();
    } catch (error: any) {
      console.error("Error creating lead:", error);
      toast.error(error.message || "Erro ao cadastrar lead");
    } finally {
      setSavingNewLead(false);
    }
  }, [currentUser, selectedConversation, setSelectedConversation, setAssignments, fetchData]);

  // Open add contact dialog
  const openAddContactDialog = useCallback(() => {
    if (!selectedConversation?.zapp_conversation) return;
    const contactInfo = getContactInfo(selectedConversation);
    setAddContactName(contactInfo.name || "");
    setAddContactPhone(contactInfo.phone || "");
    setAddContactDialogOpen(true);
  }, [selectedConversation, getContactInfo]);

  // Open new conversation dialog
  const openNewConversationDialog = useCallback(() => {
    if (!currentUser?.account_id) return;
    setNewConversationSearch("");
    setNewConversationClients([]);
    setNewConversationDialogOpen(true);
  }, [currentUser?.account_id]);

  // Dynamic search for all contacts
  const searchContacts = useCallback(async (searchTerm: string) => {
    if (!currentUser?.account_id || !searchTerm.trim()) {
      setNewConversationClients([]);
      return;
    }

    const trimmedSearch = searchTerm.trim();
    const normalizedPhone = trimmedSearch.replace(/\D/g, '');
    const textSearch = trimmedSearch
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const isPhoneSearch = trimmedSearch.startsWith('+') ||
      (normalizedPhone.length >= 4 && normalizedPhone.length >= trimmedSearch.replace(/[\s\-\(\)]/g, '').length * 0.7);

    const [clientsResult, leadsResult, conversationsResult, groupsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, phone_e164, avatar_url, status, additional_phones")
        .eq("account_id", currentUser.account_id)
        .in("status", ["active", "churn_risk", "churned", "no_contract", "paused"])
        .or(isPhoneSearch && normalizedPhone.length >= 4
          ? `phone_e164.ilike.%${normalizedPhone}%`
          : `full_name.ilike.%${textSearch}%,phone_e164.ilike.%${textSearch}%`)
        .order("full_name")
        .limit(15),
      supabase
        .from("leads")
        .select("id, full_name, phone, avatar_url, additional_phones")
        .eq("account_id", currentUser.account_id)
        .is("converted_to_client_id", null)
        .or(isPhoneSearch && normalizedPhone.length >= 4
          ? `phone.ilike.%${normalizedPhone}%`
          : `full_name.ilike.%${textSearch}%,phone.ilike.%${textSearch}%`)
        .order("full_name")
        .limit(20),
      supabase
        .from("zapp_conversations")
        .select("id, contact_name, phone_e164, avatar_url, client_id, lead_id")
        .eq("account_id", currentUser.account_id)
        .is("is_group", false)
        .neq("phone_e164", "")
        .or(isPhoneSearch && normalizedPhone.length >= 4
          ? `phone_e164.ilike.%${normalizedPhone}%`
          : `contact_name.ilike.%${textSearch}%,phone_e164.ilike.%${textSearch}%`)
        .order("last_message_at", { ascending: false })
        .limit(10),
      supabase
        .from("zapp_conversations")
        .select("id, contact_name, avatar_url, group_jid, sector_id, integration_id")
        .eq("account_id", currentUser.account_id)
        .eq("is_group", true)
        .ilike("contact_name", `%${textSearch}%`)
        .order("last_message_at", { ascending: false })
        .limit(25),
    ]);

    if (groupsResult.error) {
      console.error("[SearchContacts] Groups query error:", groupsResult.error);
      toast.error("Erro ao buscar grupos");
    }

    // Map clients with additional phones
    const clients: Array<{ id: string; full_name: string; phone_e164: string; avatar_url: string | null; type: 'client' }> = [];
    for (const c of (clientsResult.data || [])) {
      const getClientAdditionalPhones = (): Array<{ phone: string; label?: string }> => {
        if (!Array.isArray(c.additional_phones)) return [];
        return (c.additional_phones as any[]).map((ap: any) => {
          if (typeof ap === 'string') return { phone: ap };
          if (typeof ap === 'object' && ap !== null && ap.number) return { phone: ap.number, label: ap.label };
          return null;
        }).filter(Boolean) as Array<{ phone: string; label?: string }>;
      };
      const clientAdditionalPhones = getClientAdditionalPhones();

      if (isPhoneSearch && normalizedPhone.length >= 4) {
        if ((c.phone_e164 || '').replace(/\D/g, '').includes(normalizedPhone)) {
          clients.push({ id: c.id, full_name: c.full_name, phone_e164: c.phone_e164, avatar_url: c.avatar_url, type: 'client' });
        }
        clientAdditionalPhones.forEach((ap, idx) => {
          if (ap.phone.replace(/\D/g, '').includes(normalizedPhone)) {
            clients.push({ id: `${c.id}-alt-${idx}`, full_name: c.full_name, phone_e164: ap.phone, avatar_url: c.avatar_url, type: 'client' });
          }
        });
      } else {
        clients.push({ id: c.id, full_name: c.full_name, phone_e164: c.phone_e164, avatar_url: c.avatar_url, type: 'client' });
        clientAdditionalPhones.forEach((ap, idx) => {
          clients.push({ id: `${c.id}-alt-${idx}`, full_name: c.full_name, phone_e164: ap.phone, avatar_url: c.avatar_url, type: 'client' });
        });
      }
    }

    // Map leads with additional phones
    const leads: Array<{ id: string; full_name: string; phone_e164: string; avatar_url: string | null; type: 'lead' }> = [];
    for (const l of (leadsResult.data || [])) {
      const getAdditionalPhones = (): Array<{ phone: string; label?: string }> => {
        if (!Array.isArray(l.additional_phones)) return [];
        return (l.additional_phones as any[]).map((ap: any) => {
          if (typeof ap === 'string') return { phone: ap };
          if (typeof ap === 'object' && ap !== null && ap.number) return { phone: ap.number, label: ap.label };
          return null;
        }).filter(Boolean) as Array<{ phone: string; label?: string }>;
      };
      const additionalPhones = getAdditionalPhones();

      if (isPhoneSearch && normalizedPhone.length >= 4) {
        if ((l.phone || '').replace(/\D/g, '').includes(normalizedPhone)) {
          leads.push({ id: l.id, full_name: l.full_name, phone_e164: l.phone || "", avatar_url: l.avatar_url, type: 'lead' });
        }
        additionalPhones.forEach((ap, idx) => {
          if (ap.phone.replace(/\D/g, '').includes(normalizedPhone)) {
            leads.push({ id: `${l.id}-alt-${idx}`, full_name: l.full_name, phone_e164: ap.phone, avatar_url: l.avatar_url, type: 'lead' });
          }
        });
      } else {
        leads.push({ id: l.id, full_name: l.full_name, phone_e164: l.phone || "", avatar_url: l.avatar_url, type: 'lead' });
        additionalPhones.forEach((ap, idx) => {
          leads.push({ id: `${l.id}-alt-${idx}`, full_name: l.full_name, phone_e164: ap.phone, avatar_url: l.avatar_url, type: 'lead' });
        });
      }
    }

    const conversations = (conversationsResult.data || [])
      .filter(conv => !conv.client_id && !conv.lead_id)
      .map(conv => ({
        id: conv.id,
        full_name: conv.contact_name || "Desconhecido",
        phone_e164: conv.phone_e164,
        avatar_url: conv.avatar_url,
        type: 'conversation' as const,
      }));

    const groups = (groupsResult.data || []).map(g => ({
      id: g.id,
      full_name: g.contact_name || "Grupo",
      phone_e164: "",
      avatar_url: g.avatar_url,
      type: 'group' as const,
      group_jid: g.group_jid,
    }));

    // Deduplicate by phone, prioritizing clients
    const phonesSeen = new Set<string>();
    const combined = [...clients, ...leads, ...conversations].filter(contact => {
      const phone = contact.phone_e164?.replace(/\D/g, '');
      if (!phone || phonesSeen.has(phone)) return false;
      phonesSeen.add(phone);
      return true;
    });

    const finalCombined = [...combined, ...groups];

    // Offer to start conversation with raw phone number
    if (combined.length === 0 && groups.length === 0) {
      const phoneDigits = trimmedSearch.replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        const formattedPhone = trimmedSearch.startsWith('+')
          ? trimmedSearch
          : `+${phoneDigits}`;
        finalCombined.push({
          id: `new-phone-${phoneDigits}`,
          full_name: formattedPhone,
          phone_e164: formattedPhone,
          avatar_url: null,
          type: 'conversation' as const,
        });
      }
    }

    // Fetch common groups
    const phonesForGroupSearch = combined.map(c => c.phone_e164?.replace(/\D/g, '')).filter(Boolean) as string[];

    if (phonesForGroupSearch.length > 0) {
      const { data: groupParticipants } = await supabase
        .from("whatsapp_group_participants")
        .select("phone, group_jid")
        .eq("account_id", currentUser.account_id)
        .in("phone", phonesForGroupSearch);

      const groupJids = [...new Set((groupParticipants || []).map(p => p.group_jid))];

      let groupsMapForCommon = new Map<string, { name: string; avatar_url: string | null }>();
      if (groupJids.length > 0) {
        const { data: groupDetails } = await supabase
          .from("whatsapp_groups")
          .select("group_jid, name")
          .eq("account_id", currentUser.account_id)
          .in("group_jid", groupJids);

        (groupDetails || []).forEach((g: { group_jid: string; name: string }) => {
          groupsMapForCommon.set(g.group_jid, { name: g.name, avatar_url: null });
        });
      }

      const phoneToGroups = new Map<string, Array<{ name: string; avatar_url: string | null }>>();
      (groupParticipants || []).forEach((p) => {
        const phone = p.phone;
        const groupInfo = groupsMapForCommon.get(p.group_jid);
        if (!phoneToGroups.has(phone)) phoneToGroups.set(phone, []);
        if (groupInfo) phoneToGroups.get(phone)!.push({ name: groupInfo.name, avatar_url: groupInfo.avatar_url });
      });

      const combinedWithGroups = combined.map(c => ({
        ...c,
        common_groups: phoneToGroups.get(c.phone_e164?.replace(/\D/g, '') || '') || [],
      }));

      setNewConversationClients([...combinedWithGroups, ...groups]);
    } else {
      setNewConversationClients(finalCombined);
    }
  }, [currentUser?.account_id]);

  // Debounced search effect
  useEffect(() => {
    if (!newConversationDialogOpen) return;
    const timeoutId = setTimeout(() => {
      searchContacts(newConversationSearch);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [newConversationSearch, newConversationDialogOpen, searchContacts]);

  // Create new conversation with contact (lead, client, or group)
  const createConversationWithContact = useCallback(async (contact: any) => {
    if (!currentUser?.account_id) return;

    const isGroupContact = contact.type === 'group';
    if (!isGroupContact && !currentAgent) {
      toast.error("Você precisa estar cadastrado como atendente para iniciar conversas individuais");
      return;
    }

    setCreatingConversation(true);
    try {
      // Handle groups specially
      if (contact.type === 'group') {
        const zappConvId = contact.id;

        const { data: existingAssignments } = await supabase
          .from("zapp_conversation_assignments")
          .select("id, agent_id, status, department_id")
          .eq("zapp_conversation_id", zappConvId)
          .eq("department_id", currentSectorDepartmentId)
          .order("created_at", { ascending: false });

        const activeAssignment = existingAssignments?.find(a => a.status !== 'closed');
        const closedAssignment = existingAssignments?.find(a => a.status === 'closed');

        if (activeAssignment) {
          const assignmentData = await selectAndAddAssignment(activeAssignment.id);
          toast.info("Abrindo grupo existente");
          setNewConversationDialogOpen(false);
          setCreatingConversation(false);
          return;
        } else if (closedAssignment) {
          await supabase
            .from("zapp_conversation_assignments")
            .update({
              status: currentAgent ? "active" : "triage",
              agent_id: currentAgent?.id || null,
              assigned_at: currentAgent ? new Date().toISOString() : null,
              closed_at: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", closedAssignment.id);

          const { data: reopenedData } = await supabase
            .from("zapp_conversation_assignments")
            .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
            .eq("id", closedAssignment.id)
            .maybeSingle();

          if (reopenedData) {
            const enrichedReopened = {
              ...reopenedData,
              agent: currentAgent ? { ...currentAgent } : null
            };
            setSelectedConversation(enrichedReopened);
            setAssignments(prev => {
              const exists = prev.some(a => a.id === enrichedReopened.id);
              if (exists) return prev.map(a => a.id === enrichedReopened.id ? enrichedReopened : a);
              return [enrichedReopened, ...prev];
            });
          }

          toast.success("Grupo reaberto!");
          setNewConversationDialogOpen(false);
          setInboxTab(currentAgent ? "mine" : "queue");
          setFilterConversationType?.("group");
          setTimeout(() => fetchData(), 2000);
          setCreatingConversation(false);
          return;
        } else {
          const { data: newAssignment } = await supabase
            .from("zapp_conversation_assignments")
            .insert({
              account_id: currentUser.account_id,
              zapp_conversation_id: zappConvId,
              agent_id: currentAgent?.id || null,
              status: currentAgent ? "active" : "triage",
              department_id: currentSectorDepartmentId,
              assigned_at: currentAgent ? new Date().toISOString() : null,
            })
            .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
            .single();

          if (newAssignment) {
            const enrichedAssignment = {
              ...newAssignment,
              agent: currentAgent ? { ...currentAgent } : null
            };
            setSelectedConversation(enrichedAssignment);
            setAssignments(prev => [enrichedAssignment, ...prev]);
          }

          toast.success("Grupo adicionado!");
          setNewConversationDialogOpen(false);
          setInboxTab(currentAgent ? "mine" : "queue");
          setFilterConversationType?.("group");
          setTimeout(() => fetchData(), 2000);
          setCreatingConversation(false);
          return;
        }
      }

      // Individual contacts
      const isLeadContact = contact.type === 'lead';
      const isClientContact = contact.type === 'client';
      const normalizedPhone = contact.phone_e164?.startsWith('+')
        ? contact.phone_e164
        : `+${contact.phone_e164}`;

      const convByPhone = await findConversationByPhone(normalizedPhone);
      let zappConvId: string | null = null;

      if (convByPhone?.data) {
        zappConvId = convByPhone.data.id;

        // Auto-unify legacy duplicates
        if (selectedSectorId && selectedIntegrationId) {
          const { data: legacyDuplicate } = await supabase
            .from("zapp_conversations")
            .select("id")
            .eq("account_id", currentUser.account_id)
            .eq("phone_e164", normalizedPhone)
            .eq("sector_id", selectedSectorId)
            .is("integration_id", null)
            .eq("is_group", false)
            .neq("id", convByPhone.data.id)
            .maybeSingle();

          if (legacyDuplicate) {
            console.log(`[AUTO-UNIFY] Merging legacy ${legacyDuplicate.id} into ${convByPhone.data.id}`);
            await supabase.from("zapp_messages").update({ zapp_conversation_id: convByPhone.data.id }).eq("zapp_conversation_id", legacyDuplicate.id);
            await supabase.from("zapp_conversation_assignments").delete().eq("zapp_conversation_id", legacyDuplicate.id);
            await supabase.from("zapp_conversations").delete().eq("id", legacyDuplicate.id);
          }
        }

        // Update lead_id/client_id
        const realContactId = contact.id.includes('-alt-') ? contact.id.split('-alt-')[0] : contact.id;
        if (isLeadContact && !convByPhone.data.lead_id && realContactId) {
          await supabase.from("zapp_conversations")
            .update({ lead_id: realContactId, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        } else if (isClientContact && !convByPhone.data.client_id && realContactId) {
          await supabase.from("zapp_conversations")
            .update({ client_id: realContactId, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        }
      }

      if (zappConvId) {
        const handled = await handleExistingAssignment(zappConvId, {
          closeDialog: () => setNewConversationDialogOpen(false),
        });
        if (handled) {
          setCreatingConversation(false);
          return;
        }
      } else {
        // Create new conversation
        const baseData = {
          account_id: currentUser.account_id,
          phone_e164: normalizedPhone,
          contact_name: contact.full_name,
          avatar_url: contact.avatar_url,
          sector_id: selectedSectorId,
          integration_id: selectedIntegrationId,
        };

        let insertData: typeof baseData & { lead_id?: string; client_id?: string } = { ...baseData };

        if (isLeadContact) {
          const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", currentUser.account_id)
            .eq("phone_e164", normalizedPhone)
            .maybeSingle();

          if (existingClient) {
            insertData = { ...baseData, client_id: existingClient.id };
          } else {
            insertData = { ...baseData, lead_id: contact.id };
          }
        } else if (isClientContact) {
          insertData = { ...baseData, client_id: contact.id };
        }

        const { data: newConv, error: convError } = await supabase
          .from("zapp_conversations")
          .insert(insertData)
          .select("id")
          .single();

        if (convError) throw convError;
        zappConvId = newConv.id;
      }

      setNewConversationDialogOpen(false);
      await createQueueAssignment(zappConvId!);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      toast.error(error.message || "Erro ao criar conversa");
    } finally {
      setCreatingConversation(false);
    }
  }, [currentUser?.account_id, currentAgent, selectedSectorId, selectedIntegrationId, currentSectorDepartmentId, agents, isAdmin, findConversationByPhone, handleExistingAssignment, selectAndAddAssignment, createQueueAssignment, setSelectedConversation, setAssignments, setInboxTab, setFilterConversationType, fetchData]);

  return {
    // State
    addContactDialogOpen,
    setAddContactDialogOpen,
    addContactPhone,
    addContactName,
    savingNewClient,
    savingNewLead,
    newConversationDialogOpen,
    setNewConversationDialogOpen,
    newConversationSearch,
    setNewConversationSearch,
    newConversationClients,
    creatingConversation,
    setCreatingConversation,
    // Actions
    createConversationFromUrl,
    saveNewClient,
    saveNewLead,
    openAddContactDialog,
    openNewConversationDialog,
    searchContacts,
    createConversationWithContact,
  };
}
