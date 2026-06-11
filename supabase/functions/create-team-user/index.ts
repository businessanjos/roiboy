import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateTeamUserRequest {
  name: string;
  email: string;
  password: string;
  account_id: string;
  team_role_id?: string;
  team_role_ids?: string[];
  is_also_admin?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is authenticated and is an admin
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
      .select("account_id, role, is_also_admin")
      .eq("auth_user_id", requestingUser.id)
      .single();

    if (profileError || !requestingProfile) {
      console.error("Profile not found for user:", requestingUser.id, profileError);
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin privileges (either role=admin OR is_also_admin=true)
    const hasAdminPrivileges = requestingProfile.role === "admin" || requestingProfile.is_also_admin === true;
    
    if (!hasAdminPrivileges) {
      console.log("User lacks admin privileges:", requestingProfile);
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem criar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateTeamUserRequest = await req.json();
    const { name, email, password, team_role_id, team_role_ids, is_also_admin } = body;

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Nome, email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Global email check: search if email exists anywhere in the system
    const { data: globalUser } = await supabaseAdmin
      .from("users")
      .select("id, account_id, name")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (globalUser) {
      if (globalUser.account_id === requestingProfile.account_id) {
        // Email already exists in the SAME account
        return new Response(
          JSON.stringify({ error: "Este usuário já faz parte da sua equipe" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Email already exists in ANOTHER account
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado em outra empresa no sistema. Entre em contato com o suporte se precisar transferir este usuário." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Also check in auth.users (may exist without a profile in users table)
    const { data: { users: allAuthUsers } } = await supabaseAdmin.auth.admin.listUsers({ 
      perPage: 1000 
    });
    const existsInAuth = allAuthUsers?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existsInAuth) {
      return new Response(
        JSON.stringify({ error: "Este email já está registrado no sistema. Entre em contato com o suporte para assistência." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user with the admin API
    // Mark as team member so the handle_new_user trigger skips creating a new account
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        name,
        full_name: name,
        is_team_member: "true", // This flag tells the trigger to skip account creation
      },
    });

    if (createAuthError) {
      console.error("Error creating auth user:", createAuthError);
      
      if (createAuthError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado no sistema" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createAuthError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar usuário de autenticação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user profile in the users table
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        auth_user_id: authData.user.id,
        account_id: requestingProfile.account_id,
        name,
        email: email.toLowerCase(),
        role: "member", // Default role for team members (accepted: admin, gestor, member, viewer)
        team_role_id: team_role_id || null,
        is_also_admin: is_also_admin || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating user profile:", insertError);
      
      // Rollback: delete the auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: "Erro ao criar perfil do usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into user_team_roles junction table
    const roleIdsToInsert = team_role_ids || (team_role_id ? [team_role_id] : []);
    if (roleIdsToInsert.length > 0 && newUser) {
      const { error: junctionError } = await supabaseAdmin
        .from("user_team_roles")
        .insert(roleIdsToInsert.map((rid: string) => ({
          user_id: newUser.id,
          team_role_id: rid,
        })));
      if (junctionError) {
        console.error("Error inserting user_team_roles:", junctionError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: newUser,
        message: "Usuário criado com sucesso! Ele já pode fazer login com o email e senha definidos."
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
