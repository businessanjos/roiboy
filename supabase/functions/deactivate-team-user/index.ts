// Inativação/reativação de membros da equipe com transferência de itens em aberto.
// Ações: count_open_items | deactivate | reactivate | transfer_open_items
// Somente administradores da própria conta podem executar.
// Nenhum registro histórico é alterado: apenas o responsável ATUAL de itens abertos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "count_open_items" | "deactivate" | "reactivate" | "transfer_open_items";

export type ItemKey =
  | "deals"
  | "leads"
  | "clients"
  | "tasks"
  | "activities"
  | "conversations";

const ITEM_KEYS: ItemKey[] = ["deals", "leads", "clients", "tasks", "activities", "conversations"];

const ITEM_LABELS: Record<ItemKey, string> = {
  deals: "Negócios em aberto",
  leads: "Leads em aberto",
  clients: "Clientes da carteira",
  tasks: "Tarefas pendentes",
  activities: "Atividades não concluídas",
  conversations: "Conversas do RoyZapp em aberto",
};

const OPEN_LEAD_STATUSES = ["new", "contacted", "qualified"];
const OPEN_TASK_STATUSES = ["pending", "in_progress", "overdue"];
const OPEN_CLIENT_STATUSES = ["active", "paused", "churn_risk"];
const OPEN_CONVERSATION_STATUSES = ["pending", "active", "waiting", "triage"];

