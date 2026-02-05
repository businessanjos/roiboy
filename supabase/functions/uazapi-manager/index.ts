import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./lib/cors.ts";
import type { UazapiRequest, UserData, ExistingWhatsapp, IntegrationConfig } from "./lib/types.ts";
import { uazapiAdminRequest, uazapiInstanceRequest, uazapiInstanceRequestWithRetry } from "./lib/uazapi-client.ts";
import { logWhatsAppChangeAndNotify, getSectorDisplayName } from "./lib/audit-logger.ts";
import { configureWebhook } from "./lib/webhook-config.ts";

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

    // Get user's account AND role for authorization
    const { data: userData } = await supabase
      .from("users")
      .select("id, name, account_id, role, is_also_admin")
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
    
    // SECURITY: Define admin-only actions for WhatsApp management
    const adminOnlyActions = ["create", "connect", "disconnect", "qrcode", "paircode", "configure_webhook", "link_instance", "add_instance_to_sector", "update_instance_pin", "unlink_instance"];
    const isAdminAction = adminOnlyActions.includes(payload.action);
    const isAdmin = userData.role === "admin" || userData.role === "super_admin" || userData.is_also_admin === true;
    
    // Block non-admins from admin-only actions
    if (isAdminAction && !isAdmin) {
      console.log(`[SECURITY] Non-admin user ${user.id} (role: ${userData.role}) attempted action: ${payload.action}`);
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem gerenciar conexões WhatsApp" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, sector_id, integration_id } = payload;

    // Build query for existing integration
    let existingWhatsapp: ExistingWhatsapp | null = null;
    
    if (integration_id) {
      const { data } = await supabase
        .from("integrations")
        .select("config, status, sector_id, id")
        .eq("id", integration_id)
        .eq("account_id", accountId)
        .single();
      existingWhatsapp = data;
      console.log(`[UAZAPI] Action: ${action}, Integration by ID: ${integration_id}, Found: ${existingWhatsapp ? 'yes' : 'no'}`);
    } else {
      let integrationQuery = supabase
        .from("integrations")
        .select("config, status, sector_id, id")
        .eq("account_id", accountId)
        .eq("type", "whatsapp");

      if (sector_id) {
        integrationQuery = integrationQuery.eq("sector_id", sector_id);
      } else {
        integrationQuery = integrationQuery.is("sector_id", null);
      }

      const { data } = await integrationQuery.limit(1);
      existingWhatsapp = data?.[0] || null;
      console.log(`[UAZAPI] Action: ${action}, Sector: ${sector_id || 'default'}, Found: ${existingWhatsapp ? 'yes' : 'no'}`);
    }

    // Get saved instance info
    const savedInstanceName = (existingWhatsapp?.config as IntegrationConfig)?.instance_name;
    let savedInstanceToken = (existingWhatsapp?.config as IntegrationConfig)?.instance_token;
    const actualInstanceName = savedInstanceName;
    
    // Check if we should reuse existing instance
    const shouldReuseInstance = !!savedInstanceName && (action === "connect" || action === "qrcode" || action === "paircode" || action === "status" || action === "disconnect");
    const uniqueSuffix = sector_id ? `-${sector_id.slice(0, 4)}` : "";

    // Token recovery logic for missing tokens
    if (!savedInstanceToken && savedInstanceName) {
      console.log(`Token missing for instance ${savedInstanceName}. Fetching from /instance/all...`);
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
          status?: string;
          owner?: string;
        }>;
        
        console.log(`Found ${allInstances.length} instances`);
        
        const instance = allInstances.find(i => i.name === savedInstanceName);
        
        if (instance?.token) {
          savedInstanceToken = instance.token;
          console.log(`Token found: ${savedInstanceToken.slice(0, 8)}... for instance ${actualInstanceName}`);
          
          if (existingWhatsapp?.id) {
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
              .eq("id", existingWhatsapp.id);
            console.log(`Token saved to database for integration ${existingWhatsapp.id}`);
          }
        } else {
          console.log(`Instance ${savedInstanceName} not found or has no token`);
        }
      } catch (err) {
        console.log("Failed to fetch from /instance/all:", (err as Error).message);
      }
    }
    
    const shouldGenerateNewName = action === "create" && !shouldReuseInstance;
    const instanceName = shouldGenerateNewName
      ? `roy-${accountId.slice(0, 8)}${uniqueSuffix}`
      : (actualInstanceName || savedInstanceName || `roy-${accountId.slice(0, 8)}${uniqueSuffix}`);

    console.log(`UAZAPI action: ${action} for account ${accountId}, sector: ${sector_id || 'default'}, instance: ${instanceName}, integrationId: ${existingWhatsapp?.id || 'none'}, reuse: ${shouldReuseInstance}, hasToken: ${!!savedInstanceToken}`);

    // Route to appropriate handler
    const handlerContext = {
      supabase,
      supabaseUrl,
      user,
      userData: userData as UserData,
      accountId,
      payload,
      existingWhatsapp,
      savedInstanceToken,
      savedInstanceName,
      instanceName,
      sector_id,
      integration_id,
      corsHeaders,
      // Pass helper functions
      uazapiAdminRequest,
      uazapiInstanceRequest,
      uazapiInstanceRequestWithRetry,
      logWhatsAppChangeAndNotify,
      configureWebhook,
      getSectorDisplayName,
    };

    let result: unknown;

    // Import and call handlers dynamically based on action category
    switch (action) {
      // Instance management actions
      case "create":
      case "connect":
      case "qrcode":
      case "paircode":
      case "status":
      case "disconnect":
      case "configure_webhook":
      case "fetch_token":
      case "list_instances":
      case "link_instance":
      case "unlink_instance": {
        const { handleInstanceAction } = await import("./handlers/instance.ts");
        result = await handleInstanceAction(handlerContext);
        if (result instanceof Response) return result;
        break;
      }

      // Sector management actions
      case "add_instance_to_sector":
      case "update_instance_pin":
      case "verify_instance_pin":
      case "list_sector_instances": {
        const { handleSectorAction } = await import("./handlers/sector.ts");
        result = await handleSectorAction(handlerContext);
        if (result instanceof Response) return result;
        break;
      }

      // Messaging actions
      case "send_text":
      case "send_media":
      case "send_to_group":
      case "send_media_to_group":
      case "delete_message":
      case "edit_message": {
        const { handleMessagingAction } = await import("./handlers/messaging.ts");
        result = await handleMessagingAction(handlerContext);
        if (result instanceof Response) return result;
        break;
      }

      // Group management actions
      case "list_groups":
      case "sync_groups":
      case "save_selected_groups":
      case "create_group":
      case "group_participants":
      case "add_participant":
      case "remove_participant":
      case "update_group_name":
      case "update_group_description":
      case "update_group_image": {
        const { handleGroupAction } = await import("./handlers/groups.ts");
        result = await handleGroupAction(handlerContext);
        if (result instanceof Response) return result;
        break;
      }

      // Sync and import actions
      case "sync-chat-history":
      case "import-conversations": {
        const { handleSyncAction } = await import("./handlers/sync.ts");
        result = await handleSyncAction(handlerContext);
        if (result instanceof Response) return result;
        break;
      }

      // Support WhatsApp actions
      case "create_support_instance":
      case "refresh_support_qr":
      case "disconnect_support":
      case "check_support_status": {
        const { handleSupportAction } = await import("./handlers/support.ts");
        result = await handleSupportAction(handlerContext);
        if (result instanceof Response) return result;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("UAZAPI Manager Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
