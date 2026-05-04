import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildRedirect(appUrl: string, redirectPath: string, params: Record<string, string>) {
  const url = new URL(`${appUrl}${redirectPath}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const appUrl = Deno.env.get('APP_URL') || 'https://cxroy.lovable.app';
  let redirectPath = '/marketing/trafego-pago';

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (errorParam) {
      return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: errorDescription || errorParam }) } });
    }
    if (!code || !stateParam) {
      return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: 'missing_params' }) } });
    }

    const { data: stateData } = await supabase.from('oauth_states').select('user_id, redirect_path').eq('state', stateParam).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!stateData) {
      return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: 'invalid_state' }) } });
    }
    const userId = stateData.user_id;
    redirectPath = stateData.redirect_path || redirectPath;
    await supabase.from('oauth_states').delete().eq('state', stateParam);

    const appId = (Deno.env.get('META_APP_ID') || '').trim();
    const appSecret = (Deno.env.get('META_APP_SECRET') || '').trim();
    if (!appId || !appSecret) {
      return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: 'missing_meta_config' }) } });
    }
    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    const tokenData = await (await fetch(tokenUrl)).json();
    if (tokenData.error) {
      return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: tokenData.error.message }) } });
    }

    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`;
    const longLived = await (await fetch(longLivedUrl)).json();
    const finalToken = longLived.access_token || tokenData.access_token;
    const finalExpiresIn = longLived.expires_in || tokenData.expires_in;

    const userInfo = await (await fetch(`https://graph.facebook.com/v21.0/me?access_token=${finalToken}`)).json();
    const expiresAt = finalExpiresIn ? new Date(Date.now() + finalExpiresIn * 1000).toISOString() : null;

    const { data: conflict } = await supabase.from('user_meta_tokens').select('user_id').eq('meta_user_id', userInfo.id).neq('user_id', userId).maybeSingle();
    if (conflict) {
      return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: 'Esta conta Meta já está vinculada a outro usuário.' }) } });
    }

    const { error: upErr } = await supabase.from('user_meta_tokens').upsert({
      user_id: userId,
      access_token: finalToken,
      token_type: 'long_lived',
      expires_at: expiresAt,
      scopes: ['ads_management', 'business_management', 'pages_show_list', 'pages_read_engagement', 'pages_manage_ads', 'leads_retrieval'],
      meta_user_id: userInfo.id,
      meta_user_name: userInfo.name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (upErr) {
      return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: 'database_error' }) } });
    }

    await supabase.from('audit_logs').insert({ user_id: userId, action: 'meta_connected', target_type: 'meta_integration', target_id: userInfo.id, details: { meta_user_name: userInfo.name } });

    return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { connected: 'true' }) } });
  } catch (e) {
    console.error('meta-oauth-callback error:', e);
    return new Response(null, { status: 302, headers: { Location: buildRedirect(appUrl, redirectPath, { error: 'server_error' }) } });
  }
});
