import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureFreshToken, isExpiredTokenError } from "../_shared/metaToken.ts";
import { runApifyActor } from "../_shared/apify.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API = 'https://graph.facebook.com/v21.0';

interface IGProfileData {
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  follows_count: number;
  media_count: number;
  biography: string | null;
}

async function fetchIGProfile(igBusinessId: string, token: string): Promise<{ data?: IGProfileData; error?: string }> {
  try {
    const fields = 'username,name,profile_picture_url,followers_count,follows_count,media_count,biography';
    const url = `${GRAPH_API}/${igBusinessId}?fields=${fields}&access_token=${token}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok || json.error) {
      return { error: json.error?.message || `HTTP ${res.status}` };
    }

    return {
      data: {
        username: json.username,
        display_name: json.name || null,
        profile_picture_url: json.profile_picture_url || null,
        followers_count: json.followers_count || 0,
        follows_count: json.follows_count || 0,
        media_count: json.media_count || 0,
        biography: json.biography || null,
      }
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

async function fetchIGMedia(igBusinessId: string, token: string, limit = 25): Promise<{ data?: any[]; error?: string }> {
  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
    const url = `${GRAPH_API}/${igBusinessId}/media?fields=${fields}&limit=${limit}&access_token=${token}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok || json.error) {
      return { error: json.error?.message || `HTTP ${res.status}` };
    }

    return { data: json.data || [] };
  } catch (e: any) {
    return { error: e.message };
  }
}

