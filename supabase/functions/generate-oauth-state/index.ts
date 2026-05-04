import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { redirect_path = '/marketing/trafego-pago', force_reauth = false } = await req.json().catch(() => ({}));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit: max 10 / 5min
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent } = await supabase.from('oauth_states').select('id').eq('user_id', user.id).gte('created_at', fiveMinAgo);
    if ((recent?.length ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('oauth_states').delete().eq('user_id', user.id);
    const { error: insErr } = await supabase.from('oauth_states').insert({ state, user_id: user.id, redirect_path, expires_at: expiresAt });
    if (insErr) {
      return new Response(JSON.stringify({ error: 'Failed to generate state' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const appId = (Deno.env.get('META_APP_ID') || '').trim();
    if (!appId || !/^\d+$/.test(appId)) {
      return new Response(JSON.stringify({ error: 'META_APP_ID inválido ou não configurado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const scopes = 'ads_management,business_management,pages_show_list,pages_read_engagement,pages_manage_ads,leads_retrieval';
    const authType = force_reauth ? '&auth_type=rerequest' : '';
    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code${authType}`;

    return new Response(JSON.stringify({ success: true, oauth_url: oauthUrl, state }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('generate-oauth-state error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
