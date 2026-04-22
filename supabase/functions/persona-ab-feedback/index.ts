import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { abTestId, action, variant, value } = body as {
      abTestId: string;
      action: "choose" | "feedback" | "save";
      variant?: "a" | "b" | "none";
      value?: any; // valor final salvo (para action=save)
    };

    if (!abTestId || !action) {
      return new Response(JSON.stringify({ error: "abTestId e action são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar registro
    const { data: row, error: rowErr } = await supabase
      .from("marketing_persona_ab_tests")
      .select("*")
      .eq("id", abTestId)
      .maybeSingle();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Teste não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: any = {};

    if (action === "choose") {
      if (!variant || !["a", "b", "none"].includes(variant)) {
        return new Response(JSON.stringify({ error: "variant inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updates.chosen_variant = variant;
      updates.decided_at = new Date().toISOString();
    } else if (action === "feedback") {
      if (!variant || !["a", "b"].includes(variant)) {
        return new Response(JSON.stringify({ error: "variant inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fb = body.feedback as "up" | "down";
      if (!["up", "down"].includes(fb)) {
        return new Response(JSON.stringify({ error: "feedback inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (variant === "a") updates.explicit_feedback_a = fb;
      else updates.explicit_feedback_b = fb;
    } else if (action === "save") {
      updates.final_value = { value };
      updates.saved_at = new Date().toISOString();
      // Verifica se foi salvo sem edição comparando com a variante escolhida
      const chosen = row.chosen_variant;
      if (chosen === "a" || chosen === "b") {
        const original = chosen === "a" ? row.variant_a_suggestion?.value : row.variant_b_suggestion?.value;
        const same = JSON.stringify(original) === JSON.stringify(value);
        updates.saved_without_edit = same;
      }
    } else {
      return new Response(JSON.stringify({ error: "action inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supabase
      .from("marketing_persona_ab_tests")
      .update(updates)
      .eq("id", abTestId);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("persona-ab-feedback error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
