export interface ZappTag {
  id: string;
  account_id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  auto_distribution: boolean;
  display_order: number;
  sector_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  account_id: string;
  user_id: string;
  department_id: string | null;
  is_active: boolean;
  is_online: boolean;
  max_concurrent_chats: number;
  current_chats: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    team_role_id?: string | null;
    role?: string | null;
    is_also_admin?: boolean | null;
  };
  department?: Department | null;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  team_role_id: string | null;
  is_also_admin?: boolean | null;
  team_role?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

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
  delivery_status?: "pending" | "sent" | "delivered" | "read" | "failed" | null;
  media_download_status?: "pending" | "downloading" | "completed" | "failed" | null;
  external_message_id?: string | null;
  transcription?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  // Campos para mensagem citada (reply)
  quoted_message_id?: string | null;
  quoted_content?: string | null;
  quoted_sender_name?: string | null;
  // Status de envio local (para mensagens otimistas)
  send_status?: "sending" | "sent" | "failed";
  send_error?: string | null;
  // Campos para edição
  updated_at?: string | null;
  is_edited?: boolean;
  // Mapa de menções: JID -> nome do contato
  mention_map?: Record<string, string> | null;
}

export interface ConversationAssignment {
  id: string;
  conversation_id: string | null;
  zapp_conversation_id: string | null;
  agent_id: string | null;
  department_id: string | null;
  status: "triage" | "pending" | "active" | "waiting" | "closed";
  priority: number;
  assigned_at: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  conversation_tags?: {
    tag_id: string;
    tag: {
      id: string;
      name: string;
      color: string;
    } | null;
  }[];
  agent?: Agent | null;
  department?: Department | null;
  conversation?: {
    id: string;
    client_id: string;
    client?: {
      id: string;
      full_name: string;
      phone_e164: string;
      avatar_url: string | null;
      timezone?: string | null;
      state?: string | null;
    };
  };
  zapp_conversation?: {
    id: string;
    phone_e164: string;
    contact_name: string | null;
    client_id: string | null;
    lead_id?: string | null;
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
    is_group: boolean;
    group_jid: string | null;
    is_archived?: boolean;
    is_muted?: boolean;
    is_pinned?: boolean;
    is_favorite?: boolean;
    is_blocked?: boolean;
    avatar_url?: string | null;
    integration_id?: string | null;
    sector_id?: string | null;
    client?: {
      id: string;
      full_name: string;
      phone_e164: string;
      avatar_url: string | null;
      timezone?: string | null;
      state?: string | null;
    } | null;
    lead?: {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      status: string;
    } | null;
  };
}

export interface ContactInfo {
  name: string;
  phone: string;
  avatar: string | null;
  clientId: string | null;
  isClient: boolean;
  isGroup: boolean;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isFavorite: boolean;
  isBlocked: boolean;
  isArchived: boolean;
  searchableText: string;
  /** Override manual de fuso horário do cliente (IANA). Null = auto-detect pelo telefone. */
  clientTimezone?: string | null;
  /** UF cadastrada do cliente, fallback para detecção de fuso quando DDD não resolve. */
  clientState?: string | null;
}

// Normalize string for flexible search (remove accents, special chars)
export const normalizeSearchText = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .trim();
};

// Normalize phone for flexible search (remove all non-digits)
export const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, ""); // Mantém apenas dígitos
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  triage: { label: "Triagem", color: "text-purple-600", bgColor: "bg-purple-500" },
  pending: { label: "Aguardando", color: "text-amber-600", bgColor: "bg-amber-500" },
  active: { label: "Em atendimento", color: "text-emerald-600", bgColor: "bg-emerald-500" },
  waiting: { label: "Aguardando cliente", color: "text-blue-600", bgColor: "bg-blue-500" },
  closed: { label: "Finalizado", color: "text-muted-foreground", bgColor: "bg-muted-foreground" },
};

