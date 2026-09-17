# Área da saúde na Mentoria: só ativos, contagem de formação e filtros por programa/área

## Por que a Fabiane aparece hoje

Conferi no banco. Existem duas fichas com esse nome; a que aparece na aba é "Fabiane A. N. Zaghini - EC":

- situação da ficha: "risco de saída" (não "ativa");
- contrato do Eternum Club: encerrado em 27/05/2026;
- mas o produto Eternum Club continua marcado como vinculado na ficha dela.

A aba de Área da saúde monta a lista por dois critérios frouxos: situação da ficha em "ativo OU risco de saída" e produto vinculado na ficha (não o contrato). Por isso ela entra, mesmo sem contrato em vigor. Nas telas de Clientes e de Mentoria Ao Vivo a régua já é outra: só entra quem tem contrato ativo — e por isso lá ela não aparece.

## O que muda

1. **Só clientes ativos.** A aba passa a usar a mesma régua das outras telas: só entra quem tem contrato ativo. São 212 pessoas hoje (confirmado no banco). A Fabiane sai da lista automaticamente.
2. **A lista passa a mostrar todos esses ativos**, não só médicos e dentistas — assim dá para ver quem ainda não tem formação informada e classificar ali mesmo, como já é possível hoje.
3. **Números do topo** passam a ser quatro:
   - Ativos: 212
   - Identificados (com formação preenchida): 189 hoje
   - Faltam identificar: 23 hoje
   - Exibidos com o filtro atual
   Abaixo dos cartões, uma linha com a quebra por formação (quantos médicos, dentistas, odontologia, etc.), cada uma clicável para filtrar.
4. **Filtros:** sai "Produto" e entra "Programa" (o produto do contrato ativo, com a contagem de cada um) e entra "Área de atuação" (as áreas cadastradas na ficha). Continuam a busca por texto, a fonte da evidência e o filtro de classificação (todos / sem formação / já classificados / só médicos).
5. Exportação em planilha passa a incluir programa e área de atuação, respeitando os filtros.

## Detalhes técnicos

`supabase/functions/list-medical-clients/index.ts`:
- Universo passa a ser montado a partir de `client_contracts` com `account_id` do usuário e `status = 'active'` (paginado de 1.000), extraindo `client_id` distintos; `clients` buscado com `.in("id", ids)` em blocos de 200. Remove o filtro por `clients.status in ('active','churn_risk')` e o uso de `client_products` como fonte de programa.
- Programa do cliente vem do contrato ativo (maior `end_date` quando houver mais de um), com `products.name` e `products.color`. Remove `MENTORSHIP_PRODUCT_PATTERNS` / `isMentorship` (todo contrato ativo já é da mentoria).
- Deixa de aplicar `.filter((c) => c.kind !== null)`: retorna todos, com `kind` (`doctor` | `dentist` | `null`), `education`, `education_specialty` e `business_niche` (áreas de atuação).
- `client_field_values` continua paginado, agora restrito aos ids do universo menor.

`src/pages/MedicalClients.tsx`:
- Tipo `MedicalClient` ganha `program`, `programColor`, `practiceAreas: string[]` (split de `business_niche` por vírgula) e perde `products`.
- Estados: `programFilter` e `areaFilter` no lugar de `productFilter`; opções derivadas da lista carregada, ordenadas em pt-BR, com contagem.
- Cartões de topo: Ativos (total), Identificados (`education` preenchida), Faltam identificar (diferença), Exibidos com filtro. Quebra por formação via `useMemo` agrupando `education` normalizada, renderizada como chips que ajustam o filtro.
- Badge do programa usa a cor cadastrada do produto com fallback `#6b7280`, conforme a regra de badge de produto do projeto.
- `exportCsv` troca a coluna "Produtos" por "Programa" e acrescenta "Áreas de atuação".

Sem mudança de schema, RLS ou permissões. Validação: `bun x tsgo --noEmit`, build, deploy de `list-medical-clients` e conferência de que o total exibido é 212 e a soma dos programas fecha com esse número.
