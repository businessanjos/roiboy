import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pickThumb } from "./pickThumb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HIKER_BASE = "https://api.hikerapi.com";

async function hiker(path: string, params: Record<string, string>, key: string) {
  const url = new URL(HIKER_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { "x-access-key": key, accept: "application/json" } });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: res.ok, status: res.status, json, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { username, clientId } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: "username é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cleanUsername = String(username).trim().replace(/^@/, "").toLowerCase();

    const apiKey = Deno.env.get("HIKERAPI_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "HIKERAPI_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) profile
    const prof = await hiker("/v1/user/by/username", { username: cleanUsername }, apiKey);
    if (!prof.ok) {
      const code = (prof.json?.detail || prof.json?.error || "").toString().toLowerCase();
      let friendly = "Falha ao buscar perfil no Instagram.";
      let action: string | null = null;
      if (prof.status === 402 || code.includes("insufficient")) {
        friendly = "Saldo insuficiente na HikerAPI.";
        action = "Recarregue o saldo em https://hikerapi.com/billing e tente novamente.";
      } else if (prof.status === 401 || prof.status === 403) {
        friendly = "Chave da HikerAPI inválida ou sem permissão.";
        action = "Verifique a chave em https://hikerapi.com e atualize o segredo HIKERAPI_KEY.";
      } else if (prof.status === 404) {
        friendly = `Usuário @${cleanUsername} não encontrado no Instagram.`;
      } else if (prof.status === 429) {
        friendly = "Limite de requisições da HikerAPI atingido.";
        action = "Aguarde alguns instantes e tente novamente.";
      } else if (prof.status >= 500) {
        friendly = "A HikerAPI está instável no momento.";
        action = "Tente novamente em alguns minutos.";
      }
      return new Response(JSON.stringify({ error: friendly, action, status: prof.status, details: prof.json || prof.text }), {
        status: prof.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const u = prof.json || {};

    // 2) medias (last 12)
    const medias = await hiker("/v1/user/medias", { user_id: String(u.pk || u.id || ""), amount: "12" }, apiKey);
    const items: any[] = Array.isArray(medias.json) ? medias.json : (medias.json?.items || medias.json?.medias || []);
    const posts = (items || []).slice(0, 12).map((m: any) => ({
      id: m.id || m.pk,
      code: m.code,
      taken_at: m.taken_at,
      like_count: m.like_count ?? null,
      comment_count: m.comment_count ?? null,
      play_count: m.play_count ?? m.view_count ?? null,
      media_type: m.media_type,
      product_type: m.product_type,
      caption: m.caption_text || m.caption?.text || null,
      thumbnail_url: pickThumb(m),
      display_uri: m.display_uri || m.display_url || null,
      video_url: m.video_url || m.video_versions?.[0]?.url || null,
      url: m.code ? `https://www.instagram.com/p/${m.code}/` : null,
    }));

    const snapshot = {
      username: u.username || cleanUsername,
      full_name: u.full_name || null,
      biography: u.biography || null,
      profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || null,
      external_url: u.external_url || null,
      is_verified: !!u.is_verified,
      is_private: !!u.is_private,
      is_business: !!u.is_business,
      category: u.category || u.category_name || null,
      followers_count: u.follower_count ?? u.followers_count ?? 0,
      following_count: u.following_count ?? 0,
      media_count: u.media_count ?? 0,
      posts,
    };

    // Save snapshot if clientId provided
    if (clientId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: client } = await supabase.from("clients").select("account_id").eq("id", clientId).maybeSingle();
      if (client?.account_id) {
        await supabase.from("client_instagram_snapshots").upsert({
          account_id: client.account_id,
          client_id: clientId,
          ...snapshot,
          raw: { profile: u },
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "client_id,username" });
      }
    }

    return new Response(JSON.stringify({ snapshot }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
