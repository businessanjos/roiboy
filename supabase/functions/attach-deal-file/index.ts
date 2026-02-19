import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequestWithLegacy, logApiKeyUsage, unauthorizedResponse } from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Authenticate
  const auth = await authenticateRequestWithLegacy(req, supabase);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data. Send multipart/form-data with deal_id and file." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dealId = formData.get("deal_id") as string | null;
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null) || "Contrato anexado";

  // Validate deal_id
  if (!dealId || !UUID_REGEX.test(dealId)) {
    return new Response(JSON.stringify({ error: "deal_id is required and must be a valid UUID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate file
  if (!file || !(file instanceof File) || file.size === 0) {
    return new Response(JSON.stringify({ error: "file is required and must not be empty" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify deal exists and belongs to account
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("account_id", auth.accountId)
    .maybeSingle();

  if (dealError) {
    console.error("Error fetching deal:", dealError);
    return new Response(JSON.stringify({ error: "Failed to fetch deal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!deal) {
    return new Response(JSON.stringify({ error: "Deal not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Determine file extension
  const originalName = file.name || "arquivo.pdf";
  const ext = originalName.split(".").pop() || "pdf";
  const fileId = crypto.randomUUID();
  const storagePath = `${auth.accountId}/deals/${dealId}/${fileId}.${ext}`;

  // Upload file to storage
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("deal-activities")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return new Response(JSON.stringify({ error: "Failed to upload file" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("deal-activities")
    .getPublicUrl(storagePath);

  const fileUrl = urlData.publicUrl;

  // Insert deal activity
  const { data: activity, error: insertError } = await supabase
    .from("deal_activities")
    .insert({
      account_id: auth.accountId,
      deal_id: dealId,
      type: "file",
      title: title.trim(),
      file_url: fileUrl,
      file_name: originalName,
      file_size: file.size,
      user_id: null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error inserting deal activity:", insertError);
    return new Response(JSON.stringify({ error: "Failed to create deal activity" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log API key usage
  if (auth.apiKeyId) {
    await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
  }

  return new Response(JSON.stringify({
    success: true,
    deal_id: dealId,
    activity_id: activity.id,
    file_url: fileUrl,
    file_name: originalName,
    file_size: file.size,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
