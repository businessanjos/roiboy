# Roadmap — Processos do CS

## Assinaturas RykaPay
- [x] Vincular os nove planos mensais/anuais Programa Clinica Ryka ao CR, confirmado por Lucas; incluir anuais vendidos como cobranças avulsas sem misturar Ryka IA/zApp/E-Pass.
- [x] Consulta segura somente leitura por CPF/CNPJ, restrita à conta e ao acesso existente do negócio/cliente, sem expor credenciais ou respostas pessoais brutas. Chave validada em consulta real; documento arbitrário rejeitado e registro inexistente bloqueado.
- [x] Aba Assinaturas junto de Contrato no negócio e junto de Contratos na ficha do cliente; recebido, faturas a vencer e histórico por produto com ciclos mensal/anual.
- [x] Atualização a cada 30 segundos da aba aberta e ao retornar à janela; resultados parciais/falhas não viram zero. 15 testes passaram, consulta autenticada em negócio/cliente, retorno ao Contrato e atualização manual conferidos; histórico preenchido e pagamento atualizando 299→598 e 1→0 verificados com resposta fictícia em 390/1440, claro/escuro. Compilação OK, sem alterar pagamentos reais ou publicar; sem webhook nesta entrega.
- [x] Conferência real (Rodrigo / Sr. Sport, negócio CARTEIRA-CR): a consulta tenta todos os CPF/CNPJ do cliente, lead e negócio e depois os e-mails; venda anual sem ID de produto é reconhecida pelo nome do plano. Retornou 12 parcelas pagas (R$ 35.000,00), 0 a vencer, no card e na ficha.
- [ ] Zildete Zanin: RykaPay não tem cliente com o CPF nem com os e-mails do ROY; o time está analisando o cadastro dela no Pay.
- [ ] Ver uma fatura pendente virar paga em um caso real (ainda não houve cliente com parcela em aberto para conferir).

## Acelerômetro: Mentorias e Programas
- [x] Mesmo mostrador colorido em Programas, sem inventar metas/percentuais; realizadas, agendadas, no-show, listas e conversão somente dos negócios vinculados a Programas. SPIFFs, cofrinho e acesso ao plano de incentivos ficam em Mentorias; nenhum backend, negócio ou comissão alterado.
- [x] Regras testadas; sessão autenticada conferida (sem vendas/reuniões desse usuário). Cenário local preenchido: 1 venda CR, 1 realizada, 1 agendada, 1 no-show e conversão 100%; quatro listas excluem Mentorias. Dois temas em 390/668/1440, sem rolagem lateral; imagens conferidas. Sem publicação. Leitura real não vazia continua pendente abaixo.
- [x] Mentorias (EM, EC, EP e Conselho, com identidades legadas de Mentoring) é padrão e exclui CR; Programas começa com CR, por registro extensível de identidades. Sem alterar negócios, comissões, permissões ou backend.
- [x] Velocímetro, recorde e lista usam as mesmas vendas completas por Item da Venda; nível de Mentorias separado e metas de Programas somente pelas quantidades já cadastradas. Sem meta, mostra quantidade e aviso, sem inventar patamares; demais indicadores/SPIFFs permanecem gerais.
- [x] 28 testes passaram; alternância e lista autenticada conferidas em 390/668/1440, temas claro/escuro, sem rolagem lateral ou erros. Compilação OK; não publicado.
- [ ] Conferir contagem e lista não vazias na sessão real: a sessão disponível é de Lucas Suporte e não possui vendas; regras com vendas verificadas por testes, sem entrar em conta alheia nem criar negócios reais.

## Excluir etiquetas e acabamento dos controles
- [x] Exclusão com confirmação no filtro e na tarefa; função implantada remove só nome/cor da etiqueta, preserva tarefas e campos, respeita a conta e RLS e rejeita alteração parcial. Etiquetas sem uso continuam locais.
- [x] Lápis menor, fino e discreto; fundo das etiquetas mais vivo, mantendo cores escolhidas, identidades antigas e capas. Contraste mínimo medido 4,73:1 no claro e 6,93:1 no escuro, incluindo branco/preto/neon.
- [x] 110 testes passaram, incluindo confirmação/cancelamento/falhas, cache, isolamento e remoção integral sob RLS; componentes originais com TESTE QA local conferidos em 1440/668/390, dois temas. Sem cortes/erros ou acesso a registros reais, compilação OK; não publicado.
- [ ] Conferência de exclusão e releitura autenticada: sessão própria não encontrada e criação de usuário de teste falhou. Exemplos locais e testes SQL não substituem esse fluxo na conta real.

## Acabamento pontual do gráfico e calls inteiras na TV
- [x] Somente Negócios por vendedor: legenda fora da área das barras, largura limitada, topo arredondado por série preenchida, totais destacados e contraste real corrigido; paleta, 171 negócios (118/48/5), interação e ranking restaurado preservados.
- [x] Ajuste TV inclui bordas/espaço interno no tamanho total, evitando corte da última linha sem redesenhar as Calls, mudar zoom padrão ou layout salvo.
- [x] 28 testes passaram; sessão real em 1440/668/390 e TV 1920×1080/1366×768/1280×720, dois temas: duas Calls completas sem rolagem interna, nomes do gráfico presentes, clique abre os 118 negócios de Darlan e retorna. Imagens conferidas, compilação OK, sem erros, escritas reais ou publicação. Não foi possível verificar o aparelho físico de 43 polegadas.

## Layout exclusivo da TV 1 — 1920×1080, foco=1, zoom=75
- [x] Apenas na apresentação do ranking: empresas usam toda a largura, lista menor centraliza abaixo do cabeçalho e Calls têm três colunas iguais; normal/compartilhado continuam limitados e hierarquia intacta.
- [x] Margens e títulos uniformes, três faixas medidas por conteúdo e preenchendo a tela sem rolagem; conversão junto de Vendas, legendas/pílulas ampliadas (mínimo visual medido >18px no Full HD com 75%).
- [x] Gráfico ocupa toda a largura, legenda CR/CA/EC/EM/MVP/NI, barras maiores e quebra completa por categoria acima dos totais (118/46/5), incluindo segmentos finos; mesmas chaves, valores, cores e filtros.
- [x] 41 testes passaram; renderers e controles originais com exemplos locais conferidos em 1920×1080, foco=1 e zoom=75 sem tv explícito, claro/escuro e controles recolhidos/visíveis; 20 regressões de tamanhos/zoom, adicionar/remover vendedores e saída para normal/mobile sem cortes ou escritas. Imagens inspecionadas e compilação OK; sem publicação.
- [ ] Conferência na sessão real e TV física: sessão própria indisponível e criação temporária falhou; aparelho não acessível. Validação de navegador com dados locais não substitui essas verificações.

