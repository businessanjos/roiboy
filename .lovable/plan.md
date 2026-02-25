

## Investigacao: Campanhas 3C Plus ausentes (ex: "Prospecao Manual")

### Causa provavel

A Edge Function `threecplus-campaigns` busca as campanhas do agente no endpoint `/api/v1/agent/campaigns` da API do 3C Plus. O problema esta na **linha 130** do codigo:

```typescript
const campaignList = Array.isArray(campaigns) ? campaigns : campaigns?.data || [];
```

A API do 3C Plus retorna respostas **paginadas** no formato Laravel (ex: `{ data: [...], current_page: 1, last_page: 3, per_page: 15, total: 40 }`). O codigo atual so extrai `campaigns.data` da **primeira pagina**, ignorando as paginas seguintes. Usuarios com muitas campanhas (como o Jonathan Marcato com ~15+) podem ter campanhas como "Prospecao Manual" caindo na segunda pagina.

### Solucao

**Arquivo:** `supabase/functions/threecplus-campaigns/index.ts`

1. Adicionar `per_page=100` como query parameter na chamada da API para maximizar resultados por pagina
2. Implementar loop de paginacao para buscar TODAS as paginas caso existam mais de 100 campanhas
3. Adicionar logs mais detalhados para diagnostico

### Mudancas tecnicas

```typescript
// Substituir a chamada unica (linha 89-95) por um loop de paginacao:
let allCampaigns: any[] = [];
let currentPage = 1;
let hasMore = true;

while (hasMore) {
  const apiResponse = await fetch(
    `${baseDomain}/api/v1/agent/campaigns?api_token=${integration.access_token}&per_page=100&page=${currentPage}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  
  // ... parse response ...
  
  const parsed = JSON.parse(responseText);
  
  if (Array.isArray(parsed)) {
    // API returned plain array (no pagination)
    allCampaigns = parsed;
    hasMore = false;
  } else if (parsed?.data && Array.isArray(parsed.data)) {
    // Paginated response
    allCampaigns.push(...parsed.data);
    hasMore = parsed.current_page < parsed.last_page;
    currentPage++;
  } else {
    hasMore = false;
  }
  
  // Safety: max 10 pages
  if (currentPage > 10) break;
}

return Response(JSON.stringify({ success: true, campaigns: allCampaigns }));
```

### Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/threecplus-campaigns/index.ts` | Adicionar paginacao completa + `per_page=100` para garantir que TODAS as campanhas do usuario sejam retornadas |

