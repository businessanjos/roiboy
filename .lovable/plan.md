
## Corrigir carregamento da pagina de cliente e lista de clientes

### Problemas identificados

#### Problema 1: Lista de clientes nao carrega (pagina Clientes)

O `useEffect` principal em `Clients.tsx` (linha 737) depende apenas de `currentSector?.id`. Quando o componente monta, `currentUser` pode ainda estar carregando (null). A funcao `fetchClients` (linha 496-501) verifica `currentUser?.account_id` e `currentUser?.id` -- se sao null, retorna imediatamente com `setLoading(false)`. Quando `currentUser` finalmente carrega, **nada dispara uma nova chamada** porque `currentUser` nao esta nas dependencias do useEffect.

Resultado: a pagina mostra estado vazio ou loading e nunca busca os dados.

**Correcao**: Adicionar `currentUser?.account_id` como dependencia do useEffect principal (linha 737-742).

#### Problema 2: Pagina de detalhe do cliente demora muito para carregar

O `fetchData` em `ClientDetail.tsx` (linhas 583-997) faz **10+ queries sequenciais** ao banco de dados: client, products, contract, score, vnps, roi_events, risk_events, recommendations, messages, followups, life_events, form_responses, attendance, subscriptions. Cada query espera a anterior terminar.

Em conexoes mais lentas ou com dados volumosos, isso causa lentidao extrema ou timeout aparente (a pagina fica presa no loading por muitos segundos).

**Correcao**: Agrupar as queries independentes em blocos paralelos usando `Promise.all()`. Apos buscar o client (necessario primeiro), executar todas as demais queries simultaneamente.

### Alteracoes

#### Arquivo 1: `src/pages/Clients.tsx`

**Linha 737-742**: Adicionar `currentUser?.account_id` ao array de dependencias:

```typescript
useEffect(() => {
  fetchClients();
  fetchProducts();
  fetchCustomFields();
}, [currentSector?.id, currentUser?.account_id]);
```

#### Arquivo 2: `src/pages/ClientDetail.tsx`

**Linhas 700-975**: Refatorar o bloco de queries sequenciais para usar `Promise.all`. Apos obter o `clientData` (que precisa ser primeiro), executar todas as queries restantes em paralelo:

```typescript
// Depois de buscar e validar clientData...

// Fetch all independent data in parallel
const [
  clientProductsResult,
  activeContractResult,
  scoreResult,
  vnpsResult,
  roiResult,
  riskResult,
  recResult,
  messagesResult,
  followupsResult,
  lifeEventsResult,
  formResponsesResult,
  attendanceResult,
  subscriptionsResult,
  allRiskResult,
] = await Promise.all([
  supabase.from("client_products").select("product_id, products(id, name)").eq("client_id", id),
  supabase.from("client_contracts").select("start_date, end_date").eq("client_id", id).eq("status", "active").order("start_date", { ascending: false }).limit(1).maybeSingle(),
  supabase.from("score_snapshots").select("*").eq("client_id", id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
  supabase.from("vnps_snapshots").select("*").eq("client_id", id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
  supabase.from("roi_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }),
  supabase.from("risk_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }),
  supabase.from("recommendations").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  supabase.from("message_events").select("*").eq("client_id", id).order("sent_at", { ascending: false }).limit(200),
  supabase.from("client_followups").select("*, users(name, avatar_url)").eq("client_id", id).order("created_at", { ascending: false }),
  supabase.from("client_life_events").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
  supabase.from("form_responses").select("*, forms(title)").eq("client_id", id).order("submitted_at", { ascending: false }).limit(100),
  supabase.from("attendance").select("*, events(title, address, scheduled_at)").eq("client_id", id).not("event_id", "is", null).order("join_time", { ascending: false }).limit(100),
  supabase.from("client_subscriptions").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
  supabase.from("risk_events").select("*").eq("client_id", id).order("happened_at", { ascending: false }).limit(100),
]);
```

Depois, processar os resultados de cada query da mesma forma que ja e feito, usando `.data` de cada resultado. Isso muda a execucao de ~14 queries sequenciais para 1 query + 13 queries paralelas, reduzindo drasticamente o tempo de carregamento.

### Impacto esperado

- **Lista de clientes**: Carregara corretamente mesmo quando `currentUser` demora para inicializar
- **Detalhe do cliente**: Tempo de carregamento reduzido de ~14x latencia de rede sequencial para ~2x (1 sequencial + 1 lote paralelo)
