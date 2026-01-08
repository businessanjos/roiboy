import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract username from various Instagram URL formats
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
    /instagram\.com\/([^/?#]+)/i,
    /instagr\.am\/([^/?#]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const username = match[1].toLowerCase();
      // Skip if it's a reserved path
      if (!['p', 'reel', 'stories', 'explore', 'reels', 'tv', 'live', 'direct', 'accounts'].includes(username)) {
        return username;
      }
    }
  }
  
  return null;
}

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

    // Method 3: Fallback - just return basic info
    console.log('Could not fetch Instagram profile data, using fallback');
    return {
      username: username,
      display_name: username,
      profile_picture_url: null,
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      bio: null,
    };
  } catch (error) {
    console.error('Error fetching Instagram profile:', error);
    // Return basic info even on error
    return {
      username: username,
      display_name: username,
      profile_picture_url: null,
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      bio: null,
    };
  }
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
        JSON.stringify({ success: false, error: 'Invalid Instagram username or URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Instagram profile for:', username);

    // Fetch public profile data
    const profileData = await fetchInstagramProfile(username);

    if (!profileData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch Instagram profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('instagram_profiles')
      .select('id')
      .eq('account_id', accountId)
      .eq('username', username)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este perfil já está cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the profile
    const { data: newProfile, error: insertError } = await supabase
      .from('instagram_profiles')
      .insert({
        account_id: accountId,
        username: profileData.username,
        display_name: profileData.display_name,
        profile_picture_url: profileData.profile_picture_url,
        followers_count: profileData.followers_count,
        followers_previous_count: profileData.followers_count, // Same as current initially
        following_count: profileData.following_count,
        posts_count: profileData.posts_count,
        bio: profileData.bio,
        is_active: true,
        last_synced_at: new Date().toISOString(),
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

    console.log('Profile created successfully:', newProfile.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: newProfile,
        message: 'Perfil adicionado com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-instagram-profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
