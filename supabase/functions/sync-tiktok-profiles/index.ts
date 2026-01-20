import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch public profile data from TikTok
async function fetchTikTokProfile(username: string): Promise<{
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  following_count: number;
  videos_count: number;
  likes_count: number;
  bio: string | null;
} | null> {
  try {
    console.log('Syncing TikTok profile for:', username);
    
    // Method 1: Try TikTok web page parsing
    const response = await fetch(`https://www.tiktok.com/@${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (response.ok) {
      const html = await response.text();
      
      // Try to extract JSON data from SIGI_STATE
      const sigiMatch = html.match(/<script id="SIGI_STATE" type="application\/json">([^<]+)<\/script>/);
      if (sigiMatch) {
        try {
          const sigiData = JSON.parse(sigiMatch[1]);
          const userModule = sigiData?.UserModule?.users?.[username];
          const statsModule = sigiData?.UserModule?.stats?.[username];
          
          if (userModule) {
            console.log('Successfully extracted TikTok profile from SIGI_STATE');
            return {
              display_name: userModule.nickname || null,
              profile_picture_url: userModule.avatarLarger || userModule.avatarMedium || null,
              followers_count: statsModule?.followerCount || 0,
              following_count: statsModule?.followingCount || 0,
              videos_count: statsModule?.videoCount || 0,
              likes_count: statsModule?.heartCount || statsModule?.heart || 0,
              bio: userModule.signature || null,
            };
          }
        } catch (e) {
          console.log('Failed to parse SIGI_STATE:', e);
        }
      }

      // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
      const universalMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/);
      if (universalMatch) {
        try {
          const universalData = JSON.parse(universalMatch[1]);
          const defaultScope = universalData?.["__DEFAULT_SCOPE__"];
          const userDetail = defaultScope?.["webapp.user-detail"]?.userInfo;
          
          if (userDetail) {
            const user = userDetail.user;
            const stats = userDetail.stats;
            
            console.log('Successfully extracted TikTok profile from UNIVERSAL_DATA');
            return {
              display_name: user?.nickname || null,
              profile_picture_url: user?.avatarLarger || user?.avatarMedium || null,
              followers_count: stats?.followerCount || 0,
              following_count: stats?.followingCount || 0,
              videos_count: stats?.videoCount || 0,
              likes_count: stats?.heartCount || stats?.heart || 0,
              bio: user?.signature || null,
            };
          }
        } catch (e) {
          console.log('Failed to parse UNIVERSAL_DATA:', e);
        }
      }
    }

    console.log('Could not fetch TikTok profile data for sync');
    return null;
  } catch (error) {
    console.error('Error fetching TikTok profile:', error);
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

    // Build query for profiles to sync
    let query = supabase
      .from('tiktok_profiles')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true);
    
    // If specific profile, only sync that one
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

    console.log(`Syncing ${profiles.length} TikTok profile(s)`);

    const results = [];
    
    for (const profile of profiles) {
      const fetchedData = await fetchTikTokProfile(profile.username);
      
      if (fetchedData && (fetchedData.followers_count > 0 || fetchedData.videos_count > 0)) {
        // Check if profile picture is from our storage (custom upload) - preserve it
        const isCustomAvatar = profile.profile_picture_url?.includes('supabase') || 
                               profile.profile_picture_url?.includes('storage');
        
        const updateData: Record<string, unknown> = {
          followers_previous_count: profile.followers_count, // Save current as previous
          followers_count: fetchedData.followers_count,
          following_count: fetchedData.following_count,
          videos_count: fetchedData.videos_count,
          likes_count: fetchedData.likes_count,
          bio: fetchedData.bio || profile.bio,
          display_name: fetchedData.display_name || profile.display_name,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Only update profile picture if not custom and we have new data
        if (!isCustomAvatar && fetchedData.profile_picture_url) {
          updateData.profile_picture_url = fetchedData.profile_picture_url;
        }

        const { error: updateError } = await supabase
          .from('tiktok_profiles')
          .update(updateData)
          .eq('id', profile.id);

        if (updateError) {
          console.error(`Error updating profile ${profile.username}:`, updateError);
          results.push({ username: profile.username, success: false, error: updateError.message });
        } else {
          console.log(`Successfully synced profile: ${profile.username}`);
          results.push({ 
            username: profile.username, 
            success: true, 
            newFollowers: fetchedData.followers_count,
            previousFollowers: profile.followers_count,
            growth: fetchedData.followers_count - profile.followers_count
          });
        }
      } else {
        console.log(`No new data for profile: ${profile.username}`);
        
        // Update last_synced_at even if no data fetched
        await supabase
          .from('tiktok_profiles')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', profile.id);
          
        results.push({ 
          username: profile.username, 
          success: true, 
          message: 'No new data available' 
        });
      }
    }

    const syncedCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncedCount,
        total: profiles.length,
        results,
        message: `${syncedCount} perfil(s) sincronizado(s) com sucesso!`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-tiktok-profiles:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
