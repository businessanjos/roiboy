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
    if (!user) return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const action = body.action as string;

    const { data: tokenData } = await supabase.from('user_meta_tokens').select('access_token').eq('user_id', user.id).maybeSingle();
    if (!tokenData) return new Response(JSON.stringify({ success: false, error: 'Meta não conectado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (action === 'list_pages') {
      const r = await (await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${tokenData.access_token}`)).json();
      if (r.error) return new Response(JSON.stringify({ success: false, error: r.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const fbPages = r.data || [];
      const { data: subs } = await supabase.from('leadads_page_subscriptions').select('page_id, is_active').eq('user_id', user.id);
      const subMap = new Map<string, boolean>((subs || []).map((s: any) => [s.page_id, s.is_active]));
      const pages = fbPages.map((p: any) => ({
        id: p.id, name: p.name, access_token: p.access_token, is_active: subMap.get(p.id) || false,
      }));
      return new Response(JSON.stringify({ success: true, pages }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'subscribe' || action === 'unsubscribe') {
      const { page_id, page_name, page_access_token } = body;
      if (!page_id || !page_access_token) return new Response(JSON.stringify({ success: false, error: 'Dados da página faltando' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const method = action === 'subscribe' ? 'POST' : 'DELETE';
      const r = await (await fetch(`https://graph.facebook.com/v21.0/${page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${page_access_token}`, { method })).json();
      if (r.error) return new Response(JSON.stringify({ success: false, error: r.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (action === 'subscribe') {
        await supabase.from('leadads_page_subscriptions').upsert({
          user_id: user.id, page_id, page_name, page_access_token, is_active: true, updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,page_id' });
      } else {
        await supabase.from('leadads_page_subscriptions').update({ is_active: false, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('page_id', page_id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('manage-leadads-subscription error:', e);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