## Mais cores e personalização das etiquetas
- [x] Autorizado pelo usuário: ampliada somente a validação do salvamento compartilhado para aceitar HEX nas etiquetas existentes, mantendo identidade, RLS, concessões e atomicidade; nenhuma etiqueta alterada automaticamente. Função implantada e conferida em leitura.
- [x] Paleta ampliada de seis para 18 cores e escolha livre por seletor/código HEX na criação e edição, preservando seleção, identidades antigas e paleta das capas. Bolinha mantém a cor exata; texto se adapta ao tema para continuar legível. Lista/quadro reutilizam a mesma apresentação.
- [x] 87 testes passaram; sessão real conferida em 1440/390 claro/escuro: criar etiqueta local sem ativar filtro, código parcial bloqueia, cor exata/legível, reabrir restaura e janela permanece contida com rodapé fixo. Salvamento autenticado por lápis de etiqueta existente em tarefa fictícia TESTE QA: HEX salvo, relido e restaurado após reload, nome/título preservados e cancelar não grava. Somente a tarefa fictícia identificada por ID/título/marcador e sua etiqueta local foram removidas; nenhum registro real alterado. Imagens inspecionadas, compilação OK, sem erros ou publicação.

## Zoom do ranking na proporção do MQL
- [x] Padrão de 60% para TV no ranking, mantendo o ajuste automático para não cortar os vendedores; controles de zoom também disponíveis nesse modo e preferência local renovada, sem alterar o MQL, outros painéis, dados ou permissões.
- [x] 36 testes passaram; redução medida de 100% para 60% nos dois temas em 1920×1080/1366×768/1280×720/803×674/668×674 com controles visíveis/recolhidos, hierarquia preservada e quatro visuais completos. Controles originais conferidos: preferência antiga de 100% substituída, ajuste para 70%, sair/reabrir mantendo escolha e link explícito de 80% respeitado. Imagens inspecionadas, compilação OK, sem erros, publicação ou escritas reais/backend; testes usam números locais.
- [ ] Conferir na conta real e TV física: sessão própria indisponível e criação de sessão temporária falhou; aparelho não acessível neste ambiente.

## Enquadramento do ranking na TV de 43 polegadas
- [x] Corte reproduzido no painel completo: Calls tinha 130px disponíveis para 224px de conteúdo, piso antigo de 180px. Linhas ajustadas pela altura natural dos vendedores + cabeçalho/bordas, palco redimensiona o conjunto e gráfico empilhado preserva 300px mínimos para legenda/barras; contexto de ajuste mantém blocos estáveis durante atualização, sem mudar organização salva, dados, hierarquia, zoom explícito ou modos normais.
- [x] 44 testes passaram; painel e renderers originais com organização salva lida em consulta somente leitura e números locais conferidos em 1920×1080/1366×768/1280×720/803×674/668×674, dois temas e controles visíveis/recolhidos (20 cenários), mais adicionar/remover/esvaziar/recarregar vendedores e retorno desktop/mobile. Calls completas sem rolagem interna, quatro visuais dentro da tela, imagens inspecionadas e teste anterior de hierarquia/zoom repetido (20 cenários). Compilação OK, sem erros, escritas reais/backend ou publicação.
- [ ] Conferir na sessão real e TV física de 43 polegadas: sessão própria indisponível e criação da sessão temporária falhou; não foi possível medir resolução/zoom/overscan do aparelho, apenas tamanhos de tela no navegador.

## Pílulas de Hoje e Amanhã na data de entrega
- [x] Campo mais compacto com pílulas discretas Hoje/Amanhã e destaque leve da data selecionada; mesma seleção explícita do calendário, preservando digitação, horário, criação/edição/cópia, estados bloqueados e validação.
- [x] 54 testes passaram, incluindo dias locais, virada de mês/ano e envio da data/horário pelo formulário original. Campo e calendário originais conferidos no navegador em 390/668/1440 nos dois temas: escolher Hoje/Amanhã, guardar/reabrir rascunho local, digitar, limpar e bloquear controles; imagens inspecionadas, sem cortes/erros. Compilação OK, nenhum dado real/backend alterado ou publicação; conferência isolada não valida gravação autenticada.

## Hierarquia dos vendedores nas Calls Comerciais
- [x] Empilhados vendedores com seus próprios blocos, ordenados por vendas e calls feitas no desempate (ano: calls feitas, sem usar vendas ocultas); preservados enquadramento, agregações, filtros e restante do painel, no renderer compartilhado por normal/TV/prévia/compartilhado.
- [x] 36 testes passaram; componente original com os números da imagem: Jonathan (3 vendas, 10 calls) acima de Darlan (1 venda, 8 calls), 20 cenários 390/803/1366/1440/1920 normal/TV/zoom 80–200% nos dois temas; ordem atualiza ao mudar vendas, ocultos mantidos, ano correto e rolagem local para oito pessoas TESTE QA. Imagens inspecionadas, sem cortes, erros ou escritas; compilação OK, sem publicação.
- [ ] Conferir o painel na sessão real: sessão própria indisponível (nenhuma conta correspondente) e criação da sessão temporária falhou; os números da imagem foram verificados isoladamente, sem leitura autenticada nem teste em TV física.

## Menus sem corte na janela de tarefa
- [x] Etiquetas na edição/cópia/criação e no filtro, calendário e paleta da descrição/comentário limitados ao espaço do diálogo/tela, com rolagem local e botões completos; nomes longos não encobrem lápis. Entradas e caminhos irmãos lidos em `.lovable/reviews/task-menu-clipping.md`; gravação/repetição/permissões/dados intactos.
- [x] 45 testes passaram; componentes originais com rascunhos TESTE QA: lista/editar/criar/cancelar/rolar/calendário/paleta/filtro em 390/803/1440/1920 claro/escuro, 56 verificações de limites sem cortes ou erros. Compilação OK; conferência visual isolada, sem persistência autenticada, escritas reais/backend ou publicação.

## Seleção e ações em grupo nas tarefas de Marketing
- [x] Menu do quadro com seleção individual/todos os resultados filtrados e por coluna/seção no quadro, lista e tela ampliada; mover, concluir, reabrir e prioridade em grupo com confirmação; filtros removem tarefas ocultas da seleção.
- [x] Desfazer a última edição/movimentação/conclusão/reordenação da própria sessão compartilhada pelo formulário e quadro, restaurando só campos alterados e horários originais; conta/ID/versão comparados sob RLS existente, erros parciais explícitos e alterações posteriores preservadas. Sem exclusão em grupo, migração, mudanças de permissões/backend ou publicação.
- [x] 68 testes passaram; componentes e hooks originais com respostas locais TESTE QA: selecionar duas → mover → reler → desfazer; concluir todas → desfazer; lista → prioridade → desfazer. 390/803/1440 nos dois temas e ampliação com seleção preservada, sem rolagem lateral da página/erros; compilação OK. Só escritas locais fictícias; nenhum registro real alterado.
- [ ] Conferir salvar/reler/desfazer na sessão autenticada: sessão própria indisponível (sem conta correspondente) e criação da sessão TESTE QA falhou; respostas locais não validam a sessão/RLS no servidor real.

## Distribuição do quadro ampliado
- [x] Colunas igualmente distribuídas pela largura disponível apenas ao ampliar, mínimo 300px com rolagem local nas telas estreitas; quadro normal, ordem, filtros, dados e ações intactos.
- [x] 46 testes passaram; componentes originais com TESTE QA no navegador em 1562/1920/1440/803/390: colunas iguais sem vazio lateral no desktop, rolagem local mobile, clique abre tarefa e reduzir restaura larguras originais. Compilação OK, sem erros de execução, alterações em tarefas ou publicação; conferência isolada não substitui sessão real.

