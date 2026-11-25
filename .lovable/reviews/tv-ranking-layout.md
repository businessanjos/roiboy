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

## Calls empilhadas — equilíbrio do painel na TV de 43 polegadas
- Organização atual conferida em leitura de `insights_visuals`: ranking em y=0/h=10, barras empilhadas y=10/h=14, Calls comercial e CR lado a lado y=24/h=9. Nenhum registro ou filtro salvo foi regravado.
- Reproduzido com palco/grid/renderers originais e dados locais: piso antigo de Calls 180px deixava apenas 130px de conteúdo para uma lista de 224px; segundo vendedor cortado, embora a área total do palco coubesse na TV.
- `useTvRowContentHeight` observa lista natural de vendedores e área de título/bordas/padding, usando offset/client (sem aplicar o transform). Seu mínimo alimenta `tvRowContentSizing` e `requiredHeight` do palco existente; reage a dados carregados, nomes quebrados e redimensionamento, inclusive retirando alturas antigas ao remover vendedores.
- `TvFitStage` fornece contexto `fitted` ao renderer de Calls, que mantém geometria estável durante ajuste automático; evita alternância entre blocos densos/normais ao esvaziar/recarregar dados. Zoom manual, normal e prévia de TV fora do palco preservam densidade anterior.
- `tvRowSizing` reserva 300px para barras empilhadas (legenda/totais/nomes/plot), sem reduzir os 320px de ranking nem reordenar gráficos. Mínimos e distribuição pertencem só ao grid ajustado à TV; backend, permissões, agregações, paletas, atualização e preferências de zoom intactos.
- `scripts/qa/tv-dashboard-fit.py`: 20 cenários 1920×1080/1366×768/1280×720/803×674/668×674, dois temas, cabeçalho de controles recolhido/visível; cards inteiros na tela, nomes/blocos completos e sem scroll interno nas Calls. Adicionar/remover/esvaziar/recarregar dados muda a reserva sem corte, retorno ao modo normal desktop/mobile não altera configuração. Imagens inspecionadas em `/tmp/browser/tv-dashboard-fit-final`.
- 44 testes passaram (incluindo altura, classificação, empresa, calls CR, URL e boot de TV); conferência anterior `calls-seller-hierarchy.py` repetida em 20 cenários de zoom/normal/TV, sem cortes ou erros. Compilação OK, nenhuma escrita real ou publicação.
- Sessão própria sem conta correspondente e criação de sessão de teste falhou: **não verificado com leitura autenticada nem na TV física**. Polegadas não determinam resolução CSS; verificados Full HD e tamanhos menores no navegador, sem assumir resolução/zoom/overscan reais do aparelho.