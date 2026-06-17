import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { SectorId } from "@/config/sectors";
import { useZappDialogs, TeamUser } from "@/hooks/useZappDialogs";
import { useZappConversations } from "@/hooks/useZappConversations";
import { useZappFilters } from "@/hooks/useZappFilters";

export interface Message {
  id: string;
  content: string | null;
  is_from_client: boolean;
  created_at: string;
  message_type: string;
  media_url?: string | null;
  media_type?: string | null;
  media_mimetype?: string | null;
  media_filename?: string | null;
  audio_duration_sec?: number | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  delivery_status?: "pending" | "sent" | "delivered" | "read" | "failed" | null;
  media_download_status?: "pending" | "downloading" | "completed" | "failed" | null;
  external_message_id?: string | null;
  transcription?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  quoted_message_id?: string | null;
  quoted_content?: string | null;
  quoted_sender_name?: string | null;
  send_status?: "sending" | "sent" | "failed";
  send_error?: string | null;
  updated_at?: string | null;
  is_edited?: boolean;
  mention_map?: Record<string, string> | null;
}

export interface InboundMessageData {
  conversationId: string;
  contactName: string;
  messagePreview: string;
  avatarUrl?: string | null;
  agentId?: string | null;
  isGroup?: boolean;
}

interface UseZappDataOptions {
  sectorId?: SectorId;
  integrationId?: string;
  onNewInboundMessage?: (data: InboundMessageData) => void;
}

export function useZappData(options: UseZappDataOptions = {}) {
  const { sectorId, integrationId, onNewInboundMessage } = options;
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);

  // Compose sub-hooks
  const dialogs = useZappDialogs({
    accountId: currentUser?.account_id,
    userId: currentUser?.id,
    sectorId,
  });

  const hasGlobalVisibility =
    currentUser?.role === "admin" ||
    currentUser?.role === "super_admin" ||
    currentUser?.is_also_admin === true ||
    currentUser?.team_role_name === "Admin" ||
    currentUser?.team_role_name === "Gestor" ||
    currentUser?.team_role_names?.includes("Admin") ||
    currentUser?.team_role_names?.includes("Gestor") ||
    false;

  const conversations = useZappConversations({
    accountId: currentUser?.account_id,
    sectorId,
    integrationId,
    departments: dialogs.departments,
    onNewInboundMessage,
    hasGlobalVisibility,
  });

  const filters = useZappFilters({
    accountId: currentUser?.account_id,
  });

  // Main data fetch - orchestrates all sub-hooks
  const fetchData = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      // Fetch dialog data (departments, agents, users, roles)
      const { targetDepartmentId } = await dialogs.fetchDialogData();

      // Fetch assignments for the target department
      if (sectorId && targetDepartmentId) {
        console.log(`[ZappData] fetchData: Filtering by department ${targetDepartmentId} for sector ${sectorId}`);
        await conversations.fetchAssignmentsForDepartment(targetDepartmentId);
      } else if (sectorId && !targetDepartmentId) {
        console.log(`[ZappData] fetchData: No department for sector ${sectorId}`);
      }

      // Fetch filter data (tags, products, clients)
      await filters.fetchFilterData();
    } catch (error: any) {
      console.error("Error fetching zapp data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, sectorId, dialogs.fetchDialogData, conversations.fetchAssignmentsForDepartment, filters.fetchFilterData]);

  // Initial load
  useEffect(() => {
    if (currentUser?.account_id) {
      fetchData();
      filters.checkWhatsAppStatus(sectorId);
    }
  }, [currentUser?.account_id, sectorId, fetchData]);

  return {
    // Dialog data
    departments: dialogs.departments,
    tags: filters.tags,
    agents: dialogs.agents,
    teamUsers: dialogs.teamUsers,
    teamRoles: dialogs.teamRoles,
    allClients: filters.allClients,
    currentAgent: dialogs.currentAgent,
    sectorId,
    hasGlobalVisibility,

    // Conversation data
    assignments: conversations.assignments,
    messages: conversations.messages,
    loading,
    availableProducts: filters.availableProducts,
    clientProducts: conversations.clientProducts,
    leadDealStages: conversations.leadDealStages,

    // WhatsApp
    whatsappConnected: filters.whatsappConnected,
    whatsappConnecting: filters.whatsappConnecting,
    whatsappInstanceName: filters.whatsappInstanceName,
    toggleWhatsAppConnection: () => filters.toggleWhatsAppConnection(sectorId),
    checkWhatsAppStatus: () => filters.checkWhatsAppStatus(sectorId),

    // Actions
    fetchData,
    fetchMessages: conversations.fetchMessages,
    setMessages: conversations.setMessages,
    setAssignments: conversations.setAssignments,
    clearCurrentConversation: conversations.clearCurrentConversation,
  };
}

export type { TeamUser };
