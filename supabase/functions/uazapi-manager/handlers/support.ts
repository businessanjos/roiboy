import { corsHeaders } from "../lib/cors.ts";
import type { UazapiRequest, UserData, SupabaseClient } from "../lib/types.ts";

interface HandlerContext {
  supabase: SupabaseClient;
  supabaseUrl: string;
  // deno-lint-ignore no-explicit-any
  user: any;
  userData: UserData;
  accountId: string;
  payload: UazapiRequest;
  // deno-lint-ignore no-explicit-any
  uazapiAdminRequest: any;
  // deno-lint-ignore no-explicit-any
  uazapiInstanceRequest: any;
  // deno-lint-ignore no-explicit-any
  configureWebhook: any;
}

export async function handleSupportAction(ctx: HandlerContext): Promise<unknown | Response> {
  const { 
    supabase, supabaseUrl, user, payload,
    uazapiAdminRequest, uazapiInstanceRequest
  } = ctx;
  const { action } = payload;

  // Check if super admin for all support actions
  const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
  if (!isSuperAdmin) {
    return new Response(
      JSON.stringify({ error: "Only super admins can manage support WhatsApp" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  switch (action) {
    case "create_support_instance": {
      const supportInstanceName = payload.instance_name || "suporte-roy";
      
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
            await uazapiAdminRequest(`/instance/delete/${supportInstanceName}`, "DELETE");
            console.log(`Deleted instance by name: ${supportInstanceName}`);
          } catch {
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

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to get QR code
      if (!qrcodeBase64 && instanceToken) {
        console.log(`Triggering QR with instance token ${instanceToken.slice(0, 8)}...`);
        
        const instanceQrEndpoints = [
          { url: `/connect`, method: "POST" },
          { url: `/connect`, method: "GET" },
          { url: `/qr`, method: "GET" },
          { url: `/qrcode`, method: "GET" },
        ];
        
        for (const endpoint of instanceQrEndpoints) {
          if (qrcodeBase64) break;
          try {
            console.log(`Trying instance: ${endpoint.method} ${endpoint.url}`);
            const connectResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, instanceToken) as {
              base64?: string;
              qrcode?: string | { base64?: string };
              qr?: string;
              data?: { base64?: string; qrcode?: string };
            };
            
            qrcodeBase64 = connectResult.base64 || 
                           connectResult.qr ||
                           connectResult.data?.base64 ||
                           connectResult.data?.qrcode ||
                           (typeof connectResult.qrcode === 'string' ? connectResult.qrcode : connectResult.qrcode?.base64) || "";
            
            if (qrcodeBase64) {
              console.log(`QR found via instance ${endpoint.url}`);
            }
          } catch (err) {
            console.log(`Instance ${endpoint.url} failed:`, (err as Error).message);
          }
        }
      }
      
      if (!qrcodeBase64) {
        console.log(`Trying admin endpoints for QR...`);
        
        const adminQrEndpoints = [
          { url: `/instance/connect/${supportInstanceName}`, method: "POST" },
          { url: `/instance/qr/${supportInstanceName}`, method: "GET" },
          { url: `/qr/${supportInstanceName}`, method: "GET" },
        ];
        
        for (const endpoint of adminQrEndpoints) {
          if (qrcodeBase64) break;
          try {
            console.log(`Trying admin: ${endpoint.method} ${endpoint.url}`);
            const connectResult = await uazapiAdminRequest(endpoint.url, endpoint.method) as {
              base64?: string;
              qrcode?: string | { base64?: string };
              qr?: string;
              data?: { base64?: string; qrcode?: string };
            };
            
            qrcodeBase64 = connectResult.base64 || 
                           connectResult.qr ||
                           connectResult.data?.base64 ||
                           connectResult.data?.qrcode ||
                           (typeof connectResult.qrcode === 'string' ? connectResult.qrcode : connectResult.qrcode?.base64) || "";
            
            if (qrcodeBase64) {
              console.log(`QR found via admin ${endpoint.url}`);
            }
          } catch (err) {
            console.log(`Admin ${endpoint.url} failed:`, (err as Error).message);
          }
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

      return {
        success: true,
        instance_name: supportInstanceName,
        qr_code: qrcodeBase64,
        token: instanceToken,
      };
    }

    case "refresh_support_qr": {
      const { data: refreshSettings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "support_whatsapp")
        .single();

      const supportConfig = refreshSettings?.value as { instance_name?: string; instance_token?: string } | null;
      const supportInstanceName = supportConfig?.instance_name || "suporte-roy";
      
      console.log(`Refresh QR for support instance: ${supportInstanceName}`);
      
      let existingSupportToken: string | undefined = supportConfig?.instance_token;
      
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name: string; 
          id: string; 
          token?: string; 
          status?: string;
        }>;
        
        if (Array.isArray(allInstances)) {
          const supportInstance = allInstances.find(i => i.name === supportInstanceName);
          
          if (supportInstance) {
            console.log(`Found existing support instance with status: ${supportInstance.status}`);
            existingSupportToken = supportInstance.token || existingSupportToken;
          }
        }
      } catch (err) {
        console.log(`Error checking existing instances:`, (err as Error).message);
      }
      
      let qrcodeBase64 = "";
      
      if (existingSupportToken) {
        const qrEndpoints = [
          { url: `/connect`, method: "POST" },
          { url: `/connect`, method: "GET" },
          { url: `/qr`, method: "GET" },
        ];
        
        for (const endpoint of qrEndpoints) {
          if (qrcodeBase64) break;
          try {
            console.log(`Trying instance: ${endpoint.method} ${endpoint.url}`);
            const connectResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, existingSupportToken) as {
              base64?: string;
              qrcode?: string | { base64?: string };
              qr?: string;
              data?: { base64?: string; qrcode?: string };
            };
            
            qrcodeBase64 = connectResult.base64 || 
                           connectResult.qr ||
                           connectResult.data?.base64 ||
                           connectResult.data?.qrcode ||
                           (typeof connectResult.qrcode === 'string' ? connectResult.qrcode : connectResult.qrcode?.base64) || "";
            
            if (qrcodeBase64) {
              console.log(`QR found via instance ${endpoint.url}`);
            }
          } catch (err) {
            console.log(`Instance ${endpoint.url} failed:`, (err as Error).message);
          }
        }
      }
      
      if (!qrcodeBase64) {
        const adminEndpoints = [
          { url: `/instance/connect/${supportInstanceName}`, method: "POST" },
          { url: `/instance/qr/${supportInstanceName}`, method: "GET" },
        ];
        
        for (const endpoint of adminEndpoints) {
          if (qrcodeBase64) break;
          try {
            console.log(`Trying admin: ${endpoint.method} ${endpoint.url}`);
            const connectResult = await uazapiAdminRequest(endpoint.url, endpoint.method) as {
              base64?: string;
              qrcode?: string | { base64?: string };
              qr?: string;
              data?: { base64?: string; qrcode?: string };
            };
            
            qrcodeBase64 = connectResult.base64 || 
                           connectResult.qr ||
                           connectResult.data?.base64 ||
                           connectResult.data?.qrcode ||
                           (typeof connectResult.qrcode === 'string' ? connectResult.qrcode : connectResult.qrcode?.base64) || "";
          } catch (err) {
            console.log(`Admin ${endpoint.url} failed:`, (err as Error).message);
          }
        }
      }
      
      // Update system settings with new QR
      if (qrcodeBase64) {
        await supabase
          .from("system_settings")
          .update({
            value: {
              ...(refreshSettings?.value as object || {}),
              instance_token: existingSupportToken,
              qr_code: qrcodeBase64,
              status: "connecting",
            },
          })
          .eq("key", "support_whatsapp");
      }

      return {
        success: !!qrcodeBase64,
        qr_code: qrcodeBase64,
        instance_name: supportInstanceName,
      };
    }

    case "disconnect_support": {
      const { data: disconnectSettings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "support_whatsapp")
        .single();

      const supportConfig = disconnectSettings?.value as { instance_name?: string; instance_token?: string } | null;
      const supportInstanceName = supportConfig?.instance_name || "suporte-roy";
      const supportInstanceToken = supportConfig?.instance_token;

      console.log(`Disconnecting support instance: ${supportInstanceName}`);

      let disconnected = false;

      if (supportInstanceToken) {
        try {
          await uazapiInstanceRequest("/logout", "POST", supportInstanceToken);
          disconnected = true;
          console.log("Disconnected via instance token");
        } catch (err) {
          console.log("Instance logout failed:", (err as Error).message);
        }
      }

      if (!disconnected) {
        try {
          await uazapiAdminRequest(`/instance/logout/${supportInstanceName}`, "POST");
          disconnected = true;
          console.log("Disconnected via admin endpoint");
        } catch (err) {
          console.log("Admin logout failed:", (err as Error).message);
        }
      }

      // Update system settings
      await supabase
        .from("system_settings")
        .update({
          value: {
            ...(disconnectSettings?.value as object || {}),
            status: "disconnected",
            phone: null,
            qr_code: null,
          },
        })
        .eq("key", "support_whatsapp");

      return { success: true, disconnected };
    }

    case "check_support_status": {
      const { data: statusSettings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "support_whatsapp")
        .single();

      const supportConfig = statusSettings?.value as { 
        instance_name?: string; 
        instance_token?: string;
        phone?: string;
        status?: string;
      } | null;
      
      const supportInstanceName = supportConfig?.instance_name || "suporte-roy";
      const supportInstanceToken = supportConfig?.instance_token;

      console.log(`Checking support status for: ${supportInstanceName}`);

      let connectionState = "unknown";
      let profileName = "";
      let owner = "";

      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          status?: string;
          owner?: string;
          profileName?: string;
        }>;
        
        const supportInstance = allInstances.find(i => i.name === supportInstanceName);
        
        if (supportInstance) {
          connectionState = supportInstance.status || "unknown";
          profileName = supportInstance.profileName || "";
          owner = supportInstance.owner || "";
          
          console.log(`Found support instance with status: ${connectionState}`);
        }
      } catch (err) {
        console.log(`Error checking support status:`, (err as Error).message);
      }

      // Update system settings with current status
      if (connectionState !== "unknown") {
        const isConnected = connectionState === "connected" || connectionState === "open";
        await supabase
          .from("system_settings")
          .update({
            value: {
              ...(statusSettings?.value as object || {}),
              status: isConnected ? "connected" : "disconnected",
              phone: owner || null,
            },
          })
          .eq("key", "support_whatsapp");
      }

      return {
        status: connectionState,
        connected: connectionState === "connected" || connectionState === "open",
        instance_name: supportInstanceName,
        profileName,
        owner,
      };
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown support action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}
