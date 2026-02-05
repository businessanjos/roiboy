import { corsHeaders } from "../lib/cors.ts";
import type { UazapiRequest, UserData, ExistingWhatsapp, IntegrationConfig, SupabaseClient } from "../lib/types.ts";

interface HandlerContext {
  supabase: SupabaseClient;
  supabaseUrl: string;
  // deno-lint-ignore no-explicit-any
  user: any;
  userData: UserData;
  accountId: string;
  payload: UazapiRequest;
  existingWhatsapp: ExistingWhatsapp | null;
  savedInstanceToken: string | undefined;
  savedInstanceName: string | undefined;
  instanceName: string;
  sector_id: string | undefined;
  integration_id: string | undefined;
  // deno-lint-ignore no-explicit-any
  uazapiAdminRequest: any;
  // deno-lint-ignore no-explicit-any
  uazapiInstanceRequest: any;
  // deno-lint-ignore no-explicit-any
  logWhatsAppChangeAndNotify: any;
  // deno-lint-ignore no-explicit-any
  configureWebhook: any;
}

export async function handleInstanceAction(ctx: HandlerContext): Promise<unknown | Response> {
  const { 
    supabase, supabaseUrl, userData, accountId, payload, existingWhatsapp,
    savedInstanceToken, savedInstanceName, instanceName, sector_id, integration_id,
    uazapiAdminRequest, uazapiInstanceRequest, logWhatsAppChangeAndNotify, configureWebhook
  } = ctx;
  const { action, phone } = payload;

  switch (action) {
    case "create": {
      const createResult = await uazapiAdminRequest("/instance/init", "POST", {
        name: instanceName,
      }) as {
        token?: string;
        instance?: { token?: string; id?: string; qrcode?: string };
        qrcode?: string;
        name?: string;
      };

      console.log("Create result:", JSON.stringify(createResult));

      const instanceToken = createResult.token || createResult.instance?.token;

      await new Promise(resolve => setTimeout(resolve, 4000));

      let qrcodeBase64 = "";
      let connectResult: unknown = null;
      
      if (instanceToken) {
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

      if (instanceToken) {
        try {
          await configureWebhook(instanceToken, instanceName, supabaseUrl);
        } catch (err) {
          console.log("Webhook configuration failed (non-blocking):", (err as Error).message);
        }
      }

      await supabase
        .from("integrations")
        .upsert({
          account_id: accountId,
          type: "whatsapp",
          sector_id: sector_id || null,
          status: qrcodeBase64 ? "pending" : "disconnected",
          config: {
            provider: "uazapi",
            instance_name: instanceName,
            instance_token: instanceToken,
            qrcode_base64: qrcodeBase64,
            created_at: new Date().toISOString(),
          },
        }, { onConflict: "account_id,type,sector_id" });

      return {
        ...createResult as object,
        qrcode_base64: qrcodeBase64,
        token: instanceToken,
      };
    }

    case "connect": {
      return await uazapiAdminRequest(`/instance/connect/${instanceName}`, "GET");
    }

    case "qrcode": {
      return await uazapiAdminRequest(`/instance/connect/${instanceName}`, "GET");
    }

    case "paircode": {
      if (!phone) {
        return new Response(
          JSON.stringify({ error: "Phone number is required for pairing code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanPhone = phone.replace(/\D/g, "");
      console.log(`Generating pairing code for phone: ${cleanPhone}`);
      
      let pairingIntegrationQuery = supabase
        .from("integrations")
        .select("config, id")
        .eq("account_id", accountId)
        .eq("type", "whatsapp");
      
      if (sector_id) {
        pairingIntegrationQuery = pairingIntegrationQuery.eq("sector_id", sector_id);
      }
      
      const { data: existingIntegration } = await pairingIntegrationQuery.maybeSingle();

      const instanceToken = (existingIntegration?.config as { instance_token?: string })?.instance_token;
      
      let paircode = "";
      let paircodeResult: unknown = null;
      
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
        await supabase
          .from("integrations")
          .upsert({
            account_id: accountId,
            type: "whatsapp",
            sector_id: sector_id || null,
            status: "pending",
            config: {
              provider: "uazapi",
              instance_name: instanceName,
              instance_token: instanceToken,
              paircode: paircode,
              phone_number: cleanPhone,
              paircode_generated_at: new Date().toISOString(),
            },
          }, { onConflict: "account_id,type,sector_id" });
      }

      return {
        paircode,
        phone: cleanPhone,
        instance_name: instanceName,
      };
    }

    case "status": {
      const wasDisconnectedManually = (existingWhatsapp?.config as IntegrationConfig)?.disconnected_manually;
      
      if (existingWhatsapp?.status === "disconnected" && wasDisconnectedManually) {
        console.log("Status check: Locally disconnected manually, returning disconnected state");
        return { 
          state: "disconnected", 
          connected: false,
          instance_name: savedInstanceName,
          locally_disconnected: true,
        };
      }
      
      let connectionState = "unknown";
      let instanceToken = savedInstanceToken;
      let profileName = "";
      let profilePicUrl = "";
      let instanceOwner = "";
      
      console.log(`Status check - savedToken: ${instanceToken ? "found" : "not found"}`);
      
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
          status?: string;
          owner?: string;
          profileName?: string;
          profilePicUrl?: string;
        }>;
        
        console.log(`Status check: Found ${allInstances.length} instances from /instance/all`);
        
        let targetInstance = allInstances.find(i => i.name === instanceName);
        
        if (!targetInstance && !savedInstanceName) {
          const accountPrefix = `roy-${accountId.slice(0, 8)}`;
          targetInstance = allInstances.find(i => i.name?.startsWith(accountPrefix));
        }
        
        if (targetInstance) {
          connectionState = targetInstance.status || "unknown";
          instanceToken = targetInstance.token || instanceToken;
          profileName = targetInstance.profileName || "";
          profilePicUrl = targetInstance.profilePicUrl || "";
          instanceOwner = targetInstance.owner || "";
          
          console.log(`Found instance ${targetInstance.name} with status: ${connectionState}, profileName: ${profileName}`);
          
          if (instanceToken && !savedInstanceToken && existingWhatsapp?.id) {
            await supabase
              .from("integrations")
              .update({
                config: {
                  ...(existingWhatsapp?.config as object || {}),
                  instance_name: targetInstance.name,
                  instance_token: instanceToken,
                  token_recovered_at: new Date().toISOString(),
                },
              })
              .eq("id", existingWhatsapp.id);
            console.log(`Token recovered and saved for instance ${targetInstance.name}`);
          }
        }
      } catch (err) {
        console.log(`Failed to get instances from /instance/all:`, (err as Error).message);
      }
      
      if (connectionState === "unknown" && instanceToken) {
        const statusEndpoints = [
          `/status`,
          `/instance/status`,
          `/connection/status`,
        ];
        
        for (const url of statusEndpoints) {
          if (connectionState !== "unknown") break;
          try {
            const statusResult = await uazapiInstanceRequest(url, "GET", instanceToken) as {
              state?: string;
              status?: string;
              connected?: boolean;
              connection?: { state?: string };
            };
            
            connectionState = statusResult.state || 
                              statusResult.status || 
                              statusResult.connection?.state ||
                              (statusResult.connected ? "connected" : "unknown");
          } catch (err) {
            console.log(`Status ${url} failed:`, (err as Error).message);
          }
        }
      }

      const isConnected = connectionState === "connected" || connectionState === "open";
      
      if (existingWhatsapp?.id) {
        const currentConfig = existingWhatsapp.config as IntegrationConfig || {};
        await supabase
          .from("integrations")
          .update({ 
            status: isConnected ? "connected" : "disconnected",
            config: {
              ...currentConfig,
              owner: instanceOwner || currentConfig.owner,
              phone_number: instanceOwner || currentConfig.phone_number,
              profile_name: profileName || currentConfig.profile_name,
              profile_pic_url: profilePicUrl || currentConfig.profile_pic_url,
              last_status_check: new Date().toISOString(),
            },
          })
          .eq("id", existingWhatsapp.id);
      }

      return {
        state: connectionState,
        connected: isConnected,
        instance_name: instanceName,
        profileName,
        profilePicUrl,
        owner: instanceOwner,
      };
    }

    case "disconnect": {
      console.log(`Disconnecting instance: ${instanceName}`);
      
      let disconnected = false;
      
      if (savedInstanceToken) {
        const tokenEndpoints = [
          { url: `/logout`, method: "POST" },
          { url: `/instance/logout`, method: "POST" },
          { url: `/disconnect`, method: "POST" },
        ];
        
        for (const endpoint of tokenEndpoints) {
          if (disconnected) break;
          try {
            await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken);
            disconnected = true;
            console.log(`Disconnected via ${endpoint.url}`);
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }
      }
      
      if (!disconnected) {
        const adminEndpoints = [
          { url: `/instance/logout/${instanceName}`, method: "POST" },
          { url: `/instance/disconnect/${instanceName}`, method: "POST" },
        ];
        
        for (const endpoint of adminEndpoints) {
          if (disconnected) break;
          try {
            await uazapiAdminRequest(endpoint.url, endpoint.method);
            disconnected = true;
            console.log(`Disconnected via admin ${endpoint.url}`);
          } catch (err) {
            console.log(`Admin ${endpoint.url} failed:`, (err as Error).message);
          }
        }
      }
      
      if (existingWhatsapp?.id) {
        const currentConfig = existingWhatsapp.config as IntegrationConfig || {};
        await supabase
          .from("integrations")
          .update({ 
            status: "disconnected",
            config: {
              ...currentConfig,
              disconnected_at: new Date().toISOString(),
              disconnected_manually: true,
            },
          })
          .eq("id", existingWhatsapp.id);
      }
      
      const owner = (existingWhatsapp?.config as IntegrationConfig)?.owner || "";
      await logWhatsAppChangeAndNotify(
        supabase,
        accountId,
        userData.id,
        userData.name || "Admin",
        "disconnect",
        sector_id || null,
        instanceName,
        owner
      );

      return { disconnected: true, instance_name: instanceName };
    }

    case "configure_webhook": {
      if (!savedInstanceToken) {
        return new Response(
          JSON.stringify({ error: "Instance token not found. Connect WhatsApp first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { configureWebhook } = ctx;
      const success = await configureWebhook(savedInstanceToken, instanceName, supabaseUrl);
      
      return { success, message: success ? "Webhook configured" : "Failed to configure webhook" };
    }

    case "fetch_token": {
      console.log(`Fetching token for instance: ${instanceName}`);
      
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
        }>;
        
        const targetInstance = allInstances.find(i => i.name === instanceName);
        
        if (targetInstance?.token) {
          if (existingWhatsapp?.id) {
            await supabase
              .from("integrations")
              .update({
                config: {
                  ...(existingWhatsapp.config as object || {}),
                  instance_token: targetInstance.token,
                  token_fetched_at: new Date().toISOString(),
                },
              })
              .eq("id", existingWhatsapp.id);
          }
          
          return { token: targetInstance.token, instance_name: instanceName };
        }
        
        return { error: "Token not found", instance_name: instanceName };
      } catch (err) {
        return { error: (err as Error).message, instance_name: instanceName };
      }
    }

    case "list_instances": {
      console.log("Listing all UAZAPI instances...");
      
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
          status?: string;
          owner?: string;
          profileName?: string;
        }>;
        
        console.log(`Found ${allInstances.length} total instances`);
        
        const { data: linkedIntegrations } = await supabase
          .from("integrations")
          .select("config, sector_id")
          .eq("account_id", accountId)
          .eq("type", "whatsapp");
        
        const linkedNames = new Set(
          (linkedIntegrations || [])
            .map(i => (i.config as IntegrationConfig)?.instance_name)
            .filter(Boolean)
        );
        
        const instances = allInstances.map(i => ({
          name: i.name,
          status: i.status,
          owner: i.owner,
          profileName: i.profileName,
          isLinked: linkedNames.has(i.name),
        }));
        
        return { instances };
      } catch (err) {
        console.error("Failed to list instances:", (err as Error).message);
        return { instances: [], error: (err as Error).message };
      }
    }

    case "link_instance": {
      const targetInstanceName = payload.instance_name;
      
      if (!targetInstanceName) {
        return new Response(
          JSON.stringify({ error: "instance_name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!sector_id) {
        return new Response(
          JSON.stringify({ error: "sector_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`Linking instance ${targetInstanceName} to sector ${sector_id}...`);
      
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
          status?: string;
          owner?: string;
          profileName?: string;
        }>;
        
        const targetInstance = allInstances.find(i => i.name === targetInstanceName);
        
        if (!targetInstance) {
          return new Response(
            JSON.stringify({ error: `Instance ${targetInstanceName} not found in UAZAPI` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const instanceToken = targetInstance.token || "";
        const isConnected = targetInstance.status === "connected";
        
        const { error: updateError } = await supabase
          .from("integrations")
          .update({
            status: isConnected ? "connected" : "disconnected",
            config: {
              provider: "uazapi",
              instance_name: targetInstanceName,
              instance_token: instanceToken,
              linked_at: new Date().toISOString(),
              owner: targetInstance.owner || "",
              profileName: targetInstance.profileName || "",
            },
          })
          .eq("account_id", accountId)
          .eq("type", "whatsapp")
          .eq("sector_id", sector_id);
        
        if (updateError) throw updateError;
        
        if (instanceToken) {
          const { configureWebhook } = ctx;
          await configureWebhook(instanceToken, targetInstanceName, supabaseUrl);
        }
        
        await logWhatsAppChangeAndNotify(
          supabase,
          accountId,
          userData.id,
          userData.name || "Admin",
          "link_instance",
          sector_id || null,
          targetInstanceName,
          targetInstance.owner || ""
        );
        
        return {
          message: `Instance ${targetInstanceName} linked to sector ${sector_id}`,
          instance_name: targetInstanceName,
          status: isConnected ? "connected" : "disconnected",
          profileName: targetInstance.profileName || "",
        };
      } catch (err) {
        console.error("Failed to link instance:", (err as Error).message);
        return new Response(
          JSON.stringify({ error: (err as Error).message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    case "unlink_instance": {
      const targetIntegrationId = payload.integration_id;
      
      if (!targetIntegrationId) {
        return new Response(
          JSON.stringify({ error: "integration_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`Unlinking integration ${targetIntegrationId}...`);
      
      try {
        const { data: integrationToDelete } = await supabase
          .from("integrations")
          .select("id, sector_id, config, status")
          .eq("id", targetIntegrationId)
          .eq("account_id", accountId)
          .single();
        
        if (!integrationToDelete) {
          return new Response(
            JSON.stringify({ error: "Integration not found or access denied" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const previousInstanceName = (integrationToDelete.config as IntegrationConfig)?.instance_name || "";
        const previousOwner = (integrationToDelete.config as IntegrationConfig)?.owner || "";
        const previousSectorId = integrationToDelete.sector_id;
        
        const { error: deleteError } = await supabase
          .from("integrations")
          .delete()
          .eq("id", targetIntegrationId)
          .eq("account_id", accountId);
        
        if (deleteError) throw deleteError;
        
        console.log(`Successfully unlinked integration ${targetIntegrationId}`);
        
        await logWhatsAppChangeAndNotify(
          supabase,
          accountId,
          userData.id,
          userData.name || "Admin",
          "unlink_instance",
          previousSectorId || null,
          previousInstanceName,
          previousOwner
        );
        
        return { 
          success: true, 
          message: `Integration ${targetIntegrationId} unlinked successfully`,
          unlinked_instance: previousInstanceName,
        };
      } catch (err) {
        console.error("Failed to unlink instance:", (err as Error).message);
        return new Response(
          JSON.stringify({ error: (err as Error).message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown instance action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}
