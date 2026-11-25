# Menus das tarefas sem corte

## Regra
O menu de etiquetas deve aparecer inteiro, com busca, seleção, lápis, fechar e ações acessíveis; dentro da tarefa, não pode ultrapassar a janela que o recorta. Listas e formulários grandes devem rolar sem esconder o cabeçalho e o rodapé.

## Inventário conferido
- `TaskLabels.tsx`: lista, busca, selecionar/desmarcar, limpar, criar e editar. O menu usava largura fixa com limite da tela, mas ignorava os limites do diálogo em que estava inserido. Corrigido com alinhamento à direita, `collisionBoundary` do diálogo e largura/altura máximas do espaço calculado pelo Radix; nome longo não compete com o lápis e fechar não encolhe.
- `MarketingTaskDialog.tsx`: criação, edição, duplicação e edição da origem recorrente compartilham `TaskLabelEditor`. Todos recebem o mesmo diálogo como destino do menu, inclusive ocorrências concluídas. Não houve alteração nos campos ou no salvamento.
- `MarketingTasksTab.tsx`: lista, quadro, expansão e links `task`/`comment` abrem o mesmo diálogo. O filtro de etiquetas usa o mesmo picker fora do diálogo; seu limite continua sendo a tela e foi conferido no navegador. Seleção e ordenação intactas.
- `MarketingTasks.tsx` e `pages/marketing/MarketingProjectsHub.tsx`: a aba de tarefas usa a mesma página e o mesmo quadro; nenhuma implementação paralela do seletor de etiquetas.
- `TaskDeliveryDate.tsx`: calendário também inserido no diálogo sem fronteira explícita. Aplicado o mesmo limite e rolagem local. Datas, parsing e ações Hoje/Limpar intactos.
- `TaskDescriptionEditor.tsx` e `TaskComments.tsx`: a paleta de marca-texto da descrição e dos comentários compartilha o mesmo editor e recebe o diálogo. Aplicado limite do diálogo e rolagem local; texto/formatação/envio intactos.
- `TaskRecurrenceEditor.tsx`, seletores de pessoas/etapa/prioridade no diálogo e `TaskSeparator.tsx`: usam `SelectContent`, cujo portal fica fora do diálogo e usa posicionamento popper. Não estão sujeitos ao recorte desse diálogo; conferidos em código, sem alteração.
- `SubtaskList.tsx`, `SortableSubtaskItem.tsx` e `TaskCover.tsx`: controles ficam dentro do conteúdo rolável, sem menu de etiquetas ou portal atingido por este problema. Conferidos em código, sem alteração.
- `TaskMentions.tsx`: lista de pessoas usa o posicionador de sugestões do Tiptap com flip, não o seletor de etiquetas; conferida em código, sem reprodução de corte ou mudanças de identidade/lista de pessoas nesta solicitação.
- `useMarketingTaskLabelCatalog.ts` e `edit_marketing_task_label` na migração 0113: armazenam catálogo e alterações de nome/cor, sem posicionamento visual. Conferidos em código; nenhum RPC, permissão ou dado foi alterado.
- `marketing-task-recurrence/index.ts`: chama o processador da repetição, não renderiza menus; conferido em código, sem alteração. Rotinas de gravação/envio não têm geometria de interface.

## Validação
- 45 testes existentes passaram: etiquetas, catálogo, edição da tarefa, formatação e menções.
- Navegador com componentes originais e rascunhos TESTE QA em 390, 803, 1440 e 1920 px, claro/escuro: lista de 26 etiquetas, busca/seleção, abrir edição/cancelar, criar/cancelar, rolar até a última etiqueta, calendário Hoje, paleta e filtro. 56 verificações de limites passaram; todos os menus do diálogo ficam dentro dele com folga lateral e vertical, filtro dentro da tela. Sem erros de execução ou rolagem lateral da página.
- Capturas inspecionadas: etiquetas em 803, edição em 390 escuro e lista rolada em 1440. Botões de fechar/lápis/rodapé completos e nomes longos contidos.
- Compilação OK. Conferência visual isolada não depende de sessão e não valida persistência autenticada; nenhum dado real, registro concluído, serviço, permissão ou configuração foi alterado. Não publicado.