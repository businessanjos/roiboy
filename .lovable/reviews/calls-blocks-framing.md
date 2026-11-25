# Calls Comerciais — blocos e enquadramento

## Regra
Manter os blocos preenchidos escolhidos por Lucas: cada número, legenda e percentual fica dentro do próprio bloco, separado dos demais e limitado à área disponível mesmo com zoom. Não substituir por tabela, nem mudar métricas, períodos, configurações ou acessos.

## Caminhos conferidos por leitura
- `Insights.tsx` / `InsightsMainContent.tsx`: painel normal e foco com zoom por transform usam InsightsGrid; ajuste à TV usa TvFitStage + o mesmo grid. Sem apresentação alternativa de calls; corrigidos no renderer comum.
- `InsightsGrid.tsx`: desktop editável, somente leitura, móvel e grade ajustada à TV convergem em ConfigurableVisualCard. Layouts salvos e medidas de outros gráficos preservados.
- `ConfigurableVisualCard.tsx` / `ConfigurableChart.tsx`: ambos os escopos (comercial e CR) chegam a ConfigurableCallCommercial. Mantido título compacto, limitada escala do título, contido corpo; sem alterar leitura de dados.
- `ConfigurableCallCommercial.tsx` / `.css`: substituída a tabela da tentativa anterior por seções de vendedores com três blocos iguais (dois no ano). Colunas dependem de largura disponível, medidas de clientWidth/clientHeight não recebem o transform; números limitados, percentual em fluxo, border em vez de ring externo, rolagem apenas local para listas maiores.
- `VisualStudioDialog.tsx`: prévia normal e de TV usam ConfigurableVisualCard, portanto recebem o mesmo ajuste; nenhum controle/configuração foi modificado.
- `SharedInsights.tsx` / `SharedVisualCard.tsx`: compartilhamento usa zoom nativo e renderer comum; corpo de calls agora deixa a rolagem com o próprio renderer, como painel interno, evitando duas rolagens.
- `ExternalDashboard.tsx`: área externa usa zoom nativo e InsightsGrid somente leitura; recebe renderer comum sem alterações de login ou de permissões.
- `WhatsAppDashboardPanel.tsx`: visuais customizados usam InsightsGrid no normal e no foco por zoom; não há versão alternativa de calls.
- `RankingPresentationView.tsx`: apresentação individual tem ranking/pódio, não desenha Calls Comerciais; sem alteração necessária.
- `useVisualData.ts`, incluindo `fetchTasksCallCommercialData`: apenas fornece nomes, agendadas, concluídas e vendas; não define tamanho. Leitura, escopos e filtros intactos.
- `shared-insights/index.ts`, incluindo `fetchTasksAggregated` / `fetchCallCommercialData`: entrega agregações sem desenho dos blocos; sem mudança de cálculos ou backend.
- `tv-proxy/index.ts` e `0094_tv_proxy_session.sql` / `tv_proxy_rpc_is_readonly`: somente encaminham leituras autorizadas; não desenham blocos. Sessão/allowlist/RPC/segredos intactos. Nenhum job de fundo ou função de banco dimensiona as calls.

## Verificação
- 30 testes existentes passaram: callCommercialCr, companyRanking, useVisualData.companyRanking e urlState.
- Playwright com os componentes originais e respostas fictícias: TV em 1920×1080, 1366×768 e 803×674; normal em 1440/390/803, zoom 80/150/200; compartilhado em 803/390 e zoom nativo 250% em 1440. Ambos os temas, mês atual com Vendas e conversão: blocos, nomes e percentuais contidos; scrollWidth/clientWidth e scrollHeight/clientHeight sem estouro; nenhum erro de execução. A página isolada recebeu largura explícita apenas no script temporário para reproduzir o espaço da tela, sem mudar CSS geral do app.
- Imagens finais do ajuste à TV e compartilhamento inspecionadas. Arquivos temporários em `/tmp/browser/calls-blocks`.
- Sessão própria recusada por ausência de conta correspondente; criação da sessão de teste também falhou. **Não verificado na conta real nem no aparelho físico.** Exemplos não validam leitura autenticada.
- Compilação OK. Nenhuma escrita em registros reais, configurações, backend, permissões ou contratos; não publicado.