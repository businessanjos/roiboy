import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import { z } from "npm:zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ text: z.string().min(1).max(8000), mode: z.enum(["copy", "short", "fix", "vars"]).default("copy") });

const BASE = `Você escreve mensagens de WhatsApp em português do Brasil para consultoras de uma empresa de mentoria (clientes chamados de sócias/sócios).
Mantenha EXATAMENTE como estão todos os códigos entre chaves, como {{data_evento}}, {{campo:local}} ou {primeiro_nome}: não remova, não traduza, não altere.
Use a formatação do WhatsApp (*negrito*, _itálico_) e quebras de linha curtas. Responda somente com a mensagem final, sem comentários nem aspas.`;
const MODES: Record<string, string> = {
  copy: `Reescreva a mensagem para ficar mais atraente, calorosa e profissional: abertura que prende atenção, informações principais destacadas em *negrito*, parágrafos curtos, emojis estratégicos (sem exagero) e uma chamada para ação clara no final. Mude de verdade a redação; não devolva o mesmo texto.`,
  short: `Deixe a mensagem bem mais curta e direta, para leitura rápida no celular. Corte repetições e enrolação, mantendo todas as informações essenciais (datas, horários, links, códigos). Mude de verdade a redação.`,
  fix: `Corrija apenas ortografia, acentuação, pontuação e digitação. Não mude o sentido, o tom, os emojis nem as quebras de linha.`,
  vars: `Troque informações escritas à mão pelos códigos automáticos correspondentes, mantendo o resto do texto igual:
- data do encontro (ex.: 06/11) -> {{data_evento}}
- dia da semana (ex.: sexta-feira) -> {{dia_semana_evento}}
- horário (ex.: 15h às 17h) -> {{horario_evento}}
- contagem regressiva (ex.: falta 1 dia, faltam 3 dias, é hoje) -> {{contagem_regressiva}}
- nome do mês do encontro (ex.: NOVEMBRO) -> {{mes_evento}}
- link/URL -> {{link_evento}}
Não invente códigos fora desta lista.`,
};
const VAR_CODES = ["data_evento", "dia_semana_evento", "horario_evento", "contagem_regressiva", "mes_evento", "link_evento"];

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
      system: `${BASE}\n\n${MODES[parsed.data.mode]}`,
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
    const list = (x: string) => x.match(/\{\{?[^{}]+\}\}?/g) || [];
    const orig = list(parsed.data.text);
    const out = list(text);
    const missing = orig.filter((c) => !out.includes(c));
    const added = out.filter((c) => !orig.includes(c));
    const okAdded = parsed.data.mode === "vars" && added.every((c) => VAR_CODES.includes(c.replace(/[{}]/g, "")));
    if (missing.length || (added.length && !okAdded)) return json({ error: "A IA alterou campos automáticos; tente novamente." }, 422);
    return json({ text: text.trim() });
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível revisar agora." }, 500);
  }
});