## Você nas pessoas das tarefas
- [x] “Você” para responsável/solicitante da pessoa logada no quadro e na lista (incluindo seções, tela ampliada e cartão de arraste que reutilizam as mesmas apresentações); demais com primeiro nome, seletores completos, fotos/identidades/dados intactos.
- [x] Comparação pelo ID de `useCurrentUser`, nunca nome; 63 testes passaram. Componentes originais com exemplos isolados em 390/803/1440 conferidos no navegador, incluindo funções independentes, nomes iguais de outras pessoas, troca de pessoa e identidade não carregada, sem erros ou escritas. Sem publicação; conferência em sessão real não executada (sessão indisponível no ajuste anterior).

## Project monitoring — notificações
- [x] Conferidos avisos, sino, histórico, navegador, produtor de push e decisões do app/WhatsApp, incluindo funções atuais em leitura; inventário em `.lovable/reviews/notification-monitoring.md`, sem alterar registros enviados.
- [x] Reproduzidos clique bloqueado no aviso WhatsApp e `/royzapp` → 404; avisos gerais já liberavam cliques, mas largura externa deixava X fora da tela.
- [x] Avisos personalizados clicáveis e limitados à largura existente; `/royzapp` redireciona ao RoyZapp Vendas com parâmetros preservados e mesmas verificações. Backend, permissões, dados, integrações e silêncio dos painéis intactos.
- [x] 34 testes passaram; original no navegador em 803/390/1440: abrir/fechar WhatsApp, geral e tarefa, ação comum e passagem de cliques preservadas, destino legado sem 404. Compilação OK; sem publicar.
- [ ] Verificação autenticada até a conversa e push no aparelho: sessão própria sem conta correspondente, criação de teste falhou e `/sw.js` não está no checkout/servidor local.

## Largura dos cartões do ranking superior
- [x] Cabeçalhos e cartões limitados juntos a 32rem ou largura disponível, com a mesma proporção nas duas empresas; nome/valor continuam legíveis. Colunas, ordem, dados, cores, calls e outros gráficos intactos.
- [x] 30 testes passaram; componentes originais com exemplos em normal/TV/zoom 390/803/1366/1440/1920, compartilhado 390/1440 e zoom 250%, apresentação 803/1440, nos dois temas: cabeçalho/lista com largura igual, sem cortes ou erros. Fontes e caminhos registrados em `.lovable/reviews/company-ranking-width.md`; compilação OK, sem escritas reais ou publicação.
- [ ] Conferência na conta real, acesso externo e TV física: sessão própria indisponível e criação de pessoa de teste falhou; exemplos não validam essas sessões ou o aparelho.

## Calls Comerciais no ranking de vendedores
- [x] Hierarquia interna ajustada: vendedor alinhado ao título, blocos diretamente abaixo na mesma linha e ordem número → legenda → percentual. Restante do dashboard intacto; 30 testes e 12 cenários isolados nos dois temas passaram, sem cortes ou erros; compilação OK, sem publicar.
- [x] Mantidos blocos preenchidos com medidas limitadas, vendedores lado a lado quando cabe, percentuais dentro de Vendas e rolagem local; sem tabela, alteração de métricas/configurações ou outros gráficos.
- [x] 30 testes passaram; componentes originais com exemplos em TV 1920/1366/803, normal 1440/390/803 e zoom 80/150/200, compartilhado 803/390 e 250%, claro/escuro: sem cortes dos blocos/nomes/percentuais ou erros. Caminhos irmãos lidos em `.lovable/reviews/calls-blocks-framing.md`; compilação OK, sem backend, escritas reais ou publicação.
- [ ] Conferência do painel com sessão real e TV física: sessão própria indisponível e criação de pessoa de teste falhou; exemplos não substituem a conta real ou o aparelho.

## Tarefas recorrentes no Marketing
- [x] Repetição diária/semanal/mensal no formulário, inclusive toda segunda-feira; rotina automática horária (calendário de Brasília), responsável/etiquetas/descrição/horário/capa/anexos preservados e subtarefas pendentes, sem reabrir concluídas. Campos e autoria validados no servidor, mesmo RLS de tarefas, chave única origem/data e cursor transacional, sem modificar registros reais.
- [x] Alterar/parar no original e editar ocorrência sem afetar série; duplicar não inicia outra recorrência. 94 testes passaram, incluindo falha/recuperação, conta/autor forjados, datas, acesso negado e histórico; formulário original isolado com TESTE QA em 803/390/1440 e claro/escuro: criar report segunda, salvar/reabrir, mensal, cancelar e parar; sem erros ou pedidos ao backend. Rotina implantada, agenda ativa, função limitada a service_role, zero séries reais, compilação OK; sem publicar.
- [ ] Conferência autenticada de salvar/reabrir e geração real: sessão própria indisponível (sem usuário correspondente) e criação da pessoa de teste falhou; exemplos isolados não verificam a conta real.

## Editar etiquetas no Marketing
- [x] Lápis nos menus da tarefa e do filtro permite editar nome/cor; Salvar etiqueta atualiza todas as tarefas que a usam, inclusive concluídas, pela mesma conta e RLS existente. Duplicatas não mesclam, falha não salva parcialmente e rascunho/seleção são preservados; sem alterar responsáveis, situações, datas ou anexos.
- [x] 83 testes passaram; sessão autenticada com duas tarefas TESTE QA: salvar nome/cor, reler ambas, reabrir a concluída, cancelar, rejeitar duplicata e renomear pelo filtro mantendo seleção; recarga conserva catálogo/nome/cor. 390/798/1440 nos dois temas sem cortes ou erros; somente tarefas QA conhecidas removidas, nenhuma tarefa real modificada. Permissões e acesso anônimo conferidos no banco; sem publicação.

## Leitura ampliada na TV (aprovado)
- [x] Ranking ampliado, medidas por altura disponível e preferência de TV independente do antigo 80%; gráfico com barras mais largas/legenda compacta, Calls com nomes/fotos ao lado e números maiores. Layout salvo, empresas, valores, cores, período e atualização preservados.
- [x] 26 testes passaram; painel autenticado em 1920×1080, 1366×768 e 803×674 nos dois temas: três vendedores e quatro gráficos visíveis, sem cortes/erros; normal 1440/390 sem rolagem lateral, recarga e troca explícita de zoom 80 para ajuste automático conferidas. Detalhes de Darlan abrem com registros reais. Escritas em configurações bloqueadas durante QA; nenhum backend ou dado real alterado, sem publicação. Sem teste no aparelho físico.

## CR no lado correto do ranking
- [x] Quatro CR antigos somam R$ 125 mil na Eternum; ranking agora usa a empresa cadastrada no produto sem regravar vendas. Eternum R$ 321.600 e Anjos R$ 160.000; total R$ 481.600 preservado.
- [x] 22 testes passaram; sessão real: recarga, vendedor, apresentação, celular 390 e TV 1920/1366/803 nos dois temas, valores/pílulas corretos, sem cortes ou erros. Banco relido intacto; Calls, demais gráficos, permissões e backend preservados, sem publicar. Caminhos irmãos conferidos em `.lovable/reviews/cr-company-ranking.md`.

