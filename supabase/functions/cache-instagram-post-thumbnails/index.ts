import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { instagramPostMediaUrl } from "./instagramPostMedia.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  accountId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

const IMAGE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
  Referer: "https://www.instagram.com/",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Método não permitido" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return response({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
    const { accountId, profileId, limit } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return response({ error: "Não autorizado" }, 401);

    const supabase = createClient(supabaseUrl, serviceRole);
    if (token !== serviceRole) {
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (claimsError || !userId) return response({ error: "Sessão inválida" }, 401);

      const { data: membership } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userId)
        .eq("account_id", accountId)
        .eq("is_active", true)
        .maybeSingle();
      if (!membership) return response({ error: "Acesso negado a esta conta" }, 403);
    }

    let query = supabase
      .from("instagram_posts")
      .select("id, profile_id, permalink, thumbnail_url, posted_at, instagram_profiles!inner(account_id)")
      .eq("instagram_profiles.account_id", accountId)
      .not("permalink", "is", null)
      .order("posted_at", { ascending: false })
      .limit(2000);
    if (profileId) query = query.eq("profile_id", profileId);

    const { data: rows, error: queryError } = await query;
    if (queryError) throw queryError;

    const pending = (rows || []).filter((row: any) =>
      row.permalink && (!row.thumbnail_url || !row.thumbnail_url.includes("supabase.co/storage"))
    );
    const targets = pending.slice(0, limit);
    let cursor = 0;
    let cached = 0;
    const failures: Array<{ id: string; error: string }> = [];

    const cacheOne = async (row: any) => {
      const mediaUrl = instagramPostMediaUrl(row.permalink);
      if (!mediaUrl) throw new Error("Link do post não possui um código válido");

      const imageResponse = await fetch(mediaUrl, {
        headers: IMAGE_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      const contentType = imageResponse.headers.get("content-type")?.split(";")[0] || "";
      if (!imageResponse.ok || !contentType.startsWith("image/")) {
        throw new Error(`Instagram respondeu ${imageResponse.status} sem imagem`);
      }
      const contentLength = Number(imageResponse.headers.get("content-length") || 0);
      if (contentLength > 15 * 1024 * 1024) throw new Error("Imagem maior que 15 MB");

      const bytes = new Uint8Array(await imageResponse.arrayBuffer());
      if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("Imagem maior que 15 MB");
      const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const path = `posts/${row.profile_id}/${row.id}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("instagram-avatars")
        .upload(path, bytes, { contentType, upsert: true, cacheControl: "86400" });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("instagram-avatars").getPublicUrl(path);
      if (!publicData?.publicUrl) throw new Error("Não foi possível obter o endereço permanente");
      const { error: updateError } = await supabase
        .from("instagram_posts")
        .update({ thumbnail_url: publicData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updateError) throw updateError;
    };

    const worker = async () => {
      while (cursor < targets.length) {
        const row = targets[cursor++];
        try {
          await cacheOne(row);
          cached++;
        } catch (error: any) {
          failures.push({ id: row.id, error: error?.message || String(error) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker));

    return response({
      success: true,
      processed: targets.length,
      cached,
      failed: failures.length,
      remaining: Math.max(0, pending.length - targets.length),
      failures: failures.slice(0, 20),
    });
  } catch (error: any) {
    console.error("cache-instagram-post-thumbnails error:", error);
    return response({ success: false, error: error?.message || "Erro inesperado" }, 500);
  }
});
