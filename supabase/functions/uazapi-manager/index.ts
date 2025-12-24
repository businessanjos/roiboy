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
  action: "create" | "connect" | "disconnect" | "status" | "qrcode" | "send_text" | "paircode" | "configure_webhook" | "fetch_token" 
    | "list_groups" | "sync_groups" | "save_selected_groups" | "create_group" | "group_participants" | "add_participant" | "remove_participant" | "send_to_group"
    | "send_media" | "send_media_to_group"
    | "update_group_name" | "update_group_description" | "update_group_image"
    | "create_support_instance" | "refresh_support_qr" | "disconnect_support" | "check_support_status";
  instance_name?: string;
  phone?: string;
  message?: string;
  group_id?: string;
  group_name?: string;
  group_description?: string;
  group_image?: string;
  participants?: string[];
  media_url?: string;
  media_type?: "image" | "audio" | "document";
  caption?: string;
  file_name?: string;
  groups?: Array<{ group_jid: string; name: string; participant_count: number }>;
}

// Helper function to configure webhook automatically
async function configureWebhook(instanceToken: string, instanceName: string, supabaseUrl: string): Promise<boolean> {
  const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
  console.log(`Configuring webhook for instance ${instanceName} to ${webhookUrl}`);
  
  // UAZAPI webhook body format - events in lowercase as per UAZAPI panel
  const webhookBody = {
    url: webhookUrl,
    enabled: true,
    webhookByEvents: true,
    addUrlEvents: false,
    addUrlTypesMessages: false,
    events: ["messages", "connection", "qrcode", "MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
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
    const { action, phone, message, group_id, group_name, participants, groups } = payload;

    // Get existing integration to use saved instance name
    const { data: existingWhatsapp, error: existingError } = await supabase
      .from("integrations")
      .select("config, status")
      .eq("account_id", accountId)
      .eq("type", "whatsapp")
      .maybeSingle();

    console.log(`Existing WhatsApp integration:`, existingWhatsapp ? JSON.stringify(existingWhatsapp) : 'none', existingError?.message || '');

    // For "create" action, ALWAYS generate a unique instance name if:
    // 1. No existing integration exists, OR
    // 2. Existing integration is disconnected
    const savedInstanceName = (existingWhatsapp?.config as { instance_name?: string })?.instance_name;
    let savedInstanceToken = (existingWhatsapp?.config as { instance_token?: string })?.instance_token;
    const isConnected = existingWhatsapp?.status === "connected";
    
    // Reutilizar instância se conectada (mesmo sem token - vamos buscar depois)
    const shouldReuseInstance = isConnected && savedInstanceName;
    
    // Generate unique suffix using timestamp to avoid collisions
    const uniqueSuffix = `-${Date.now().toString(36).slice(-4)}`;
    
    // Se não temos token, buscar de qualquer instância conectada via /instance/all
    // Isso corrige o caso onde o nome salvo não bate com a instância real
    let actualInstanceName = savedInstanceName;
    if (!savedInstanceToken) {
      console.log(`Token missing. Fetching connected instances from /instance/all...`);
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
          status?: string;
          owner?: string;
        }>;
        
        console.log(`Found ${allInstances.length} instances`);
        
        // Primeiro, tentar achar pelo nome salvo
        let instance = allInstances.find(i => i.name === savedInstanceName);
        
        // Se não achou pelo nome, pegar a primeira instância conectada
        if (!instance?.token) {
          const connectedInstance = allInstances.find(i => i.status === "connected" && i.token);
          if (connectedInstance) {
            instance = connectedInstance;
            actualInstanceName = connectedInstance.name || savedInstanceName;
            console.log(`Using connected instance: ${actualInstanceName} instead of saved: ${savedInstanceName}`);
          }
        }
        
        if (instance?.token) {
          savedInstanceToken = instance.token;
          console.log(`Token found: ${savedInstanceToken.slice(0, 8)}... for instance ${actualInstanceName}`);
          
          // Salvar o token e nome correto
          await supabase
            .from("integrations")
            .update({
              config: {
                ...(existingWhatsapp?.config as object || {}),
                instance_name: actualInstanceName,
                instance_token: savedInstanceToken,
                token_recovered_at: new Date().toISOString(),
              },
            })
            .eq("account_id", accountId)
            .eq("type", "whatsapp");
            
          console.log(`Token and instance name saved to database`);
        } else {
          console.log(`No connected instance with token found`);
        }
      } catch (err) {
        console.log("Failed to fetch from /instance/all:", (err as Error).message);
      }
    }
    
    // Usar o nome real da instância (pode ter sido atualizado)
    const instanceName = shouldReuseInstance 
      ? (actualInstanceName || savedInstanceName)
      : `roy-${accountId.slice(0, 8)}${uniqueSuffix}`;

    console.log(`UAZAPI action: ${action} for account ${accountId}, instance: ${instanceName}, reuse: ${shouldReuseInstance}, hasToken: ${!!savedInstanceToken}`);

    let result: unknown;

    switch (action) {
      case "create": {
        // Create a new instance for this account
        // UAZAPI GO v2 - Endpoint correto: POST /instance/init
        // Body: { name: "instance-name" }
        // Response: { token: "...", name: "...", instance: {...} }
        const createResult = await uazapiAdminRequest("/instance/init", "POST", {
          name: instanceName,
        }) as {
          token?: string;
          instance?: { token?: string; id?: string; qrcode?: string };
          qrcode?: string;
          name?: string;
        };

        console.log("Create result:", JSON.stringify(createResult));

        // Extract instance token
        const instanceToken = createResult.token || createResult.instance?.token;

        // Wait for instance to initialize (increased to 4s for UAZAPI GO)
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Try to get QR code using the INSTANCE TOKEN (not admin token)
        // UAZAPI GO uses the instance token to authenticate instance-specific endpoints
        let qrcodeBase64 = "";
        let connectResult: unknown = null;
        
        if (instanceToken) {
          // Try different endpoints using the instance token - POST first, then GET
          const instanceEndpoints = [
            { url: `/connect`, method: "POST" },
            { url: `/connect`, method: "GET" },
            { url: `/qr`, method: "POST" },
            { url: `/qr`, method: "GET" },
            { url: `/qrcode`, method: "POST" },
            { url: `/qrcode`, method: "GET" },
            { url: `/instance/connect`, method: "POST" },
            { url: `/instance/qr`, method: "POST" },
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
        
        // If still no QR code with instance token, try admin endpoints (POST then GET)
        if (!qrcodeBase64) {
          const adminEndpoints = [
            { url: `/instance/connect/${instanceName}`, method: "POST" },
            { url: `/instance/connect/${instanceName}`, method: "GET" },
            { url: `/instance/qr/${instanceName}`, method: "POST" },
            { url: `/instance/qr/${instanceName}`, method: "GET" },
            { url: `/connect/${instanceName}`, method: "POST" },
            { url: `/connect/${instanceName}`, method: "GET" },
            { url: `/qr/${instanceName}`, method: "POST" },
            { url: `/qr/${instanceName}`, method: "GET" },
          ];

          for (const endpoint of adminEndpoints) {
            if (qrcodeBase64) break;
            
            try {
              console.log(`Trying admin: ${endpoint.method} ${endpoint.url}`);
              connectResult = await uazapiAdminRequest(endpoint.url, endpoint.method);
              
              console.log(`Admin result from ${endpoint.url}:`, JSON.stringify(connectResult));
              
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
                console.log(`QR code found from admin ${endpoint.url}`);
              }
            } catch (err) {
              console.log(`Admin ${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }

        // Configure webhook automatically if we have instance token
        if (instanceToken) {
          try {
            await configureWebhook(instanceToken, instanceName, supabaseUrl);
          } catch (err) {
            console.log("Webhook configuration failed (non-blocking):", (err as Error).message);
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
          token: instanceToken,
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
        
        console.log(`Status check - savedToken: ${savedToken ? "found" : "not found"}`);
        
        // Try with instance token first (more reliable)
        if (savedToken) {
          const tokenEndpoints = [
            { url: `/status`, method: "GET" },
            { url: `/connectionState`, method: "GET" },
            { url: `/instance/status`, method: "GET" },
            { url: `/instance/connectionState`, method: "GET" },
            { url: `/info`, method: "GET" },
            { url: `/instance/info`, method: "GET" },
          ];
          
          for (const endpoint of tokenEndpoints) {
            if (connectionState !== "unknown") break;
            try {
              console.log(`Trying instance token: ${endpoint.method} ${endpoint.url}`);
              statusResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedToken);
              console.log(`Status result from ${endpoint.url}:`, JSON.stringify(statusResult));
              
              // Handle multiple response formats from UAZAPI
              const data = statusResult as { 
                state?: string; 
                instance?: { state?: string; status?: string }; 
                status?: string | { checked_instance?: { connection_status?: string; is_healthy?: boolean } }; 
                connected?: boolean;
                info?: string;
                connection?: string;
              };
              
              // Check for health check response format
              if (typeof data.status === 'object' && data.status?.checked_instance) {
                const instanceStatus = data.status.checked_instance;
                connectionState = instanceStatus.connection_status === "connected" ? "open" : instanceStatus.connection_status || "unknown";
              } else if (data.instance?.status) {
                connectionState = data.instance.status === "disconnected" ? "disconnected" : data.instance.status;
              } else {
                connectionState = data.state || data.connection || data.instance?.state || (typeof data.status === 'string' ? data.status : undefined) || (data.connected ? "open" : "unknown");
              }
              
              if (connectionState !== "unknown") {
                console.log(`Connection state found: ${connectionState}`);
              }
            } catch (err) {
              console.log(`Instance ${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }
        
        // Fallback to admin endpoints with multiple methods
        if (connectionState === "unknown") {
          const adminEndpoints = [
            { url: `/instance/info/${instanceName}`, method: "GET" },
            { url: `/instance/connectionState/${instanceName}`, method: "GET" },
            { url: `/instance/status/${instanceName}`, method: "GET" },
            { url: `/connectionState/${instanceName}`, method: "GET" },
            { url: `/info/${instanceName}`, method: "GET" },
            { url: `/status/${instanceName}`, method: "GET" },
          ];
          
          for (const endpoint of adminEndpoints) {
            if (connectionState !== "unknown") break;
            try {
              console.log(`Trying admin: ${endpoint.method} ${endpoint.url}`);
              statusResult = await uazapiAdminRequest(endpoint.url, endpoint.method);
              console.log(`Admin status result:`, JSON.stringify(statusResult));
              
              const data = statusResult as { 
                state?: string; 
                instance?: { state?: string; status?: string }; 
                status?: string;
                connection?: string;
              };
              
              if (data.instance?.status) {
                connectionState = data.instance.status;
              } else {
                connectionState = data.state || data.connection || data.instance?.state || data.status || "unknown";
              }
              
              if (connectionState !== "unknown") {
                console.log(`Admin connection state found: ${connectionState}`);
              }
            } catch (err) {
              console.log(`Admin ${endpoint.url} failed:`, (err as Error).message);
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
        // Disconnect/logout the instance - try multiple endpoints and methods
        const savedToken = (existingWhatsapp?.config as { instance_token?: string })?.instance_token;
        let disconnected = false;
        
        // Try instance token endpoints first
        if (savedToken) {
          const instanceLogoutEndpoints = [
            { url: `/logout`, method: "POST" },
            { url: `/logout`, method: "DELETE" },
            { url: `/instance/logout`, method: "POST" },
            { url: `/instance/logout`, method: "DELETE" },
          ];
          
          for (const endpoint of instanceLogoutEndpoints) {
            try {
              console.log(`Trying instance logout: ${endpoint.method} ${endpoint.url}`);
              result = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedToken);
              console.log(`Logout successful via instance ${endpoint.url}`);
              disconnected = true;
              break;
            } catch (err) {
              console.log(`Instance logout ${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }
        
        // Try admin endpoints if instance logout failed
        if (!disconnected) {
          const adminLogoutEndpoints = [
            { url: `/instance/logout/${instanceName}`, method: "POST" },
            { url: `/instance/logout/${instanceName}`, method: "DELETE" },
            { url: `/logout/${instanceName}`, method: "POST" },
            { url: `/logout/${instanceName}`, method: "DELETE" },
          ];
          
          for (const endpoint of adminLogoutEndpoints) {
            try {
              console.log(`Trying admin logout: ${endpoint.method} ${endpoint.url}`);
              result = await uazapiAdminRequest(endpoint.url, endpoint.method);
              console.log(`Logout successful via admin ${endpoint.url}`);
              disconnected = true;
              break;
            } catch (err) {
              console.log(`Admin logout ${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }
        
        // Even if logout API failed, update local status
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
        
        if (!disconnected) {
          console.log("Could not logout via API, but local status updated");
          result = { message: "Integração desconectada localmente" };
        }
          
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
        const cleanPhone = phone.replace(/\D/g, "");
        
        // UAZAPI GO v2 - Documentação oficial: POST /send/text
        // Body: { number: "5511999999999", text: "mensagem" }
        const messageBody = { number: cleanPhone, text: message };
        
        if (instanceToken) {
          // Use instance token with /send/text endpoint (documentação oficial UAZAPI)
          result = await uazapiInstanceRequest(`/send/text`, "POST", instanceToken, messageBody);
        } else {
          // Fallback to admin endpoint with instance name in path
          result = await uazapiAdminRequest(`/send/text/${instanceName}`, "POST", messageBody);
        }
        break;
      }

      case "fetch_token": {
        // Fetch the token for an existing instance using admin API
        // UAZAPI GO v2 - GET /instance/all retorna lista com token de cada instância
        console.log(`Fetching token for instance: ${instanceName}`);
        
        let instanceToken = "";
        let fetchResult: unknown = null;
        
        // UAZAPI GO v2 - Endpoint correto: GET /instance/all
        const tokenEndpoints = [
          { url: `/instance/all`, method: "GET" },  // UAZAPI GO v2 documentação oficial
          { url: `/instance/fetchInstances`, method: "GET" },
          { url: `/instance/list`, method: "GET" },
        ];
        
        for (const endpoint of tokenEndpoints) {
          if (instanceToken) break;
          
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            fetchResult = await uazapiAdminRequest(endpoint.url, endpoint.method);
            console.log(`Result:`, JSON.stringify(fetchResult).substring(0, 500));
            
            // Handle array of instances (UAZAPI GO v2 returns array)
            if (Array.isArray(fetchResult)) {
              const instance = fetchResult.find((i: { name?: string; Name?: string; instance_name?: string }) => 
                i.name === instanceName || i.Name === instanceName || i.instance_name === instanceName
              );
              if (instance) {
                instanceToken = (instance as { token?: string; Token?: string }).token || 
                               (instance as { token?: string; Token?: string }).Token || "";
                console.log(`Found instance ${instanceName} with token: ${instanceToken?.slice(0, 8)}...`);
              }
            } else {
              // Handle single instance response
              const data = fetchResult as { 
                token?: string; 
                Token?: string; 
                instance?: { token?: string }; 
                data?: { token?: string }; 
              };
              instanceToken = data.token || data.Token || data.instance?.token || data.data?.token || "";
            }
            
            if (instanceToken) {
              console.log(`Token found from ${endpoint.url}`);
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }
        
        if (instanceToken) {
          // Save token to integration
          await supabase
            .from("integrations")
            .update({
              config: {
                ...(existingWhatsapp?.config as object || {}),
                instance_token: instanceToken,
                token_fetched_at: new Date().toISOString(),
              },
            })
            .eq("account_id", accountId)
            .eq("type", "whatsapp");
          
          result = { 
            success: true, 
            message: "Token encontrado e salvo",
            instance_name: instanceName,
          };
        } else {
          result = { 
            success: false, 
            message: "Não foi possível obter o token. Tente reconectar o WhatsApp.",
          };
        }
        break;
      }

      case "list_groups": {
        // List all groups using UAZAPI
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }

        console.log("Fetching groups list...");
        
        // Try different endpoints to list groups
        let groups: unknown[] = [];
        
        // According to UAZAPI docs: GET /group/list with optional query params: force, noparticipants
        // This should be the primary endpoint
        const getEndpointsWithParams = [
          `/group/list?force=true&noparticipants=false`,
          `/group/list?force=true`,
          `/group/list`,
        ];

        for (const url of getEndpointsWithParams) {
          try {
            console.log(`Trying: GET ${url}`);
            const groupsResult = await uazapiInstanceRequest(url, "GET", savedInstanceToken);
            console.log("Groups result:", JSON.stringify(groupsResult).substring(0, 1000));
            
            // Handle different response formats
            if (Array.isArray(groupsResult)) {
              groups = groupsResult;
            } else if ((groupsResult as { groups?: unknown[] })?.groups) {
              groups = (groupsResult as { groups: unknown[] }).groups;
            } else if ((groupsResult as { data?: unknown[] })?.data) {
              groups = (groupsResult as { data: unknown[] }).data;
            } else if ((groupsResult as { chats?: unknown[] })?.chats) {
              // Filter only group chats
              const chats = (groupsResult as { chats: Array<{ id?: string; jid?: string }> }).chats;
              groups = chats.filter(c => (c.id || c.jid || "").includes("@g.us"));
            }
            
            if (groups.length > 0) {
              console.log(`Found ${groups.length} groups via GET ${url}`);
              break;
            }
          } catch (err) {
            console.log(`GET ${url} failed:`, (err as Error).message);
          }
        }
        
        // Try other GET endpoints as fallback
        if (groups.length === 0) {
          const fallbackGetEndpoints = [
            `/group/fetchAllGroups`,
            `/group/participatesGroups`,
            `/groups`,
            `/chat/groups`,
          ];

          for (const url of fallbackGetEndpoints) {
            try {
              console.log(`Trying fallback: GET ${url}`);
              const groupsResult = await uazapiInstanceRequest(url, "GET", savedInstanceToken);
              console.log("Groups result:", JSON.stringify(groupsResult).substring(0, 1000));
              
              if (Array.isArray(groupsResult)) {
                groups = groupsResult;
              } else if ((groupsResult as { groups?: unknown[] })?.groups) {
                groups = (groupsResult as { groups: unknown[] }).groups;
              } else if ((groupsResult as { data?: unknown[] })?.data) {
                groups = (groupsResult as { data: unknown[] }).data;
              }
              
              if (groups.length > 0) {
                console.log(`Found ${groups.length} groups via fallback GET ${url}`);
                break;
              }
            } catch (err) {
              console.log(`Fallback GET ${url} failed:`, (err as Error).message);
            }
          }
        }

        console.log(`Total groups found: ${groups.length}`);
        result = { groups };
        break;
      }

      case "sync_groups": {
        // Sync all WhatsApp groups to database
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }

        console.log("Syncing groups from WhatsApp to database...");
        
        // First, fetch all groups from WhatsApp API
        let groups: unknown[] = [];
        
        // According to UAZAPI docs: GET /group/list with optional query params: force, noparticipants
        const getEndpointsWithParams = [
          `/group/list?force=true&noparticipants=false`,
          `/group/list?force=true`,
          `/group/list`,
        ];

        for (const url of getEndpointsWithParams) {
          try {
            console.log(`Trying: GET ${url}`);
            const groupsResult = await uazapiInstanceRequest(url, "GET", savedInstanceToken);
            console.log("Groups result:", JSON.stringify(groupsResult).substring(0, 1000));
            
            if (Array.isArray(groupsResult)) {
              groups = groupsResult;
            } else if ((groupsResult as { groups?: unknown[] })?.groups) {
              groups = (groupsResult as { groups: unknown[] }).groups;
            } else if ((groupsResult as { data?: unknown[] })?.data) {
              groups = (groupsResult as { data: unknown[] }).data;
            } else if ((groupsResult as { chats?: unknown[] })?.chats) {
              const chats = (groupsResult as { chats: Array<{ id?: string; jid?: string }> }).chats;
              groups = chats.filter(c => (c.id || c.jid || "").includes("@g.us"));
            }
            
            if (groups.length > 0) {
              console.log(`Found ${groups.length} groups via GET ${url}`);
              break;
            }
          } catch (err) {
            console.log(`GET ${url} failed:`, (err as Error).message);
          }
        }

        // Try fallback GET endpoints
        if (groups.length === 0) {
          const fallbackGetEndpoints = [
            `/group/fetchAllGroups`,
            `/group/participatesGroups`,
            `/groups`,
          ];

          for (const url of fallbackGetEndpoints) {
            try {
              console.log(`Trying fallback: GET ${url}`);
              const groupsResult = await uazapiInstanceRequest(url, "GET", savedInstanceToken);
              console.log("Groups result:", JSON.stringify(groupsResult).substring(0, 1000));
              
              if (Array.isArray(groupsResult)) {
                groups = groupsResult;
              } else if ((groupsResult as { groups?: unknown[] })?.groups) {
                groups = (groupsResult as { groups: unknown[] }).groups;
              } else if ((groupsResult as { data?: unknown[] })?.data) {
                groups = (groupsResult as { data: unknown[] }).data;
              }
              
              if (groups.length > 0) {
                console.log(`Found ${groups.length} groups via fallback GET ${url}`);
                break;
              }
            } catch (err) {
              console.log(`Fallback GET ${url} failed:`, (err as Error).message);
            }
          }
        }

        console.log(`Total groups found from WhatsApp API: ${groups.length}`);

        // Save/update each group in the database
        let synced = 0;
        let errors = 0;
        
        for (const g of groups) {
          const group = g as {
            JID?: string;
            jid?: string;
            id?: string;
            Name?: string;
            name?: string;
            subject?: string;
            Subject?: string;
            Participants?: unknown[];
            participants?: unknown[];
            Size?: number;
            size?: number;
          };
          
          const groupJid = group.JID || group.jid || group.id || "";
          const groupName = group.Name || group.name || group.Subject || group.subject || "";
          const participantCount = group.Participants?.length || group.participants?.length || group.Size || group.size || 0;
          
          if (groupJid && groupJid.includes("@g.us")) {
            try {
              await supabase
                .from("whatsapp_groups")
                .upsert({
                  account_id: accountId,
                  group_jid: groupJid,
                  name: groupName,
                  participant_count: participantCount,
                }, { onConflict: "account_id,group_jid" });
              synced++;
            } catch (err) {
              console.log(`Error saving group ${groupJid}:`, (err as Error).message);
              errors++;
            }
          }
        }

        console.log(`Sync complete: ${synced} synced, ${errors} errors`);
        
        result = { 
          success: true, 
          synced, 
          errors,
          total: groups.length,
          message: `${synced} grupo(s) sincronizado(s)${errors > 0 ? `, ${errors} erro(s)` : ""}` 
        };
        break;
      }

      case "save_selected_groups": {
        // Save only selected groups to database
        const groupsToSave = groups || [];
        
        if (groupsToSave.length === 0) {
          throw new Error("Nenhum grupo selecionado para salvar");
        }

        console.log(`Saving ${groupsToSave.length} selected groups...`);
        
        let saved = 0;
        let errors = 0;
        
        for (const group of groupsToSave) {
          try {
            await supabase
              .from("whatsapp_groups")
              .upsert({
                account_id: accountId,
                group_jid: group.group_jid,
                name: group.name,
                participant_count: group.participant_count,
              }, { onConflict: "account_id,group_jid" });
            saved++;
          } catch (err) {
            console.log(`Error saving group ${group.group_jid}:`, (err as Error).message);
            errors++;
          }
        }

        console.log(`Save complete: ${saved} saved, ${errors} errors`);
        
        result = { 
          success: true, 
          saved, 
          errors,
          message: `${saved} grupo(s) salvo(s)${errors > 0 ? `, ${errors} erro(s)` : ""}` 
        };
        break;
      }

      case "create_group": {
        // Create a new group
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_name) {
          throw new Error("Nome do grupo é obrigatório");
        }
        
        if (!participants || participants.length === 0) {
          throw new Error("Pelo menos um participante é obrigatório");
        }

        console.log(`Creating group: ${group_name} with ${participants.length} participants`);
        
        // Clean participant phones
        const cleanParticipants = participants.map(p => p.replace(/\D/g, ""));
        
        // Try different endpoints to create group
        let createGroupResult: unknown = null;
        const createEndpoints = [
          { url: `/group/create`, method: "POST" },
          { url: `/groups/create`, method: "POST" },
        ];

        for (const endpoint of createEndpoints) {
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            createGroupResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              { 
                subject: group_name, 
                participants: cleanParticipants,
                name: group_name, // alternate field name
              }
            );
            console.log("Create group result:", JSON.stringify(createGroupResult));
            break;
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        // Save the group to database if created successfully
        // UAZAPI returns: { group: { JID: "...", Name: "...", Participants: [...] } }
        const groupData = createGroupResult as {
          group?: { JID?: string; Name?: string; Participants?: unknown[] };
          jid?: string;
          id?: string;
          JID?: string;
          Name?: string;
        } | null;
        
        // Try different response formats
        const groupJid = groupData?.group?.JID || groupData?.JID || groupData?.jid || groupData?.id;
        const groupName = groupData?.group?.Name || group_name;
        const participantCount = groupData?.group?.Participants?.length || cleanParticipants.length + 1;
        
        if (groupJid) {
          console.log(`Saving group to database: ${groupName} (${groupJid})`);
          
          await supabase
            .from("whatsapp_groups")
            .upsert({
              account_id: accountId,
              group_jid: groupJid,
              name: groupName,
              participant_count: participantCount,
            }, { onConflict: "account_id,group_jid" });
        }

        result = createGroupResult || { success: false, message: "Não foi possível criar o grupo" };
        break;
      }

      case "group_participants": {
        // Get participants of a group
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }

        // Ensure group_id has @g.us suffix
        const groupJidForParticipants = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
        console.log(`Fetching participants for group: ${groupJidForParticipants}`);
        
        let participantsResult: unknown = null;
        let participantsFound = false;
        let participants: unknown[] = [];
        
        // Strategy 1: Try to get group info which may contain participants
        const groupInfoEndpoints = [
          { url: `/group/fetchGroup`, method: "POST", body: { jid: groupJidForParticipants } },
          { url: `/group/fetchGroup`, method: "POST", body: { groupJid: groupJidForParticipants } },
          { url: `/group/info`, method: "POST", body: { jid: groupJidForParticipants } },
          { url: `/group/info`, method: "POST", body: { groupJid: groupJidForParticipants } },
          { url: `/group/metadata`, method: "POST", body: { jid: groupJidForParticipants } },
          { url: `/group/metadata`, method: "POST", body: { groupJid: groupJidForParticipants } },
        ];

        for (const endpoint of groupInfoEndpoints) {
          if (participantsFound) break;
          try {
            console.log(`Trying group info: ${endpoint.method} ${endpoint.url}`);
            const groupInfo = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
            console.log("Group info result:", JSON.stringify(groupInfo));
            
            // Extract participants from group info
            const data = groupInfo as { 
              participants?: unknown[]; 
              Participants?: unknown[]; 
              members?: unknown[];
              group?: { participants?: unknown[]; Participants?: unknown[]; members?: unknown[] };
            };
            
            participants = data?.participants || 
                          data?.Participants || 
                          data?.members ||
                          data?.group?.participants || 
                          data?.group?.Participants || 
                          data?.group?.members || [];
            
            if (participants.length > 0) {
              participantsFound = true;
              participantsResult = { participants };
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }
        
        // Strategy 2: Try dedicated participants endpoints with POST
        if (!participantsFound) {
          const postEndpoints = [
            { url: `/group/participants`, method: "POST", body: { jid: groupJidForParticipants } },
            { url: `/group/participants`, method: "POST", body: { groupJid: groupJidForParticipants } },
            { url: `/group/fetchParticipants`, method: "POST", body: { jid: groupJidForParticipants } },
            { url: `/group/getParticipants`, method: "POST", body: { jid: groupJidForParticipants } },
            { url: `/group/members`, method: "POST", body: { jid: groupJidForParticipants } },
          ];

          for (const endpoint of postEndpoints) {
            if (participantsFound) break;
            try {
              console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
              participantsResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
              console.log("Participants result:", JSON.stringify(participantsResult));
              
              const data = participantsResult as { participants?: unknown[]; Participants?: unknown[]; data?: unknown[]; members?: unknown[] };
              participants = Array.isArray(participantsResult) ? participantsResult : 
                            (data?.participants || data?.Participants || data?.data || data?.members || []);
              
              if (participants.length > 0) {
                participantsFound = true;
                participantsResult = { participants };
              }
            } catch (err) {
              console.log(`${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }
        
        // Strategy 3: Fallback to GET endpoints with path parameter
        if (!participantsFound) {
          const getEndpoints = [
            { url: `/group/participants/${groupJidForParticipants}`, method: "GET" },
            { url: `/group/${groupJidForParticipants}/participants`, method: "GET" },
            { url: `/group/info/${groupJidForParticipants}`, method: "GET" },
            { url: `/group/metadata/${groupJidForParticipants}`, method: "GET" },
          ];

          for (const endpoint of getEndpoints) {
            if (participantsFound) break;
            try {
              console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
              participantsResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken);
              console.log("Participants result:", JSON.stringify(participantsResult));
              
              const data = participantsResult as { participants?: unknown[]; Participants?: unknown[]; data?: unknown[]; members?: unknown[] };
              participants = Array.isArray(participantsResult) ? participantsResult : 
                            (data?.participants || data?.Participants || data?.data || data?.members || []);
              
              if (participants.length > 0) {
                participantsFound = true;
                participantsResult = { participants };
              }
            } catch (err) {
              console.log(`${endpoint.url} failed:`, (err as Error).message);
            }
          }
        }

        result = participantsResult || { participants: [], message: "Não foi possível buscar os membros do grupo. Tente atualizar a lista de grupos." };
        break;
      }

      case "add_participant": {
        // Add participant to group
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }
        
        if (!participants || participants.length === 0) {
          throw new Error("Pelo menos um participante é obrigatório");
        }

        console.log(`Adding ${participants.length} participants to group: ${group_id}`);
        
        const cleanParticipants = participants.map(p => p.replace(/\D/g, ""));
        
        let addResult: unknown = null;
        const addEndpoints = [
          { url: `/group/addParticipants`, method: "POST" },
          { url: `/group/${group_id}/add`, method: "POST" },
          { url: `/groups/${group_id}/participants/add`, method: "POST" },
        ];

        for (const endpoint of addEndpoints) {
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            addResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              { 
                groupJid: group_id,
                participants: cleanParticipants,
              }
            );
            console.log("Add participants result:", JSON.stringify(addResult));
            break;
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        result = addResult || { success: false, message: "Não foi possível adicionar participantes" };
        break;
      }

      case "remove_participant": {
        // Remove participant from group
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }
        
        if (!participants || participants.length === 0) {
          throw new Error("Pelo menos um participante é obrigatório");
        }

        console.log(`Removing ${participants.length} participants from group: ${group_id}`);
        
        const cleanParticipants = participants.map(p => p.replace(/\D/g, ""));
        
        let removeResult: unknown = null;
        const removeEndpoints = [
          { url: `/group/removeParticipants`, method: "POST" },
          { url: `/group/${group_id}/remove`, method: "POST" },
          { url: `/groups/${group_id}/participants/remove`, method: "POST" },
        ];

        for (const endpoint of removeEndpoints) {
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            removeResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              { 
                groupJid: group_id,
                participants: cleanParticipants,
              }
            );
            console.log("Remove participants result:", JSON.stringify(removeResult));
            break;
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        result = removeResult || { success: false, message: "Não foi possível remover participantes" };
        break;
      }

      case "send_to_group": {
        // Send message to group
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }
        
        if (!message) {
          throw new Error("Mensagem é obrigatória");
        }

        // Ensure group_id has @g.us suffix
        const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
        console.log(`Sending message to group: ${groupJid}`);
        
        let sendResult: unknown = null;
        let sendSuccess = false;
        
        // UAZAPI GO v2 - Same format as send_text but with group JID as "number"
        // The API expects { number: "groupJid@g.us", text: "message" }
        const sendEndpoints = [
          { url: `/send/text`, method: "POST", body: { number: groupJid, text: message } },
          { url: `/send/text`, method: "POST", body: { chatId: groupJid, text: message } },
          { url: `/chat/send/text`, method: "POST", body: { Phone: groupJid, Body: message } },
        ];

        for (const endpoint of sendEndpoints) {
          if (sendSuccess) break;
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url} with body:`, JSON.stringify(endpoint.body));
            sendResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              endpoint.body
            );
            console.log("Send to group result:", JSON.stringify(sendResult));
            
            // Check if successful - various response formats
            const sendData = sendResult as { 
              error?: boolean | string; 
              messageId?: string; 
              status?: string;
              key?: { id?: string };
              message?: { key?: { id?: string } };
              id?: string;
              Message?: { ID?: string };
            };
            
            if (
              sendData.error === false || 
              sendData.messageId || 
              sendData.status === "PENDING" ||
              sendData.key?.id ||
              sendData.message?.key?.id ||
              sendData.id ||
              sendData.Message?.ID
            ) {
              sendSuccess = true;
              break;
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        result = sendSuccess 
          ? { success: true, message: "Mensagem enviada com sucesso", data: sendResult }
          : { success: false, message: "Não foi possível enviar a mensagem", lastResult: sendResult };
        break;
      }

      case "send_media": {
        // Send media (image/audio/document) to individual phone
        const { phone, media_url, media_type = "image", caption } = payload as UazapiRequest;
        
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!phone) {
          throw new Error("Telefone é obrigatório");
        }
        
        if (!media_url) {
          throw new Error("URL da mídia é obrigatória");
        }

        const cleanPhone = phone.replace(/\D/g, "");
        console.log(`Sending ${media_type} to: ${cleanPhone}`);
        
        let sendMediaResult: unknown = null;
        let mediaSuccess = false;
        
        // UAZAPI GO v2 - Media endpoints (uses "number" field)
        const mediaEndpoints = [
          { url: `/send/${media_type}`, method: "POST", body: { number: cleanPhone, file: media_url, caption: caption || "" } },
          { url: `/send/${media_type}`, method: "POST", body: { number: cleanPhone, url: media_url, caption: caption || "" } },
          { url: `/send/media`, method: "POST", body: { number: cleanPhone, mediaUrl: media_url, type: media_type, caption: caption || "" } },
          { url: `/chat/send/${media_type}`, method: "POST", body: { Phone: cleanPhone, Url: media_url, Caption: caption || "" } },
        ];

        for (const endpoint of mediaEndpoints) {
          if (mediaSuccess) break;
          try {
            console.log(`Trying media: ${endpoint.method} ${endpoint.url}`);
            sendMediaResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              endpoint.body
            );
            console.log("Send media result:", JSON.stringify(sendMediaResult));
            
            const mediaData = sendMediaResult as { 
              error?: boolean | string; 
              messageId?: string; 
              key?: { id?: string };
              id?: string;
              Message?: { ID?: string };
            };
            
            if (
              mediaData.error === false || 
              mediaData.messageId || 
              mediaData.key?.id ||
              mediaData.id ||
              mediaData.Message?.ID
            ) {
              mediaSuccess = true;
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        result = mediaSuccess 
          ? { success: true, message: "Mídia enviada com sucesso", data: sendMediaResult }
          : { success: false, message: "Não foi possível enviar a mídia", lastResult: sendMediaResult };
        break;
      }

      case "send_media_to_group": {
        // Send media (image/audio/document) to group
        const { group_id, media_url, media_type = "image", caption, file_name } = payload as UazapiRequest;
        
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }
        
        if (!media_url) {
          throw new Error("URL da mídia é obrigatória");
        }

        const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
        console.log(`Sending ${media_type} to group: ${groupJid}, fileName: ${file_name}`);
        
        let sendMediaResult: unknown = null;
        let mediaSuccess = false;
        
        // UAZAPI GO v2 - Media to group (uses "number" field for group JID)
        // Include fileName for documents to preserve original name
        const mediaEndpoints = [
          // Standard UAZAPI format - uses "number" for recipient, with fileName for documents
          { url: `/send/${media_type}`, method: "POST", body: { number: groupJid, file: media_url, caption: caption || "", fileName: file_name || "" } },
          // Alternative with url field
          { url: `/send/${media_type}`, method: "POST", body: { number: groupJid, url: media_url, caption: caption || "", fileName: file_name || "" } },
          // Alternative format with "to" field
          { url: `/send/${media_type}`, method: "POST", body: { to: groupJid, file: media_url, caption: caption || "", fileName: file_name || "" } },
          // Alternative endpoint structure
          { url: `/chat/send/${media_type}`, method: "POST", body: { Phone: groupJid, File: media_url, Caption: caption || "", FileName: file_name || "" } },
          // Generic media endpoint
          { url: `/send/media`, method: "POST", body: { number: groupJid, file: media_url, type: media_type, caption: caption || "", fileName: file_name || "" } },
        ];

        for (const endpoint of mediaEndpoints) {
          if (mediaSuccess) break;
          try {
            console.log(`Trying media to group: ${endpoint.method} ${endpoint.url}`);
            sendMediaResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              endpoint.body
            );
            console.log("Send media to group result:", JSON.stringify(sendMediaResult));
            
            const mediaData = sendMediaResult as { 
              error?: boolean | string; 
              messageId?: string; 
              key?: { id?: string };
              id?: string;
              Message?: { ID?: string };
            };
            
            if (
              mediaData.error === false || 
              mediaData.messageId || 
              mediaData.key?.id ||
              mediaData.id ||
              mediaData.Message?.ID
            ) {
              mediaSuccess = true;
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        result = mediaSuccess 
          ? { success: true, message: "Mídia enviada com sucesso ao grupo", data: sendMediaResult }
          : { success: false, message: "Não foi possível enviar a mídia ao grupo", lastResult: sendMediaResult };
        break;
      }

      case "update_group_name": {
        // Update group name/subject
        const { group_id, group_name } = payload as UazapiRequest;
        
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }
        
        if (!group_name) {
          throw new Error("Nome do grupo é obrigatório");
        }

        const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
        console.log(`Updating group name: ${groupJid} -> ${group_name}`);
        
        let updateResult: unknown = null;
        let updateSuccess = false;
        
        const updateEndpoints = [
          { url: `/group/updateSubject`, method: "POST", body: { groupJid: groupJid, subject: group_name } },
          { url: `/group/updateName`, method: "POST", body: { groupJid: groupJid, name: group_name } },
          { url: `/group/${groupJid}/name`, method: "PUT", body: { name: group_name } },
        ];

        for (const endpoint of updateEndpoints) {
          if (updateSuccess) break;
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            updateResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              endpoint.body
            );
            console.log("Update name result:", JSON.stringify(updateResult));
            
            const updateData = updateResult as { error?: boolean | string; success?: boolean };
            if (updateData.success || updateData.error === false) {
              updateSuccess = true;
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        // Update in database if success
        if (updateSuccess) {
          try {
            await supabase.from("whatsapp_groups")
              .update({ name: group_name, updated_at: new Date().toISOString() })
              .eq("group_jid", groupJid);
          } catch (dbErr) {
            console.log("Failed to update group name in DB:", dbErr);
          }
        }

        result = updateSuccess 
          ? { success: true, message: "Nome do grupo atualizado com sucesso", data: updateResult }
          : { success: false, message: "Não foi possível atualizar o nome do grupo", lastResult: updateResult };
        break;
      }

      case "update_group_description": {
        // Update group description
        const { group_id, group_description } = payload as UazapiRequest;
        
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }

        const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
        console.log(`Updating group description: ${groupJid}`);
        
        let updateResult: unknown = null;
        let updateSuccess = false;
        
        const updateEndpoints = [
          { url: `/group/updateDescription`, method: "POST", body: { groupJid: groupJid, description: group_description || "" } },
          { url: `/group/${groupJid}/description`, method: "PUT", body: { description: group_description || "" } },
        ];

        for (const endpoint of updateEndpoints) {
          if (updateSuccess) break;
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            updateResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              endpoint.body
            );
            console.log("Update description result:", JSON.stringify(updateResult));
            
            const updateData = updateResult as { error?: boolean | string; success?: boolean };
            if (updateData.success || updateData.error === false) {
              updateSuccess = true;
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        // Update in database if success
        if (updateSuccess) {
          try {
            await supabase.from("whatsapp_groups")
              .update({ description: group_description, updated_at: new Date().toISOString() })
              .eq("group_jid", groupJid);
          } catch (dbErr) {
            console.log("Failed to update group description in DB:", dbErr);
          }
        }

        result = updateSuccess 
          ? { success: true, message: "Descrição do grupo atualizada com sucesso", data: updateResult }
          : { success: false, message: "Não foi possível atualizar a descrição do grupo", lastResult: updateResult };
        break;
      }

      case "update_group_image": {
        // Update group image
        const { group_id, group_image } = payload as UazapiRequest;
        
        if (!savedInstanceToken) {
          throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
        }
        
        if (!group_id) {
          throw new Error("ID do grupo é obrigatório");
        }
        
        if (!group_image) {
          throw new Error("URL da imagem é obrigatória");
        }

        const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
        console.log(`Updating group image: ${groupJid}`);
        
        let updateResult: unknown = null;
        let updateSuccess = false;
        
        const updateEndpoints = [
          { url: `/group/updateImage`, method: "POST", body: { groupJid: groupJid, image: group_image } },
          { url: `/group/${groupJid}/image`, method: "PUT", body: { image: group_image } },
        ];

        for (const endpoint of updateEndpoints) {
          if (updateSuccess) break;
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            updateResult = await uazapiInstanceRequest(
              endpoint.url, 
              endpoint.method, 
              savedInstanceToken,
              endpoint.body
            );
            console.log("Update image result:", JSON.stringify(updateResult));
            
            const updateData = updateResult as { error?: boolean | string; success?: boolean };
            if (updateData.success || updateData.error === false) {
              updateSuccess = true;
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }

        result = updateSuccess 
          ? { success: true, message: "Imagem do grupo atualizada com sucesso", data: updateResult }
          : { success: false, message: "Não foi possível atualizar a imagem do grupo", lastResult: updateResult };
        break;
      }

      // ========== SUPPORT WHATSAPP ACTIONS ==========
      case "create_support_instance": {
        const supportInstanceName = payload.instance_name || "suporte-roy";
        
        // Check if super admin
        const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
        if (!isSuperAdmin) {
          return new Response(
            JSON.stringify({ error: "Only super admins can manage support WhatsApp" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // First, delete ALL instances with this name to avoid duplicates
        try {
          const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
            name?: string; 
            id?: string;
          }>;
          
          const duplicates = allInstances.filter(i => i.name === supportInstanceName);
          console.log(`Found ${duplicates.length} existing instances with name ${supportInstanceName}`);
          
          for (const dup of duplicates) {
            try {
              // Try delete by name first
              await uazapiAdminRequest(`/instance/delete/${supportInstanceName}`, "DELETE");
              console.log(`Deleted instance by name: ${supportInstanceName}`);
            } catch {
              // Try delete by ID if available
              if (dup.id) {
                try {
                  await uazapiAdminRequest(`/instance/delete/${dup.id}`, "DELETE");
                  console.log(`Deleted instance by ID: ${dup.id}`);
                } catch (e2) {
                  console.log(`Failed to delete instance ${dup.id}:`, (e2 as Error).message);
                }
              }
            }
          }
          
          if (duplicates.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (err) {
          console.log(`Error cleaning up instances:`, (err as Error).message);
        }

        // Create instance via UAZAPI
        console.log(`Creating support instance: ${supportInstanceName}`);
        const createResult = await uazapiAdminRequest("/instance/init", "POST", {
          name: supportInstanceName,
        }) as {
          token?: string;
          instance?: { token?: string; qrcode?: string };
          qrcode?: string;
        };
        
        console.log(`Create instance response:`, JSON.stringify(createResult).slice(0, 500));

        const instanceToken = createResult.token || createResult.instance?.token;
        let qrcodeBase64 = createResult.qrcode || createResult.instance?.qrcode || "";

        if (!instanceToken) {
          throw new Error("Failed to create instance - no token returned");
        }

        // Save token immediately
        await supabase
          .from("system_settings")
          .upsert({
            key: "support_whatsapp",
            value: {
              instance_name: supportInstanceName,
              instance_token: instanceToken,
              phone: null,
              status: "connecting",
              qr_code: null,
            },
          }, { onConflict: 'key' });

        // Wait for UAZAPI to fully register the instance
        await new Promise(resolve => setTimeout(resolve, 3000));

        // UAZAPI GO: Call /connect with instance token to trigger QR generation
        if (!qrcodeBase64 && instanceToken) {
          console.log(`Triggering QR via instance token /connect`);
          
          try {
            const connectResult = await uazapiInstanceRequest("/connect", "GET", instanceToken) as {
              base64?: string;
              qrcode?: string | { base64?: string };
              qr?: string;
            };
            console.log(`Connect result:`, JSON.stringify(connectResult).slice(0, 500));
            
            qrcodeBase64 = connectResult.base64 || 
                           connectResult.qr ||
                           (typeof connectResult.qrcode === 'string' ? connectResult.qrcode : connectResult.qrcode?.base64) || "";
          } catch (err) {
            console.log(`Instance /connect failed:`, (err as Error).message);
          }
        }

        // Configure webhook for support
        if (instanceToken) {
          const supportWebhookUrl = `${supabaseUrl}/functions/v1/support-webhook`;
          try {
            await uazapiInstanceRequest("/webhook/set", "POST", instanceToken, {
              url: supportWebhookUrl,
              enabled: true,
              webhookByEvents: true,
              events: ["messages", "connection", "qrcode", "MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
            });
            console.log(`Support webhook configured`);
          } catch (err) {
            console.log(`Webhook config failed:`, (err as Error).message);
          }
        }

        // Update system settings with final result
        await supabase
          .from("system_settings")
          .update({
            value: {
              instance_name: supportInstanceName,
              instance_token: instanceToken,
              phone: null,
              status: qrcodeBase64 ? "connecting" : "disconnected",
              qr_code: qrcodeBase64,
            },
          })
          .eq("key", "support_whatsapp");

        result = {
          success: true,
          instance_name: supportInstanceName,
          qr_code: qrcodeBase64,
          token: instanceToken,
        };
        break;
      }

      case "refresh_support_qr": {
        const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
        if (!isSuperAdmin) {
          return new Response(
            JSON.stringify({ error: "Only super admins can manage support WhatsApp" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get current settings
        const { data: settings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "support_whatsapp")
          .single();

        const supportConfig = settings?.value as { instance_name?: string; instance_token?: string } | null;
        const instanceName = supportConfig?.instance_name || "suporte-roy";
        
        // Get QR code - simplified approach
        let qrcodeBase64 = "";
        let newToken = supportConfig?.instance_token;
        
        // First, try to get QR with existing token
        if (newToken) {
          console.log(`Refresh: Trying with existing token ${newToken.slice(0, 8)}...`);
          try {
            const connectResult = await uazapiInstanceRequest("/connect", "GET", newToken) as {
              base64?: string; qrcode?: string; qr?: string;
            };
            qrcodeBase64 = connectResult.base64 || connectResult.qr || 
                          (typeof connectResult.qrcode === 'string' ? connectResult.qrcode : '') || "";
            if (qrcodeBase64) {
              console.log(`QR found with existing token`);
            }
          } catch (err) {
            console.log(`Existing token /connect failed:`, (err as Error).message);
          }
        }
        
        // If no QR, delete all instances with this name and create fresh
        if (!qrcodeBase64) {
          console.log(`No QR code, recreating instance...`);
          
          // Delete all instances with this name
          try {
            const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
              name?: string; id?: string;
            }>;
            
            const duplicates = allInstances.filter(i => i.name === instanceName);
            console.log(`Found ${duplicates.length} instances to delete`);
            
            for (const dup of duplicates) {
              try {
                await uazapiAdminRequest(`/instance/delete/${instanceName}`, "DELETE");
              } catch {
                if (dup.id) {
                  try {
                    await uazapiAdminRequest(`/instance/delete/${dup.id}`, "DELETE");
                  } catch {}
                }
              }
            }
            
            if (duplicates.length > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (err) {
            console.log(`Cleanup failed:`, (err as Error).message);
          }
          
          // Create new instance
          try {
            const createResult = await uazapiAdminRequest("/instance/init", "POST", {
              name: instanceName,
            }) as { token?: string; instance?: { token?: string } };
            
            newToken = createResult.token || createResult.instance?.token;
            console.log(`Created new instance, token: ${newToken?.slice(0, 8)}...`);
            
            if (newToken) {
              // Wait for initialization
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Get QR
              try {
                const connectResult = await uazapiInstanceRequest("/connect", "GET", newToken) as {
                  base64?: string; qrcode?: string; qr?: string;
                };
                qrcodeBase64 = connectResult.base64 || connectResult.qr || 
                              (typeof connectResult.qrcode === 'string' ? connectResult.qrcode : '') || "";
                console.log(`QR from new instance: ${qrcodeBase64 ? 'found' : 'not found'}`);
              } catch (e) {
                console.log(`New instance /connect failed:`, (e as Error).message);
              }
            }
          } catch (err) {
            console.log(`Create instance failed:`, (err as Error).message);
          }
        }

        // Update settings
        await supabase
          .from("system_settings")
          .update({
            value: {
              instance_name: instanceName,
              instance_token: newToken,
              phone: null,
              qr_code: qrcodeBase64,
              status: qrcodeBase64 ? "connecting" : "disconnected",
            },
          })
          .eq("key", "support_whatsapp");

        result = { success: true, qr_code: qrcodeBase64, token: newToken };
        break;
      }

      case "check_support_status": {
        const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
        if (!isSuperAdmin) {
          return new Response(
            JSON.stringify({ error: "Only super admins can manage support WhatsApp" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: settings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "support_whatsapp")
          .single();

        const supportConfig = settings?.value as { instance_name?: string; instance_token?: string; qr_code?: string } | null;
        if (!supportConfig?.instance_token) {
          result = { status: "disconnected" };
          break;
        }

        // Check status via UAZAPI
        let status = "disconnected";
        let phone = null;
        try {
          const statusResult = await uazapiInstanceRequest("/status", "GET", supportConfig.instance_token) as {
            status?: string;
            state?: string;
            connected?: boolean;
            phone?: string;
            jid?: string;
          };
          
          if (statusResult.connected || statusResult.status === "connected" || statusResult.state === "connected") {
            status = "connected";
            phone = statusResult.phone || statusResult.jid?.split("@")[0] || null;
          }
        } catch (err) {
          console.log("Status check failed:", (err as Error).message);
        }

        // Update settings
        await supabase
          .from("system_settings")
          .update({
            value: {
              ...supportConfig,
              status,
              phone,
              qr_code: status === "connected" ? null : supportConfig.qr_code,
            },
          })
          .eq("key", "support_whatsapp");

        result = { success: true, status, phone };
        break;
      }

      case "disconnect_support": {
        const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
        if (!isSuperAdmin) {
          return new Response(
            JSON.stringify({ error: "Only super admins can manage support WhatsApp" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: settings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "support_whatsapp")
          .single();

        const supportConfig = settings?.value as { instance_name?: string; instance_token?: string } | null;
        if (supportConfig?.instance_token) {
          try {
            await uazapiInstanceRequest("/logout", "POST", supportConfig.instance_token);
          } catch (err) {
            console.log("Logout failed:", (err as Error).message);
          }
        }

        // Reset settings
        await supabase
          .from("system_settings")
          .update({
            value: {
              instance_name: null,
              instance_token: null,
              phone: null,
              status: "disconnected",
              qr_code: null,
            },
          })
          .eq("key", "support_whatsapp");

        result = { success: true };
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
