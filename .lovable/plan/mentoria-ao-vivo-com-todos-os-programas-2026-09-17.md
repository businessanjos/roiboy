# Mentoria Ao Vivo com todos os programas

## O problema

A tela hoje só considera dois programas (Eternum Club e Rykas Mentoring), fixados por uma lista interna de produtos. Todos os outros clientes ativos da carteira — Eternum Mentoring, Eternum MVP, Eternum Private, Conselho de Anjo, Clínica Ryka, entre outros — nunca entram na lista. Por isso o seletor "Todos os programas" mostra só duas opções e o filtro parece errado: ele está filtrando um universo incompleto.

## O que muda

1. A lista passa a trazer todos os clientes ativos da carteira:
   - quem tem contrato ativo, de qualquer produto;
   - e também quem está ativo sem contrato registrado, usando o produto vinculado ao cliente.
2. O seletor de programas passa a ser montado a partir dos produtos que realmente aparecem na lista, com a contagem de cada um. Nada fica de fora.
3. Renovações aparecem como programa separado (por exemplo "REN. RM l Rykas Mentoring" ao lado de "RM l Rykas Mentoring"), conforme pedido.
4. A etiqueta de programa na linha do cliente passa a usar a cor cadastrada do produto, como no resto do sistema.
5. O texto de apresentação da página deixa de citar só os dois programas.

Com isso, dá para escolher qualquer cliente ativo e registrar a agenda de mentoria.

## Detalhes técnicos

Arquivo: `src/pages/MentoriaEC.tsx`.

- Remover a constante `MENTORING_PRODUCTS` / `MENTORING_PRODUCT_IDS` e o tipo `ProgramFilter` fixo em `"EC" | "RM"`.
- `membersQuery` passa a:
  - buscar `client_contracts` com `status = 'active'` sem o `.in("product_id", ...)`;
  - buscar `client_products` com `is_active = true` para cobrir clientes sem contrato;
  - buscar `clients` com `status in ('active','paused','churn_risk')` para restringir a carteira ativa, unindo as duas origens (contrato tem prioridade para `end_date`);
  - carregar `products (id, name, color)` e resolver nome + cor por `product_id`.
- `EcMember` troca `program: "EC" | "RM" | null` por `productId` + `productLabel` + `productColor`; o filtro de programa passa a comparar `productId` (valor `all` mantido) e continua persistido no parâmetro `program` da URL.
- Opções do seletor geradas dinamicamente a partir dos membros carregados, ordenadas por nome, com contagem por produto e um item "Sem programa" quando houver clientes sem produto identificado.
- Badge do programa usa `products.color` com fallback neutro, conforme a regra de badge de produto do projeto.
- Os cards de topo (Membros ativos / Sem mentoria marcada) e as abas continuam calculados sobre a lista já filtrada.

Validação: `bun x tsgo --noEmit`, build, e conferência dos totais por produto contra o banco.
