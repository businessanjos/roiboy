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
        status,
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

    // Map clients to members format based on settings
    const members = clients?.map(client => {
      const member: Record<string, any> = {
        id: client.id,
        name: client.full_name,
        avatar_url: client.avatar_url || client.logo_url,
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

      if (settings.show_products) {
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
          show_products: settings.show_products,
        },
        members,
        total: members.length,
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