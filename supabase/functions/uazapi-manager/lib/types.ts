// Type definitions for UAZAPI manager
export interface UazapiRequest {
  action: "create" | "connect" | "disconnect" | "status" | "qrcode" | "send_text" | "paircode" | "configure_webhook" | "fetch_token" 
    | "list_groups" | "sync_groups" | "save_selected_groups" | "create_group" | "group_participants" | "add_participant" | "remove_participant" | "send_to_group"
    | "unlink_instance"
    | "send_media" | "send_media_to_group"
    | "update_group_name" | "update_group_description" | "update_group_image"
    | "create_support_instance" | "refresh_support_qr" | "disconnect_support" | "check_support_status"
    | "import-conversations"
    | "delete_message" | "edit_message"
    | "list_instances" | "link_instance"
    | "add_instance_to_sector" | "update_instance_pin" | "verify_instance_pin" | "list_sector_instances"
    | "sync-chat-history";
  days?: number;
  limit?: number;
  instance_name?: string;
  phone?: string;
  message?: string;
  message_id?: string;
  new_content?: string;
  quoted_message_id?: string;
  quoted_from_me?: boolean;
  quoted_participant?: string;
  group_id?: string;
  group_name?: string;
  group_description?: string;
  group_image?: string;
  participants?: string[];
  mentions?: string[];
  media_url?: string;
  media_type?: "image" | "audio" | "document";
  caption?: string;
  file_name?: string;
  groups?: Array<{ group_jid: string; name: string; participant_count: number }>;
  sector_id?: string;
  integration_id?: string;
  display_name?: string;
  pin?: string;
}

export interface UserData {
  id: string;
  name: string | null;
  account_id: string;
  role: string;
  is_also_admin: boolean | null;
}

export interface IntegrationConfig {
  provider?: string;
  instance_name?: string;
  instance_token?: string;
  owner?: string;
  phone_number?: string;
  profile_name?: string;
  profile_pic_url?: string;
  qrcode_base64?: string;
  disconnected_manually?: boolean;
  [key: string]: unknown;
}

export interface ExistingWhatsapp {
  id: string;
  config: IntegrationConfig | null;
  status: string;
  sector_id: string | null;
}

// deno-lint-ignore no-explicit-any
export type SupabaseClient = any;
