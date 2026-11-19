import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Público (sem login): entrega uma imagem do bucket privado "tv-media" redirecionando para um link assinado.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const p = new URL(req.url).searchParams.get("p") ?? "";
  if (!/^[a-z0-9][a-z0-9._-]{0,120}\.(png|jpe?g|webp)$/i.test(p)) return new Response("bad path", { status: 400, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await sb.storage.from("tv-media").createSignedUrl(p, 86_400);
  if (!data?.signedUrl) return new Response("not found", { status: 404, headers: corsHeaders });
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: data.signedUrl, "Cache-Control": "public, max-age=3600" } });
});
