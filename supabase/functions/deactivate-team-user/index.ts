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

type Action = "count_open_items" | "list_open_items" | "deactivate" | "reactivate" | "transfer_open_items";

interface ItemDef {
  key: string;
  group: string;
  label: string;
  table: string;
  /** Colunas de responsável atual (podem ser várias na mesma tabela). */
  columns: string[];
  /** Filtros de "em aberto" aplicados na contagem e na transferência. */
  apply: (q: any) => any;
  /** Tabelas sem account_id */
  noAccount?: boolean;
}

const OPEN_LEAD_STATUSES = ["new", "contacted", "qualified"];
const OPEN_TASK_STATUSES = ["pending", "in_progress", "overdue"];
const OPEN_CLIENT_STATUSES = ["active", "paused", "churn_risk"];
const OPEN_CONVERSATION_STATUSES = ["pending", "active", "waiting", "triage"];

const ITEMS: ItemDef[] = [
  // ---------- Vendas ----------
  {
    key: "deals", group: "sales", label: "Negócios em aberto",
    table: "deals", columns: ["responsible_user_id", "sdr_user_id"],
    apply: (q) => q.eq("status", "open").is("deleted_at", null),
  },
  {
    key: "leads", group: "sales", label: "Leads em aberto",
    table: "leads", columns: ["responsible_user_id"],
    apply: (q) => q.in("status", OPEN_LEAD_STATUSES),
  },
  {
    key: "activities", group: "sales", label: "Atividades agendadas não concluídas",
    table: "deal_activities", columns: ["user_id"],
    apply: (q) => q.not("scheduled_at", "is", null).is("completed_at", null),
  },
  {
    key: "sales_meetings", group: "sales", label: "Reuniões de vendas agendadas",
    table: "sales_meetings", columns: ["responsible_user_id"],
    apply: (q) => q.in("status", ["scheduled", "pending", "confirmed", "rescheduled"]),
  },
  {
    key: "clients_sales", group: "sales", label: "Clientes onde é o vendedor",
    table: "clients", columns: ["sales_user_id"],
    apply: (q) => q.in("status", OPEN_CLIENT_STATUSES),
  },

  // ---------- Atendimento / CS ----------
  {
    key: "clients", group: "cs", label: "Clientes da carteira (responsável)",
    table: "clients", columns: ["responsible_user_id"],
    apply: (q) => q.in("status", OPEN_CLIENT_STATUSES),
  },
  {
    key: "conversations", group: "cs", label: "Conversas do RoyZapp em aberto",
    table: "zapp_conversation_assignments", columns: ["agent_id"],
    apply: (q) => q.in("status", OPEN_CONVERSATION_STATUSES),
  },
  {
    key: "ruler", group: "cs", label: "Régua de relacionamento em andamento",
    table: "zapp_ruler_enrollments", columns: ["assigned_to"],
    apply: (q) => q.in("status", ["active", "pending", "paused"]),
  },
  {
    key: "support_tickets", group: "cs", label: "Chamados de suporte em aberto",
    table: "support_tickets", columns: ["assigned_to"],
    apply: (q) => q.not("status", "in", "(closed,resolved,cancelled)"),
  },

  // ---------- Marketing ----------
  {
    key: "marketing_projects", group: "marketing", label: "Projetos de marketing que lidera",
    table: "marketing_projects", columns: ["owner_user_id"],
    apply: (q) => q.not("status", "in", "(done,completed,cancelled,archived)"),
  },
  {
    key: "content_pieces", group: "marketing", label: "Peças de conteúdo atribuídas",
    table: "content_pieces", columns: ["assigned_user_id"],
    apply: (q) => q.not("status", "in", "(published,done,cancelled,archived)"),
  },
  {
    key: "content_approvals", group: "marketing", label: "Aprovações de conteúdo sob responsabilidade",
    table: "content_approval_checklists", columns: ["responsible_user_id"],
    apply: (q) => q,
  },

  // ---------- Eventos ----------
  {
    key: "event_checklist", group: "events", label: "Itens de checklist de evento",
    table: "event_checklist", columns: ["assigned_to"],
    apply: (q) => q.is("completed_at", null).not("status", "in", "(done,cancelled)"),
  },
  {
    key: "event_deliverables", group: "events", label: "Entregáveis de conteúdo de evento",
    table: "event_content_deliverables", columns: ["assigned_to"],
    apply: (q) => q.not("status", "in", "(done,delivered,published,cancelled)"),
  },
  {
    key: "event_briefings", group: "events", label: "Briefings de evento sob responsabilidade",
    table: "event_briefings", columns: ["responsible_user_id"],
    apply: (q) => q,
  },

  // ---------- Financeiro ----------
  {
    key: "dunning_cases", group: "financial", label: "Cobranças / inadimplência em aberto",
    table: "dunning_cases", columns: ["assigned_to"],
    apply: (q) => q.not("stage", "in", "(recuperada,encerrada,cancelada,perdida)"),
  },

  // ---------- RH ----------
  {
    key: "hr_admissions", group: "hr", label: "Admissões que conduz",
    table: "hr_admissions", columns: ["responsible_user_id"],
    apply: (q) => q.not("stage", "in", "(admitted,completed,cancelled)"),
  },
  {
    key: "hr_offboardings", group: "hr", label: "Desligamentos que conduz",
    table: "hr_offboardings", columns: ["responsible_user_id"],
    apply: (q) => q.is("completed_at", null),
  },

  // ---------- Geral ----------
  {
    key: "tasks", group: "general", label: "Tarefas pendentes",
    table: "internal_tasks", columns: ["assigned_to"],
    apply: (q) => q.in("status", OPEN_TASK_STATUSES),
  },
  {
    key: "leader_actions", group: "general", label: "Ações da reunião de líderes",
    table: "leader_meeting_actions", columns: ["owner_user_id"], noAccount: true,
    apply: (q) => q.is("completed_at", null),
  },
];

