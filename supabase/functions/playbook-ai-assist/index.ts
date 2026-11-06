import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import { z } from "npm:zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ text: z.string().min(1).max(8000) });

const INSTRUCTIONS = `Você revisa mensagens de WhatsApp em português do Brasil escritas por consultoras.
Corrija apenas ortografia, acentuação, pontuação e digitação. Não mude o sentido, o tom, os emojis, as quebras de linha nem a formatação (*negrito*, _itálico_).
Mantenha EXATAMENTE como estão todos os códigos entre chaves duplas, como {{data_evento}}, {{campo:local}} ou {primeiro_nome}.
Responda somente com o texto revisado, sem comentários.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Faça login novamente." }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error: authErr } = await sb.auth.getClaims(auth.slice(7));
    if (authErr || !claims?.claims?.sub) return json({ error: "Faça login novamente." }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Texto inválido." }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "IA não configurada." }, 500);

    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    let failure: unknown = null;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: parsed.data.text }],
      abortSignal: req.signal,
      onError: ({ error }) => { failure = error; },
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
      },
    });
    let text = "";
    for await (const delta of result.textStream) text += delta;
    if (failure || !text.trim()) {
      const status = (failure as { statusCode?: number })?.statusCode;
      if (status === 429) return json({ error: "Muitas revisões agora. Tente em instantes." }, 429);
      if (status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      if (status === 403) return json({ error: "IA indisponível para esta conta." }, 403);
      console.error("playbook-ai-assist", failure);
      return json({ error: "Não foi possível revisar agora." }, 502);
    }
    // Garante que nenhum campo automático sumiu.
    const codes = (s: string) => (s.match(/\{\{?[^{}]+\}\}?/g) || []).sort().join("|");
    if (codes(text) !== codes(parsed.data.text)) return json({ text: parsed.data.text, note: "fields_changed" });
    return json({ text: text.trim() });
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível revisar agora." }, 500);
  }
});
