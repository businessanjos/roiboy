import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for PIN verification (consistent with set-sector-pin)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "roy-sector-pin-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sector_id, pin } = await req.json();

    if (!sector_id || !pin) {
      return new Response(
        JSON.stringify({ valid: false, error: "sector_id e pin são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pin.length !== 6) {
      return new Response(
        JSON.stringify({ valid: false, error: "PIN deve ter 6 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar o hash do PIN armazenado
    const { data: settings, error } = await supabase
      .from("sector_settings")
      .select("pin_hash")
      .eq("sector_id", sector_id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching sector settings:", error);
      return new Response(
        JSON.stringify({ valid: false, error: "Erro ao verificar PIN" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings?.pin_hash) {
      // Se não há PIN configurado, considerar como válido (acesso livre)
      return new Response(
        JSON.stringify({ valid: true, message: "Nenhum PIN configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Comparar hash do PIN informado com o armazenado
    const inputHash = await hashPin(pin);
    const valid = inputHash === settings.pin_hash;

    return new Response(
      JSON.stringify({ valid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
