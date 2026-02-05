import type { SupabaseClient } from "./types.ts";

// Helper function to get sector display name
export function getSectorDisplayName(sectorId: string | null): string {
  const sectorNames: Record<string, string> = {
    "operacoes": "Operações",
    "financeiro": "Finanças",
    "vendas": "Vendas",
    "diretoria": "Diretoria",
  };
  return sectorId ? (sectorNames[sectorId] || sectorId) : "Padrão";
}

// Helper function to log WhatsApp changes and notify other admins
export async function logWhatsAppChangeAndNotify(
  supabaseClient: SupabaseClient,
  accountId: string,
  userId: string,
  userName: string,
  action: string,
  sectorId: string | null,
  instanceName: string,
  phoneNumber: string
): Promise<void> {
  const sectorName = getSectorDisplayName(sectorId);
  const details = {
    action,
    sector_id: sectorId,
    sector_name: sectorName,
    instance_name: instanceName,
    phone_number: phoneNumber,
    changed_by: userName,
    changed_at: new Date().toISOString(),
  };

  console.log(`[AUDIT] WhatsApp change: ${action} by ${userName} for sector ${sectorName}`);

  // 1. Log to security_audit_logs
  const { error: auditError } = await supabaseClient.from("security_audit_logs").insert({
    event_type: "whatsapp_integration_change",
    user_id: userId,
    account_id: accountId,
    details,
  });

  if (auditError) {
    console.error("Failed to log audit:", auditError.message);
  }

  // 2. Fetch all other admins to notify (excluding the user who made the change)
  const { data: admins, error: adminsError } = await supabaseClient
    .from("users")
    .select("id, name")
    .eq("account_id", accountId)
    .or("role.eq.admin,is_also_admin.eq.true")
    .neq("id", userId);

  if (adminsError) {
    console.error("Failed to fetch admins for notification:", adminsError.message);
    return;
  }

  if (admins && admins.length > 0) {
    const actionText = action === "link_instance" ? "alterou" : action === "disconnect" ? "desconectou" : action;
    const phoneText = phoneNumber ? ` (${phoneNumber})` : "";
    
    // deno-lint-ignore no-explicit-any
    const notifications = admins.map((admin: any) => ({
      account_id: accountId,
      user_id: admin.id,
      type: "security_alert",
      title: "🔔 WhatsApp Alterado",
      content: `${userName} ${actionText} o WhatsApp do setor "${sectorName}"${phoneText}`,
      link: "/settings",
      source_type: "integration",
      triggered_by_user_id: userId,
    }));

    const { error: notifyError } = await supabaseClient.from("notifications").insert(notifications);
    
    if (notifyError) {
      console.error("Failed to send notifications:", notifyError.message);
    } else {
      console.log(`[NOTIFY] Sent ${notifications.length} notifications to admins`);
    }
  }
}
