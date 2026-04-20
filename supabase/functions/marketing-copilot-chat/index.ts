import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchVoiceAndPersona, buildBrandVoiceBlock, buildPersonaBlock } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "criar_ideia",
      description: "Cria uma nova ideia de conteúdo na biblioteca de ideias do usuário.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook: { type: "string", description: "Gancho de abertura" },
          description: { type: "string" },
          format: { type: "string", enum: ["reel","post","story","carousel","youtube_short","youtube_long","tiktok","live","other"] },
          platform: { type: "string", enum: ["instagram","tiktok","youtube","linkedin","multi","other"] },
          priority: { type: "string", enum: ["low","medium","high","urgent"] },
          planned_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["title","format","platform"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_hook",
      description: "Salva um gancho (hook) no banco de hooks.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          category: { type: "string", enum: ["curiosidade","promessa","polemica","historia","dado","provocacao","outro"] },
          notes: { type: "string" },
        },
        required: ["text","category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_trends",
      description: "Busca tendências (virais) já capturadas pelo usuário, opcionalmente filtrando por palavra-chave.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_hooks",
      description: "Busca hooks salvos no banco, opcionalmente por categoria.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_ideias_recentes",
      description: "Lista as últimas ideias criadas (com status).",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
];

async function executeTool(supabase: any, accountId: string, userId: string | null, name: string, args: any) {
  try {
    if (name === "criar_ideia") {
      const { data, error } = await supabase.from("marketing_ideas").insert({
        account_id: accountId,
        title: args.title,
        hook: args.hook,
        description: args.description,
        format: args.format || "reel",
        platform: args.platform || "instagram",
        priority: args.priority || "medium",
        planned_date: args.planned_date,
        status: "draft",
        created_by: userId,
      }).select().single();
      if (error) throw error;
      return { success: true, idea_id: data.id, title: data.title };
    }
    if (name === "salvar_hook") {
      const { data, error } = await supabase.from("marketing_hooks").insert({
        account_id: accountId,
        text: args.text,
        category: args.category,
        notes: args.notes,
        source: "ai",
        created_by_ai: true,
        created_by: userId,
      }).select().single();
      if (error) throw error;
      return { success: true, hook_id: data.id };
    }
    if (name === "buscar_trends") {
      let q = supabase.from("marketing_trends").select("title, description, hype_score, platform, source_url")
        .eq("account_id", accountId).eq("is_archived", false)
        .order("hype_score", { ascending: false, nullsFirst: false })
        .limit(args.limit || 10);
      if (args.keyword) q = q.or(`title.ilike.%${args.keyword}%,description.ilike.%${args.keyword}%`);
      const { data, error } = await q;
      if (error) throw error;
      return { trends: data || [] };
    }
    if (name === "buscar_hooks") {
      let q = supabase.from("marketing_hooks").select("text, category, performance_score, source_platform")
        .eq("account_id", accountId)
        .order("performance_score", { ascending: false })
        .limit(args.limit || 10);
      if (args.category) q = q.eq("category", args.category);
      const { data, error } = await q;
      if (error) throw error;
      return { hooks: data || [] };
    }
    if (name === "listar_ideias_recentes") {
      const { data, error } = await supabase.from("marketing_ideas")
        .select("title, status, format, platform, planned_date")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(args.limit || 10);
      if (error) throw error;
      return { ideas: data || [] };
    }
    return { error: "Ferramenta desconhecida" };
  } catch (e: any) {
    return { error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const authUserId = claims?.claims?.sub;
    if (!authUserId) throw new Error("Sessão inválida");

    const { conversationId, message, accountId } = await req.json();
    if (!conversationId || !message || !accountId) throw new Error("conversationId, message, accountId obrigatórios");

    // Carrega histórico
    const { data: history } = await supabase
      .from("marketing_copilot_messages")
      .select("role, content, tool_calls, tool_call_id, tool_name, tool_result")
      .eq("conversation_id", conversationId)
      .order("created_at");

    // Salva user message
    await supabase.from("marketing_copilot_messages").insert({
      conversation_id: conversationId, account_id: accountId,
      role: "user", content: message,
    });

    // Contexto: voz + persona + últimas ideias/trends/hooks
    const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);
    const [recentIdeas, recentTrends, topHooks] = await Promise.all([
      supabase.from("marketing_ideas").select("title, format, status").eq("account_id", accountId).order("created_at", { ascending: false }).limit(10),
      supabase.from("marketing_trends").select("title, hype_score, platform").eq("account_id", accountId).eq("is_archived", false).order("hype_score", { ascending: false, nullsFirst: false }).limit(8),
      supabase.from("marketing_hooks").select("text, category").eq("account_id", accountId).order("performance_score", { ascending: false }).limit(8),
    ]);

    const systemPrompt = `Você é o **Roy Marketing Copilot** — um assistente especialista em marketing digital para o mercado de estética avançada. Atua como copywriter, estrategista e produtor de conteúdo.

REGRAS:
- Responda SEMPRE em português brasileiro, tom natural e direto.
- Use markdown (negrito, listas, emojis com moderação).
- Quando a pessoa pedir pra criar/salvar/agendar algo, USE as ferramentas (não só sugira em texto).
- Quando precisar de dados, USE buscar_trends/buscar_hooks/listar_ideias_recentes em vez de inventar.
- Sempre aplique o tom de voz da marca e fale com a persona definida.
${ctxBlock(voice, persona)}

CONTEXTO ATUAL DA CONTA:
- Últimas ideias: ${(recentIdeas.data || []).map((i: any) => `"${i.title}" (${i.status})`).join(", ") || "nenhuma"}
- Top trends ativas: ${(recentTrends.data || []).map((t: any) => `"${t.title}" (${t.hype_score || 0}pts)`).join(", ") || "nenhuma"}
- Top hooks salvos: ${(topHooks.data || []).map((h: any) => `[${h.category}] "${h.text.slice(0, 60)}..."`).join(" | ") || "nenhum"}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => {
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.tool_call_id, name: m.tool_name, content: JSON.stringify(m.tool_result) };
        }
        if (m.role === "assistant" && m.tool_calls) {
          return { role: "assistant", content: m.content || "", tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content };
      }),
      { role: "user", content: message },
    ];

    // Loop de tool calling (max 5 iterações)
    let iter = 0;
    let finalAssistantText = "";
    while (iter < 5) {
      iter++;
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages,
          tools: TOOLS,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente em 1 minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI ${res.status}: ${t}`);
      }

      const data = await res.json();
      const msg = data.choices[0].message;

      if (msg.tool_calls?.length) {
        // Salva assistant message com tool_calls
        await supabase.from("marketing_copilot_messages").insert({
          conversation_id: conversationId, account_id: accountId,
          role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls,
        });

        messages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });

        // Executa cada tool
        for (const tc of msg.tool_calls) {
          const args = JSON.parse(tc.function.arguments || "{}");
          const result = await executeTool(supabase, accountId, authUserId, tc.function.name, args);

          await supabase.from("marketing_copilot_messages").insert({
            conversation_id: conversationId, account_id: accountId,
            role: "tool", tool_call_id: tc.id, tool_name: tc.function.name, tool_result: result,
          });

          messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
        }
        continue; // loop pra IA processar resultados
      }

      // Resposta final
      finalAssistantText = msg.content || "";
      await supabase.from("marketing_copilot_messages").insert({
        conversation_id: conversationId, account_id: accountId,
        role: "assistant", content: finalAssistantText,
      });
      break;
    }

    await supabase.from("marketing_copilot_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(JSON.stringify({ reply: finalAssistantText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("copilot error:", e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function ctxBlock(voice: any, persona: any) {
  return buildBrandVoiceBlock(voice) + buildPersonaBlock(persona);
}
