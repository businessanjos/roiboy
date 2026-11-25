# Ranking e espaço na TV

## Regra
Dentro de cada empresa, a segunda posição deve aparecer abaixo da primeira; cartões de vendedores devem ter proporção consistente. No painel da TV, títulos e bordas precisam de folga e os gráficos não devem ser cortados. Nenhum valor, filtro, venda, configuração compartilhada ou atualização muda por este ajuste.

## Conferência dos caminhos
- **Ranking por empresa normal, TV e apresentação:** lidos `CompanyRanking`, `ConfigurableRanking`, `ConfigurableChart` e `RankingPresentationView`. A grade de vendedores ajustava o número de colunas à largura e esticava um vendedor único. Substituída por uma coluna ordenada com largura limitada comum, valor ao lado do nome quando cabe, cores semânticas suaves e pílulas preservadas.
- **Painel em ajuste automático:** lidos `InsightsMainContent`, `TvFitStage` e `InsightsGrid`. Folga nas bordas, cálculo que inclui a borda e a área interna da moldura, piso de altura do ranking por empresa. A ordem de linhas e proporções continuam derivadas do layout salvo. Nenhuma gravação de layout.
- **Painel no zoom escolhido:** `InsightsMainContent` e ramo read-only de `InsightsGrid` lidos. Folga superior aplicada também neste caminho, sem substituir zoom, período ou atualização.
- **Celular:** `MobileInsightsGrid` e `CompanyRanking.css` lidos. Empresas empilhadas, vendedores verticalmente ordenados, mesmo conteúdo; conferido 390 px.
- **Compartilhado e externo:** lidos `SharedVisualsGrid`, `SharedVisualCard` e trecho de `ExternalDashboard` que monta `InsightsGrid`. Consomem o ranking corrigido; não usam a moldura de TV. Configurações e escalas preservadas; leitura do código, sem sessão externa ou link compartilhado exercido.
- **Chave de TV:** `tvTokenBoot` lido e seus três testes executados. Continua montando a tela normal através da leitura protegida; nenhum arquivo de agente, chave ou servidor modificado. Não foi exercida uma chave real nem um aparelho físico de TV.
- **Outros gráficos:** Calls e Negócios por vendedor conferidos no painel real; não tiveram dados/configurações alterados. MQL aberto em modo TV depois da alteração da moldura comum, sem erro e com período/atualização preservados.

## Verificação
- 23 testes passaram: agregação por empresa, produtos, parâmetros de URL e boot por chave.
- Sessão autenticada: 1920×1080, 1366×768 e 803×674 nos dois temas; posições em ordem, cartões igualmente limitados e os quatro gráficos inteiros dentro da tela.
- Normal 1440/390, zoom 80, apresentação e retorno conferidos; botão de fechar não sobrepõe mais o relógio.
- Requisições de gravação de configurações bloqueadas no navegador; nenhum registro ou layout salvo alterado, sem publicação.