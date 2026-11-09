import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { runApifyActor } from "../_shared/apify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  accountId: z.string().uuid(),
  channelId: z.string().uuid().optional(),
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function parseDuration(d: unknown): number | null {
  if (typeof d === "number") return Math.round(d);
  if (typeof d !== "string" || !d) return null;
  const parts = d.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v.replace(/[^\d]/g, "")); return isNaN(n) ? 0 : n; }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return response({ success: false, error: "Dados inválidos" }, 400);
    const { accountId, channelId } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (!token) return response({ success: false, error: "Não autorizado" }, 401);
    const supabase = createClient(supabaseUrl, serviceRole);

    if (token !== serviceRole) {
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: claims, error } = await authClient.auth.getClaims(token);
      const userId = claims?.claims?.sub;
      if (error || !userId) return response({ success: false, error: "Sessão inválida" }, 401);
      const { data: member } = await supabase.from("users").select("id")
        .eq("auth_user_id", userId).eq("account_id", accountId).eq("is_active", true).maybeSingle();
      if (!member) return response({ success: false, error: "Acesso negado" }, 403);
    }

    let q = supabase.from("youtube_channels").select("*").eq("account_id", accountId).eq("is_active", true);
    if (channelId) q = q.eq("id", channelId);
    const { data: channels, error: chErr } = await q;
    if (chErr) return response({ success: false, error: chErr.message }, 500);

    const details: any[] = [];
    let videosSynced = 0;
    for (const ch of channels || []) {
      try {
        const base = ch.channel_id ? `https://www.youtube.com/channel/${ch.channel_id}` : `https://www.youtube.com/@${ch.username}`;
        const items = await runApifyActor("streamers~youtube-scraper", {
          startUrls: [{ url: `${base}/videos` }],
          maxResults: 30,
          maxResultsShorts: 20,
          maxResultStreams: 5,
        }, 150);
        if (!items.length) throw new Error("Nenhum vídeo retornado");

        const first = items.find((i) => i.numberOfSubscribers != null || i.channelTotalVideos != null) || items[0];
        await supabase.from("youtube_channels").update({
          display_name: first.channelName || ch.display_name,
          profile_picture_url: ch.profile_picture_url || first.channelAvatarUrl || null,
          subscribers_previous_count: ch.subscribers_count,
          subscribers_count: num(first.numberOfSubscribers) || ch.subscribers_count,
          videos_count: num(first.channelTotalVideos) || ch.videos_count,
          total_views: num(first.channelTotalViews) || ch.total_views,
          bio: first.channelDescription || ch.bio,
          channel_id: ch.channel_id || first.channelId || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", ch.id);

        const { data: existing } = await supabase.from("youtube_videos").select("id, youtube_id, video_url").eq("channel_id", ch.id);
        let count = 0;
        for (const v of items) {
          const ytId = v.id as string | undefined;
          if (!ytId) continue;
          const url = v.url || `https://www.youtube.com/watch?v=${ytId}`;
          const type = String(v.type || "").toLowerCase();
          const video_type = /short/.test(type) || /\/shorts\//.test(url) ? "short" : /stream|live/.test(type) ? "live" : "video";
          const views = num(v.viewCount);
          const likes = num(v.likes);
          const comments = num(v.commentsCount);
          const row = {
            account_id: accountId,
            channel_id: ch.id,
            youtube_id: ytId,
            video_url: url,
            title: v.title || null,
            caption: v.text || null,
            thumbnail_url: v.thumbnailUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
            posted_at: v.date || null,
            duration_seconds: parseDuration(v.duration),
            video_type,
            views, likes, comments,
            engagement_rate: views > 0 ? ((likes + comments) / views) * 100 : 0,
            updated_at: new Date().toISOString(),
          };
          const match = (existing || []).find((e) => e.youtube_id === ytId || (e.video_url && e.video_url.includes(ytId)));
          const { error } = match
            ? await supabase.from("youtube_videos").update(row).eq("id", match.id)
            : await supabase.from("youtube_videos").insert(row);
          if (!error) count++; else console.error(`video ${ytId}: ${error.message}`);
        }
        videosSynced += count;
        details.push({ username: ch.username, success: true, videos: count });
      } catch (e: any) {
        console.error(`sync youtube ${ch.username}:`, e.message);
        details.push({ username: ch.username, success: false, error: e.message });
      }
    }

    const ok = details.filter((d) => d.success).length;
    return response({ success: true, synced: ok, failed: details.length - ok, videos_synced: videosSynced, details,
      message: `${ok} canal(is) atualizado(s), ${videosSynced} vídeos` });
  } catch (e: any) {
    console.error("sync-youtube-channels error", e);
    return response({ success: false, error: e.message || "Erro interno" }, 500);
  }
});