## Barras ligeiramente mais largas para TV
- [x] Ampliar limite das barras verticais de 104 para 128 px no painel e de 132 para 160 px no modo TV; telas estreitas continuam limitadas pelo espaço disponível. Cores, alturas proporcionais, nomes, valores e configurações preservados.
- [x] Conferência isolada com o gráfico original em 390/1440 e TV 1920×1080/1366×768, claro/escuro: barras maiores, nomes e totais sem cortes ou erros; compilação sem erros. Nenhum dado, configuração ou backend alterado; sem publicar. Sessão própria indisponível, sem conferência autenticada ou aparelho físico.

## Respeitar as cores selecionadas no painel
- [x] Leitura confirma Brasa selecionada nos quatro visuais; ranking compacto ignorava a seleção e usava o dourado do tema. Barras, bordas suaves e iniciais agora usam a paleta do próprio visual, como o ranking normal; pílulas, produtos, dados e backend preservados.
- [x] 16 testes de produtos/empresa passaram; exemplos isolados com os componentes originais em 390/1440 e TV 1920/1366, claro/escuro: selecionar Brasa → Ouro → Profissional → Brasa atualiza ranking e barras juntos, sem erros. Sem gravação de configurações nem publicação.
- [ ] Conferir o painel na sessão autenticada: sessão própria não foi disponibilizada nesta rodada e criação da conta de teste falhou; exemplos isolados não verificam a conta real.

## Acabamento do gráfico Negócios por vendedor
- [x] Legenda em altura própria, área central delimitada, barras com largura máxima e topo arredondado, totais destacados e contraste corrigido; nomes completos em duas linhas no celular. Altura móvel reconhece barras segmentadas; dados, cores, filtros, interações e configurações salvas preservados.
- [x] 16 testes passaram; conferência autenticada em 390/803/1440, TV 1920×1080 e 1366×768 e TV 803×674, claro/escuro: sem cortes ou erros. Total 166 e vendedores 118/43/5 preservados; clicar Darlan abre seus 118 negócios e fechar retorna ao gráfico. Sem escritas em dados reais, backend ou publicação; sem teste em aparelho físico.

## Ranking e enquadramento do painel na TV
- [x] Vendedores empilhados em ordem por empresa; cartões com largura máxima comum, valor alinhado ao nome quando cabe e pílulas discretas, sem esticar Darlan na Anjos. Empresas permanecem lado a lado na TV e empilhadas no celular.
- [x] Folga no topo/bordas no ajuste automático e zoom; ajuste da altura considera borda/área interna e reserva espaço para ranking por empresa. Relógio da apresentação separado do botão de fechar; valores, filtros, layout salvo, Calls e intervalo de atualização preservados.
- [x] 23 testes passaram; conferência autenticada em TV 1920×1080, 1366×768 e 803×674, claro/escuro: duas posições Eternum visíveis em ordem, card Anjos da mesma largura, quatro gráficos completos sem cortes. Normal 1440/390, apresentação e saída, zoom 80 e MQL TV conferidos, sem erros. Gravações de configurações bloqueadas durante QA; sem backend, dados reais, chaves ou publicação. Sem teste em aparelho físico de TV.

## Respeitar a situação escolhida nas tarefas
- [x] Todas/Abertas/Em andamento/Concluídas persistem por pessoa ao atualizar ou reabrir; Abertas somente como padrão inicial, com rejeição de situações salvas inválidas, sem alterar outros filtros ou dados.
- [x] 21 testes passaram; sessão real conferida selecionando cada situação e atualizando, quadro/lista, limpar filtros, tela cheia, trocar de aba e 803/390/1440 px, sem erros. Preferências locais restauradas após o teste, pedidos de escrita em tarefas bloqueados; nenhuma tarefa alterada, sem publicar.
- [x] Caminhos irmãos lidos e resultados registrados em `.lovable/reviews/task-filter-refresh.md`: contagens, lista/seções, quadro/tela cheia, entrada/redirecionamento, links/avisos, recarga de dados, projetos, Copilot, MCP e funções atuais de notificação. Não reiniciam filtros em outros caminhos; backend e registros concluídos preservados.

## Horário de entrega antes da data
- [x] Horário livre sem data; preenchimento de hoje para horário igual/posterior ao minuto atual ou amanhã se já passou, no mesmo dia local do calendário. Mudanças no horário ajustam somente a data automática; escolha manual e digitação parcial/inválida permanecem preservadas. Limpar somente a data não apaga o horário.
- [x] 41 testes passaram, incluindo criação/edição/cópia, virada de mês/ano e prioridade do Hoje no calendário. Formulário original com dados fictícios conferido no navegador em 803/390/1440 px: horário primeiro, hoje/amanhã, escolha manual, salvar/reabrir e calendário; sem erros, sem gravações no backend, sem publicação.
- [ ] Conferência na conta real em /marketing/projetos?tab=tarefas: sessão própria indisponível nesta rodada e criação da sessão temporária falhou; a verificação isolada não confirma gravação autenticada.

## Etiquetas de tarefas: criação no filtro e cartões discretos
- [x] Seleção/busca compacta, criação diretamente no filtro e editor compartilhado com nome/cor e prévia; etiquetas ainda não usadas ficam neste navegador por conta/pessoa, etiquetas salvas nas tarefas continuam compartilhadas, sem alterar backend ou permissões. Criar no filtro não ativa um filtro vazio.
- [x] Etiquetas no quadro/lista e na edição com ponto de cor, fundo suave, tamanho compacto e contraste nos dois temas; campos, busca e pessoas preservados.
- [x] 29 testes passaram; conferência autenticada com etiqueta e tarefa fictícias: criar no filtro, selecionar/desmarcar, recarregar, aplicar/salvar/reabrir, cancelar e excluir somente a tarefa QA. 390/803/1440 px, claro/escuro sem cortes ou erros de execução; nenhuma tarefa real alterada, sem publicação.

## Transferência em massa sem mudar status
- [x] Confirmar falha dos quatro negócios ganhos do Jonathan: bloqueio de movimentação para negócios encerrados, nenhuma alteração aplicada.
- [x] Permitir mudar funil/etapa preservando status, datas de fechamento, responsáveis e contratos; manter permissões, histórico e desfazer seguro. Funções alteradas e confirmadas no banco; sem transferir automaticamente negócios reais ou publicar.
- [x] 31 testes passaram: ganhos, perdidos e abertos mantêm status/fechamento/dados, reversão segura e bloqueio após mudança posterior de status; acesso negado mantém o ganho intacto. Compilação sem erros.
- [x] Regra conferida no código: transferência em massa nunca reabre um negócio. Seleção do quadro/lista nas três abas → BulkDealDialog → useBulkDeals → begin/apply/finish; histórico → get_last/undo/capture. Todos usam o mesmo caminho, sem status enviado pelo cliente; corrigidos apply e undo/capture. Movimentação individual não escreve status; reabertura explícita permanece separada. Gatilhos de etapa, preenchimento do cliente e Central de Tráfego lidos: mantidos, sem repetir eventos de ganho/perda.
- [ ] Conferir fluxo completo em sessão autenticada: sessão própria não disponível e criação da sessão de teste falhou; testes isolados não validam a interface na conta do Jonathan.

