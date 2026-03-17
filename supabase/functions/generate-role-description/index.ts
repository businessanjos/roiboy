import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { area, cargo, seniority } = await req.json();

    if (!area || !cargo) {
      return new Response(
        JSON.stringify({ error: "Área e Cargo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seniorityPart = seniority ? ` com senioridade ${seniority}` : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em gestão de pessoas em empresas de consultoria, assessoria, mentoria e serviços recorrentes (modelo de negócio baseado em relacionamento de longo prazo com clientes, usando WhatsApp como canal principal, lives, eventos e acompanhamento contínuo). O sistema ROY CRM é uma plataforma completa de gestão de relacionamento com clientes que inclui: RoyZapp (WhatsApp multicanal com IA), gestão de contratos, financeiro, eventos, pipeline de vendas, CS/CX, e análise de ROI dos clientes. Gere descrições concisas (máximo 2 frases) para funções/cargos dentro desse contexto.`,
          },
          {
            role: "user",
            content: `Gere uma descrição concisa para a função: Área: ${area}, Cargo: ${cargo}${seniorityPart}. A descrição deve explicar as responsabilidades principais dessa função no contexto de uma empresa que usa o ROY CRM. Responda APENAS com a descrição, sem prefixo ou formatação.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("generate-role-description error:", error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
