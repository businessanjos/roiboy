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

export async function handleSectorAction(ctx: HandlerContext): Promise<unknown | Response> {
  const { 
    supabase, supabaseUrl, userData, accountId, payload, sector_id,
    uazapiAdminRequest, logWhatsAppChangeAndNotify, configureWebhook
  } = ctx;
  const { action } = payload;

  switch (action) {
    case "add_instance_to_sector": {
      const targetInstanceName = payload.instance_name;
      const displayName = payload.display_name;
      const pin = payload.pin;
      
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
      
      console.log(`Adding/Moving instance ${targetInstanceName} to sector ${sector_id}...`);
      
      try {
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
          status?: string;
          owner?: string;
          profileName?: string;
          profilePicUrl?: string;
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
        
        const { data: existingLinks, error: existingLinksError } = await supabase
          .from("integrations")
          .select("id, sector_id, display_name, pin_hash")
          .eq("account_id", accountId)
          .eq("type", "whatsapp")
          .ilike("config->>instance_name", targetInstanceName);
        
        if (existingLinksError) {
          console.error("Error checking existing links:", existingLinksError.message);
          throw new Error("Erro ao verificar vínculos existentes: " + existingLinksError.message);
        }
        
        console.log(`[SECURITY] Found ${existingLinks?.length || 0} existing links for instance ${targetInstanceName}`);
        
        const existingInThisSector = existingLinks?.find(l => l.sector_id === sector_id);
        if (existingInThisSector) {
          return new Response(
            JSON.stringify({ error: "Instância já está vinculada a este setor" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (existingLinks && existingLinks.length > 0) {
          const linkedSectors = existingLinks.map(l => l.sector_id).filter(Boolean);
          const sectorNames = linkedSectors.map(s => {
            const names: Record<string, string> = {
              operacoes: "Operações",
              financeiro: "Finanças", 
              vendas: "Vendas",
              diretoria: "Diretoria"
            };
            return names[s as string] || s;
          });
          
          console.log(`[SECURITY] BLOCKED: Instance ${targetInstanceName} is already linked to sectors: ${linkedSectors.join(", ")}`);
          
          return new Response(
            JSON.stringify({ 
              error: `Esta instância já está vinculada ao setor "${sectorNames.join(", ")}". Remova-a desse setor antes de adicionar a outro.`,
              linked_sectors: linkedSectors
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log(`[SECURITY] OK: Instance ${targetInstanceName} is not linked to any sector, proceeding to add to ${sector_id}`);
        
        let pinHash: string | null = null;
        if (pin && pin.length >= 4) {
          const encoder = new TextEncoder();
          const data = encoder.encode(pin + accountId);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        
        const { data: newIntegration, error: insertError } = await supabase
          .from("integrations")
          .insert({
            account_id: accountId,
            type: "whatsapp",
            sector_id: sector_id,
            status: isConnected ? "connected" : "disconnected",
            display_name: displayName || null,
            pin_hash: pinHash,
            config: {
              provider: "uazapi",
              instance_name: targetInstanceName,
              instance_token: instanceToken,
              linked_at: new Date().toISOString(),
              owner: targetInstance.owner || "",
              phone_number: targetInstance.owner || "",
              profile_name: targetInstance.profileName || "",
              profile_pic_url: targetInstance.profilePicUrl || "",
            },
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        if (instanceToken) {
          await configureWebhook(instanceToken, targetInstanceName, supabaseUrl);
        }
        
        await logWhatsAppChangeAndNotify(
          supabase,
          accountId,
          userData.id,
          userData.name || "Admin",
          "add_instance_to_sector",
          sector_id || null,
          targetInstanceName,
          targetInstance.owner || ""
        );
        
        return {
          message: `Instance ${targetInstanceName} added to sector ${sector_id}`,
          integration_id: newIntegration?.id,
          instance_name: targetInstanceName,
          status: isConnected ? "connected" : "disconnected",
          profile_name: targetInstance.profileName || "",
          has_pin: !!pinHash,
        };
      } catch (err) {
        console.error("Failed to add/move instance to sector:", (err as Error).message);
        return new Response(
          JSON.stringify({ error: (err as Error).message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    case "update_instance_pin": {
      const targetIntegrationId = payload.integration_id;
      const pin = payload.pin;
      
      if (!targetIntegrationId) {
        return new Response(
          JSON.stringify({ error: "integration_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`Updating PIN for integration ${targetIntegrationId}...`);
      
      try {
        let pinHash: string | null = null;
        if (pin && pin.length >= 4) {
          const encoder = new TextEncoder();
          const data = encoder.encode(pin + accountId);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        
        const { error: updateError } = await supabase
          .from("integrations")
          .update({ pin_hash: pinHash })
          .eq("id", targetIntegrationId)
          .eq("account_id", accountId);
        
        if (updateError) throw updateError;
        
        console.log(`PIN ${pin ? 'updated' : 'removed'} for integration ${targetIntegrationId}`);
        
        return {
          success: true,
          message: pin ? "PIN updated successfully" : "PIN removed successfully",
          has_pin: !!pinHash,
        };
      } catch (err) {
        console.error("Failed to update PIN:", (err as Error).message);
        return new Response(
          JSON.stringify({ error: (err as Error).message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    case "verify_instance_pin": {
      const targetIntegrationId = payload.integration_id;
      const pin = payload.pin;
      
      if (!targetIntegrationId || !pin) {
        return new Response(
          JSON.stringify({ error: "integration_id and pin are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`Verifying PIN for integration ${targetIntegrationId}...`);
      
      try {
        const { data: integration, error: fetchError } = await supabase
          .from("integrations")
          .select("pin_hash")
          .eq("id", targetIntegrationId)
          .eq("account_id", accountId)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (!integration?.pin_hash) {
          return { valid: true, message: "No PIN set" };
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(pin + accountId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        const valid = inputHash === integration.pin_hash;
        
        console.log(`PIN verification for ${targetIntegrationId}: ${valid ? 'valid' : 'invalid'}`);
        
        return {
          valid,
          message: valid ? "PIN is correct" : "PIN incorreto",
        };
      } catch (err) {
        console.error("Failed to verify PIN:", (err as Error).message);
        return new Response(
          JSON.stringify({ error: (err as Error).message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    case "list_sector_instances": {
      console.log("Listing sector instances...");
      
      try {
        const { data: integrations, error: intError } = await supabase
          .from("integrations")
          .select("id, sector_id, status, config, display_name, pin_hash")
          .eq("account_id", accountId)
          .eq("type", "whatsapp")
          .not("sector_id", "is", null);
        
        if (intError) throw intError;
        
        const allInstances = await uazapiAdminRequest("/instance/all", "GET") as Array<{ 
          name?: string; 
          token?: string; 
          status?: string;
          owner?: string;
          profileName?: string;
          profilePicUrl?: string;
        }>;
        
        // deno-lint-ignore no-explicit-any
        const instances = (integrations || []).map((int: any) => {
          const config = int.config as IntegrationConfig;
          const instanceName = config?.instance_name;
          const uazapiInstance = allInstances.find(i => i.name === instanceName);
          
          return {
            id: int.id,
            sector_id: int.sector_id,
            instance_name: instanceName,
            display_name: int.display_name,
            status: uazapiInstance?.status || int.status,
            phone_number: config?.owner || config?.phone_number || uazapiInstance?.owner,
            profile_name: config?.profile_name || uazapiInstance?.profileName,
            profile_pic_url: config?.profile_pic_url || uazapiInstance?.profilePicUrl,
            has_pin: !!int.pin_hash,
          };
        });
        
        console.log(`Found ${instances.length} sector instances`);
        
        return { instances };
      } catch (err) {
        console.error("Failed to list sector instances:", (err as Error).message);
        return { instances: [], error: (err as Error).message };
      }
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown sector action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}
