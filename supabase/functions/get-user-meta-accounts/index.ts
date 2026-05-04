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
    if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return new Response(JSON.stringify({ success: false, error: 'Usuário não encontrado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tokenData } = await supabase.from('user_meta_tokens').select('*').eq('user_id', user.id).maybeSingle();
    if (!tokenData) {
      return new Response(JSON.stringify({ success: false, error: 'Meta não conectado', needsConnection: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: 'Token expirado', needsConnection: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const r = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,currency&access_token=${tokenData.access_token}`);
    const data = await r.json();
    if (data.error) {
      if (data.error.code === 190) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido', needsConnection: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: data.error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const accounts = (data.data || []).filter((a: any) => a.account_status === 1).map((a: any) => ({
      id: a.id, accountId: a.account_id, name: a.name, currency: a.currency,
    }));

    return new Response(JSON.stringify({ success: true, accounts, metaUser: { id: tokenData.meta_user_id, name: tokenData.meta_user_name } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('get-user-meta-accounts error:', e);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
