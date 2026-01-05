import { supabase } from "@/integrations/supabase/client";

const OPERATION_ROLES = ["CX", "Gestor", "CS", "Admin", "Head"];
const FINANCIAL_ROLES = ["Financeiro", "Admin", "Gestor"];

interface NotifyContractCreatedParams {
  contractId: string;
  clientName: string;
  contractValue: number;
  fromDeal?: boolean;
  createdByUserId: string;
  accountId: string;
}

export async function notifyContractCreated({
  contractId,
  clientName,
  contractValue,
  fromDeal = false,
  createdByUserId,
  accountId,
}: NotifyContractCreatedParams) {
  if (!fromDeal) return; // Only notify when contract is from a deal win

  try {
    // Get all team roles that match operations or financial
    const { data: teamRoles } = await supabase
      .from("team_roles")
      .select("id, name")
      .eq("account_id", accountId)
      .in("name", [...new Set([...OPERATION_ROLES, ...FINANCIAL_ROLES])]);

    if (!teamRoles || teamRoles.length === 0) return;

    const roleIds = teamRoles.map(r => r.id);

    // Get all users with these roles (excluding the creator)
    const { data: users } = await supabase
      .from("users")
      .select("id, team_role_id")
      .eq("account_id", accountId)
      .in("team_role_id", roleIds)
      .neq("id", createdByUserId);

    if (!users || users.length === 0) return;

    // Format value
    const formattedValue = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(contractValue);

    // Create notifications for all relevant users
    const notifications = users.map(user => ({
      account_id: accountId,
      user_id: user.id,
      type: "contract_created",
      title: "🎉 Novo Contrato Fechado!",
      content: `${clientName} - ${formattedValue}`,
      link: `/contracts?search=${encodeURIComponent(clientName)}`,
      source_type: "client_contracts",
      source_id: contractId,
      triggered_by_user_id: createdByUserId,
    }));

    const { error } = await supabase
      .from("notifications")
      .insert(notifications);

    if (error) {
      console.error("Error creating contract notifications:", error);
    }
  } catch (error) {
    console.error("Error in notifyContractCreated:", error);
  }
}