## Primeiro Ranking de Vendedores: empresas lado a lado
- [x] Dividir apenas esse visual em Eternum e Anjos, com valores, posições e produtos independentes pela empresa salva na venda; filtros e atualização preservados.
- [x] Configuração ativada somente no primeiro ranking de Leaderboard, com leitura autenticada após salvar/recarregar; demais configurações e layouts comparados antes/depois, intactos.
- [x] 24 testes passaram; valores reais conferidos no ano e mês com leitura do banco, 390/803/1440 px nos dois temas sem cortes, cancelamento da configuração, Calls sem opção de empresas, apresentação ampliada e modo TV com parâmetros preservados. Compilação sem erros; sem publicação.
- Quatro vendas antigas de CR continuam vinculadas à Eternum; nenhum negócio foi reclassificado e não foram inventados subtotais por produto.

## Padrão inicial das tarefas (substituído)
- [x] O comportamento anterior reiniciava em Abertas; substituído pela preservação da escolha explícita solicitada em “Respeitar a situação escolhida nas tarefas”.

## Topo compacto das tarefas de Marketing
- [x] Reduzir título e espaçamento; concentrar filtros num menu e ações secundárias em mais opções, preservando busca, filtros, telas e callbacks.
- [x] 20 testes passaram; busca, filtros combinados, limpar, ordenação, nova tarefa, separadores, etapas, lista/quadro e tela cheia conferidos com tarefas fictícias em 390/958/1440 px, claro/escuro, sem overflow ou alterações reais; compilação sem erros.
- [ ] Conferência autenticada em /marketing/projetos: sessão própria indisponível e criação de pessoa temporária falhou; teste visual com respostas fictícias não valida persistência real.

## Links no texto das tarefas
- [x] Reconhecer links da descrição ao digitar, colar e abrir, com destaque e abertura segura em outra aba; preservar texto, formatação e dados existentes.
- [x] Editor compartilhado e comentários preservam links HTTP(S) seguros; 48 testes passaram, incluindo endereço completo, protocolos rejeitados, atributos descartados, digitação e ausência de autosave.
- [x] Conferidos com respostas fictícias em 390/798/1440 px e claro/escuro: colar/digitar, abrir Drive com query sem opener/referrer, salvar/reabrir, descrição antiga sem escrita, link longo sem sobreposição, tempos em negrito e comentários novos/antigos. Sem erros de execução/compilação ou alterações reais; não publicado.
- [ ] Conferência autenticada em /marketing/projetos: sessão própria indisponível e criação de pessoa temporária falhou; exemplos não validam persistência real.

## Títulos das etapas do quadro
- [x] Refinar apenas os cabeçalhos: nomes mais destacados, contadores alinhados e ações discretas; manter cores, ordem, contagens e comportamento das etapas.
- [x] 19 testes passaram; cabeçalhos/contadores, nome longo sem sobreposição, abrir nova tarefa na etapa, separador e tela cheia conferidos com respostas fictícias em 390/798/1440 px, claro/escuro. Sem erros de execução/compilação e sem alterações reais; não publicado.
- [ ] Conferência na sessão real em /marketing/projetos: sessão própria indisponível e criação de pessoa temporária falhou; a página retorna ao login.

## Comentários: estado vazio e campo de escrita
- [x] Remover o quadro vazio acima do editor; placeholder dentro do campo com concordância pelo nome da pessoa logada, incluindo Jessica e Fernanda; barra compacta e envio integrado, sem mudar dados, acesso ou notificações.
- [x] 23 testes passaram; vazio, concordância Jessica/Fernanda/Lucas, digitação, envio/releitura/reabertura e falha mantendo rascunho conferidos com respostas fictícias em 390/798/1440 px, claro/escuro. Sem erros de execução/compilação, nenhum comentário real alterado; não publicado.
- [ ] Conferência na sessão real em /marketing/projetos: sessão própria indisponível e criação de pessoa temporária falhou; a página retorna ao login. Exemplos não validam persistência autenticada.

## Marcações de tempo na descrição
- [x] Marcações como 26:49 em negrito ao digitar, colar e abrir descrições; preserva texto simples, listas, itálico e marca-texto, sem estender o negrito à frase seguinte, sem mudança em comentários ou dados reais.
- [x] 25 testes passaram; digitação, colagem real via clipboard, criação/edição e salvar/reabrir conferidos em tarefa fictícia em 390/798/1440 px e claro/escuro. Sem erros de execução e compilação sem erros; não publicado.
- [ ] Conferir a descrição na conta real: sessão própria indisponível e criação de usuário temporário falhou; respostas fictícias não validam persistência com sessão real.

## Opções de formato e categoria no Social
- [ ] Aguardar escolha: personalizar as opções ou trocar valores no post; os valores já podem ser trocados nos formulários existentes.

## Campo Seção na janela de tarefa
- [x] Regra: a janela da tarefa não deve oferecer um campo que só permite “Sem seção”. Retirado da criação, edição e cópia compartilhadas pelo quadro, lista, tela cheia e links dos avisos; seções existentes e organização da lista preservadas.
- [x] Código conferido: MarketingTasks/MarketingProjectsHub usam a mesma janela; quadro usa etapas, lista mantém criar/renomear seções com ações úteis; tarefas vinculadas ao projeto, Copilot, MCP e gatilhos de comentários/atribuição não oferecem esse seletor. Sem mudanças em serviços, permissões ou registros.
- [x] 14 testes passaram, incluindo seção de origem na criação e manutenção na edição/cópia; janela e salvar/reabrir conferidos com respostas fictícias em 390/798/1440 px, claro/escuro, sem erros ou escritas reais. Compilação sem erros; não publicado. Sessão real segue indisponível, sem nova tentativa nesta alteração exclusivamente visual.

## Avisos de tarefas recebidas
- [x] Notificar o responsável no servidor quando a tarefa é criada para ele ou transferida para ele, sem repetição em edições comuns, autoatribuição ou pessoas técnicas/inativas/de outra conta; acesso e identidade preservados.
- [x] Aviso compacto no canto superior com foto, primeiro nome e abertura direta; quadro atualizado e push sem duplicação. 32 testes passaram; criação, transferência, abertura mesmo com filtros, fechar, sino e formatos 390/798/1440 px em claro/escuro conferidos com pessoas fictícias, sem erros ou escritas reais. Migração aplicada e compilação sem erros; não publicado.
- [ ] Entrega entre sessões reais em /marketing/projetos?tab=tarefas: sessão própria indisponível e criação de usuário temporário falhou. Testes isolados não substituem a verificação autenticada.

