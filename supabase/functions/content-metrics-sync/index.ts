import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Account = {
  id: string;
  account_id: string;
  talent_id: string;
  platform: string;
  handle: string | null;
  external_id: string | null;
  access_token: string | null;
  extra: any;
};

async function syncInstagram(db: any, acc: Account) {
  // IG Business/Creator via Graph API. Requires: external_id = IG Business User ID, access_token = long-lived user token.
  if (!acc.external_id || !acc.access_token) throw new Error("Instagram requer IG User ID e access token");
  const base = `https://graph.facebook.com/v20.0`;

  const profile = await fetch(`${base}/${acc.external_id}?fields=followers_count,media_count,username&access_token=${acc.access_token}`).then(r => r.json());
  if (profile.error) throw new Error(profile.error.message);

  const mediaRes = await fetch(`${base}/${acc.external_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25&access_token=${acc.access_token}`).then(r => r.json());
  if (mediaRes.error) throw new Error(mediaRes.error.message);

  let synced = 0;
  for (const m of mediaRes.data || []) {
    const { data: post } = await db.from("content_platform_posts").upsert({
      account_id: acc.account_id, talent_id: acc.talent_id, platform_account_id: acc.id,
      platform: "instagram", external_id: m.id, url: m.permalink,
      thumbnail_url: m.thumbnail_url || m.media_url, caption: m.caption, media_type: m.media_type,
      published_at: m.timestamp, raw: m,
    }, { onConflict: "platform_account_id,external_id" }).select().single();
    if (!post) continue;

    const metricNames = m.media_type === "VIDEO" || m.media_type === "REELS"
      ? "reach,likes,comments,shares,saved,video_views,total_interactions"
      : "reach,likes,comments,shares,saved,total_interactions";
    const insRes = await fetch(`${base}/${m.id}/insights?metric=${metricNames}&access_token=${acc.access_token}`).then(r => r.json()).catch(() => ({}));
    const vals: Record<string, number> = {};
    for (const x of insRes.data || []) vals[x.name] = x.values?.[0]?.value || 0;

    const likes = vals.likes || 0, comments = vals.comments || 0, saves = vals.saved || 0, shares = vals.shares || 0;
    const reach = vals.reach || 0;
    const eng = likes + comments + saves + shares;
    await db.from("content_platform_metrics").insert({
      account_id: acc.account_id, post_id: post.id,
      views: vals.video_views || vals.reach || 0, reach, impressions: vals.reach || 0,
      likes, comments, shares, saves,
      engagement_rate: reach > 0 ? eng / reach : null,
      raw: vals,
    });
    synced++;
  }

  await db.from("content_platform_metric_snapshots").upsert({
    account_id: acc.account_id, platform_account_id: acc.id, talent_id: acc.talent_id,
    platform: "instagram", snapshot_date: new Date().toISOString().slice(0,10),
    followers: profile.followers_count, raw: profile,
  }, { onConflict: "platform_account_id,snapshot_date" });

  return synced;
}

