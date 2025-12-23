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
  action: "create" | "connect" | "disconnect" | "status" | "qrcode" | "send_text" | "paircode" | "configure_webhook";
  instance_name?: string;
  phone?: string;
  message?: string;
}

// Helper function to configure webhook automatically
async function configureWebhook(instanceToken: string, instanceName: string, supabaseUrl: string): Promise<boolean> {
  const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
  console.log(`Configuring webhook for instance ${instanceName} to ${webhookUrl}`);
  
  // UAZAPI webhook body format
  const webhookBody = {
    url: webhookUrl,
    enabled: true,
    webhookByEvents: true,
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPDATE"]
  };
  
  // Try different endpoints and methods to set webhook
  const webhookEndpoints = [
    // POST methods (most common for UAZAPI)
    { url: `/webhook/set`, method: "POST", body: webhookBody },
    { url: `/webhook`, method: "POST", body: webhookBody },
    { url: `/instance/webhook`, method: "POST", body: webhookBody },
    { url: `/settings/webhook`, method: "POST", body: webhookBody },
    // PUT methods as fallback
    { url: `/webhook/set`, method: "PUT", body: webhookBody },
    { url: `/webhook`, method: "PUT", body: webhookBody },
  ];
  
  for (const endpoint of webhookEndpoints) {
    try {
      console.log(`Trying webhook config: ${endpoint.method} ${endpoint.url}`);
      await uazapiInstanceRequest(endpoint.url, endpoint.method, instanceToken, endpoint.body);
      console.log(`Webhook configured successfully via ${endpoint.url}`);
      return true;
    } catch (err) {
      console.log(`Webhook ${endpoint.url} failed:`, (err as Error).message);
    }
  }
  
  // Try admin endpoints as fallback (POST first, then PUT)
  const adminWebhookEndpoints = [
    { url: `/instance/webhook/${instanceName}`, method: "POST", body: webhookBody },
    { url: `/webhook/${instanceName}`, method: "POST", body: webhookBody },
    { url: `/instance/webhook/${instanceName}`, method: "PUT", body: webhookBody },
    { url: `/webhook/${instanceName}`, method: "PUT", body: webhookBody },
  ];
  
  for (const endpoint of adminWebhookEndpoints) {
    try {
      console.log(`Trying admin webhook config: ${endpoint.method} ${endpoint.url}`);
      await uazapiAdminRequest(endpoint.url, endpoint.method, endpoint.body);
      console.log(`Webhook configured successfully via admin ${endpoint.url}`);
      return true;
    } catch (err) {
      console.log(`Admin webhook ${endpoint.url} failed:`, (err as Error).message);
    }
  }
  
  console.log("Could not configure webhook automatically");
  return false;
}

