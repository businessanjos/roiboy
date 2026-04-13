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

    const { cpf, nascimento } = await req.json();
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

    // HubDev API URLs to try
    // Basic CPF (requires birth date): /v2/cpf/{cpf}/{nascimento}
    // Cadastral CPF (full data, no birth date needed): /v2/cadastral-cpf/{cpf}
    const urls: string[] = [];
    
    // Try cadastral-cpf first (returns more data, doesn't need birth date)
    urls.push(`https://ws.hubdodesenvolvedor.com.br/v2/cadastral-cpf/${cleanCpf}?token=${HUBDEV_API_KEY}`);
    
    // If birth date provided, also try the basic CPF endpoint
    if (nascimento) {
      // nascimento can be YYYY-MM-DD or DD/MM/YYYY
      let formattedDate = nascimento;
      if (nascimento.includes("-")) {
        const [y, m, d] = nascimento.split("-");
        formattedDate = `${d}/${m}/${y}`;
      }
      urls.push(`https://ws.hubdodesenvolvedor.com.br/v2/cpf/${cleanCpf}/${formattedDate}?token=${HUBDEV_API_KEY}`);
    }

    let result = null;
    let lastError = "";

    for (const url of urls) {
      try {
        const safeUrl = url.replace(HUBDEV_API_KEY, "***");
        console.log(`Trying: ${safeUrl}`);
        const response = await fetch(url);
        const text = await response.text();
        console.log(`Status: ${response.status}, Body: ${text.substring(0, 500)}`);

        if (response.ok) {
          try {
            const data = JSON.parse(text);
            // HubDev returns status:true on success, status:false on error
            if (data && data.status === true && data.result) {
              result = data.result;
              break;
            }
            if (data && data.status === false) {
              lastError = data.message || "CPF não encontrado";
            }
          } catch {
            lastError = "Resposta inválida da API";
          }
        } else {
          lastError = `HTTP ${response.status}`;
        }
      } catch (e) {
        lastError = String(e);
        console.error(`URL failed: ${e}`);
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: lastError || "Não foi possível consultar o CPF" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize response from HubDev
    const normalized = {
      nome: result.nome_da_pf || result.nome || null,
      nascimento: result.data_nascimento || result.nascimento || null,
      situacao: result.situacao_cadastral || result.situacao || null,
      genero: result.sexo || result.genero || null,
      mae: result.nome_da_mae || result.mae || null,
      telefone: result.telefone_fixo || result.telefone_celular || result.telefone || null,
      celular: result.telefone_celular || null,
      endereco: result.logradouro || result.endereco || null,
      numero: result.numero || null,
      complemento: result.complemento || null,
      bairro: result.bairro || null,
      cidade: result.municipio || result.cidade || null,
      estado: result.uf || result.estado || null,
      cep: result.cep || null,
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
