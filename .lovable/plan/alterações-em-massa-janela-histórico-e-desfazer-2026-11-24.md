# Alterações em massa: janela, histórico e desfazer

## Janela mais organizada
- Ajustar largura, espaçamento e alinhamento dos campos, mantendo o visual ROY.
- Cabeçalho com quantidade selecionada, conteúdo rolável e rodapé fixo; revisão mostra o destino e os negócios envolvidos antes de aplicar.
- “Selecionar cards” sai da barra destacada e entra no menu de três pontos do funil. A barra de seleção só aparece enquanto estiver selecionando.

## Somente adm/gestor
- Seleção, alterações em massa, histórico e desfazer ficam disponíveis apenas para administradores e gestores.
- Verificar essa autorização no servidor, não apenas esconder o botão.
- Usar a identidade e os cargos já cadastrados, sem promover pessoas nem ampliar acesso aos negócios. Edição individual continua como hoje.

## Histórico
- Adicionar “Histórico de alterações em massa” no mesmo menu do funil.
- Registrar quem fez, data e hora de Brasília, tipo de alteração, destino/valor/campo, negócios envolvidos e resultado de cada um.
- Guardar os valores anteriores e posteriores junto da alteração efetiva, para não haver alteração sem histórico ou histórico de uma alteração que falhou.
- O histórico começa com as novas operações; não inventar autoria nem reversão para operações antigas.

## Desfazer última movimentação
- Disponibilizar no histórico “Desfazer última movimentação”, com confirmação e resumo dos negócios que voltarão ao funil/etapa anterior.
- Considerar a última movimentação em massa feita pela própria pessoa, mesmo depois de atualizar a página; reverter somente os negócios realmente movidos nessa operação.
- Recusar a reversão se algum negócio tiver sido movido novamente, encerrado, excluído, perdido o acesso ou se a etapa original não estiver disponível.
- Restaurar somente os dados da movimentação, sem sobrescrever produto, valor, responsável, cliente, contratos ou outros campos editados depois.
- Fazer a reversão de modo indivisível: ou todos os negócios elegíveis retornam, ou nenhum é alterado. Registrar também quem desfez e quando, impedindo repetição.
- Neste pedido, desfazer fica limitado a movimentações de funil/etapa; produto, valor e campos continuam com histórico, sem reversão automática.

## Verificação
- Testes para adm/gestor permitido e demais perfis bloqueados, inclusive em chamadas diretas.
- Conferir isolamento por conta e permissões dos negócios, autoria derivada da sessão e rejeição de autoria enviada pelo solicitante.
- Com negócios “TESTE QA”, mover em massa, reler o histórico, desfazer e confirmar o retorno pela interface; testar bloqueio após nova movimentação.
- Conferir computador/celular, rolagem da lista e rodapé sempre acessível. Nenhum registro real será alterado para testar; não publicar.

## Detalhes técnicos
- Adicionar registros de operações e resultados com índices, GRANTs explícitos e RLS; auditoria protegida contra alteração direta pelo navegador.
- Encaminhar as gravações em massa por operações autenticadas e transacionais, preservando a RLS atual e os gatilhos de produto/empresa; não alterar as permissões gerais das tabelas de negócios.
- Manter validação de campos obrigatórios, etapas ativas, regra existente SDR → Closer, progresso, interrupção e tratamento de falhas por negócio.
- A reversão valida snapshots reais e bloqueia concorrência antes de restaurar funil, etapa e probabilidade. Não aceita estados anteriores fornecidos pelo navegador.
