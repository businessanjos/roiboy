import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function mapMediaTypeToPostType(mediaType: string, mediaUrl?: string): string {
  if (mediaType === 'VIDEO') {
    // Reels are usually VIDEO with permalink containing /reel/
    return 'reel';
  }
  if (mediaType === 'CAROUSEL_ALBUM') return 'carousel';
  return 'image';
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
        results.failed++;
        results.details.push({
          username: profile.username,
          success: false,
          error: 'Token Meta ou IG Business ID não configurado. Configure em "Configurar Meta API".'
        });
        await supabase.from('instagram_profiles').update({
          last_synced_at: new Date().toISOString(),
          sync_error: 'Credenciais Meta ausentes',
        }).eq('id', profile.id);
        continue;
      }

      // 1) Fetch profile info
      const profRes = await fetchIGProfile(profile.ig_business_account_id, profile.meta_access_token);
      if (profRes.error) {
        results.failed++;
        results.details.push({ username: profile.username, success: false, error: profRes.error });
        await supabase.from('instagram_profiles').update({
          last_synced_at: new Date().toISOString(),
          sync_error: profRes.error,
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
      const mediaRes = await fetchIGMedia(profile.ig_business_account_id, profile.meta_access_token, 25);
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
        const insights = await fetchMediaInsights(media.id, media.media_type, profile.meta_access_token);
        const post_type = mapMediaTypeToPostType(media.media_type, media.media_url);

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

    return new Response(JSON.stringify({
      success: true,
      message: `Sincronização: ${results.synced} perfis, ${results.posts_synced} posts atualizados${results.failed ? `, ${results.failed} falhas` : ''}`,
      ...results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('sync-instagram-profiles error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
