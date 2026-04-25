// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate VAPID keys using Web Crypto API
async function generateVapidKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return {
    publicKey: publicKeyBase64,
    privateKeyJwk: JSON.stringify(privateKeyJwk),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET = return public key (for client to subscribe)
    if (req.method === "GET") {
      // Get or create VAPID keys
      let { data: vapidData } = await supabaseAdmin
        .from("vapid_keys")
        .select("public_key")
        .limit(1)
        .maybeSingle();

      if (!vapidData) {
        const keys = await generateVapidKeys();
        const { data: inserted, error } = await supabaseAdmin
          .from("vapid_keys")
          .insert({ public_key: keys.publicKey, private_key: keys.privateKeyJwk })
          .select("public_key")
          .single();

        if (error) throw error;
        vapidData = inserted;
      }

      return new Response(JSON.stringify({ publicKey: vapidData.public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST = save subscription
    if (req.method === "POST") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user record
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id, account_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!userData) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { subscription } = await req.json();

      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return new Response(JSON.stringify({ error: "Invalid subscription" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert subscription
      const { error: upsertError } = await supabaseAdmin
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userData.id,
            account_id: userData.account_id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            user_agent: req.headers.get("user-agent") || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" }
        );

      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE = remove subscription
    if (req.method === "DELETE") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!userData) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { endpoint } = await req.json();

      if (endpoint) {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userData.id)
          .eq("endpoint", endpoint);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
