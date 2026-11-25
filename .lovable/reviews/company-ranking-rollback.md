# Retorno ao primeiro layout Eternum/Anjos

## Regra
O painel deve voltar ao visual da primeira separação das empresas, sem desfazer as correções dos números, as cores escolhidas ou mudanças em outras áreas.

Referência: versão `65a30087d`, 25/11/2026 às 12:26 UTC. Não foi restaurado o projeto inteiro.

## Superfícies conferidas
- Página normal de Insights e celular: `Insights.tsx`, `InsightsMainContent`, `InsightsGrid`, `ConfigurableVisualCard`, `ConfigurableChart`, `CompanyRanking` e `ConfigurableRanking` lidos; renderizadores restaurados. Sessão real: duas empresas, três linhas, tabelas sem os cartões posteriores; 1440, 668 e 390 px.
- Painel completo em foco/TV: `InsightsMainContent`, `TvFitStage` e grade lidos e restaurados; sessão real em 1920×1080, foco original a 80% e ajuste TV, sem o tratamento de largura completa posterior.
- Apresentação individual: `RankingPresentationView` lido; utiliza o mesmo `CompanyRanking` restaurado e mantém privacidade. O controle independente de apresentação não foi redesenhado.
- Link compartilhado, desktop e celular: `SharedVisualsGrid` em `SharedInsights.tsx`, `SharedVisualCard` e `ConfigurableChart` lidos; o mesmo ranking restaurado é consumido. A autorização do link não foi alterada; nenhum link privado foi criado para o teste.
- Prévia do editor: trecho de prévia de `VisualStudioDialog` lido; consome o cartão restaurado, sem alterar configurações do visual.
- Consultas de números: diferenças de `useVisualData` e `companyRanking` conferidas; a correção de atribuição de CR/Anjos permanece. Nenhuma função de banco, rotina de envio ou dado comercial foi alterado.

## Evidência
- 30 testes existentes passaram: separação por empresa, atribuição por produto e helpers de TV.
- Navegação autenticada no painel normal → foco → ajuste TV → retorno ao painel normal, sem erros de execução.
- Capturas em `/tmp/browser/restore-company-ranking/`, inspecionadas visualmente.
- O retorno reproduz também a densidade original, inclusive a limitação de linhas no ajuste TV; não inclui uma nova reformulação.
- Sem publicação, mudanças de backend ou registros reais.