// Request helper for admin endpoints (using admintoken header - UAZAPI standard)
async function uazapiAdminRequest(endpoint: string, method: string, body?: unknown) {
  const url = `${UAZAPI_URL}${endpoint}`;
  console.log(`UAZAPI Admin Request: ${method} ${url}`);
  
  if (!UAZAPI_URL) {
    throw new Error("UAZAPI_URL não configurada. Adicione a secret nas configurações.");
  }
  
  if (!UAZAPI_ADMIN_TOKEN) {
    throw new Error("UAZAPI_ADMIN_TOKEN não configurado. Adicione a secret nas configurações.");
  }
  
  // Use admintoken header for administrative endpoints (UAZAPI docs)
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

    // Get existing integration to use saved instance name
    const { data: existingWhatsapp } = await supabase
      .from("integrations")
      .select("config")
      .eq("account_id", accountId)
      .eq("type", "whatsapp")
      .maybeSingle();

    // Use saved instance name or generate new one
    const savedInstanceName = (existingWhatsapp?.config as { instance_name?: string })?.instance_name;
    const instanceName = savedInstanceName || `roy-${accountId.slice(0, 8)}`;

    console.log(`UAZAPI action: ${action} for account ${accountId}, instance: ${instanceName}`);

    let result: unknown;

    switch (action) {
      case "create": {
        // Create a new instance for this account
        // UAZAPI expects "Name" (capitalized) in the payload
        const createResult = await uazapiAdminRequest("/instance/create", "POST", {
          Name: instanceName,
          qrcode: true,
          webhook: `${supabaseUrl}/functions/v1/uazapi-webhook`,
        }) as {
          token?: string;
          instance?: { token?: string; qrcode?: string };
          qrcode?: string;
        };

        console.log("Create result:", JSON.stringify(createResult));

        // Extract instance token
        const instanceToken = createResult.token || createResult.instance?.token;

        // Wait for instance to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to get QR code using the INSTANCE TOKEN (not admin token)
        // UAZAPI GO uses the instance token to authenticate instance-specific endpoints
        let qrcodeBase64 = "";
        let connectResult: unknown = null;
        
        if (instanceToken) {
          // Try different endpoints using the instance token
          const instanceEndpoints = [
            { url: `/connect`, method: "GET" },
            { url: `/qr`, method: "GET" },
            { url: `/qrcode`, method: "GET" },
          ];

          for (const endpoint of instanceEndpoints) {
            if (qrcodeBase64) break;
            
            try {
              console.log(`Trying instance token: ${endpoint.method} ${endpoint.url}`);
              connectResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, instanceToken);
              
              console.log(`Result from ${endpoint.url}:`, JSON.stringify(connectResult));
              
              const connectData = connectResult as {
                base64?: string;
                qrcode?: string | { base64?: string };
                code?: string;
                pairingCode?: string;
                qr?: string;
                QRCode?: string;
                instance?: { qrcode?: string };
                data?: { base64?: string; qrcode?: string };
              };
              
              // Try all possible fields where QR code might be
              qrcodeBase64 = connectData.base64 || 
                             connectData.qr ||
                             connectData.QRCode ||
                             connectData.data?.base64 ||
                             connectData.data?.qrcode ||
                             connectData.instance?.qrcode ||
                             (typeof connectData.qrcode === 'string' ? connectData.qrcode : connectData.qrcode?.base64) ||
                             connectData.code || 
                             connectData.pairingCode || "";
                             
              if (qrcodeBase64) {
                console.log(`QR code found from ${endpoint.url}`);
              }
            } catch (err) {
              console.log(`Instance ${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }
        
        // If still no QR code with instance token, try admin endpoints
        if (!qrcodeBase64) {
          const adminEndpoints = [
            `/instance/connect/${instanceName}`,
            `/instance/qr/${instanceName}`,
            `/connect/${instanceName}`,
            `/qr/${instanceName}`,
          ];

          for (const endpoint of adminEndpoints) {
            if (qrcodeBase64) break;
            
            try {
              console.log(`Trying admin: GET ${endpoint}`);
              connectResult = await uazapiAdminRequest(endpoint, "GET");
              
              console.log(`Admin result from ${endpoint}:`, JSON.stringify(connectResult));
              
              const connectData = connectResult as {
                base64?: string;
                qrcode?: string | { base64?: string };
                qr?: string;
                data?: { base64?: string; qrcode?: string };
              };
              
              qrcodeBase64 = connectData.base64 || 
                             connectData.qr ||
                             connectData.data?.base64 ||
                             connectData.data?.qrcode ||
                             (typeof connectData.qrcode === 'string' ? connectData.qrcode : connectData.qrcode?.base64) || "";
                             
              if (qrcodeBase64) {
                console.log(`QR code found from admin ${endpoint}`);
              }
            } catch (err) {
              console.log(`Admin ${endpoint} failed:`, (err as Error).message);
            }
          }
        }

        // Update integrations table
        await supabase
          .from("integrations")
          .upsert({
            account_id: accountId,
            type: "whatsapp",
            status: qrcodeBase64 ? "pending" : "disconnected",
            config: {
              provider: "uazapi",
              instance_name: instanceName,
              instance_token: instanceToken,
              qrcode_base64: qrcodeBase64,
              created_at: new Date().toISOString(),
            },
          }, { onConflict: "account_id,type" });

        result = {
          ...createResult as object,
          qrcode_base64: qrcodeBase64,
        };

        break;
      }

      case "connect": {
        // Request QR code for connection
        result = await uazapiAdminRequest(`/instance/connect/${instanceName}`, "GET");
        break;
      }

      case "qrcode": {
        // Get current QR code - use connect endpoint since qrcode endpoint may not exist
        result = await uazapiAdminRequest(`/instance/connect/${instanceName}`, "GET");
        break;
      }

      case "paircode": {
        // Generate pairing code (8-digit code for WhatsApp connection)
        if (!phone) {
          return new Response(
            JSON.stringify({ error: "Phone number is required for pairing code" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Clean phone number (remove non-digits)
        const cleanPhone = phone.replace(/\D/g, "");
        console.log(`Generating pairing code for phone: ${cleanPhone}`);
        
        // Get instance token from integration or existing config
        const { data: existingIntegration } = await supabase
          .from("integrations")
          .select("config")
          .eq("account_id", accountId)
          .eq("type", "whatsapp")
          .single();

        const instanceToken = (existingIntegration?.config as { instance_token?: string })?.instance_token;
        
        // Try different endpoints for pairing code
        let paircode = "";
        let paircodeResult: unknown = null;
        
        // Try with instance token first
        if (instanceToken) {
          const tokenEndpoints = [
            { url: `/paircode`, method: "POST", body: { number: cleanPhone } },
            { url: `/instance/paircode`, method: "POST", body: { number: cleanPhone } },
            { url: `/requestPairingCode`, method: "POST", body: { number: cleanPhone } },
          ];
          
          for (const endpoint of tokenEndpoints) {
            if (paircode) break;
            try {
              console.log(`Trying instance: ${endpoint.method} ${endpoint.url}`);
              paircodeResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, instanceToken, endpoint.body);
              console.log(`Paircode result:`, JSON.stringify(paircodeResult));
              
              const data = paircodeResult as { paircode?: string; code?: string; pairingCode?: string; data?: { paircode?: string } };
              paircode = data.paircode || data.code || data.pairingCode || data.data?.paircode || "";
            } catch (err) {
              console.log(`Instance ${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }
        
        // Try with admin token
        if (!paircode) {
          const adminEndpoints = [
            { url: `/instance/paircode/${instanceName}`, method: "POST", body: { number: cleanPhone } },
            { url: `/paircode/${instanceName}`, method: "POST", body: { number: cleanPhone } },
            { url: `/instance/requestPairingCode/${instanceName}`, method: "POST", body: { number: cleanPhone } },
          ];
          
          for (const endpoint of adminEndpoints) {
            if (paircode) break;
            try {
              console.log(`Trying admin: ${endpoint.method} ${endpoint.url}`);
              paircodeResult = await uazapiAdminRequest(endpoint.url, endpoint.method, endpoint.body);
              console.log(`Admin paircode result:`, JSON.stringify(paircodeResult));
              
              const data = paircodeResult as { paircode?: string; code?: string; pairingCode?: string; data?: { paircode?: string } };
              paircode = data.paircode || data.code || data.pairingCode || data.data?.paircode || "";
            } catch (err) {
              console.log(`Admin ${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }

        if (paircode) {
          // Update integration with pairing code
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
                paircode: paircode,
                phone_number: cleanPhone,
                paircode_generated_at: new Date().toISOString(),
              },
            }, { onConflict: "account_id,type" });
        }

        result = {
          paircode,
          phone: cleanPhone,
          instance_name: instanceName,
        };
        break;
      }

      case "status": {
        // Get instance status - try multiple endpoints
        const savedToken = (existingWhatsapp?.config as { instance_token?: string })?.instance_token;
        let statusResult: unknown = null;
        let connectionState = "unknown";
        
        // Try with instance token first (more reliable)
        if (savedToken) {
          const tokenEndpoints = [
            `/connectionState`,
            `/instance/connectionState`,
            `/status`,
            `/instance/status`,
          ];
          
          for (const endpoint of tokenEndpoints) {
            if (connectionState !== "unknown") break;
            try {
              console.log(`Trying instance token: GET ${endpoint}`);
              statusResult = await uazapiInstanceRequest(endpoint, "GET", savedToken);
              console.log(`Status result:`, JSON.stringify(statusResult));
              
              // Handle multiple response formats from UAZAPI
              const data = statusResult as { 
                state?: string; 
                instance?: { state?: string }; 
                status?: string | { checked_instance?: { connection_status?: string; is_healthy?: boolean } }; 
                connected?: boolean;
                info?: string;
              };
              
              // Check for health check response format
              if (typeof data.status === 'object' && data.status?.checked_instance) {
                const instanceStatus = data.status.checked_instance;
                connectionState = instanceStatus.connection_status === "connected" ? "open" : instanceStatus.connection_status || "unknown";
              } else {
                connectionState = data.state || data.instance?.state || (typeof data.status === 'string' ? data.status : undefined) || (data.connected ? "open" : "unknown");
              }
            } catch (err) {
              console.log(`Instance ${endpoint} failed:`, (err as Error).message);
            }
          }
        }
        
        // Fallback to admin endpoints
        if (connectionState === "unknown") {
          const adminEndpoints = [
            `/instance/connectionState/${instanceName}`,
            `/instance/status/${instanceName}`,
            `/connectionState/${instanceName}`,
          ];
          
          for (const endpoint of adminEndpoints) {
            if (connectionState !== "unknown") break;
            try {
              console.log(`Trying admin: GET ${endpoint}`);
              statusResult = await uazapiAdminRequest(endpoint, "GET");
              console.log(`Admin status result:`, JSON.stringify(statusResult));
              
              const data = statusResult as { state?: string; instance?: { state?: string }; status?: string };
              connectionState = data.state || data.instance?.state || data.status || "unknown";
            } catch (err) {
              console.log(`Admin ${endpoint} failed:`, (err as Error).message);
            }
          }
        }
        
        const isConnected = connectionState === "open" || connectionState === "connected";
        
        // If connected, ensure webhook is configured
        let webhookConfigured = false;
        if (isConnected && savedToken) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          webhookConfigured = await configureWebhook(savedToken, instanceName, supabaseUrl);
        }
        
        // Update integration status based on result
        await supabase
          .from("integrations")
          .update({
            status: isConnected ? "connected" : (connectionState === "unknown" ? "connected" : "disconnected"),
            config: {
              ...(existingWhatsapp?.config as object || {}),
              last_status_check: new Date().toISOString(),
              connection_state: connectionState,
              webhook_configured: webhookConfigured || (existingWhatsapp?.config as { webhook_configured?: boolean })?.webhook_configured,
            },
          })
          .eq("account_id", accountId)
          .eq("type", "whatsapp");
        
        result = { 
          state: connectionState, 
          connected: isConnected,
          instance_name: instanceName,
          webhook_configured: webhookConfigured,
        };
        break;
      }

      case "configure_webhook": {
        // Manually configure webhook
        const savedToken = (existingWhatsapp?.config as { instance_token?: string })?.instance_token;
        
        if (!savedToken) {
          return new Response(
            JSON.stringify({ error: "WhatsApp não está conectado. Conecte primeiro." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const webhookConfigured = await configureWebhook(savedToken, instanceName, supabaseUrl);
        
        if (webhookConfigured) {
          await supabase
            .from("integrations")
            .update({
              config: {
                ...(existingWhatsapp?.config as object || {}),
                webhook_configured: true,
                webhook_configured_at: new Date().toISOString(),
              },
            })
            .eq("account_id", accountId)
            .eq("type", "whatsapp");
        }
        
        result = {
          webhook_configured: webhookConfigured,
          webhook_url: `${supabaseUrl}/functions/v1/uazapi-webhook`,
        };
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
