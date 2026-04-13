const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUBDEV_BASE_URL = "https://ws.hubdodesenvolvedor.com.br/v2";

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

    // Try the full data endpoint first (cadastral-cpf), fallback to basic cpf
    const urls = [
      `${HUBDEV_BASE_URL}/cpf/${cleanCpf}/?token=${HUBDEV_API_KEY}`,
    ];

    let result = null;
    for (const url of urls) {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.status !== false && !data.erro) {
          result = data;
          break;
        }
        // If status is false, treat as not found
        if (data && (data.status === false || data.erro)) {
          return new Response(
            JSON.stringify({ error: data.message || data.erro || "CPF não encontrado na Receita Federal" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: "Não foi possível consultar o CPF" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize response
    const normalized = {
      nome: result.nome || result.result?.nome_da_pf || null,
      nascimento: result.nascimento || result.result?.data_nascimento || null,
      situacao: result.situacao || result.result?.situacao_cadastral || null,
      genero: result.genero || result.result?.sexo || null,
      mae: result.mae || result.result?.nome_da_mae || null,
      telefone: result.telefone || result.result?.telefone || null,
      endereco: result.endereco || result.result?.endereco || null,
      bairro: result.bairro || result.result?.bairro || null,
      cidade: result.cidade || result.result?.municipio || null,
      estado: result.estado || result.result?.uf || null,
      cep: result.cep || result.result?.cep || null,
      raw: result,
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
