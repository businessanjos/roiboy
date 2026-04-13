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

    // Format birth date to DD/MM/YYYY if provided as YYYY-MM-DD
    let formattedDate = nascimento || "";
    if (nascimento && nascimento.includes("-")) {
      const [y, m, d] = nascimento.split("-");
      formattedDate = `${d}/${m}/${y}`;
    }

    // HubDev API: GET /v2/cpf/?cpf=XXX&nascimento=DD/MM/YYYY&token=XXX
    const params = new URLSearchParams({
      cpf: cleanCpf,
      token: HUBDEV_API_KEY,
    });
    if (formattedDate) {
      params.set("nascimento", formattedDate);
    }

    const url = `https://ws.hubdodesenvolvedor.com.br/v2/cpf/?${params.toString()}`;
    console.log(`Calling HubDev: /v2/cpf/?cpf=${cleanCpf}&nascimento=${formattedDate}&token=***`);

    const response = await fetch(url);
    const data = await response.json();
    console.log(`Response: ${JSON.stringify(data).substring(0, 500)}`);

    if (!data || data.status === false) {
      return new Response(
        JSON.stringify({ error: data?.message || "CPF não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize response
    const r = data.result || data;
    const normalized = {
      nome: r.nome_da_pf || r.nome || null,
      nascimento: r.data_nascimento || r.nascimento || null,
      situacao: r.situacao_cadastral || r.situacao || null,
      comprovante_emitido: r.comprovante_emitido || null,
      digito_verificador: r.digito_verificador || null,
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
