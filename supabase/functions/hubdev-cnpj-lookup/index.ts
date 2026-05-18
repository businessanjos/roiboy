const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const HUBDEV_API_KEY = Deno.env.get("HUBDEV_API_KEY");
    if (!HUBDEV_API_KEY) {
      return new Response(
        JSON.stringify({ error: "HUBDEV_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { cnpj } = await req.json();
    if (!cnpj || typeof cnpj !== "string") {
      return new Response(
        JSON.stringify({ error: "CNPJ é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      return new Response(
        JSON.stringify({ error: "CNPJ deve ter 14 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams({
      cnpj: cleanCnpj,
      token: HUBDEV_API_KEY,
    });

    const url = `https://ws.hubdodesenvolvedor.com.br/v2/cnpj/?${params.toString()}`;
    console.log(`Calling HubDev: /v2/cnpj/?cnpj=${cleanCnpj}&token=***`);

    const response = await fetch(url);
    const data = await response.json();
    console.log(`Response: ${JSON.stringify(data).substring(0, 500)}`);

    if (!data || data.status === false) {
      return new Response(
        JSON.stringify({ error: data?.message || "CNPJ não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const r = data.result || data;

    // Extract CNAEs - HubDev may return as string, object or array
    const extractCnae = (item: any): string | null => {
      if (!item) return null;
      if (typeof item === "string") return item;
      if (typeof item === "object") {
        const code = item.code || item.codigo || item.cnae || "";
        const desc = item.text || item.descricao || item.description || "";
        return code && desc ? `${code} - ${desc}` : (code || desc || null);
      }
      return null;
    };

    const cnaesSecundariosRaw = r.atividades_secundarias || r.cnaes_secundarios || r.atividade_secundaria || [];
    const cnaesSecundarios = Array.isArray(cnaesSecundariosRaw)
      ? cnaesSecundariosRaw.map(extractCnae).filter(Boolean)
      : [];

    const normalized = {
      razao_social: r.razao_social || r.nome || null,
      nome_fantasia: r.nome_fantasia || r.fantasia || null,
      email: r.email || null,
      telefone: r.telefone || r.telefone_1 || null,
      logradouro: r.logradouro || null,
      numero: r.numero || null,
      complemento: r.complemento || null,
      bairro: r.bairro || null,
      cidade: r.municipio || r.cidade || null,
      estado: r.uf || r.estado || null,
      cep: r.cep || null,
      situacao: r.situacao_cadastral || r.situacao || null,
      abertura: r.data_abertura || r.abertura || null,
      atividade_principal: extractCnae(r.atividade_principal) || r.atividade_principal || null,
      cnaes_secundarios: cnaesSecundarios,
      porte: r.porte || null,
      natureza_juridica: r.natureza_juridica || null,
      capital_social: r.capital_social || null,
    };

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("HubDev CNPJ lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao consultar CNPJ" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
