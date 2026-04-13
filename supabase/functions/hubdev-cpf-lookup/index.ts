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

    const { cpf } = await req.json();
    if (!cpf || typeof cpf !== "string") {
      return new Response(
        JSON.stringify({ error: "CPF é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF deve ter 11 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try multiple URL patterns for HubDev API
    const urls = [
      `https://ws.hubdodesenvolvedor.com.br/v2/cpf/${cleanCpf}?token=${HUBDEV_API_KEY}`,
      `https://ws.hubdodesenvolvedor.com.br/cpf/${cleanCpf}?token=${HUBDEV_API_KEY}`,
    ];

    let result = null;
    let lastError = "";

    for (const url of urls) {
      try {
        console.log(`Trying URL: ${url.replace(HUBDEV_API_KEY, "***")}`);
        const response = await fetch(url);
        const text = await response.text();
        console.log(`Response status: ${response.status}, body: ${text.substring(0, 500)}`);
        
        if (response.ok) {
          const data = JSON.parse(text);
          if (data && data.status !== false && !data.erro) {
            result = data;
            break;
          }
          if (data && (data.status === false || data.erro)) {
            return new Response(
              JSON.stringify({ error: data.message || data.erro || "CPF não encontrado na Receita Federal" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        lastError = `HTTP ${response.status}: ${text.substring(0, 200)}`;
      } catch (e) {
        lastError = String(e);
        console.error(`URL failed: ${e}`);
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: "Não foi possível consultar o CPF", details: lastError }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize response - handle various HubDev response formats
    const r = result.result || result;
    const normalized = {
      nome: r.nome || r.nome_da_pf || null,
      nascimento: r.nascimento || r.data_nascimento || null,
      situacao: r.situacao || r.situacao_cadastral || null,
      genero: r.genero || r.sexo || null,
      mae: r.mae || r.nome_da_mae || null,
      telefone: r.telefone || null,
      endereco: r.endereco || r.logradouro || null,
      bairro: r.bairro || null,
      cidade: r.cidade || r.municipio || null,
      estado: r.estado || r.uf || null,
      cep: r.cep || null,
    };

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("HubDev CPF lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao consultar CPF" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