const ITEM_BY_KEY: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.key, i]));
const ITEM_KEYS = ITEMS.map((i) => i.key);
const ITEM_LABELS: Record<string, string> = Object.fromEntries(ITEMS.map((i) => [i.key, i.label]));

interface Assignment { key: string; to_user_id: string }

interface RequestBody {
  action: Action;
  user_id: string;               // public.users.id do alvo
  new_owner_user_id?: string | null;
  items?: string[];
  assignments?: Assignment[];
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAgentIds(admin: any, accountId: string, userId: string): Promise<string[]> {
  const { data } = await admin.from("zapp_agents")
    .select("id").eq("account_id", accountId).eq("user_id", userId);
  return (data || []).map((r: { id: string }) => r.id);
}

async function countOpenItems(admin: any, accountId: string, userId: string) {
  const counts: Record<string, number> = {};
  for (const key of ITEM_KEYS) counts[key] = 0;

  const agentIds = await getAgentIds(admin, accountId, userId);

  const results = await Promise.all(ITEMS.map(async (item) => {
    try {
      let owners = [userId];
      if (item.key === "conversations") {
        if (agentIds.length === 0) return [item.key, 0] as const;
        owners = agentIds;
      }

      let q = admin.from(item.table).select("id", { count: "exact", head: true });
      if (!item.noAccount) q = q.eq("account_id", accountId);
      q = item.apply(q);

      const filters: string[] = [];
      for (const col of item.columns) {
        for (const owner of owners) filters.push(`${col}.eq.${owner}`);
      }
      q = filters.length === 1 ? q.eq(item.columns[0], owners[0]) : q.or(filters.join(","));

      const { count, error } = await q;
      if (error) {
        console.error(`count ${item.key} failed:`, error.message);
        return [item.key, 0] as const;
      }
      return [item.key, count || 0] as const;
    } catch (err) {
      console.error(`count ${item.key} threw:`, err);
      return [item.key, 0] as const;
    }
  }));

  for (const [key, count] of results) counts[key] = count;
  return counts;
}

/** Transfere um item para um destinatário. Retorna quantos registros mudaram de dono. */
async function transferItem(
  admin: any,
  accountId: string,
  item: ItemDef,
  fromUserId: string,
  toUserId: string,
): Promise<{ moved: number; error?: string }> {
  try {
    if (item.key === "conversations") {
      const fromAgents = await getAgentIds(admin, accountId, fromUserId);
      const toAgents = await getAgentIds(admin, accountId, toUserId);
      const toAgentId = toAgents[0] || null;
      if (fromAgents.length === 0) return { moved: 0 };
      if (!toAgentId) {
        return { moved: 0, error: "O destinatário não tem agente no RoyZapp" };
      }
      let q = admin.from(item.table).update({ agent_id: toAgentId })
        .eq("account_id", accountId).in("agent_id", fromAgents);
      q = item.apply(q);
      const { data, error } = await q.select("id");
      if (error) return { moved: 0, error: error.message };
      return { moved: data?.length || 0 };
    }

    const ids = new Set<string>();
    for (const col of item.columns) {
      let q = admin.from(item.table).update({ [col]: toUserId });
      if (!item.noAccount) q = q.eq("account_id", accountId);
      q = item.apply(q).eq(col, fromUserId);
      const { data, error } = await q.select("id");
      if (error) return { moved: ids.size, error: error.message };
      for (const row of data || []) ids.add(row.id);
    }
    return { moved: ids.size };
  } catch (err) {
    return { moved: 0, error: err instanceof Error ? err.message : "erro" };
  }
}

/** Como montar a descrição de cada registro na listagem detalhada. */
const LIST_META: Record<string, {
  title?: string[];
  status?: string;
  date?: string;
  ref?: { col: string; table: string; label: string };
}> = {
  deals: { title: ["title", "contact_name"], status: "status" },
  leads: { title: ["full_name"], status: "status" },
  activities: { title: ["title"], date: "scheduled_at" },
  sales_meetings: { title: ["title"], status: "status", date: "scheduled_at" },
  clients_sales: { title: ["full_name"], status: "status" },
  clients: { title: ["full_name"], status: "status" },
  conversations: {
    status: "status",
    ref: { col: "conversation_id", table: "zapp_conversations", label: "contact_name" },
  },
  ruler: { title: ["contact_name"], status: "status" },
  support_tickets: { title: ["subject"], status: "status" },
  marketing_projects: { title: ["name"], status: "status" },
  content_pieces: { title: ["title"], status: "status" },
  content_approvals: { title: ["post_title"] },
  event_checklist: { title: ["title"], status: "status", date: "due_date" },
  event_deliverables: { title: ["title"], status: "status", date: "due_date" },
  event_briefings: { ref: { col: "event_id", table: "events", label: "title" } },
  dunning_cases: { status: "stage", ref: { col: "client_id", table: "clients", label: "full_name" } },
  hr_admissions: { title: ["candidate_name"], status: "stage" },
  hr_offboardings: {
    status: "stage",
    ref: { col: "collaborator_id", table: "hr_collaborators", label: "full_name" },
  },
  tasks: { title: ["title"], status: "status", date: "due_date" },
  leader_actions: { title: ["title"], date: "due_date" },
};

/** Lista os registros em aberto de um item, para o gestor conferir um a um. */
async function listOpenItems(
  admin: any,
  accountId: string,
  userId: string,
  key: string,
  limit = 300,
) {
  const item = ITEM_BY_KEY[key];
  const meta = LIST_META[key] || {};

  let owners = [userId];
  if (item.key === "conversations") {
    owners = await getAgentIds(admin, accountId, userId);
    if (owners.length === 0) return [];
  }

  const cols = new Set<string>(["id", "created_at"]);
  for (const c of meta.title || []) cols.add(c);
  if (meta.status) cols.add(meta.status);
  if (meta.date) cols.add(meta.date);
  if (meta.ref) cols.add(meta.ref.col);

  let q = admin.from(item.table).select(Array.from(cols).join(","));
  if (!item.noAccount) q = q.eq("account_id", accountId);
  q = item.apply(q);

  const filters: string[] = [];
  for (const col of item.columns) for (const owner of owners) filters.push(`${col}.eq.${owner}`);
  q = filters.length === 1 ? q.eq(item.columns[0], owners[0]) : q.or(filters.join(","));

  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) {
    console.error(`list ${key} failed:`, error.message);
    return [];
  }