## Avisos de comentários e menções nas tarefas
- [x] Avisos criados no servidor após comentar: responsável e pessoas mencionadas do Marketing, na mesma conta; sem notificar o próprio autor ou duplicar destinatários. @primeiro-nome digitado só resolve se único; seleção mantém o ID individual.
- [x] Seleção por @ com foto/primeiro nome, barra de formatação preservada; aviso compacto no canto superior direito com fechar e Abrir tarefa, chegando ao comentário mesmo com filtros no quadro. Assinatura de notificações filtrada pelo usuário, sem reenviar push já gerado no servidor; permissões e silêncio dos painéis preservados.
- [x] 45 testes passaram (incluindo SQL com RLS, destinatários, ambiguidade, conta técnica e deduplicação); três pessoas fictícias conferidas no navegador em 390/798/1440 px e claro/escuro: comentar, reler, aviso, abrir comentário, preservar filtros e fechar. Sem erros de execução, compilação sem erros e nenhuma escrita real de teste; migração aplicada, não publicado.
- [ ] Conferir entrega na conta real em /marketing/projetos?tab=tarefas: sessão própria indisponível e criação de usuário temporário falhou. Testes isolados e respostas fictícias não verificam a entrega Realtime entre sessões reais.

## Comentários das tarefas em conversa
- [x] Barra compartilhada com a descrição: negrito, itálico, listas, marca-texto com cores próprias e segundo clique para desligar, desfazer/refazer; comentários antigos e autoria preservados, sem mudar backend ou permissões.
- [x] Foto e primeiro nome, mensagens próprias à direita e dos colegas à esquerda, data agrupada e horário individual; exclusão existente apenas do próprio comentário.
- [x] 19 testes passaram; envio/releitura e reabertura com formatação, falha mantendo rascunho, fotos e identificação conferidos com respostas fictícias em 390/798/1440 px e claro/escuro, sem erros de execução ou escritas reais. Compilação sem erros; não publicado.
- [ ] Conferência autenticada em /marketing/projetos?tab=tarefas: sessão própria indisponível, criação de conta temporária falhou e a página real retorna ao login. Testes com exemplos não validam persistência/RLS no servidor.

## Janela de tarefa: espaço e marca-texto
- [x] Descrição, anexos e capa agrupados na coluna principal; detalhes compactos e rolagem independente no desktop, uma rolagem no celular; cabeçalho e rodapé fixos, sem cauda vazia acompanhando a lateral.
- [x] Marca-texto ativo remove o destaque no segundo clique sem abrir a paleta; no cursor, interrompe a escrita destacada sem apagar a marcação anterior. Texto/negrito preservados; 12 testes passaram, compilação sem erros.
- [x] Exemplos em 390/958/1440 px: seleção, segundo clique, salvar/reabrir destaque, rolagem, campos completos, calendário e rodapé conferidos, sem erros ou escritas reais; não publicado.
- [ ] Conferência autenticada: sessão própria indisponível e criação de conta temporária falhou; a página real retorna ao login. Exemplos isolados não validam dados reais.

## Quadro de Marketing em tela cheia
- [x] Botão de ampliar junto ao seletor de lista/quadro; reduzir sempre visível no topo, filtros e ações preservados, quadro ocupando a tela com rolagem local; Escape fecha a edição antes do quadro.
- [x] 19 testes passaram e compilação sem erros; ampliação, retorno por botão/Escape, filtros e abrir/fechar edição conferidos com exemplos em 390/794/1440 px, sem rolagem lateral da página nem escritas. Sem publicação.
- [ ] Conferência na página autenticada: sessão própria indisponível e conta temporária falhou; /marketing/projetos?tab=tarefas retorna ao login. Exemplos isolados não substituem dados reais.

## Responsável obrigatório nas tarefas de Marketing
- [x] Exigir responsável pela execução na criação, edição e cópia pelo formulário, com aviso junto ao campo; solicitante independente e tarefas existentes preservadas.
- [x] 21 testes passaram: formulário bloqueia criação/edição/cópia sem executor, escolha permite envio com identidade separada do solicitante; cópia não altera original, TV não satisfaz o campo obrigatório. Sem mudanças no backend ou em dados reais; conferência autenticada segue indisponível (sessão própria não encontrada e usuário temporário falhou na solicitação anterior).

## Conta técnica de TV invisível
- [x] Ocultar a conta técnica das fontes de listas/seletores, busca global, equipe/admin/RH, filtros e rankings; excluir antes da paginação/contagem de pessoas e ignorar seleção antiga no Marketing. Autenticação, permissões, billing e autoria histórica preservadas, nenhum backend/dado real alterado.
- [x] 37 testes passaram, incluindo listas por equipe/setor/Marketing, pessoas reais mantidas, conta identificada por UUID/e-mail/nome, filtro antes da contagem e boot dos painéis preservado; seletor original + hook real conferidos isoladamente em 794 px com respostas fictícias, sem erros ou escritas.
- [ ] Conferência autenticada do quadro de Marketing: sessão própria indisponível e criação de usuário de teste falhou; /marketing/projetos?tab=tarefas retorna ao login. Conferência isolada não valida a página completa nem os dados reais. Não publicado.

## Tarefas de Marketing: anexos, comentários, capas e separadores
- [x] Ampliar anexos para documentos e mídias privados, com abertura e remoção segura sem afetar cópias; limpar só uploads novos descartados do próprio rascunho.
- [x] Comentários com autoria individual e data do servidor, nome histórico preservado e exclusão só do próprio autor, sem copiar histórico na duplicação.
- [x] Capas escolhidas entre imagens anexadas ou cores, visíveis nos cartões e lista.
- [x] Separadores nomeados, posição editável e arraste entre cartões, sem prazo/conclusão/responsável nem contagem como tarefa.
- [x] 35 testes passaram; conferência com respostas fictícias em 390/794/1440 px, claro/escuro: selecionar/marcar texto, criar cor, salvar/reabrir, digitar data, bloquear inválida, abrir calendário, anexos/capa/comentário, duplicar e retirar anexo da cópia preservando a original, cancelar com limpeza de upload, arrastar separador antes do cartão; sem erros. Nenhum registro real alterado, tela temporária removida, não publicado.
- [ ] Conferência autenticada em /marketing/projetos?tab=tarefas: sessão própria indisponível e criação de conta temporária falhou duas vezes; a tela real retorna ao login. Fluxo com respostas fictícias não valida upload/RLS no servidor.
- [x] Reformular a janela de edição com descrição ampla e expansível, detalhes em coluna lateral, rodapé fixo e marca-texto por seleção com cores próprias, sem placeholder de instruções.
- [x] Permitir digitar a data de entrega além de escolhê-la no calendário ROY, mantendo a data salva sem conversão de fuso; data parcial/inválida bloqueia Salvar.

## Tarefas de Marketing: duplicação e identificação
- [x] Duplicar tarefa como uma nova cópia editável, preservando a original e reiniciando conclusão das subtarefas.
- [x] Data e horário de entrega (24h), solicitante separado do responsável e etiquetas coloridas persistidas nos campos existentes; sem migração ou alteração de permissões.
- [x] Mostrar identificação no quadro/lista e filtrar cartões por etiquetas, combinando com filtros existentes.
- [x] 17 testes passaram; sessão autenticada: criar/reabrir, duplicar/cancelar, copiar subtarefa, filtrar e editar/limpar campos conferidos por tarefas fictícias. Originais preservadas, somente as 3 tarefas QA removidas (inclui a cópia), sem sobras; diálogo/rodapé/etiquetas em 390/794/1440 px, claro/escuro e Escape conferidos, sem publicação.

