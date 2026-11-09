// Chamada síncrona a um ator do Apify (token no segredo APIFY_API_TOKEN, enviado no cabeçalho).
export async function runApifyActor(actorId: string, input: unknown, timeoutSecs = 120): Promise<any[]> {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) throw new Error("APIFY_API_TOKEN não configurado");
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSecs}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apify [${res.status}]: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  return Array.isArray(json) ? json : [];
}