  const rows = (data || []) as any[];

  // Resolve nomes quando o registro só guarda o id de outra entidade.
  let refNames: Record<string, string> = {};
  if (meta.ref) {
    const ids = Array.from(new Set(rows.map((r) => r[meta.ref!.col]).filter(Boolean)));
    if (ids.length > 0) {
      const { data: refs } = await admin.from(meta.ref.table)
        .select(`id, ${meta.ref.label}`).in("id", ids);
      refNames = Object.fromEntries(
        (refs || []).map((r: any) => [r.id, r[meta.ref!.label] || ""]),
      );
    }
  }

  return rows.map((r) => {
    const direct = (meta.title || []).map((c) => r[c]).find((v) => !!v);
    const fromRef = meta.ref ? refNames[r[meta.ref.col]] : null;
    return {
      id: r.id,
      title: direct || fromRef || "(sem título)",
      status: meta.status ? r[meta.status] || null : null,
      date: meta.date ? r[meta.date] || null : null,
      created_at: r.created_at || null,
    };
  });
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

    if (action === "list_open_items") {
      const key = (body as any).item_key as string;
      if (!key || !ITEM_BY_KEY[key]) return json(400, { error: "Item inválido" });
      const rows = await listOpenItems(admin, accountId, user_id, key);
      return json(200, { rows, label: ITEM_LABELS[key] });
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
    // Formato novo: assignments [{ key, to_user_id }]. Formato antigo: items[] + new_owner_user_id.
    let assignments: Assignment[] = (body.assignments || [])
      .filter((a) => a && ITEM_BY_KEY[a.key] && a.to_user_id);
    if (assignments.length === 0 && (body.items || []).length > 0 && body.new_owner_user_id) {
      assignments = (body.items || [])
        .filter((k) => ITEM_BY_KEY[k])
        .map((k) => ({ key: k, to_user_id: body.new_owner_user_id as string }));
    }

    const transferred: Record<string, number> = {};
    const warnings: string[] = [];
    const ownerNames: Record<string, string> = {};

    if (assignments.length > 0) {
      const ownerIds = Array.from(new Set(assignments.map((a) => a.to_user_id)));
      if (ownerIds.includes(user_id)) {
        return json(400, { error: "O novo responsável deve ser outra pessoa" });
      }
      const { data: owners } = await admin.from("users")
        .select("id, name, account_id, is_active")
        .in("id", ownerIds);
      for (const id of ownerIds) {
        const owner = (owners || []).find((o: any) => o.id === id);
        if (!owner || owner.account_id !== accountId) {
          return json(400, { error: "Novo responsável inválido" });
        }
        if (owner.is_active === false) {
          return json(400, { error: `O responsável ${owner.name} está inativo` });
        }
        ownerNames[id] = owner.name;
      }

      // Agrupa por destinatário para gerar um registro de auditoria por pessoa.
      for (const ownerId of ownerIds) {
        const keys = assignments.filter((a) => a.to_user_id === ownerId).map((a) => a.key);
        const movedByKey: Record<string, number> = {};
        for (const key of keys) {
          const res = await transferItem(admin, accountId, ITEM_BY_KEY[key], user_id, ownerId);
          movedByKey[key] = res.moved;
          transferred[key] = (transferred[key] || 0) + res.moved;
          if (res.error) warnings.push(`${ITEM_LABELS[key]}: ${res.error}`);
        }

        await writeAuditLog(admin, {
          account_id: accountId, actor, action: "user.open_items_transferred",
          entity_id: user_id, entity_name: target.name,
          details: {
            from_user_id: user_id,
            from_user_name: target.name,
            to_user_id: ownerId,
            to_user_name: ownerNames[ownerId],
            items: keys,
            moved: movedByKey,
          },
          req,
        });
      }
    }

    if (action === "transfer_open_items") {
      const remaining = await countOpenItems(admin, accountId, user_id);
      return json(200, {
        success: true,
        transferred,
        remaining,
        warnings,
        new_owner_name: Object.values(ownerNames).join(", ") || null,
      });
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
          transferred_to: Object.values(ownerNames).join(", ") || null,
          transferred,
          remaining_open_items: remaining,
        },
        req,
      });

      return json(200, {
        success: true,
        message: "Membro inativado.",
        transferred,
        remaining,
        warnings,
      });
    }

    return json(400, { error: "Ação inválida" });
  } catch (err) {
    console.error("deactivate-team-user error:", err);
    return json(500, { error: err instanceof Error ? err.message : "Erro inesperado" });
  }
});