## Funil MQL no Insights
- [x] Reproduzir na sessão atual: nomes salvos “Closer” e “Repescagem / Cadencia” não correspondem aos funis atuais; fallback trazia 19 linhas de todos os funis, com valores zero.
- [x] Corrigir somente a apresentação/leitura: filtro sem correspondência não inclui outros funis; etapas com largura legível e rolagem local quando necessário, sem alterar filtros salvos ou dados.
- [x] 32 testes passaram; conferência autenticada confirma ausência das etapas indevidas. Nomes atuais simulados apenas na resposta de leitura, sem salvar: CR mostra 7 etapas + Ganhos/Perdidos e total 61 em novembro; 390/794/1440 px sem overflow das barras ou erros. Painel normal mostra todas as etapas; modo TV mantém rolagem local. A lista de Chegou Lead abriu vazia (a barra é cumulativa, não a contagem da etapa). Não publicado.
- Filtros salvos ainda apontam a nomes inexistentes: precisam ser atualizados pelo responsável pelo painel; não foram remapeados automaticamente nem regravados neste ajuste.

## Filtros por Item da Venda e campos preenchidos
- [x] Reproduzir o filtro “Leads CR”: o cartão usa UUID de produto e a condição usa código da opção; antes mostrava zero para 16 cartões válidos, inclusive Fabienne. RLS consultada e preservada.
- [x] Corrigir comparação do Pipeline, seletor de produto e exportação com o mesmo comparador de identidade; leitura completa por lote/página, campos da prévia independentes do filtro aplicado e estados de carregamento/erro; nenhum filtro salvo, negócio ou contrato regravado.
- [x] 49 testes passaram; sessão real conferida: CR 16, EM 455, EC 71, MVP 22, EP 3, Conselho 7, quadro/lista/detalhe de Fabienne e prévia CR 16/588 sem salvar; exportação CR em aberto com 321 registros entre todos os funis e Fabienne incluída (arquivo temporário descartado). 390/794/1440 px sem rolagem lateral ou erros; caminhos irmãos conferidos por leitura em .lovable/reviews/pipeline-filter-check.md; não publicado.

## Ordem dos funis
- [x] Adicionar “Reorganizar funis” ao seletor, com arraste e setas para definir a ordem.
- [x] Salvar na ordem já existente dos funis, preservando acessos, funil selecionado, etapas e negócios; sem migrações ou mudanças de permissões.
- [x] 28 testes passaram: ordem/persistência, cancelamento, rejeição por acesso/concorrência e filtros existentes; conferência com funis fictícios em 390/794/1440 px nos dois temas, incluindo arraste, teclado, salvar/recarregar e cancelar; não publicado.
- [ ] Conferir na sessão real: sessão própria indisponível, acesso explícito não autorizado para este usuário do workspace; /pipeline retorna ao login. Nenhum negócio ou funil real alterado nos testes.

## Borda e filtros do funil
- [x] Degradê à direita enquanto há mais etapas, seta central ao passar o mouse e avanço por etapa; desaparecem no fim e durante arraste, com movimento reduzido respeitado.
- [x] Filtros agrupados, campos alinhados, cabeçalho/rodapé fixos e contagem dos negócios; opções, persistência e permissões preservadas.
- [x] 55 testes passaram; sessão autenticada conferida em 390/794/1440 px nos dois temas, filtro de empresa aplicado e restaurado, calendário, filtros avançados, Ganhas/Perdidas e avanço/fim do funil, sem erros nem alteração de negócios; não publicado.

## Topo compacto do Pipeline
- [x] Busca e funil em linha compacta, resumo ao lado das situações e filtros em painel sob demanda; sem alterar dados ou regras.
- [x] 55 testes passaram; página completa com exemplos conferida em 390/794/1440 px nos dois temas, filtros de empresa/vendedor/origem/data, ganhas/perdidas, seleção por etapa e tela expandida, sem erros ou rolagem lateral da página; não publicado.
- [ ] Conferir com dados reais: mesmo após entrada confirmada em 24/11, a sessão própria de teste não foi disponibilizada (nenhuma conta correspondente retornada); exemplos não substituem essa conferência.

## Cliques Story e Feed no comparativo
- [x] Incluir as duas métricas ao lado das atuais em Eternum RECORDES e na tabela semanal, usando os lançamentos existentes por perfil e período, sem novos campos ou alterações de dados.
- [x] 21 testes passaram, incluindo isolamento por conta/perfil/ano, paginação completa e preservação do botão Salvar; gráfico conferido com dados fictícios em 390/794/1440 px, sem sobreposição, rolagem lateral ou erros; não publicado.
- [ ] Conferir leitura dos números reais na sessão autenticada: sessão própria indisponível ao teste; sem alteração de dados reais.

## Visualização de produtos ativos e inativos
- [x] Confirmar que o funil não tem vínculo com empresa: filtro usa a empresa da venda, herdada do produto.
- [x] Mostrar ativos por padrão e separar inativos pelo seletor de status, mantendo filtro de empresa, contagem e paginação; sem alterar dados ou regras comerciais.
- [x] 30 testes passaram: ativos por padrão, inativos separados sem alteração de registros e combinação com empresa; página compilou sem erros.
- [ ] Conferir alternância na página com sessão autenticada: sessão própria indisponível; a abertura de /products retornou ao login, sem erros de execução. Não publicado.

## Filtros de empresa por área
- [x] Painel de vendas: indicadores, gráficos, ranking, cancelamentos e acumulados anual/trimestral pela empresa da venda; metas existentes, indicadores fixados e AION continuam gerais e identificados.
- [x] Produtos: catálogo e paginação pela empresa vinculada, com contagem e limpeza independente.
- [x] Clientes: filtro por produtos/histórico da empresa aplicado antes da paginação, às contagens das abas e à exportação; cadastro único, inclusive quando compra das duas empresas; filtro no painel desktop/mobile e na limpeza geral.
- [x] 34 testes passaram; seletor e limpeza conferidos isoladamente em 390/794/1440 px, sem overflow; sem alteração de dados reais, permissões, contratos ou funções; sem publicação.
- [ ] Conferência completa das três telas com dados reais: sessão indisponível ao teste, mesmo após confirmação de entrada na prévia; abertura de /setores retornou ao login e a criação/seleção de sessão não foi autorizada/disponibilizada.

