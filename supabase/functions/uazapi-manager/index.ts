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

// Request helper for admin endpoints (using admintoken header)
async function uazapiAdminRequest(endpoint: string, method: string, body?: unknown) {
  const url = `${UAZAPI_URL}${endpoint}`;
  console.log(`UAZAPI Admin Request: ${method} ${url}`);
  
  if (!UAZAPI_URL) {
    throw new Error("UAZAPI_URL não configurada. Adicione a secret nas configurações.");
  }
  
  if (!UAZAPI_ADMIN_TOKEN) {
    throw new Error("UAZAPI_ADMIN_TOKEN não configurado. Adicione a secret nas configurações.");
  }
  
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "admintoken": UAZAPI_ADMIN_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.log(`UAZAPI Response (${response.status}):`, responseText);
  
  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`UAZAPI retornou resposta inválida: ${responseText.slice(0, 200)}`);
  }
  
  if (!response.ok) {
    const errorMsg = (data as { message?: string })?.message || 
                     (data as { error?: string })?.error || 
                     `UAZAPI error: ${response.status}`;
    throw new Error(errorMsg);
  }
  
  return data;
}

// Request helper for instance endpoints (using token header)
async function uazapiInstanceRequest(endpoint: string, method: string, instanceToken: string, body?: unknown) {
  const url = `${UAZAPI_URL}${endpoint}`;
  console.log(`UAZAPI Instance Request: ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "token": instanceToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.log(`UAZAPI Response (${response.status}):`, responseText);
  
  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`UAZAPI retornou resposta inválida: ${responseText.slice(0, 200)}`);
  }
  
  if (!response.ok) {
    const errorMsg = (data as { message?: string })?.message || 
                     (data as { error?: string })?.error || 
                     `UAZAPI error: ${response.status}`;
    throw new Error(errorMsg);
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
        // UAZAPI expects "Name" (capitalized) in the payload
        result = await uazapiAdminRequest("/instance/create", "POST", {
          Name: instanceName,
          qrcode: true,
          webhook: {
            url: `${supabaseUrl}/functions/v1/uazapi-webhook`,
            events: ["messages.upsert", "connection.update", "qrcode.updated"],
          },
        });

        // Store instance token if returned
        const instanceToken = (result as { token?: string })?.token;

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
              instance_token: instanceToken,
              created_at: new Date().toISOString(),
            },
          }, { onConflict: "account_id,type" });

        break;
      }

      case "connect": {
        // Request QR code for connection
        result = await uazapiAdminRequest(`/instance/connect/${instanceName}`, "GET");
        break;
      }

      case "qrcode": {
        // Get current QR code
        result = await uazapiAdminRequest(`/instance/qrcode/${instanceName}`, "GET");
        break;
      }

      case "status": {
        // Get instance status
        try {
          result = await uazapiAdminRequest(`/instance/connectionState/${instanceName}`, "GET");
          
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
        result = await uazapiAdminRequest(`/instance/logout/${instanceName}`, "DELETE");
        
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

        // Get instance token from integration config
        const { data: integration } = await supabase
          .from("integrations")
          .select("config")
          .eq("account_id", accountId)
          .eq("type", "whatsapp")
          .single();

        const instanceToken = (integration?.config as { instance_token?: string })?.instance_token;
        
        if (!instanceToken) {
          // Fallback to admin endpoint if no instance token
          const cleanPhone = phone.replace(/\D/g, "");
          result = await uazapiAdminRequest(`/message/sendText/${instanceName}`, "POST", {
            number: cleanPhone,
            text: message,
          });
        } else {
          const cleanPhone = phone.replace(/\D/g, "");
          result = await uazapiInstanceRequest(`/message/sendText/${instanceName}`, "POST", instanceToken, {
            number: cleanPhone,
            text: message,
          });
        }
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
