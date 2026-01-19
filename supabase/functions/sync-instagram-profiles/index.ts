import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch public profile data from Instagram
async function fetchInstagramProfile(username: string): Promise<{
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  bio: string | null;
} | null> {
  try {
    // Method 1: Try using the Instagram web endpoint
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'X-IG-App-ID': '936619743392459',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const user = data?.data?.user;
      
      if (user) {
        return {
          username: user.username || username,
          display_name: user.full_name || null,
          profile_picture_url: user.profile_pic_url_hd || user.profile_pic_url || null,
          followers_count: user.edge_followed_by?.count || 0,
          following_count: user.edge_follow?.count || 0,
          posts_count: user.edge_owner_to_timeline_media?.count || 0,
          bio: user.biography || null,
        };
      }
    }

    // Method 2: Try the GraphQL endpoint
    const graphqlResponse = await fetch(`https://www.instagram.com/${username}/?__a=1&__d=dis`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    });

    if (graphqlResponse.ok) {
      const text = await graphqlResponse.text();
      try {
        const data = JSON.parse(text);
        const user = data?.graphql?.user || data?.user;
        
        if (user) {
          return {
            username: user.username || username,
            display_name: user.full_name || null,
            profile_picture_url: user.profile_pic_url_hd || user.profile_pic_url || null,
            followers_count: user.edge_followed_by?.count || user.follower_count || 0,
            following_count: user.edge_follow?.count || user.following_count || 0,
            posts_count: user.edge_owner_to_timeline_media?.count || user.media_count || 0,
            bio: user.biography || null,
          };
        }
      } catch {
        // JSON parse failed, continue to fallback
      }
    }

    console.log(`Could not fetch Instagram profile data for ${username}`);
    return null;
  } catch (error) {
    console.error(`Error fetching Instagram profile ${username}:`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId, profileId } = await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Account ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query to get profiles
    let query = supabase
      .from('instagram_profiles')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true);
    
    // If a specific profile ID is provided, only sync that one
    if (profileId) {
      query = query.eq('id', profileId);
    }

    const { data: profiles, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No profiles to sync', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing ${profiles.length} profiles for account ${accountId}`);

    const results = {
      synced: 0,
      failed: 0,
      details: [] as { username: string; success: boolean; error?: string }[],
    };

    // Sync each profile
    for (const profile of profiles) {
      try {
        console.log(`Syncing profile: ${profile.username}`);
        
        const instagramData = await fetchInstagramProfile(profile.username);
        
        if (instagramData && (instagramData.followers_count > 0 || instagramData.display_name)) {
          // Preservar imagem customizada (do nosso storage) se existir
          // Imagens do Supabase Storage contêm 'supabase.co/storage' na URL
          const isCustomAvatar = profile.profile_picture_url?.includes('supabase.co/storage');
          const newProfilePictureUrl = isCustomAvatar 
            ? profile.profile_picture_url 
            : (instagramData.profile_picture_url || profile.profile_picture_url);

          // Update profile with new data
          const { error: updateError } = await supabase
            .from('instagram_profiles')
            .update({
              display_name: instagramData.display_name || profile.display_name,
              profile_picture_url: newProfilePictureUrl,
              followers_previous_count: profile.followers_count, // Store previous count
              followers_count: instagramData.followers_count,
              following_count: instagramData.following_count,
              posts_count: instagramData.posts_count,
              bio: instagramData.bio || profile.bio,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          if (updateError) {
            console.error(`Error updating profile ${profile.username}:`, updateError);
            results.failed++;
            results.details.push({ username: profile.username, success: false, error: updateError.message });
          } else {
            results.synced++;
            results.details.push({ username: profile.username, success: true });
            console.log(`Successfully synced ${profile.username}`);
          }
        } else {
          // Just update last_synced_at to show we tried
          await supabase
            .from('instagram_profiles')
            .update({
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', profile.id);
          
          results.failed++;
          results.details.push({ 
            username: profile.username, 
            success: false, 
            error: 'Não foi possível acessar os dados públicos do Instagram' 
          });
          console.log(`Could not fetch data for ${profile.username}`);
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error syncing profile ${profile.username}:`, error);
        results.failed++;
        results.details.push({ 
          username: profile.username, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`Sync complete: ${results.synced} synced, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização concluída: ${results.synced} perfis atualizados, ${results.failed} falhas`,
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-instagram-profiles:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
