import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for PIN (using SHA-256)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "roy-sector-pin-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar token do usuário
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é super_admin diretamente na tabela
    const { data: superAdminRecord } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (!superAdminRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso restrito a super administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sector_id, pin } = await req.json();

    if (!sector_id) {
      return new Response(
        JSON.stringify({ success: false, error: "sector_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se pin for null ou vazio, remover o PIN
    if (!pin) {
      const { error: updateError } = await supabase
        .from("sector_settings")
        .update({ pin_hash: null })
        .eq("sector_id", sector_id);

      if (updateError) {
        console.error("Error removing PIN:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao remover PIN" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "PIN removido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, error: "PIN deve ter exatamente 6 dígitos numéricos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar hash do PIN
    const pinHash = await hashPin(pin);

    // Verificar se já existe registro para este setor
    const { data: existing } = await supabase
      .from("sector_settings")
      .select("id")
      .eq("sector_id", sector_id)
      .maybeSingle();

    if (existing) {
      // Atualizar
      const { error: updateError } = await supabase
        .from("sector_settings")
        .update({ pin_hash: pinHash })
        .eq("sector_id", sector_id);

      if (updateError) {
        console.error("Error updating PIN:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao atualizar PIN" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Inserir
      const { error: insertError } = await supabase
        .from("sector_settings")
        .insert({ sector_id, pin_hash: pinHash });

      if (insertError) {
        console.error("Error inserting PIN:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao definir PIN" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "PIN definido com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error setting PIN:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
