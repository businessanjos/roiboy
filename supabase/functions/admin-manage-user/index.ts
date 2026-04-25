// Admin user management — super-admin-only operations on a single auth user:
// change_email, change_password, set_active, set_role, link_account,
// unlink_account, list_memberships.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "change_email"
  | "change_password"
  | "set_active"
  | "set_role"
  | "link_account"
  | "unlink_account"
  | "list_memberships";

// Perfis de Acesso oficiais do sistema. NÃO confundir com "cargo"
// (mentor, consultor, head, etc.) — esses são gerenciados em team_roles.
const ACCESS_PROFILES = ["admin", "gestor", "member", "viewer"] as const;
type AccessProfile = typeof ACCESS_PROFILES[number];

function isValidAccessProfile(value: unknown): value is AccessProfile {
  return typeof value === "string" && (ACCESS_PROFILES as readonly string[]).includes(value);
}

interface RequestBody {
  action: Action;
  // Target identifiers (any combination):
  auth_user_id?: string;          // preferred
  user_row_id?: string;           // public.users.id (for set_active / set_role / unlink_account)
  account_id?: string;            // for link/unlink
  // Action payload:
  new_email?: string;
  new_password?: string;
  is_active?: boolean;
  role?: string;
  name?: string;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Registra um evento de auditoria. Falhas são apenas logadas — nunca bloqueiam
// a operação principal, mas garantem rastreabilidade de quem mudou o quê.
async function writeAuditLog(
  admin: any,
  params: {
    account_id: string;
    actor_user_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    action: string;
    entity_id: string | null;
    entity_name: string | null;
    details: Record<string, unknown>;
    req: Request;
  },
) {
  try {
    const ip =
      params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      params.req.headers.get("cf-connecting-ip") ||
      null;
    const userAgent = params.req.headers.get("user-agent") || null;

    await admin.from("audit_logs").insert({
      account_id: params.account_id,
      user_id: params.actor_user_id,
      user_name: params.actor_name,
      user_email: params.actor_email,
      action: params.action,
      entity_type: "user",
      entity_id: params.entity_id,
      entity_name: params.entity_name,
      details: params.details,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error("audit log write failed:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Auth check — must be a super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requester }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !requester) return json(401, { error: "Token inválido" });

    const { data: superRow } = await admin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", requester.id)
      .maybeSingle();
    if (!superRow) return json(403, { error: "Apenas super admins podem executar esta ação" });

    const body: RequestBody = await req.json();
    const { action } = body;

    // Resolve target auth_user_id when only user_row_id is given
    let targetAuthUserId = body.auth_user_id || null;
    if (!targetAuthUserId && body.user_row_id) {
      const { data: row } = await admin
        .from("users")
        .select("auth_user_id")
        .eq("id", body.user_row_id)
        .maybeSingle();
      targetAuthUserId = row?.auth_user_id || null;
    }

    switch (action) {
      case "list_memberships": {
        if (!targetAuthUserId) return json(400, { error: "auth_user_id é obrigatório" });
        const { data, error } = await admin
          .from("users")
          .select("id, account_id, role, is_active, name, email, accounts(name)")
          .eq("auth_user_id", targetAuthUserId);
        if (error) return json(400, { error: error.message });
        return json(200, {
          memberships: (data || []).map((r: any) => ({
            user_id: r.id,
            account_id: r.account_id,
            account_name: r.accounts?.name || null,
            role: r.role,
            is_active: r.is_active,
            name: r.name,
            email: r.email,
          })),
        });
      }

      case "change_email": {
        if (!targetAuthUserId) return json(400, { error: "auth_user_id é obrigatório" });
        if (!body.new_email) return json(400, { error: "new_email é obrigatório" });
        const newEmail = body.new_email.trim().toLowerCase();

        // Update auth user (skip confirmation since super admin is performing this).
        const { error: authErr } = await admin.auth.admin.updateUserById(targetAuthUserId, {
          email: newEmail,
          email_confirm: true,
        });
        if (authErr) return json(400, { error: authErr.message });

        // Mirror in public.users for ALL accounts this auth user belongs to.
        const { error: dbErr } = await admin
          .from("users")
          .update({ email: newEmail })
          .eq("auth_user_id", targetAuthUserId);
        if (dbErr) return json(400, { error: dbErr.message });

        // Force re-login on the next visit.
        await admin
          .from("users")
          .update({ force_relogin_at: new Date().toISOString() })
          .eq("auth_user_id", targetAuthUserId);

        return json(200, { success: true, message: "E-mail atualizado." });
      }

      case "change_password": {
        if (!targetAuthUserId) return json(400, { error: "auth_user_id é obrigatório" });
        if (!body.new_password || body.new_password.length < 6) {
          return json(400, { error: "Senha deve ter no mínimo 6 caracteres" });
        }
        const { error: authErr } = await admin.auth.admin.updateUserById(targetAuthUserId, {
          password: body.new_password,
        });
        if (authErr) {
          let msg = authErr.message;
          if (
            (authErr as any).code === "weak_password" ||
            authErr.name === "AuthWeakPasswordError" ||
            msg?.toLowerCase().includes("weak")
          ) {
            const reasons = (authErr as any).reasons || [];
            msg = reasons.includes("pwned")
              ? "Senha encontrada em vazamentos. Escolha uma diferente."
              : "Senha muito fraca. Use letras, números e caracteres especiais.";
          }
          return json(400, { error: msg });
        }
        // Invalidate any active session.
        await admin
          .from("users")
          .update({ force_relogin_at: new Date().toISOString() })
          .eq("auth_user_id", targetAuthUserId);
        return json(200, { success: true, message: "Senha atualizada." });
      }

      case "set_active": {
        // Toggles BOTH the auth ban (so the user really can't log in)
        // and the public.users.is_active flag (audit trail).
        if (!targetAuthUserId) return json(400, { error: "auth_user_id é obrigatório" });
        if (typeof body.is_active !== "boolean") {
          return json(400, { error: "is_active é obrigatório" });
        }
        const banDuration = body.is_active ? "none" : "876000h"; // ~100 years
        const { error: authErr } = await admin.auth.admin.updateUserById(targetAuthUserId, {
          ban_duration: banDuration,
        } as any);
        if (authErr) return json(400, { error: authErr.message });

        let updateQuery = admin
          .from("users")
          .update({ is_active: body.is_active, force_relogin_at: new Date().toISOString() })
          .eq("auth_user_id", targetAuthUserId);
        // If a single membership was specified, scope the public.users update to it.
        if (body.user_row_id) updateQuery = updateQuery.eq("id", body.user_row_id) as any;
        const { error: dbErr } = await updateQuery;
        if (dbErr) return json(400, { error: dbErr.message });

        return json(200, {
          success: true,
          message: body.is_active ? "Usuário reativado." : "Usuário inativado.",
        });
      }

      case "set_role": {
        if (!body.user_row_id) return json(400, { error: "user_row_id é obrigatório" });
        if (!body.role) return json(400, { error: "role é obrigatório" });
        if (!isValidAccessProfile(body.role)) {
          return json(400, {
            error: `Perfil de acesso inválido: "${body.role}". Valores aceitos: ${ACCESS_PROFILES.join(", ")}.`,
            code: "invalid_access_profile",
            allowed: ACCESS_PROFILES,
          });
        }
        const { error } = await admin
          .from("users")
          .update({ role: body.role })
          .eq("id", body.user_row_id);
        if (error) return json(400, { error: error.message });
        // Force re-login so permissions refresh immediately.
        await admin
          .from("users")
          .update({ force_relogin_at: new Date().toISOString() })
          .eq("id", body.user_row_id);
        return json(200, { success: true, message: "Perfil de acesso atualizado." });
      }

      case "link_account": {
        if (!targetAuthUserId) return json(400, { error: "auth_user_id é obrigatório" });
        if (!body.account_id) return json(400, { error: "account_id é obrigatório" });
        const role = body.role ?? "member";
        if (!isValidAccessProfile(role)) {
          return json(400, {
            error: `Perfil de acesso inválido: "${body.role}". Valores aceitos: ${ACCESS_PROFILES.join(", ")}.`,
            code: "invalid_access_profile",
            allowed: ACCESS_PROFILES,
          });
        }
        const { data, error } = await admin.rpc("admin_link_user_to_account", {
          target_auth_user_id: targetAuthUserId,
          target_account_id: body.account_id,
          p_role: role,
          p_name: body.name || null,
          p_email: null,
        });
        if (error) return json(400, { error: error.message });
        return json(200, { success: true, user_row_id: data, message: "Usuário vinculado à conta." });
      }

      case "unlink_account": {
        if (!body.user_row_id) return json(400, { error: "user_row_id é obrigatório" });
        // Safety: ensure this is not the only membership.
        const { data: row } = await admin
          .from("users")
          .select("auth_user_id, id")
          .eq("id", body.user_row_id)
          .maybeSingle();
        if (!row) return json(404, { error: "Vínculo não encontrado" });
        if (row.auth_user_id) {
          const { count } = await admin
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("auth_user_id", row.auth_user_id);
          if ((count || 0) <= 1) {
            return json(400, {
              error: "Este é o único vínculo do usuário. Remova o usuário pela área de equipe ou crie outro vínculo antes.",
            });
          }
        }
        const { error } = await admin.from("users").delete().eq("id", body.user_row_id);
        if (error) return json(400, { error: error.message });
        return json(200, { success: true, message: "Vínculo removido." });
      }

      default:
        return json(400, { error: "Ação inválida" });
    }
  } catch (e: any) {
    console.error("admin-manage-user unexpected error:", e);
    return json(500, { error: e.message || "Erro interno do servidor" });
  }
});
