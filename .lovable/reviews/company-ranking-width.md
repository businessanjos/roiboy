# Ranking superior — cartões compridos demais

## Regra
Os cartões de vendedores devem ter uma largura compacta comum nas duas empresas, com cabeçalho alinhado à mesma largura, sem se esticar até as laterais da TV. Corrigir somente o ranking por empresa; calls, outros gráficos, valores, layout salvo e acessos permanecem intactos.

## Diagnóstico e correção
Reproduzido com componentes originais e respostas fictícias: em TV 1920px, cabeçalho e lista chegavam a 864px por empresa; no normal 1440px, a 640px. Agora um único conteúdo por coluna limita cabeçalho e cartões a 32rem (512px), ou à largura disponível quando menor. Mantidas as duas colunas do dashboard, sem reduzir largura de outros gráficos. A densidade compacta de TV reconhece a nova largura para manter nome/valor legíveis e sem estouro.

## Caminhos lidos nesta rodada
- `CompanyRanking.tsx` e `.css`: origem do limite comum; corrigidos.
- `ConfigurableRanking.tsx`: lista compacta usa largura do pai; adaptação de densidade de TV de 440 para 560px para encaixar nome/valor; ranking sem empresas e pódio não mudam.
- `ConfigurableChart.tsx`: ranking com empresas chega a CompanyRanking; ranking sem empresas continua independente.
- `InsightsMainContent.tsx` e `InsightsGrid.tsx`: normal, celular, foco/zoom e ajuste automático de TV convergem no mesmo renderer; seguem a regra após correção, sem alterações na grade.
- `VisualStudioDialog.tsx`: prévias usam ConfigurableVisualCard/ConfigurableChart; seguem a mesma regra sem alteração dos controles.
- `SharedInsights.tsx` e `SharedVisualCard.tsx`: layouts de celular/desktop compartilham o renderer; mesmos limites, zoom preservado.
- `ExternalDashboard.tsx`: InsightsGrid somente leitura com zoom nativo, recebe o mesmo limite; nenhuma mudança de login/permissões.
- `RankingPresentationView.tsx`: apresentação por empresa usa CompanyRanking diretamente; recebe o limite. Pódio sem empresas não afetado.
- `src/lib/insights/companyRanking.ts`, referências de `useVisualData.ts`, agregação `shared-insights/index.ts` e encaminhamento `tv-proxy/index.ts`: somente fornecem ou encaminham dados; não dimensionam cartões e ficaram intactos. Nenhum job ou função de banco controla essa largura; nenhum registro encerrado ou configuração foi regravado.

## Verificação
- 30 testes existentes passaram (companyRanking, useVisualData.companyRanking, callCommercialCr e urlState).
- Playwright isolado com componentes reais: painel normal/TV/zoom nas larguras 390/803/1366/1440/1920, temas claro/escuro. Cabeçalhos/listas limitados e iguais, nomes/valores dentro dos cartões, calls e gráficos preservados. TV 1920: 864→512px; normal 1440: 640→512px; telas pequenas usam largura disponível.
- Renderer de apresentação e SharedVisualCard conferidos separadamente: 1440/803 e compartilhado 1440/390, zoom nativo 250%, ambos os temas. Ordem 2 vendedores Eternum/1 Anjos e totais 321.600/160.000 preservados. Capturas inspecionadas em `/tmp/browser/ranking-width`.
- Compilação OK. Sessão própria indisponível; criação da pessoa de teste falhou. Sem conferência na conta real, página externa autenticada ou TV física; prévias isoladas não substituem essas verificações.
- Somente apresentação do ranking por empresa alterada; calls, demais gráficos, backend, permissões e dados intactos. Não publicado.