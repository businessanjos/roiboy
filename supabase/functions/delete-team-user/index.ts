import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  user_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get requesting user's account and check if admin
    const { data: requestingProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, account_id, role, is_also_admin")
      .eq("auth_user_id", requestingUser.id)
      .single();

    if (profileError || !requestingProfile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = requestingProfile.role === "admin" || requestingProfile.is_also_admin === true;
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem excluir usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DeleteUserRequest = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "ID do usuário é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-deletion
    if (user_id === requestingProfile.id) {
      return new Response(
        JSON.stringify({ error: "Você não pode excluir sua própria conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the target user to verify they belong to the same account
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from("users")
      .select("id, auth_user_id, account_id, name, role")
      .eq("id", user_id)
      .single();

    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify they belong to the same account
    if (targetUser.account_id !== requestingProfile.account_id) {
      return new Response(
        JSON.stringify({ error: "Você não pode excluir usuários de outra conta" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete user profile from users table first
    const { error: deleteProfileError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", user_id);

    if (deleteProfileError) {
      console.error("Error deleting user profile:", deleteProfileError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir perfil do usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If user has an auth account, delete it too
    if (targetUser.auth_user_id) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        targetUser.auth_user_id
      );

      if (deleteAuthError) {
        console.error("Error deleting auth user:", deleteAuthError);
        // Don't fail the request, profile is already deleted
      }
    }

    console.log(`User ${targetUser.name} deleted by admin`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Usuário excluído com sucesso!"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
