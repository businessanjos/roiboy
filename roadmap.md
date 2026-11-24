# Roadmap — Processos do CS

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
