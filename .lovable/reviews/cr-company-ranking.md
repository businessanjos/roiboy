# CR no Ranking de Vendedores

## Regra
Neste ranking separado por empresa, CR pertence à Anjos: quantidade de produtos e valor integral de cada negócio devem ir juntos para essa coluna. EM permanece na Eternum. A exibição não regrava negócios encerrados, contratos, pagamentos, permissões ou configurações.

## Origem e resultado
- Reproduzido na sessão da prévia: Eternum R$ 446.600 (Darlan R$ 205.400, 4 CR + 1 EM); Anjos R$ 35.000 (Darlan, 1 CR).
- Leituras do banco confirmaram três CR antigos de R$ 30.000 e um CR de R$ 35.000 vinculados à Eternum. O produto CR já está cadastrado na Anjos. A definição antiga de empresa padrão explica o vínculo histórico; o gatilho atual acompanha o produto quando Item da Venda muda, sem migração retroativa.
- Corrigida exclusivamente a leitura do ranking opt-in: identidade registrada por UUID, opção antiga ou nome exato único; empresa histórica como fallback quando o produto não é resolvido. Nenhuma dedução por trecho do nome ou pelo vendedor.
- Resultado: Eternum R$ 321.600 (Jonathan R$ 241.200 + Darlan R$ 80.400, somente EM); Anjos R$ 160.000 (Darlan, 5 CR). Total preservado em R$ 481.600 e 9 vendas.

## Caminhos conferidos
| Lugar | Código lido / execução | Resultado |
| --- | --- | --- |
| Ranking normal e atualização | `useVisualData.ts`, `companyRanking.ts`, `CompanyRanking.tsx`, `ConfigurableChart.tsx` | Corrigidos; sessão autenticada e recarga confirmam empresas, valores e pílulas. |
| Fórmulas e participação percentual | `ConfigurableVisualCard.tsx`, `companyRankingShares` | Usam os pontos já divididos; testes confirmam denominador próprio de cada empresa. |
| Apresentação ampliada | `ConfigurableVisualCard.tsx`, `RankingPresentationView.tsx` | Recebe a mesma leitura corrigida; abrir, apresentar e sair executados na sessão real. |
| Modo Foco/TV | `urlState.ts`, mesma apresentação do ranking | Executado em 1920×1080, 1366×768 e 803×674, claro/escuro, com `foco=1&tv=1`; valores corretos e todas as linhas visíveis. Sem aparelho físico. |
| Filtro de vendedor | `InsightsFilterBar.tsx`, `useVisualData.ts` | Selecionar Darlan, atualizar e voltar a todos executados; R$ 80.400 na Eternum e R$ 160.000 na Anjos. |
| Lista Explorar dados | `useVisualDrilldown.ts` | Lista consolidada dos negócios filtrados, não possui colunas por empresa; não redistribui valores. Código lido, não executada nesta rodada. |
| Negócios por vendedor / demais visuais | `useStackedVisualData.ts`, `productLabelResolver.ts`, seleção de tipo em `useVisualData.ts` | Sem divisão por empresa; não recebem o novo parâmetro. Gráfico da sessão permaneceu com 167 negócios e valores 118/44/5. |
| Calls Comerciais e Calls CR | `fetchTasksCallCommercialData` em `useVisualData.ts`, seleção em `ConfigurableChart.tsx` | Mantêm os critérios próprios por atividade/produto/funil. Não usam `aggregateCompanyRanking`; comparados antes/depois, intactos. |
| Produtos: filtro, criação/edição/duplicação | `Products.tsx`, `companyAreaFilters.ts` | Leem/preservam a empresa cadastrada no produto. Cadastro real de CR consultado: Anjos. Código lido, nenhum produto alterado. |
| Novo/editar negócio e alteração em massa | `DealDialog.tsx`, `BulkDealDialog.tsx`, `itemVendaResolver.ts` | Mantêm identidade de produto e vínculo previsto pelo fluxo existente. Sem executar alterações em registros. |
| Pipeline aberto/ganho/perdido, prévia e exportação | `SalesPipeline.tsx`, `companyFilter.ts`, `pipelineFilterValues.ts`, `usePipelineFilterValues.ts` | Filtros históricos por empresa da venda continuam intencionalmente inalterados, conforme escopo anterior: corrigir este bloco não muda propriedade dos negócios fechados. Identidade de CR por opção/UUID é compartilhada. |
| Dashboard de Vendas, anual/trimestral, atividades e contratos | `SalesDashboard.tsx`, `useSalesCompanyScope.ts`, `companyActivityScope.ts` | Preservam a empresa histórica da venda e os contratos vinculados; não receberam nova atribuição comercial. Código lido, sem alterar outros painéis. |
| Clientes compartilhados | `useCompanyClientList.ts`, `companyAreaFilters.ts` | Pertencimento por produtos/histórico, sem classificar o cliente em uma só empresa. Não alterado. |
| Entrada Typeform | `typeform-webhook/index.ts` (criação e enriquecimento) | Cria negócio aberto e preenche campos da ficha; não é agregador de empresas nem recebe alteração desta correção. Código lido, sem replay de formulários. |
| Relatório diário em segundo plano | `daily-sales-report-whatsapp/index.ts` (leituras e rankings) | Ranking consolidado, sem colunas de empresa. Não muda; nada enviado/reprocessado. |
| TV por chave | `tv-proxy/index.ts` | Encaminha leituras usando a conta de TV e suas permissões, sem agregar dados; permite a leitura adicional de produtos sem mudar função. Código lido; chave/aparelho físico não executados. |
| Funções do banco | Definições atuais lidas: `tg_sync_deal_company_from_sale_item`, `tg_validate_product_company_account`, `tg_set_company_from_product` | Sincronizam alterações de Item da Venda e validam empresa da mesma conta; não reclassificam automaticamente negócios antigos por leitura de painel. Nenhuma função/migração alterada. |

## Validação
- 22 testes passaram: CR por UUID/opção/nome exato, renovação distinta, identidade desconhecida/ambígua, fallback histórico, deslocamento de R$ 125.000, total constante, quantidades, soma/média/contagem e ranking não opt-in sem mudanças.
- Sessão autenticada: painel e recarga em 803 px, celular 390 px, filtro por vendedor, apresentação e TV nos três tamanhos acima; sem erros de execução e sem pedidos de gravação em tabelas.
- Compilação mais recente sem erros. Nova leitura do banco mantém exatamente os mesmos grupos, valores e empresas históricas das nove vendas.
- Sem publicação, alteração de backend, dados reais, contratos, permissões, paletas ou configurações salvas.