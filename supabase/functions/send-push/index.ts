// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Create JWT for VAPID
async function createVapidJwt(
  privateKeyJwk: JsonWebKey,
  audience: string,
  subject: string
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const encodedHeader = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signInput
  );

  // Convert DER signature to raw r||s format
  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32);
  } else {
    // DER format
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32, 64);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 32 - r.length);
  rawSig.set(s, 64 - s.length);

  const encodedSig = uint8ArrayToBase64url(rawSig);

  return `${encodedHeader}.${encodedPayload}.${encodedSig}`;
}

// Send a single Web Push notification
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKeyJwk: JsonWebKey
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    // Generate ECDH key pair for encryption
    const localKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    const localPublicKeyRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
    );

    // Import subscriber's public key
    const subscriberPublicKey = await crypto.subtle.importKey(
      "raw",
      base64urlToUint8Array(subscription.p256dh),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "ECDH", public: subscriberPublicKey },
        localKeyPair.privateKey,
        256
      )
    );

    const authSecret = base64urlToUint8Array(subscription.auth);
    const subscriberPublicKeyRaw = base64urlToUint8Array(subscription.p256dh);

    // HKDF-based key derivation (RFC 8291)
    const prk = await hkdfExtract(authSecret, sharedSecret);
    
    const keyInfoPrefix = new TextEncoder().encode("WebPush: info\0");
    const keyInfo = new Uint8Array(keyInfoPrefix.length + subscriberPublicKeyRaw.length + localPublicKeyRaw.length);
    keyInfo.set(keyInfoPrefix);
    keyInfo.set(subscriberPublicKeyRaw, keyInfoPrefix.length);
    keyInfo.set(localPublicKeyRaw, keyInfoPrefix.length + subscriberPublicKeyRaw.length);

    const ikm = await hkdfExpand(prk, keyInfo, 32);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const contentPrk = await hkdfExtract(salt, ikm);
    
    const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
    const contentKey = await hkdfExpand(contentPrk, cekInfo, 16);

    const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
    const nonce = await hkdfExpand(contentPrk, nonceInfo, 12);

    // Encrypt payload
    const payloadBytes = new TextEncoder().encode(payload);
    const paddedPayload = new Uint8Array(payloadBytes.length + 2);
    paddedPayload.set(payloadBytes);
    paddedPayload[payloadBytes.length] = 2; // delimiter

    const encryptionKey = await crypto.subtle.importKey(
      "raw",
      contentKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce },
        encryptionKey,
        paddedPayload
      )
    );

    // Build aes128gcm body
    const recordSize = encrypted.length + 86;
    const header = new Uint8Array(86);
    header.set(salt, 0); // 16 bytes salt
    // 4 bytes record size (big-endian)
    const dv = new DataView(header.buffer);
    dv.setUint32(16, recordSize, false);
    header[20] = 65; // key length
    header.set(localPublicKeyRaw, 21); // 65 bytes public key

    const body = new Uint8Array(header.length + encrypted.length);
    body.set(header);
    body.set(encrypted, header.length);

    // Create VAPID authorization
    const jwt = await createVapidJwt(vapidPrivateKeyJwk, audience, "mailto:push@royapp.com.br");
    const vapidPubKeyRaw = base64urlToUint8Array(vapidPublicKey);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": body.length.toString(),
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body,
    });

    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const input = new Uint8Array(info.length + 1);
  input.set(info);
  input[info.length] = 1;
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
  return output.slice(0, length);
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

    const { user_id, account_id, title, body, url, tag, category, sector_id } = await req.json();

    if ((!user_id && !account_id) || !title) {
      return new Response(JSON.stringify({ error: "user_id or account_id, and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get VAPID keys
    const { data: vapidData } = await supabaseAdmin
      .from("vapid_keys")
      .select("public_key, private_key")
      .limit(1)
      .single();

    if (!vapidData) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured. A user needs to enable push notifications first." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get subscriptions: by user_id or by account_id (all users in account)
    let subscriptionsQuery = supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id");
    
    if (user_id) {
      subscriptionsQuery = subscriptionsQuery.eq("user_id", user_id);
    } else if (account_id) {
      subscriptionsQuery = subscriptionsQuery.eq("account_id", account_id);
    }
    
    const { data: subscriptions } = await subscriptionsQuery;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No push subscriptions for this user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // When category is provided (e.g. from uazapi-webhook), filter by user preferences
    // Map category to the preference column name
    const categoryColumnMap: Record<string, string> = {
      zapp_messages: "notify_zapp_messages",
      task_assigned: "notify_task_assigned",
      mentions: "notify_mentions",
      system_alerts: "notify_system_alerts",
    };

    // Build a set of user_ids that should be skipped based on preferences
    const skipUserIds = new Set<string>();

    if (category && account_id) {
      // Get unique user_ids from subscriptions
      const uniqueUserIds = [...new Set(subscriptions.map((s: any) => s.user_id).filter(Boolean))];

      if (uniqueUserIds.length > 0) {
        const prefColumn = categoryColumnMap[category];

        const { data: prefs } = await supabaseAdmin
          .from("push_notification_preferences")
          .select("user_id, notify_zapp_messages, notify_task_assigned, notify_mentions, notify_system_alerts, notify_sectors")
          .in("user_id", uniqueUserIds);

        if (prefs) {
          for (const pref of prefs) {
            // Check if category is disabled
            if (prefColumn && (pref as any)[prefColumn] === false) {
              skipUserIds.add(pref.user_id);
              continue;
            }

            // Check sector filter: if user has sector preferences AND notification has a sector_id
            const userSectors = pref.notify_sectors as string[] | null;
            if (sector_id && userSectors && userSectors.length > 0) {
              if (!userSectors.includes(sector_id)) {
                skipUserIds.add(pref.user_id);
              }
            }
          }
        }
      }
    }

    const payload = JSON.stringify({ title, body, url, tag });
    const privateKeyJwk = JSON.parse(vapidData.private_key);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      // Skip if user preferences say no
      if (sub.user_id && skipUserIds.has(sub.user_id)) {
        skipped++;
        continue;
      }

      const result = await sendWebPush(sub, payload, vapidData.public_key, privateKeyJwk);

      if (result.success) {
        sent++;
      } else {
        failed++;
        // Remove expired/invalid subscriptions (410 Gone or 404)
        if (result.statusCode === 410 || result.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
        console.error(`Push failed for endpoint ${sub.endpoint}:`, result);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      const deleteQuery = supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      
      if (user_id) {
        deleteQuery.eq("user_id", user_id);
      } else if (account_id) {
        deleteQuery.eq("account_id", account_id);
      }
      
      await deleteQuery;
    }

    return new Response(JSON.stringify({ sent, failed, skipped, expired: expiredEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
