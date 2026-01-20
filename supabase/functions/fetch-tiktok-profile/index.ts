import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Robust browser-like headers for better scraping success
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

// Extract username from various TikTok URL formats
function extractUsername(input: string): string | null {
  const trimmed = input.trim();
  
  // If it starts with @, just remove the @
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1).toLowerCase();
  }
  
  // If it has no slashes or dots, it's probably just a username
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed.toLowerCase();
  }
  
  // Try to extract from URL
  const patterns = [
    /tiktok\.com\/@([^/?#]+)/i,
    /tiktok\.com\/([^/?#@]+)/i,
    /vm\.tiktok\.com\/([^/?#]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const username = match[1].toLowerCase();
      // Skip if it's a reserved path
      if (!['explore', 'foryou', 'following', 'live', 'discover', 'tag', 'music', 'video'].includes(username)) {
        return username;
      }
    }
  }
  
  return null;
}

// Fetch public profile data from TikTok with robust headers
async function fetchTikTokProfile(username: string): Promise<{
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  following_count: number;
  videos_count: number;
  likes_count: number;
  bio: string | null;
  dataFetched: boolean;
} | null> {
  try {
    console.log('Fetching TikTok profile for:', username);
    
    const response = await fetch(`https://www.tiktok.com/@${username}`, {
      headers: browserHeaders,
    });

    console.log('TikTok response status:', response.status);

    if (response.ok) {
      const html = await response.text();
      console.log('HTML length received:', html.length);
      
      // Try to extract JSON data from SIGI_STATE
      const sigiMatch = html.match(/<script id="SIGI_STATE" type="application\/json">([^<]+)<\/script>/);
      if (sigiMatch) {
        try {
          const sigiData = JSON.parse(sigiMatch[1]);
          const userModule = sigiData?.UserModule?.users?.[username];
          const statsModule = sigiData?.UserModule?.stats?.[username];
          
          if (userModule && statsModule) {
            console.log('Successfully extracted TikTok profile from SIGI_STATE');
            console.log('Stats:', JSON.stringify(statsModule));
            return {
              username: userModule.uniqueId || username,
              display_name: userModule.nickname || null,
              profile_picture_url: userModule.avatarLarger || userModule.avatarMedium || userModule.avatarThumb || null,
              followers_count: statsModule?.followerCount || 0,
              following_count: statsModule?.followingCount || 0,
              videos_count: statsModule?.videoCount || 0,
              likes_count: statsModule?.heartCount || statsModule?.heart || 0,
              bio: userModule.signature || null,
              dataFetched: true,
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
            console.log('Stats:', JSON.stringify(stats));
            return {
              username: user?.uniqueId || username,
              display_name: user?.nickname || null,
              profile_picture_url: user?.avatarLarger || user?.avatarMedium || null,
              followers_count: stats?.followerCount || 0,
              following_count: stats?.followingCount || 0,
              videos_count: stats?.videoCount || 0,
              likes_count: stats?.heartCount || stats?.heart || 0,
              bio: user?.signature || null,
              dataFetched: true,
            };
          }
        } catch (e) {
          console.log('Failed to parse UNIVERSAL_DATA:', e);
        }
      }

      // Try to extract from meta tags as fallback
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const followersMatch = html.match(/(\d+(?:\.\d+)?[KMB]?)\s*Followers/i);
      const likesMatch = html.match(/(\d+(?:\.\d+)?[KMB]?)\s*Likes/i);
      
      if (titleMatch && (followersMatch || likesMatch)) {
        const displayName = titleMatch[1].replace(/ \| TikTok$/, '').replace(/@\w+/, '').trim();
        
        console.log('Extracted from meta tags');
        return {
          username: username,
          display_name: displayName || username,
          profile_picture_url: null,
          followers_count: parseMetricValue(followersMatch?.[1]),
          following_count: 0,
          videos_count: 0,
          likes_count: parseMetricValue(likesMatch?.[1]),
          bio: null,
          dataFetched: true,
        };
      }
    }

    // Fallback - return null to indicate fetch failed
    console.log('Could not fetch TikTok profile data, fetch failed');
    return null;
  } catch (error) {
    console.error('Error fetching TikTok profile:', error);
    return null;
  }
}

// Parse metric values like "1.2M", "500K", etc.
function parseMetricValue(value: string | undefined): number {
  if (!value) return 0;
  
  const num = parseFloat(value.replace(/,/g, ''));
  if (isNaN(num)) return 0;
  
  const suffix = value.slice(-1).toUpperCase();
  if (suffix === 'K') return Math.round(num * 1000);
  if (suffix === 'M') return Math.round(num * 1000000);
  if (suffix === 'B') return Math.round(num * 1000000000);
  
  return Math.round(num);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileInput, accountId } = await req.json();

    if (!profileInput) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile input is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accountId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Account ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract username from input
    const username = extractUsername(profileInput);
    
    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome de usuário ou URL do TikTok inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing TikTok profile for:', username);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('tiktok_profiles')
      .select('id')
      .eq('account_id', accountId)
      .eq('username', username)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este perfil do TikTok já está cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch public profile data
    const fetchedData = await fetchTikTokProfile(username);
    const dataFetched = fetchedData?.dataFetched || false;

    // Build profile data - NO MANUAL FALLBACK, only fetched data
    const profileData = {
      username: fetchedData?.username || username,
      display_name: fetchedData?.display_name || username,
      profile_picture_url: fetchedData?.profile_picture_url || null,
      followers_count: fetchedData?.followers_count || 0,
      following_count: fetchedData?.following_count || 0,
      videos_count: fetchedData?.videos_count || 0,
      likes_count: fetchedData?.likes_count || 0,
      bio: fetchedData?.bio || null,
    };

    console.log('Profile data to save:', JSON.stringify(profileData));
    console.log('Data was fetched automatically:', dataFetched);

    // Insert the profile
    const { data: newProfile, error: insertError } = await supabase
      .from('tiktok_profiles')
      .insert({
        account_id: accountId,
        username: profileData.username,
        display_name: profileData.display_name,
        profile_picture_url: profileData.profile_picture_url,
        followers_count: profileData.followers_count,
        followers_previous_count: profileData.followers_count,
        following_count: profileData.following_count,
        videos_count: profileData.videos_count,
        likes_count: profileData.likes_count,
        bio: profileData.bio,
        is_active: true,
        last_synced_at: dataFetched ? new Date().toISOString() : null, // Only set if data was actually fetched
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting profile:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('TikTok profile created successfully:', newProfile.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: newProfile,
        message: dataFetched 
          ? 'Perfil do TikTok conectado com dados atualizados!'
          : 'Perfil conectado. Sincronizando dados...',
        dataFetched,
        needsSync: !dataFetched, // Tell frontend to trigger sync
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-tiktok-profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});