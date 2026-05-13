import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MANAGEMENT_KEYWORDS = [
  'head', 'gerente', 'manager', 'diretor', 'director',
  'c-level', 'clevel', 'ceo', 'coo', 'cto', 'cfo', 'cmo', 'cpo', 'cro', 'cso',
  'sócio', 'socio', 'partner',
];

function nameMatchesManagement(name?: string | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return MANAGEMENT_KEYWORDS.some((k) => lower.includes(k));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ ok: false, error: 'Email e senha obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify password via the auth REST API in an isolated client
    // (does NOT touch the caller's session).
    const verifyClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signin, error: signinError } = await verifyClient.auth.signInWithPassword({
      email, password,
    });
    if (signinError || !signin?.user) {
      return new Response(JSON.stringify({ ok: false, error: 'Credenciais inválidas' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUserId = signin.user.id;

    // Look up user profile + roles using service role
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('id, name, role, is_also_admin, team_role_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ ok: false, error: 'Usuário não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let teamRoleName: string | null = null;
    let teamRoleNames: string[] = [];
    if (profile.team_role_id) {
      const { data: role } = await admin
        .from('team_roles').select('name').eq('id', profile.team_role_id).maybeSingle();
      teamRoleName = role?.name ?? null;
    }
    const { data: extraRoles } = await admin
      .from('user_team_roles')
      .select('team_role:team_roles(name)')
      .eq('user_id', profile.id);
    if (extraRoles) {
      teamRoleNames = extraRoles.map((r: any) => r.team_role?.name).filter(Boolean);
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin' || !!profile.is_also_admin;
    const isManager = isAdmin
      || nameMatchesManagement(teamRoleName)
      || teamRoleNames.some((n) => nameMatchesManagement(n));

    if (!isManager) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Este usuário não tem permissão de gestor para aprovar giradas',
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      manager: { id: profile.id, name: profile.name },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
