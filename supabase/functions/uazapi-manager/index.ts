import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

interface UazapiRequest {
  action: "create" | "connect" | "disconnect" | "status" | "qrcode" | "send_text";
  instance_name?: string;
  phone?: string;
  message?: string;
}

async function uazapiRequest(endpoint: string, method: string, body?: unknown) {
  const url = `${UAZAPI_URL}${endpoint}`;
  console.log(`UAZAPI Request: ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${UAZAPI_ADMIN_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  console.log(`UAZAPI Response:`, data);
  
  if (!response.ok) {
    throw new Error(data.message || `UAZAPI error: ${response.status}`);
  }
  
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's account
    const { data: userData } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = userData.account_id;
    const payload: UazapiRequest = await req.json();
    const { action, phone, message } = payload;

    // Instance name is based on account ID for isolation
    const instanceName = `roy_${accountId.replace(/-/g, "_").slice(0, 20)}`;

    console.log(`UAZAPI action: ${action} for account ${accountId}`);

    let result: unknown;

    switch (action) {
      case "create": {
        // Create a new instance for this account
        result = await uazapiRequest("/instance/create", "POST", {
          instanceName,
          qrcode: true,
          webhook: {
            url: `${supabaseUrl}/functions/v1/uazapi-webhook`,
            events: ["messages.upsert", "connection.update", "qrcode.updated"],
          },
        });

        // Update integrations table
        await supabase
          .from("integrations")
          .upsert({
            account_id: accountId,
            type: "whatsapp",
            status: "pending",
            config: {
              provider: "uazapi",
              instance_name: instanceName,
              created_at: new Date().toISOString(),
            },
          }, { onConflict: "account_id,type" });

        break;
      }

      case "connect": {
        // Request QR code for connection
        result = await uazapiRequest(`/instance/connect/${instanceName}`, "GET");
        break;
      }

      case "qrcode": {
        // Get current QR code
        result = await uazapiRequest(`/instance/qrcode/${instanceName}`, "GET");
        break;
      }

      case "status": {
        // Get instance status
        try {
          result = await uazapiRequest(`/instance/connectionState/${instanceName}`, "GET");
          
          // Update integration status based on UAZAPI response
          const isConnected = result && (result as { state?: string }).state === "open";
          
          await supabase
            .from("integrations")
            .update({
              status: isConnected ? "connected" : "disconnected",
              config: {
                provider: "uazapi",
                instance_name: instanceName,
                last_status_check: new Date().toISOString(),
                connection_state: (result as { state?: string }).state,
              },
            })
            .eq("account_id", accountId)
            .eq("type", "whatsapp");
            
        } catch (err) {
          // Instance might not exist yet
          result = { state: "not_found", error: (err as Error).message };
        }
        break;
      }

      case "disconnect": {
        // Disconnect/logout the instance
        result = await uazapiRequest(`/instance/logout/${instanceName}`, "DELETE");
        
        // Update integration status
        await supabase
          .from("integrations")
          .update({
            status: "disconnected",
            config: {
              provider: "uazapi",
              instance_name: instanceName,
              disconnected_at: new Date().toISOString(),
            },
          })
          .eq("account_id", accountId)
          .eq("type", "whatsapp");
          
        break;
      }

      case "send_text": {
        if (!phone || !message) {
          return new Response(
            JSON.stringify({ error: "Phone and message are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Clean phone number
        const cleanPhone = phone.replace(/\D/g, "");
        
        result = await uazapiRequest(`/message/sendText/${instanceName}`, "POST", {
          number: cleanPhone,
          text: message,
        });
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result, instance_name: instanceName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("UAZAPI Manager error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
