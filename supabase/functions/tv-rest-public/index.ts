import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Público (sem login): devolve só as artes da tela de descanso e os horários de troca.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error } = await sb.from("tv_settings").select("rest_day_image, rest_night_image, rest_day_from, rest_night_from").eq("id", 1).maybeSingle();
    const data = { day_image: row?.rest_day_image, night_image: row?.rest_night_image, day_from: row?.rest_day_from, night_from: row?.rest_night_from };
    if (error) throw error;
    const sign = async (p: unknown) => {
      if (typeof p !== "string" || !p) return null;
      if (/^https?:\/\//.test(p)) return p;
      const { data: s } = await sb.storage.from("tv-rest").createSignedUrl(p, 86_400);
      return s?.signedUrl ?? null;
    };
    return json({
      dayUrl: await sign(data?.day_image), nightUrl: await sign(data?.night_image),
      dayFrom: data?.day_from ?? null, nightFrom: data?.night_from ?? null,
    });
  } catch (e) {
    console.error(e);
    return json({ dayUrl: null, nightUrl: null, dayFrom: null, nightFrom: null }, 200);
  }
});