async function syncYouTube(db: any, acc: Account) {
  // YouTube Data API v3. Requires: external_id = channelId, access_token = API Key
  if (!acc.external_id || !acc.access_token) throw new Error("YouTube requer Channel ID e API Key");
  const key = acc.access_token;
  const ch = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${acc.external_id}&key=${key}`).then(r => r.json());
  if (ch.error) throw new Error(ch.error.message);
  const uploadsId = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  const followers = Number(ch.items?.[0]?.statistics?.subscriberCount || 0);
  const totalViews = Number(ch.items?.[0]?.statistics?.viewCount || 0);
  if (!uploadsId) throw new Error("Canal sem uploads");

  const list = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=25&key=${key}`).then(r => r.json());
  const videoIds = (list.items || []).map((i: any) => i.contentDetails.videoId).join(",");
  if (!videoIds) return 0;
  const vids = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds}&key=${key}`).then(r => r.json());

  let synced = 0;
  for (const v of vids.items || []) {
    const stats = v.statistics || {};
    const { data: post } = await db.from("content_platform_posts").upsert({
      account_id: acc.account_id, talent_id: acc.talent_id, platform_account_id: acc.id,
      platform: "youtube", external_id: v.id, url: `https://youtu.be/${v.id}`,
      thumbnail_url: v.snippet?.thumbnails?.high?.url, caption: v.snippet?.title,
      media_type: v.contentDetails?.duration?.startsWith("PT") && /M|H/.test(v.contentDetails.duration) ? "video" : "short",
      published_at: v.snippet?.publishedAt, raw: v,
    }, { onConflict: "platform_account_id,external_id" }).select().single();
    if (!post) continue;

    const views = Number(stats.viewCount || 0), likes = Number(stats.likeCount || 0), comments = Number(stats.commentCount || 0);
    await db.from("content_platform_metrics").insert({
      account_id: acc.account_id, post_id: post.id,
      views, reach: views, impressions: views, likes, comments,
      engagement_rate: views > 0 ? (likes + comments) / views : null,
      raw: stats,
    });
    synced++;
  }

  await db.from("content_platform_metric_snapshots").upsert({
    account_id: acc.account_id, platform_account_id: acc.id, talent_id: acc.talent_id,
    platform: "youtube", snapshot_date: new Date().toISOString().slice(0,10),
    followers, total_views: totalViews, raw: ch.items?.[0]?.statistics,
  }, { onConflict: "platform_account_id,snapshot_date" });

  return synced;
}

async function syncTikTok(db: any, acc: Account) {
  // TikTok Display API. Requires access_token (user OAuth)
  if (!acc.access_token) throw new Error("TikTok requer access token (OAuth)");
  const fields = "id,title,video_description,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time";
  const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${fields}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${acc.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_count: 20 }),
  }).then(r => r.json());
  if (res.error?.code && res.error.code !== "ok") throw new Error(res.error.message || "TikTok error");

  let synced = 0;
  for (const v of res.data?.videos || []) {
    const { data: post } = await db.from("content_platform_posts").upsert({
      account_id: acc.account_id, talent_id: acc.talent_id, platform_account_id: acc.id,
      platform: "tiktok", external_id: String(v.id), url: v.share_url,
      thumbnail_url: v.cover_image_url, caption: v.title || v.video_description, media_type: "video",
      published_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null, raw: v,
    }, { onConflict: "platform_account_id,external_id" }).select().single();
    if (!post) continue;
    const views = v.view_count || 0, likes = v.like_count || 0, comments = v.comment_count || 0, shares = v.share_count || 0;
    await db.from("content_platform_metrics").insert({
      account_id: acc.account_id, post_id: post.id,
      views, reach: views, impressions: views, likes, comments, shares,
      avg_watch_seconds: v.duration ? v.duration * 0.5 : null,
      engagement_rate: views > 0 ? (likes + comments + shares) / views : null,
      raw: v,
    });
    synced++;
  }
  return synced;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { account_ids } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_ROLE);
    let query = db.from("content_platform_accounts").select("*").eq("status", "connected");
    if (account_ids?.length) query = query.in("id", account_ids);
    const { data: accounts, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const acc of accounts || []) {
      try {
        let synced = 0;
        if (acc.platform === "instagram") synced = await syncInstagram(db, acc);
        else if (acc.platform === "youtube") synced = await syncYouTube(db, acc);
        else if (acc.platform === "tiktok") synced = await syncTikTok(db, acc);
        else continue;
        await db.from("content_platform_accounts").update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("id", acc.id);
        results.push({ id: acc.id, platform: acc.platform, synced });
      } catch (e: any) {
        await db.from("content_platform_accounts").update({ last_sync_error: e.message, status: "error" }).eq("id", acc.id);
        results.push({ id: acc.id, platform: acc.platform, error: e.message });
      }
    }
    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
