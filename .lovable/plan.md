# Conferência de produto nas vendas ganhas (Hat Trick / SPIFFs)

## O problema

A campanha Hat Trick Week vale só para **EM l Eternum Mentoring**, mas hoje entram vendas que não deveriam:

- O produto do negócio está gravado de dois jeitos diferentes no sistema (em alguns negócios o código do produto, em outros um apelido de texto como `rykas_mentoring`). A comparação com o produto da campanha só reconhece um dos formatos, então a conta sai errada.
- Renovações (REN. EM, REN. RM, REN. EC) são produtos próprios e não podem contar como venda nova.
- Muitos negócios antigos foram ganhos com o produto errado marcado: por exemplo, 3 negócios com título `[CARTEIRA-EM]` estão marcados como renovação de Rykas, e 18 com `[TRAF-STUDIO-EC]` estão marcados como Rykas.

## O que vamos fazer

### 1. Contagem correta na campanha
- Reconhecer os dois formatos de produto (código e apelido) antes de comparar com o produto da campanha.
- Nunca contar produtos de renovação, mesmo que o nome pareça o mesmo (REN. EM não é EM).
- Na janela do giro, continuar mostrando todas as vendas do período com a marcação "Conta" / "Fora da regra", agora com a regra certa.

### 2. Relação de produtos a conferir
Nova tela em Vendas → Metas & Incentivos → SPIFFs, botão **Conferir produtos**, só para gestor/admin:
- Lista as vendas ganhas em que o produto marcado não bate com a sigla do título (ex.: título `[CARTEIRA-EM]` com produto Rykas).
- Colunas: negócio, contato, vendedor, data do ganho, valor, produto marcado, produto sugerido pela sigla do título.
- Filtro por período e por vendedor, busca por nome, e exportação em CSV para você conferir fora do sistema.
- Clicar na linha abre a ficha do negócio.

### 3. Corrigir o produto mesmo após o ganho
- Gestor/admin passa a poder trocar o produto de uma venda já ganha (hoje o campo fica travado) — direto na lista de conferência ou na ficha do negócio.
- Toda troca fica registrada no histórico (quem alterou, quando, de qual produto para qual), aparecendo nos logs de vendas.
- Vendedor comum continua sem poder alterar depois do ganho.

## Detalhes técnicos

- Produto do negócio: `deal_field_values` com `field_id = 033b91fb-3add-4c96-aec9-567fefbd0fb2`, `value_text` ora com UUID de `products`, ora com slug (`rykas_mentoring`, `ren_rykas_mentoring`, `eternum_club`...). Criar `src/lib/sales/productResolution.ts` com mapa slug → produto e função `resolveDealProduct(valueText, products)`.
- Ajustar `SpiffWindowDealsDialog.tsx` e `SpiffsSection.tsx` para usar essa resolução ao montar `matchingIds`, excluindo produtos cujo nome comece com `REN.`.
- Novo componente `ProductAuditDialog.tsx` em `src/components/sales/quotas/`, consultando `deals` (`status='won'`) + `deal_field_values` + `products`, com paginação em lotes (limite do PostgREST) e derivação da sigla a partir do prefixo `[...]` do título.
- Edição pós-ganho: gravação em `deal_field_values` liberada por `isManagementUser(currentUser)`, com registro em `audit_logs` (`action='deal_product_changed'`, valores antigo/novo) para aparecer em `/sales/logs`.
- Sem migração de dados em massa: a correção dos registros acontece pela tela, com autoria registrada.