async function fetchMediaInsights(mediaId: string, mediaType: string, token: string): Promise<Record<string, number>> {
  try {
    // Different metrics per media type (per Meta docs v21+)
    let metrics = 'reach,saved,shares';
    if (mediaType === 'VIDEO' || mediaType === 'REELS') {
      metrics = 'reach,saved,shares,views,total_interactions';
    }
    const url = `${GRAPH_API}/${mediaId}/insights?metric=${metrics}&access_token=${token}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.error) return {};

    const out: Record<string, number> = {};
    for (const m of json.data || []) {
      const val = m.values?.[0]?.value;
      if (typeof val === 'number') out[m.name] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function mapMediaTypeToPostType(mediaType: string): string {
  if (mediaType === 'VIDEO' || mediaType === 'REELS') return 'reels';
  if (mediaType === 'CAROUSEL_ALBUM') return 'carousel';
  return 'static';
}

// Fallback público via Apify: seguidores, bio e posts recentes (sem alcance/salvamentos, que só a Meta fornece).
async function syncViaApify(supabase: any, profile: any): Promise<{ ok: boolean; posts: number; error?: string }> {
  try {
    const items = await runApifyActor('apify~instagram-profile-scraper', { usernames: [profile.username], resultsLimit: 30 });
    const ig = items[0];
    if (!ig || ig.error) return { ok: false, posts: 0, error: ig?.errorDescription || ig?.error || 'Perfil não retornado pelo Apify' };

    const isCustomAvatar = profile.profile_picture_url?.includes('supabase.co/storage');
    await supabase.from('instagram_profiles').update({
      display_name: ig.fullName || profile.display_name,
      profile_picture_url: isCustomAvatar ? profile.profile_picture_url : (ig.profilePicUrlHD || ig.profilePicUrl || profile.profile_picture_url),
      followers_previous_count: profile.followers_count,
      followers_count: ig.followersCount ?? profile.followers_count,
      following_count: ig.followsCount ?? profile.following_count,
      posts_count: ig.postsCount ?? profile.posts_count,
      bio: ig.biography || profile.bio,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id);

    let posts = 0;
    let postItems: any[] = ig.latestPosts || [];
    if (!postItems.length) {
      try {
        postItems = await runApifyActor('apify~instagram-scraper', {
          directUrls: [`https://www.instagram.com/${profile.username}/`], resultsType: 'posts', resultsLimit: 30,
        }, 150);
      } catch (e: any) { console.error(`Apify posts ${profile.username}: ${e.message}`); }
    }
    for (const p of postItems) {
      const code = p.shortCode;
      if (!code || p.error) continue;
      const type = String(p.type || '');
      const row: Record<string, unknown> = {
        profile_id: profile.id,
        instagram_id: code,
        post_type: type === 'Video' ? 'reels' : type === 'Sidecar' ? 'carousel' : 'static',
        caption: p.caption || null,
        permalink: p.url || `https://www.instagram.com/p/${code}/`,
        posted_at: p.timestamp,
        updated_at: new Date().toISOString(),
      };
      if (typeof p.likesCount === 'number' && p.likesCount >= 0) row.likes = p.likesCount;
      if (typeof p.commentsCount === 'number' && p.commentsCount >= 0) row.comments = p.commentsCount;
      if (p.videoViewCount || p.videoPlayCount) row.views = p.videoPlayCount || p.videoViewCount;
      const { error } = await supabase.from('instagram_posts').upsert(row, { onConflict: 'profile_id,instagram_id' });
      if (!error) posts++;
      else console.error(`Apify upsert ${code}: ${error.message}`);
    }
    return { ok: true, posts };
  } catch (e: any) {
    return { ok: false, posts: 0, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, profileId } = await req.json();
    if (!accountId) {
      return new Response(JSON.stringify({ success: false, error: 'Account ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let query = supabase.from('instagram_profiles').select('*').eq('account_id', accountId).eq('is_active', true);
    if (profileId) query = query.eq('id', profileId);

    const { data: profiles, error: fetchError } = await query;
    if (fetchError) {
      return new Response(JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No profiles to sync', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = { synced: 0, failed: 0, posts_synced: 0, details: [] as any[] };

    for (const profile of profiles) {
      console.log(`Syncing profile: ${profile.username}`);

      // Skip profiles without Meta credentials
      if (!profile.meta_access_token || !profile.ig_business_account_id) {
        const fb = await syncViaApify(supabase, profile);
        if (fb.ok) {
          results.synced++;
          results.posts_synced += fb.posts;
          results.details.push({ username: profile.username, success: true, posts: fb.posts, source: 'apify' });
          continue;
        }
        results.failed++;
        results.details.push({ username: profile.username, success: false, error: `Sem Meta e busca pública falhou: ${fb.error}` });
        await supabase.from('instagram_profiles').update({
          last_synced_at: new Date().toISOString(),
          sync_error: `Credenciais Meta ausentes; busca pública falhou (${fb.error})`,
        }).eq('id', profile.id);
        continue;
      }

      // 0) Garante token de longa duração válido (renova se estiver perto de expirar)
      const fresh = await ensureFreshToken(supabase, profile);
      let token = fresh.token || profile.meta_access_token;

      // 1) Fetch profile info
      let profRes = await fetchIGProfile(profile.ig_business_account_id, token);

      // Se o token falhou por expiração, tenta renovar e refazer a chamada uma vez
      if (profRes.error && isExpiredTokenError(profRes.error)) {
        const forced = await ensureFreshToken(supabase, { ...profile, meta_access_token: token }, { force: true });
        if (forced.token) {
          token = forced.token;
          profRes = await fetchIGProfile(profile.ig_business_account_id, token);
        }
      }

      if (profRes.error) {
        const fb = await syncViaApify(supabase, profile);
        if (fb.ok) {
          results.synced++;
          results.posts_synced += fb.posts;
          results.details.push({ username: profile.username, success: true, posts: fb.posts, source: 'apify', meta_error: profRes.error });
          continue;
        }
        results.failed++;
        results.details.push({ username: profile.username, success: false, error: profRes.error });
        await supabase.from('instagram_profiles').update({
          last_synced_at: new Date().toISOString(),
          sync_error: isExpiredTokenError(profRes.error)
            ? `Token Meta expirado — reconecte em "Configurar Meta API"`
            : profRes.error,
        }).eq('id', profile.id);
        continue;
      }


      const ig = profRes.data!;
      const isCustomAvatar = profile.profile_picture_url?.includes('supabase.co/storage');
      const newProfilePictureUrl = isCustomAvatar ? profile.profile_picture_url : (ig.profile_picture_url || profile.profile_picture_url);

      await supabase.from('instagram_profiles').update({
        display_name: ig.display_name || profile.display_name,
        profile_picture_url: newProfilePictureUrl,
        followers_previous_count: profile.followers_count,
        followers_count: ig.followers_count,
        following_count: ig.follows_count,
        posts_count: ig.media_count,
        bio: ig.biography || profile.bio,
        last_synced_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);

      // 2) Fetch recent media
      const mediaRes = await fetchIGMedia(profile.ig_business_account_id, token, 25);
      if (mediaRes.error) {
        results.synced++;
        results.details.push({
          username: profile.username,
          success: true,
          warning: `Perfil sincronizado mas posts falharam: ${mediaRes.error}`
        });
        continue;
      }

      let postsSynced = 0;
      for (const media of mediaRes.data || []) {
        const insights = await fetchMediaInsights(media.id, media.media_type, token);
        const post_type = mapMediaTypeToPostType(media.media_type);

        const postRow = {
          profile_id: profile.id,
          instagram_id: media.id,
          post_type,
          caption: media.caption || null,
          thumbnail_url: media.thumbnail_url || media.media_url || null,
          permalink: media.permalink || null,
          posted_at: media.timestamp,
          likes: media.like_count || 0,
          comments: media.comments_count || 0,
          reach: insights.reach || 0,
          saves: insights.saved || 0,
          shares: insights.shares || 0,
          views: insights.views || 0,
          updated_at: new Date().toISOString(),
        };

        // Upsert by (profile_id, instagram_id)
        const { error: upErr } = await supabase
          .from('instagram_posts')
          .upsert(postRow, { onConflict: 'profile_id,instagram_id' });

        if (!upErr) postsSynced++;
        else console.error(`Error upserting media ${media.id}: ${upErr.message}`);

        await new Promise(r => setTimeout(r, 150));
      }

      results.synced++;
      results.posts_synced += postsSynced;
      results.details.push({ username: profile.username, success: true, posts: postsSynced });
      console.log(`Synced ${profile.username}: ${postsSynced} posts`);

      await new Promise(r => setTimeout(r, 300));
    }

    // Miniaturas públicas são copiadas para o Storage mesmo quando a Meta está desconectada.
    let thumbnails: any = null;
    try {
      const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const cacheRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cache-instagram-post-thumbnails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ accountId, profileId: profileId || undefined, limit: 40 }),
      });
      thumbnails = await cacheRes.json();
    } catch (cacheError: any) {
      console.error('Thumbnail cache error:', cacheError);
      thumbnails = { success: false, error: cacheError?.message || String(cacheError) };
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Sincronização: ${results.synced} perfis, ${results.posts_synced} posts atualizados${results.failed ? `, ${results.failed} falhas` : ''}`,
      ...results,
      thumbnails,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('sync-instagram-profiles error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
