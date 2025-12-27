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
    };
  };
  zapp_conversation?: {
    id: string;
    phone_e164: string;
    contact_name: string | null;
    client_id: string | null;
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
    client?: {
      id: string;
      full_name: string;
      phone_e164: string;
      avatar_url: string | null;
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
}

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
    return {
      name: clientData?.full_name || zappConv.contact_name || zappConv.phone_e164 || "Desconhecido",
      phone: zappConv.phone_e164 || "",
      avatar: clientData?.avatar_url || zappConv.avatar_url || null,
      clientId: zappConv.client_id || null,
      isClient: !!zappConv.client_id,
      isGroup: zappConv.is_group || false,
      lastMessageAt: zappConv.last_message_at || assignment.created_at,
      lastMessagePreview: zappConv.last_message_preview || "",
      unreadCount: zappConv.unread_count || 0,
      isPinned: zappConv.is_pinned || false,
      isMuted: zappConv.is_muted || false,
      isFavorite: zappConv.is_favorite || false,
      isBlocked: zappConv.is_blocked || false,
      isArchived: zappConv.is_archived || false,
    };
  } else if (oldConv?.client) {
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
  };
};

// Helper to get initials from name
export const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