## Alterações em massa no Pipeline
- [x] “Selecionar todos” por etapa, com contagem, estado parcial, desmarcação independente e filtros preservados; 16 testes passaram e controles conferidos com exemplos em 390/794/1440 px, sem alterar negócios.
- [ ] Conferir seleção por etapa com cards reais: sessão própria de teste indisponível mesmo após entrada confirmada em 24/11; nenhuma conta correspondente retornada.
- [x] Reorganizar janela e mover “Selecionar cards” para o menu discreto do funil.
- [x] Restringir alterações em massa a adm/gestor no servidor e na interface, preservando as permissões individuais existentes.
- [x] Registrar autor, data, ação e resultados em histórico persistente; desfazer a última movimentação própria com verificação contra alterações posteriores.
- [x] 38 testes passaram; movimentação/reversão e autoria conferidas pela sessão atual, pedidos anônimos e autoria forjada rejeitados. Janela e histórico conferidos em 390/794/1440 px, claro/escuro, sem erros. Dois negócios fictícios retirados ao final, sem excluir registros reais; não publicado.
- [x] Selecionar cards ou todos os negócios do resultado filtrado, no quadro e na lista.
- [x] Confirmar alteração de funil/etapa, produto, valor ou campo personalizado, preservando permissões, contratos e regras existentes.
- [x] Progresso, resultado por negócio e interrupção dos próximos; 40 testes passaram, valor/produto/campo/transferência salvos e relidos pela interface em dois negócios fictícios, depois removidos; 390/794/1440 px e Escape conferidos, sem publicar.

## Cliques em links no Marketing
- [x] Exibir duas abas no topo de Conteúdo: Clique no link - Story e Clique no link - Feed.
- [x] Manter os lançamentos e totais de Story separados dos de Feed, preservando os stories existentes; 9 testes de separação, formato e acesso passaram.
- [x] Navegação e persistência conferidas com a sessão atual e dois lançamentos fictícios, removidos ao final; 390/794/1440 px nos dois temas sem rolagem lateral da página ou erros; não publicado.

## Produtos por empresa
- [x] Filtro por empresa nos negócios abertos, ganhos e perdidos (Kanban/lista), com escolha pessoal persistida e limpeza independente; 38 testes e conferência autenticada das contagens reais em 390/794/1440 px, claro/escuro, sem alterar dados reais ou publicar.
- [x] Cadastrar Anjos Business Consultoria Digital Empresarial LTDA (CNPJ 29.471.749/0001-07, informado pelo usuário).
- [x] Vincular Clínica Ryka (CR l Programa de Aceleração, confirmado) a Anjos e EM/EC/EP/Conselho a Eternum, preservando os demais produtos e fluxos.
- [x] Exibir e selecionar empresa em Produtos; vendas herdam o vínculo do produto sem mudar contratos existentes.
- [x] Testar isolamento, persistência e navegação: 18 testes; vendas fictícias salvas e relidas na interface, depois removidas; 390/794/1440 px nos dois temas, sem publicação.

- [x] Andréia: liberar edição das mensagens dos Processos respeitando a autorização existente.
- [x] Andréia: permitir ver clientes de todas as consultoras no onboarding dos Processos; testes de acesso e navegação autenticada passaram.
- [ ] Conferência na sessão da Andréia: bloqueada porque esta sessão não pode abrir a conta de outra pessoa; edição e filtros conferidos com a sessão do solicitante, sem salvar mensagens reais.
- [x] Painel analítico de inteligência: indicadores, evolução mensal, comparativos por canal/@ e histórico dos leads.
- [x] Inteligência: conectar leads, MQL e vendas por canal/origem, exibir Instagram do lead e consultar seu histórico comercial.
- [x] Conteúdos: reunir posts cadastrados de todas as redes e da Produção, com filtros e detalhes.
- [x] IA de Marketing: ampliar contexto para o histórico completo cadastrado, preservando acesso por conta.
- [x] Fase 1: área "Processos" (consulta, busca, copiar mensagens, links, alertas)
- [x] Fase 2: checklist por cliente
- [x] Fluxograma, tour, status (edição por gestores ainda pendente)
- [x] Negócio perdido: finalizar conversa do RoyZapp e desvincular vendedor (pedido Jonathan)
- [ ] Sincronização da Bruna: aguarda reconexão da Meta em “Configurar Meta API” (sessão invalidada pelo provedor)
- [x] Imagens dos posts: 746 miniaturas salvas no ROY; 19 indisponíveis no Instagram recebem fallback visual
- [x] Processos: "Processo concluído" com painel próprio, pulso no momento em que termina e fim de processo sem cliente
- [x] TVs: barra com um botão só — "Devolver todas" passou a ser linha dentro do menu de "Liberar todas"

## Chave de TV = mesma tela logada
- [x] Conta dedicada "TV Escritório" (só leitura, perfil igual ao das TVs hoje; senha via cartão seguro)
- [x] tv-proxy: valida tv_token, só leituras, sessão persistida (refresh antes de expirar, senha só se refresh falhar)
- [x] Aviso "Conta de TV sem acesso — verifique em Configurações > TVs" na TV e na tela de TVs
- [x] Front: Insights normal em modo TV com tv_token; remover TvInsightsView
- [x] Lista de RPC liberadas + comparação lado a lado dos 4 painéis

## Retorno ao primeiro ranking separado por empresa
- [x] Restaurar o layout da primeira separação Eternum/Anjos (25/11, 12:26), sem desfazer correções de números, paleta ou mudanças em outras áreas.
- [x] Painel real conferido na sessão atual em 1440, 1920×1080, 668 e 390 px: tabelas originais, foco a 80% e ajuste TV; sem erros de execução. 30 testes de cálculos/separação passaram; sem alterar dados, permissões, integrações ou publicar.

## Assinatura no ganho (Anjos)
- [x] Pergunta "É uma assinatura?" e ciclo mensal/anual obrigatórios no ganho das vendas da Anjos
- [x] Formas de pagamento restritas por ciclo, com preenchimento automático da forma compatível
- [x] Conferência em todos os pontos de ganho (Pipeline, RoyZapp, Leads, Tarefas, ficha do cliente)
- [x] Exibição somente leitura no card abaixo de "É uma renovação"

## Áreas de Atuação: trocar nome e excluir com segurança
- [x] Trocar o nome atualiza a lista e todas as fichas (clientes e leads), com aviso do que muda antes de salvar
- [x] Excluir área em uso pede para mover as fichas, tirar das fichas ou editar o nome
- [x] Nomes fora da lista oficial podem ser movidos ou oficializados; coluna "Em uso" na tabela

## RoyZapp: aba Equipe
- [x] Natiely inativada (sem conversas abertas para liberar); Amanda com cargo CX + Consultor
- [x] Inativos fora da aba, com Inativar/Reativar no menu; conversas abertas ficam sem dono na fila
- [x] Selo de cargo segue todos os cargos marcados na Equipe
- [ ] Conferência visual da aba na prévia: aguarda sessão do usuário (entrada automática recusada nesta rodada)

## Mentoria Ao Vivo na agenda do cliente (Andréia)
- [x] Seção "Mentorias Ao Vivo" na Agenda de Entregas do cliente, com os mesmos registros da tela Mentoria Ao Vivo
- [x] Registrar participação, agendar e excluir direto na agenda; as duas telas se atualizam
- [ ] Conferência visual na prévia: aguarda sessão do usuário (entrada automática recusada)

## Ganho de assinatura: pagamento vem do RykaPay
- [x] Assinatura (mensal ou anual) não pede "Nº de parcelas"
- [x] Se já houver pagamento no RykaPay, valor e data aparecem só para leitura no ganho
- [ ] Conferência visual do ganho na prévia com um negócio real já pago
