# Roadmap — Processos do CS

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
- [x] Confirmar alteração de funil/etapa, produto, valor ou campo personalizado, preservando permissões, contratos e regras existentes; negócios encerrados exigem reabertura individual para mover.
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
