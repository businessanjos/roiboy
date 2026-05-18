// Public portal for service providers: fetch profile, update bank data, upload invoices
// No JWT required — token in URL is the auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const token = url.searchParams.get("token") || "";

    if (!token) return json({ error: "Token obrigatório" }, 400);

    // Resolve provider by token
    const { data: provider, error: pErr } = await admin
      .from("hr_service_providers")
      .select("id, account_id, full_name, company_name, trade_name, cnpj, cpf, email, phone, bank_name, bank_agency, bank_account, bank_pix_key, preferred_payment_day, fee_amount, status")
      .eq("portal_token", token)
      .maybeSingle();

    if (pErr || !provider) return json({ error: "Link inválido ou expirado" }, 404);
    if (provider.status === "inactive") return json({ error: "Cadastro inativo. Contate o RH/Financeiro." }, 403);

    // GET profile + invoice history
    if (req.method === "GET" || action === "get") {
      const { data: invoices } = await admin
        .from("hr_provider_invoices")
        .select("id, competence_month, invoice_number, amount, file_url, file_name, status, payment_due_date, paid_at, uploaded_at, rejection_reason, notes")
        .eq("provider_id", provider.id)
        .order("competence_month", { ascending: false })
        .limit(24);

      return json({ provider, invoices: invoices ?? [] });
    }

    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const body = await req.json().catch(() => ({}));

    if (action === "update_profile") {
      const updates: Record<string, unknown> = {};
      const allow = ["bank_name", "bank_agency", "bank_account", "bank_pix_key", "preferred_payment_day", "phone", "email"];
      for (const k of allow) {
        if (k in body) updates[k] = body[k];
      }
      if (typeof updates.preferred_payment_day === "number") {
        const d = updates.preferred_payment_day as number;
        if (d < 1 || d > 31) return json({ error: "Dia de pagamento deve estar entre 1 e 31" }, 400);
      }
      const { error } = await admin
        .from("hr_service_providers")
        .update(updates)
        .eq("id", provider.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "upload_invoice") {
      const { competence_month, invoice_number, amount, file_base64, file_name, notes } = body;
      if (!competence_month || !file_base64 || !file_name) {
        return json({ error: "competence_month, file_base64 e file_name são obrigatórios" }, 400);
      }
      if (typeof amount !== "number" || amount <= 0) {
        return json({ error: "Valor da NF inválido" }, 400);
      }

      // Decode base64
      const cleaned = String(file_base64).replace(/^data:[^;]+;base64,/, "");
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
      } catch {
        return json({ error: "Arquivo inválido" }, 400);
      }
      if (bytes.length > 15 * 1024 * 1024) return json({ error: "Arquivo maior que 15MB" }, 400);

      const safeName = String(file_name).replace(/[^\w.\-]+/g, "_").slice(0, 80);
      const ext = safeName.includes(".") ? safeName.split(".").pop() : "pdf";
      const path = `${provider.account_id}/${provider.id}/${competence_month}-${Date.now()}.${ext}`;

      const contentType = ext === "pdf" ? "application/pdf"
        : ext === "png" ? "image/png"
        : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : "application/octet-stream";

      const { error: upErr } = await admin.storage
        .from("provider-invoices")
        .upload(path, bytes, { contentType, upsert: false });
      if (upErr) return json({ error: `Falha no upload: ${upErr.message}` }, 500);

      // Compute payment_due_date based on preferred day if provided
      let payment_due_date: string | null = null;
      if (provider.preferred_payment_day) {
        const [y, m] = String(competence_month).split("-").map(Number);
        const day = Math.min(provider.preferred_payment_day, 28);
        const due = new Date(Date.UTC(y, m, day)); // next month at preferred day
        payment_due_date = due.toISOString().slice(0, 10);
      }

      const { data: inv, error: invErr } = await admin
        .from("hr_provider_invoices")
        .upsert([{
          account_id: provider.account_id,
          provider_id: provider.id,
          competence_month,
          invoice_number: invoice_number || null,
          amount,
          file_url: path,
          file_name: safeName,
          notes: notes || null,
          status: "pending",
          payment_due_date,
          uploaded_at: new Date().toISOString(),
        }], { onConflict: "provider_id,competence_month" })
        .select()
        .single();

      if (invErr) return json({ error: invErr.message }, 400);
      return json({ ok: true, invoice: inv });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    console.error("provider-portal error:", msg);
    return json({ error: msg }, 500);
  }
});
