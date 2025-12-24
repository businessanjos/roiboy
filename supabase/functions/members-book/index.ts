import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-account-slug, x-access-password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const accountId = url.searchParams.get("account_id");
    const accessPassword = url.searchParams.get("password");

    console.log("Members Book request - accountId:", accountId);

    if (!accountId) {
      console.log("Error: account_id is required");
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch members book settings
    const { data: settings, error: settingsError } = await supabase
      .from("members_book_settings")
      .select("*")
      .eq("account_id", accountId)
      .single();

    console.log("Settings fetch result:", { settings, error: settingsError?.message });

    if (settingsError && settingsError.code !== "PGRST116") {
      console.error("Settings error:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configurações" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings) {
      console.log("Members Book not configured for account:", accountId);
      return new Response(
        JSON.stringify({ error: "Members Book não configurado. Ative nas configurações do ROY." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.is_enabled) {
      console.log("Members Book is disabled for account:", accountId);
      return new Response(
        JSON.stringify({ error: "Members Book está desativado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check password if required
    if (settings.access_password && settings.access_password !== accessPassword) {
      console.log("Password required or incorrect for account:", accountId);
      return new Response(
        JSON.stringify({ 
          error: "Senha incorreta", 
          requires_password: true,
          settings: {
            custom_title: settings.custom_title,
            custom_description: settings.custom_description
          }
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch account info for branding
    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .single();

    console.log("Account name:", account?.name);

    // Fetch visible members from visibility table
    const { data: visibilityList } = await supabase
      .from("members_book_visibility")
      .select("client_id, display_order")
      .eq("account_id", accountId)
      .eq("is_visible", true)
      .order("display_order", { ascending: true });

    const visibleClientIds = visibilityList?.map(v => v.client_id) || [];
    console.log("Visible client IDs from visibility table:", visibleClientIds.length);

    // Build client query - fetch all active clients if no visibility list
    let clientQuery = supabase
      .from("clients")
      .select(`
        id,
        full_name,
        company_name,
        avatar_url,
        logo_url,
        phone_e164,
        emails,
        instagram,
        bio,
        status,
        client_diagnostics(business_segment),
        client_products(
          product:products(id, name)
        )
      `)
      .eq("account_id", accountId)
      .eq("status", "active");

    // If visibility list exists and has entries, filter by it
    if (visibleClientIds.length > 0) {
      clientQuery = clientQuery.in("id", visibleClientIds);
    }

    const { data: clients, error: clientsError } = await clientQuery;

    if (clientsError) {
      console.error("Error fetching clients:", clientsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar membros" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Clients fetched:", clients?.length || 0);

    // Fetch custom fields that can be used as filters (select, multi_select, boolean)
    const { data: customFields } = await supabase
      .from("custom_fields")
      .select("id, name, field_type, options")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .in("field_type", ["select", "multi_select", "boolean"])
      .order("display_order", { ascending: true });

    console.log("Custom fields for filters:", customFields?.length || 0);

    // Build option value to label map for each field
    const optionLabelMaps: Record<string, Record<string, string>> = {};
    customFields?.forEach(field => {
      optionLabelMaps[field.id] = {};
      if (field.options && Array.isArray(field.options)) {
        field.options.forEach((opt: any) => {
          if (opt && typeof opt === 'object' && opt.value && opt.label) {
            // Options have {value, label, color} structure
            optionLabelMaps[field.id][opt.value] = opt.label;
          } else if (opt && typeof opt === 'object' && opt.id && opt.label) {
            // Fallback for {id, label} structure
            optionLabelMaps[field.id][opt.id] = opt.label;
          } else if (typeof opt === 'string') {
            // Fallback if options are just strings
            optionLabelMaps[field.id][opt] = opt;
          }
        });
      }
    });

    // Fetch field values for clients
    const clientIds = clients?.map(c => c.id) || [];
    let fieldValuesMap: Record<string, Record<string, any>> = {};
    
    if (customFields && customFields.length > 0 && clientIds.length > 0) {
      const { data: fieldValues } = await supabase
        .from("client_field_values")
        .select("client_id, field_id, value_text, value_boolean, value_json")
        .eq("account_id", accountId)
        .in("client_id", clientIds)
        .in("field_id", customFields.map(f => f.id));

      // Group by client_id and translate option IDs to labels
      fieldValues?.forEach(fv => {
        if (!fieldValuesMap[fv.client_id]) {
          fieldValuesMap[fv.client_id] = {};
        }
        const field = customFields.find(f => f.id === fv.field_id);
        if (field) {
          if (field.field_type === "boolean") {
            fieldValuesMap[fv.client_id][fv.field_id] = fv.value_boolean;
          } else if (field.field_type === "multi_select") {
            // Translate option IDs to labels
            const values = fv.value_json || [];
            const labelMap = optionLabelMaps[field.id] || {};
            fieldValuesMap[fv.client_id][fv.field_id] = values.map((v: string) => labelMap[v] || v);
          } else {
            // Translate option ID to label for select
            const labelMap = optionLabelMaps[field.id] || {};
            const rawValue = fv.value_text || '';
            fieldValuesMap[fv.client_id][fv.field_id] = labelMap[rawValue] || rawValue;
          }
        }
      });
    }

    // Collect unique products and segments for filters
    const productsSet = new Set<string>();
    const segmentsSet = new Set<string>();
    // Collect unique values for each custom field (as labels now)
    const customFieldValuesMap: Record<string, Set<string>> = {};
    
    customFields?.forEach(field => {
      customFieldValuesMap[field.id] = new Set<string>();
    });

    clients?.forEach(client => {
      // Collect products
      client.client_products?.forEach((cp: any) => {
        if (cp.product?.name) {
          productsSet.add(cp.product.name);
        }
      });
      // Collect segments
      const diagnostics = client.client_diagnostics as any[];
      if (diagnostics && diagnostics.length > 0 && diagnostics[0]?.business_segment) {
        segmentsSet.add(diagnostics[0].business_segment);
      }
      // Collect custom field values (already translated to labels)
      const clientFieldValues = fieldValuesMap[client.id] || {};
      customFields?.forEach(field => {
        const value = clientFieldValues[field.id];
        if (value !== undefined && value !== null && value !== "") {
          if (field.field_type === "multi_select" && Array.isArray(value)) {
            value.forEach((v: string) => {
              if (v) customFieldValuesMap[field.id].add(v);
            });
          } else if (field.field_type === "boolean") {
            customFieldValuesMap[field.id].add(value ? "true" : "false");
          } else if (typeof value === "string" && value) {
            customFieldValuesMap[field.id].add(value);
          }
        }
      });
    });

    const availableProducts = Array.from(productsSet).sort();
    const availableSegments = Array.from(segmentsSet).sort();
    
    // Build custom field filters array with labels
    const customFieldFilters = customFields?.map(field => ({
      id: field.id,
      name: field.name,
      field_type: field.field_type,
      values: Array.from(customFieldValuesMap[field.id] || []).sort(),
    })).filter(f => f.values.length > 0) || [];

    // Map clients to members format based on settings
    const members = clients?.map(client => {
      const diagnostics = client.client_diagnostics as any[];
      const segment = diagnostics && diagnostics.length > 0 ? diagnostics[0]?.business_segment : null;
      
      const member: Record<string, any> = {
        id: client.id,
        name: client.full_name,
        avatar_url: client.avatar_url || client.logo_url,
        segment: segment, // Always include segment for filtering
        custom_fields: fieldValuesMap[client.id] || {}, // Include custom field values for filtering
      };

      if (settings.show_company) {
        member.company = client.company_name;
      }

      if (settings.show_phone) {
        member.phone = client.phone_e164;
      }

      if (settings.show_email) {
        const emails = client.emails as any[];
        member.email = emails && emails.length > 0 ? emails[0] : null;
      }

      if (settings.show_instagram) {
        member.instagram = client.instagram;
      }

      if (settings.show_bio) {
        member.bio = client.bio;
      }

      if (settings.show_products) {
        member.products = client.client_products?.map((cp: any) => cp.product?.name).filter(Boolean) || [];
      } else {
        // Include products for filtering even if not shown
        member.products = client.client_products?.map((cp: any) => cp.product?.name).filter(Boolean) || [];
      }

      return member;
    }) || [];

    // Sort by visibility order if available, otherwise alphabetically
    if (visibleClientIds.length > 0) {
      const orderMap = new Map(visibilityList?.map(v => [v.client_id, v.display_order]) || []);
      members.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));
    } else {
      members.sort((a, b) => a.name.localeCompare(b.name));
    }

    console.log("Returning", members.length, "members");

        return new Response(
      JSON.stringify({
        account_name: account?.name || "Members Book",
        settings: {
          custom_title: settings.custom_title,
          custom_description: settings.custom_description,
          show_company: settings.show_company,
          show_email: settings.show_email,
          show_phone: settings.show_phone,
          show_instagram: settings.show_instagram,
          show_bio: settings.show_bio,
          show_products: settings.show_products,
        },
        members,
        total: members.length,
        filters: {
          products: availableProducts,
          segments: availableSegments,
          custom_fields: customFieldFilters,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in members-book function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});