// Generate a consistent color for a sender name in group chats
export const getSenderColor = (name: string): string => {
  const colors = [
    '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#FF9800', '#FF5722', '#795548',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Helper to get contact info from assignment
export const getContactInfo = (assignment: ConversationAssignment): ContactInfo => {
  const zappConv = assignment.zapp_conversation;
  const oldConv = assignment.conversation;
  
  if (zappConv) {
    const clientData = zappConv.client;
    const leadData = zappConv.lead;
    
    // IMPORTANTE: Para GRUPOS, sempre usar contact_name (nome do grupo no WhatsApp)
    // Para conversas individuais, priorizar cliente/lead vinculado
    // Isso evita o bug onde o nome de um cliente aparece em conversas de outros
    const name = zappConv.is_group 
      ? (zappConv.contact_name || "Grupo sem nome")
      : (clientData?.full_name || leadData?.full_name || zappConv.contact_name || zappConv.phone_e164 || "Desconhecido");
    
    const phone = zappConv.phone_e164 || "";
    
    // Build searchable text with all relevant fields
    const searchableText = normalizeSearchText([
      clientData?.full_name,
      leadData?.full_name,
      zappConv.contact_name,
      zappConv.phone_e164,
      zappConv.last_message_preview,
    ].filter(Boolean).join(" "));
    
    return {
      name,
      phone,
      avatar: clientData?.avatar_url || zappConv.avatar_url || null,
      clientId: zappConv.client_id || null,
      isClient: !!zappConv.client_id || !!zappConv.lead_id,
      isGroup: zappConv.is_group || false,
      lastMessageAt: zappConv.last_message_at || assignment.created_at,
      lastMessagePreview: zappConv.last_message_preview || "",
      unreadCount: zappConv.unread_count || 0,
      isPinned: zappConv.is_pinned || false,
      isMuted: zappConv.is_muted || false,
      isFavorite: zappConv.is_favorite || false,
      isBlocked: zappConv.is_blocked || false,
      isArchived: zappConv.is_archived || false,
      searchableText,
      clientTimezone: clientData?.timezone || null,
      clientState: clientData?.state || null,
    };
  } else if (oldConv?.client) {
    const searchableText = normalizeSearchText([
      oldConv.client.full_name,
      oldConv.client.phone_e164,
    ].filter(Boolean).join(" "));
    
    return {
      name: oldConv.client.full_name,
      phone: oldConv.client.phone_e164,
      avatar: oldConv.client.avatar_url,
      clientId: oldConv.client.id,
      isClient: true,
      isGroup: false,
      lastMessageAt: assignment.created_at,
      lastMessagePreview: "",
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isFavorite: false,
      isBlocked: false,
      isArchived: false,
      searchableText,
    };
  }
  
  return {
    name: "Conversa sem contato",
    phone: "",
    avatar: null,
    clientId: null,
    isClient: false,
    isGroup: false,
    lastMessageAt: assignment.created_at,
    lastMessagePreview: "",
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    isFavorite: false,
    isBlocked: false,
    isArchived: false,
    searchableText: "",
  };
};

// Flexible search matching function
export const matchesSearchQuery = (contact: ContactInfo, searchQuery: string): boolean => {
  if (!searchQuery || searchQuery.trim() === "") return true;
  
  const normalizedQuery = normalizeSearchText(searchQuery);
  const normalizedPhoneQuery = normalizePhone(searchQuery);
  
  // Search by normalized name (handles accents: "João" matches "joao")
  if (contact.searchableText.includes(normalizedQuery)) return true;
  
  // Search by phone (handles formatting: "11999" matches "+5511999887766")
  if (normalizedPhoneQuery.length >= 3) {
    const normalizedPhone = normalizePhone(contact.phone);
    if (normalizedPhone.includes(normalizedPhoneQuery)) return true;
  }
  
  return false;
};

// Helper to get initials from name
export const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
