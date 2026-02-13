
## Backfill de MQL, Canal e Faturamento dos Leads a partir dos Deals

### Objetivo
Criar uma edge function executada uma unica vez que percorra todos os leads, busque o deal mais recente de cada um, e copie os valores dos campos personalizados MQL, Canal de Venda e Faturamento Atual do deal para os campos equivalentes do lead.

### Mapeamento de campos

Os campos de Deals e Leads tem IDs e opcoes diferentes. A funcao precisa traduzir os valores.

| Campo          | Deal Field ID                          | Lead Field ID                          |
|----------------|----------------------------------------|----------------------------------------|
| MQL            | 448404cd-0344-4892-a574-2387b1c17578   | e4270e93-e9b9-4d9b-9589-d614ce335bcd   |
| Canal          | 16ebda9f-cd3b-412c-bb06-0950001963c5   | 3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a   |
| Faturamento    | ed5c7c0e-0740-4945-b982-70a593ffae0c   | e352a1ca-cfbc-435a-95f7-2f53b5cac041   |

**Traducao de opcoes (Deal value -> Lead value):**

**MQL:**
- `sim_acima_30k` -> `opt_1`
- `nao_abaixo_30k` -> `opt_2`

**Canal (por label):**
- `organico` -> `opt_1`
- `trafego_pago` -> `opt_2`
- `indicacao` -> `opt_1770990177251`
- `prospeccao_ativa` -> `opt_1770990180958`
- `eventos` (Trafego Alheio) -> `opt_1770990186415`
- `carteira_esteira` -> `opt_1770990194848`
- `social_seller` -> `opt_1770990199860`
- `recorrencia` -> `opt_1770990203418`

**Faturamento Atual:** O campo do Lead e do tipo `text`, entao gravar o **label** da opcao do Deal (ex: "Entre 20 e 30 mil reais").

### Implementacao

**Arquivo: `supabase/functions/backfill-lead-fields/index.ts`**

Logica:
1. Buscar todos os leads (paginado)
2. Para cada lead, buscar o deal mais recente (`ORDER BY created_at DESC LIMIT 1`) via `deals.lead_id`
3. Para cada deal encontrado, buscar os valores em `deal_field_values` para os 3 campos
4. Traduzir os valores usando os mapas acima
5. Fazer upsert em `lead_field_values` (campo `lead_id + field_id`) com o valor traduzido
6. Retornar um resumo com quantos leads foram atualizados

A funcao sera protegida por autenticacao e podera ser chamada manualmente via curl ou pelo frontend.

### O que nao muda
- Nenhum campo existente sera sobrescrito se ja tiver valor no lead (ou podemos sobrescrever sempre - a escolha e sobrescrever para garantir sincronizacao)
- Nenhuma alteracao na UI
- Edge functions existentes nao sao afetadas
