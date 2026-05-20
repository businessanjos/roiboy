// NFS-e issue (Notazz) — recebe issuance_id pendente, monta payload e envia
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTAZZ_BASE = "https://app.notazz.com/api";

interface IssueBody {
  issuance_id?: string;
  installment_id?: string;
  invoice_id?: string;
}

function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const NOTAZZ_API_KEY = Deno.env.get("NOTAZZ_API_KEY");
    if (!NOTAZZ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "NOTAZZ_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: IssueBody = await req.json().catch(() => ({}));
    let issuanceId = body.issuance_id;

    // Se foi passado installment_id/invoice_id, criar issuance pendente
    if (!issuanceId && (body.installment_id || body.invoice_id)) {
      const { data: created, error: createErr } = await supabase.rpc(
        "create_nfse_issuance_from_source" as any,
        {
          p_installment_id: body.installment_id ?? null,
          p_invoice_id: body.invoice_id ?? null,
        },
      );
      // Se RPC não existir, faz fallback simples: buscar e criar inline
      if (createErr || !created) {
        // Fallback: emissão manual via installment_id
        if (body.installment_id) {
          const { data: inst } = await supabase
            .from("installments")
            .select("id, amount, invoice_id")
            .eq("id", body.installment_id)
            .maybeSingle();
          if (!inst) throw new Error("Parcela não encontrada");
          const { data: inv } = await supabase
            .from("invoices")
            .select("id, account_id, payer_id, client_id, description, product_id")
            .eq("id", inst.invoice_id)
            .maybeSingle();
          if (!inv) throw new Error("Fatura não encontrada");
          const { data: settings } = await supabase
            .from("account_settings")
            .select("nfse_default_contratada_id")
            .eq("account_id", inv.account_id)
            .maybeSingle();
          if (!settings?.nfse_default_contratada_id) {
            throw new Error("CNPJ emissor padrão não configurado em /financial/configuracoes/fiscal");
          }
          const { data: inserted, error: insErr } = await supabase
            .from("nfse_issuances")
            .insert({
              account_id: inv.account_id,
              contratada_id: settings.nfse_default_contratada_id,
              payer_id: inv.payer_id,
              client_id: inv.client_id,
              source_type: "installment",
              source_id: inst.id,
              invoice_id: inv.id,
              installment_id: inst.id,
              amount: inst.amount,
              description: inv.description || "Serviços prestados",
              status: "pending",
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          issuanceId = inserted.id;
        }
      } else {
        issuanceId = created as string;
      }
    }

    if (!issuanceId) {
      return new Response(JSON.stringify({ error: "issuance_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carregar issuance + contratada + payer
    const { data: iss, error: issErr } = await supabase
      .from("nfse_issuances")
      .select(`
        id, account_id, amount, description, status,
        item_lista_servico, codigo_tributacao_municipio, aliquota_iss,
        contratada:contratadas!nfse_issuances_contratada_id_fkey (
          id, cnpj, razao_social, inscricao_municipal, endereco,
          regime_tributario, item_lista_servico, codigo_tributacao_municipio, aliquota_iss,
          provider, provider_config
        ),
        payer:payers!nfse_issuances_payer_id_fkey (
          id, document, document_type, legal_name, email_billing,
          phone_billing, address
        )
      `)
      .eq("id", issuanceId)
      .maybeSingle();

    if (issErr || !iss) throw new Error("Emissão não encontrada");
    if (iss.status === "issued") {
      return new Response(JSON.stringify({ ok: true, already_issued: true, issuance_id: iss.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contratada: any = iss.contratada;
    const payer: any = iss.payer;
    if (!contratada) throw new Error("Contratada (CNPJ emissor) não vinculada");
    if (!payer) throw new Error("Pagador não vinculado à emissão");

    const itemLista = iss.item_lista_servico || contratada.item_lista_servico;
    const codigoTrib = iss.codigo_tributacao_municipio || contratada.codigo_tributacao_municipio;
    const aliquota = iss.aliquota_iss ?? contratada.aliquota_iss ?? 0;

    if (!itemLista) throw new Error("Item da lista de serviços não definido (configure no produto ou na contratada)");

    await supabase
      .from("nfse_issuances")
      .update({ status: "processing" })
      .eq("id", iss.id);

    // Payload Notazz NFSE
    const endereco = (payer.address ?? {}) as Record<string, any>;
    const payload = {
      apiKey: NOTAZZ_API_KEY,
      operation: "INPUT",
      kind: "NFSE",
      externalId: iss.id,
      destination: {
        document: onlyDigits(payer.document),
        name: payer.legal_name,
        email: payer.email_billing ?? undefined,
        phone: onlyDigits(payer.phone_billing),
        address: {
          street: endereco.street ?? endereco.logradouro,
          number: endereco.number ?? endereco.numero,
          complement: endereco.complement ?? endereco.complemento,
          district: endereco.district ?? endereco.bairro,
          city: endereco.city ?? endereco.cidade,
          state: endereco.state ?? endereco.uf,
          zipCode: onlyDigits(endereco.zip ?? endereco.cep),
        },
      },
      provider: {
        document: onlyDigits(contratada.cnpj),
      },
      service: {
        amount: Number(iss.amount),
        description: iss.description,
        cityServiceCode: codigoTrib ?? itemLista,
        federalServiceCode: itemLista,
        issRate: Number(aliquota),
      },
    };

    const resp = await fetch(`${NOTAZZ_BASE}/InvoiceInput.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const respText = await resp.text();
    let respJson: any = null;
    try { respJson = JSON.parse(respText); } catch { /* keep raw */ }

    const ok = resp.ok && (respJson?.status === "SUCCESS" || respJson?.success === true);

    if (!ok) {
      await supabase
        .from("nfse_issuances")
        .update({
          status: "rejected",
          provider_response: respJson ?? { raw: respText },
          rejected_reason: respJson?.message || respJson?.error || respText.slice(0, 500),
          retry_count: (await supabase.from("nfse_issuances").select("retry_count").eq("id", iss.id).maybeSingle()).data?.retry_count ?? 0,
        })
        .eq("id", iss.id);

      return new Response(JSON.stringify({
        ok: false,
        error: respJson?.message || respJson?.error || "Falha na emissão",
        provider_response: respJson ?? respText,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sucesso (síncrono ou em fila — Notazz costuma confirmar via webhook)
    await supabase
      .from("nfse_issuances")
      .update({
        status: respJson?.invoice?.status === "issued" ? "issued" : "queued",
        provider_request_id: respJson?.invoice?.id || respJson?.id || iss.id,
        provider_response: respJson,
        nfse_number: respJson?.invoice?.number || null,
        rps_number: respJson?.invoice?.rps?.number || null,
        rps_series: respJson?.invoice?.rps?.series || null,
        verification_code: respJson?.invoice?.verificationCode || null,
        pdf_url: respJson?.invoice?.pdfUrl || null,
        xml_url: respJson?.invoice?.xmlUrl || null,
        issued_at: respJson?.invoice?.status === "issued" ? new Date().toISOString() : null,
      })
      .eq("id", iss.id);

    return new Response(JSON.stringify({ ok: true, issuance_id: iss.id, provider_response: respJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("nfse-issue error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