interface RequestBody {
  action: Action;
  user_id: string;               // public.users.id do alvo
  new_owner_user_id?: string | null;
  items?: ItemKey[];
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function countOpenItems(admin: any, accountId: string, userId: string) {
  const counts: Record<ItemKey, number> = {
    deals: 0, leads: 0, clients: 0, tasks: 0, activities: 0, conversations: 0,
  };

  const head = { count: "exact" as const, head: true };

  const [deals, leads, clients, tasks, activities] = await Promise.all([
    admin.from("deals").select("id", head)
      .eq("account_id", accountId).eq("status", "open").is("deleted_at", null)
      .or(`responsible_user_id.eq.${userId},sdr_user_id.eq.${userId}`),
    admin.from("leads").select("id", head)
      .eq("account_id", accountId).eq("responsible_user_id", userId)
      .in("status", OPEN_LEAD_STATUSES),
    admin.from("clients").select("id", head)
      .eq("account_id", accountId).eq("responsible_user_id", userId)
      .in("status", OPEN_CLIENT_STATUSES),
    admin.from("internal_tasks").select("id", head)
      .eq("account_id", accountId).eq("assigned_to", userId)
      .in("status", OPEN_TASK_STATUSES),
    admin.from("deal_activities").select("id", head)
      .eq("account_id", accountId).eq("user_id", userId)
      .not("scheduled_at", "is", null).is("completed_at", null),
  ]);

  counts.deals = deals.count || 0;
  counts.leads = leads.count || 0;
  counts.clients = clients.count || 0;
  counts.tasks = tasks.count || 0;
  counts.activities = activities.count || 0;

  const agentIds = await getAgentIds(admin, accountId, userId);
  if (agentIds.length > 0) {
    const { count } = await admin.from("zapp_conversation_assignments")
      .select("id", head)
      .eq("account_id", accountId)
      .in("agent_id", agentIds)
      .in("status", OPEN_CONVERSATION_STATUSES);
    counts.conversations = count || 0;
  }

  return counts;
}

async function getAgentIds(admin: any, accountId: string, userId: string): Promise<string[]> {
  const { data } = await admin.from("zapp_agents")
    .select("id").eq("account_id", accountId).eq("user_id", userId);
  return (data || []).map((r: { id: string }) => r.id);
}

// Executa a transferência dos itens marcados. Retorna a contagem real movida.
async function transferItems(
  admin: any,
  accountId: string,
  fromUserId: string,
  toUserId: string,
  items: ItemKey[],
): Promise<Record<string, number>> {
  const moved: Record<string, number> = {};

  const countRows = (res: any) => (res?.data?.length ?? 0);

  if (items.includes("deals")) {
    const resp = await admin.from("deals")
      .update({ responsible_user_id: toUserId })
      .eq("account_id", accountId).eq("status", "open").is("deleted_at", null)
      .eq("responsible_user_id", fromUserId)
      .select("id");
    const sdr = await admin.from("deals")
      .update({ sdr_user_id: toUserId })
      .eq("account_id", accountId).eq("status", "open").is("deleted_at", null)
      .eq("sdr_user_id", fromUserId)
      .select("id");
    const ids = new Set<string>([
      ...(resp.data || []).map((r: any) => r.id),
      ...(sdr.data || []).map((r: any) => r.id),
    ]);
    moved.deals = ids.size;
  }

  if (items.includes("leads")) {
    const res = await admin.from("leads")
      .update({ responsible_user_id: toUserId })
      .eq("account_id", accountId).eq("responsible_user_id", fromUserId)
      .in("status", OPEN_LEAD_STATUSES)
      .select("id");
    moved.leads = countRows(res);
  }

  if (items.includes("clients")) {
    const res = await admin.from("clients")
      .update({ responsible_user_id: toUserId })
      .eq("account_id", accountId).eq("responsible_user_id", fromUserId)
      .in("status", OPEN_CLIENT_STATUSES)
      .select("id");
    moved.clients = countRows(res);
  }

  if (items.includes("tasks")) {
    const res = await admin.from("internal_tasks")
      .update({ assigned_to: toUserId })
      .eq("account_id", accountId).eq("assigned_to", fromUserId)
      .in("status", OPEN_TASK_STATUSES)
      .select("id");
    moved.tasks = countRows(res);
  }

  if (items.includes("activities")) {
    const res = await admin.from("deal_activities")
      .update({ user_id: toUserId })
      .eq("account_id", accountId).eq("user_id", fromUserId)
      .not("scheduled_at", "is", null).is("completed_at", null)
      .select("id");
    moved.activities = countRows(res);
  }

  if (items.includes("conversations")) {
    const fromAgents = await getAgentIds(admin, accountId, fromUserId);
    let toAgentId: string | null = null;
    const toAgents = await getAgentIds(admin, accountId, toUserId);
    toAgentId = toAgents[0] || null;

    if (fromAgents.length > 0 && toAgentId) {
      const res = await admin.from("zapp_conversation_assignments")
        .update({ agent_id: toAgentId })
        .eq("account_id", accountId)
        .in("agent_id", fromAgents)
        .in("status", OPEN_CONVERSATION_STATUSES)
        .select("id");
      moved.conversations = countRows(res);
    } else {
      moved.conversations = 0;
    }
  }

  return moved;
}

async function writeAuditLog(
  admin: any,
  params: {
    account_id: string;
    actor: { id: string | null; name: string | null; email: string | null };
    action: string;
    entity_id: string | null;
    entity_name: string | null;
    details: Record<string, unknown>;
    req: Request;
  },
) {
  try {
    const ip = params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await admin.from("audit_logs").insert({
      account_id: params.account_id,
      user_id: params.actor.id,
      user_name: params.actor.name,
      user_email: params.actor.email,
      action: params.action,
      entity_type: "user",
      entity_id: params.entity_id,
      entity_name: params.entity_name,
      details: params.details,
      ip_address: ip,
      user_agent: params.req.headers.get("user-agent") || null,
    });
  } catch (err) {
    console.error("audit log write failed:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requester }, error: authError } = await admin.auth.getUser(token);
    if (authError || !requester) return json(401, { error: "Token inválido" });

    const { data: profile } = await admin.from("users")
      .select("id, name, email, account_id, role, is_also_admin")
      .eq("auth_user_id", requester.id)
      .maybeSingle();
    if (!profile) return json(403, { error: "Perfil não encontrado" });

    const isAdmin = profile.role === "admin" || profile.role === "super_admin" || profile.is_also_admin === true;
    if (!isAdmin) return json(403, { error: "Apenas administradores podem gerenciar membros" });

    const body: RequestBody = await req.json();
    const { action, user_id } = body;
    if (!action || !user_id) return json(400, { error: "action e user_id são obrigatórios" });

    const { data: target } = await admin.from("users")
      .select("id, name, email, account_id, auth_user_id, is_active")
      .eq("id", user_id)
      .maybeSingle();
    if (!target) return json(404, { error: "Usuário não encontrado" });
    if (target.account_id !== profile.account_id) {
      return json(403, { error: "Usuário pertence a outra conta" });
    }

    const accountId = profile.account_id as string;
    const actor = { id: profile.id, name: profile.name, email: profile.email };

    if (action === "count_open_items") {
      const counts = await countOpenItems(admin, accountId, user_id);
      return json(200, { counts, labels: ITEM_LABELS });
    }

    if (action === "reactivate") {
      if (target.auth_user_id) {
        await admin.auth.admin.updateUserById(target.auth_user_id, { ban_duration: "none" });
      }
      const { error } = await admin.from("users")
        .update({ is_active: true, force_relogin_at: new Date().toISOString() })
        .eq("id", user_id);
      if (error) return json(400, { error: error.message });

      await writeAuditLog(admin, {
        account_id: accountId, actor, action: "user.activated",
        entity_id: user_id, entity_name: target.name,
        details: { field: "is_active", from: false, to: true },
        req,
      });
      return json(200, { success: true, message: "Membro reativado." });
    }

    // deactivate | transfer_open_items — ambos podem transferir itens
    const requestedItems = (body.items || []).filter((i) => ITEM_KEYS.includes(i));
    const newOwner = body.new_owner_user_id || null;

    let transferred: Record<string, number> = {};
    let newOwnerName: string | null = null;

    if (requestedItems.length > 0) {
      if (!newOwner) return json(400, { error: "Selecione o novo responsável para transferir os itens" });
      if (newOwner === user_id) return json(400, { error: "O novo responsável deve ser outra pessoa" });

      const { data: owner } = await admin.from("users")
        .select("id, name, account_id, is_active")
        .eq("id", newOwner)
        .maybeSingle();
      if (!owner || owner.account_id !== accountId) {
        return json(400, { error: "Novo responsável inválido" });
      }
      if (owner.is_active === false) {
        return json(400, { error: "O novo responsável está inativo" });
      }
      newOwnerName = owner.name;

      transferred = await transferItems(admin, accountId, user_id, newOwner, requestedItems);

      await writeAuditLog(admin, {
        account_id: accountId, actor, action: "user.open_items_transferred",
        entity_id: user_id, entity_name: target.name,
        details: {
          from_user_id: user_id,
          from_user_name: target.name,
          to_user_id: newOwner,
          to_user_name: newOwnerName,
          items: requestedItems,
          moved: transferred,
        },
        req,
      });
    }

    if (action === "transfer_open_items") {
      const remaining = await countOpenItems(admin, accountId, user_id);
      return json(200, { success: true, transferred, remaining, new_owner_name: newOwnerName });
    }

    if (action === "deactivate") {
      if (user_id === profile.id) return json(400, { error: "Você não pode inativar a si mesmo" });
      if (target.auth_user_id) {
        const { error: banErr } = await admin.auth.admin.updateUserById(target.auth_user_id, {
          ban_duration: "876000h",
        });
        if (banErr) console.error("ban failed:", banErr.message);
      }
      const { error } = await admin.from("users")
        .update({ is_active: false, force_relogin_at: new Date().toISOString() })
        .eq("id", user_id);
      if (error) return json(400, { error: error.message });

      const remaining = await countOpenItems(admin, accountId, user_id);

      await writeAuditLog(admin, {
        account_id: accountId, actor, action: "user.deactivated",
        entity_id: user_id, entity_name: target.name,
        details: {
          field: "is_active", from: true, to: false,
          transferred_to: newOwnerName, transferred: transferred,
          remaining_open_items: remaining,
        },
        req,
      });

      return json(200, {
        success: true,
        message: "Membro inativado.",
        transferred,
        remaining,
      });
    }

    return json(400, { error: "Ação inválida" });
  } catch (err) {
    console.error("deactivate-team-user error:", err);
    return json(500, { error: err instanceof Error ? err.message : "Erro inesperado" });
  }
});
