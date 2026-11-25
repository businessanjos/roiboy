# Filtro de situação das tarefas

## Regra
A situação escolhida pela pessoa — inclusive Todas as etapas — deve continuar igual ao atualizar, trocar entre quadro e lista, ampliar o quadro ou reabrir Tarefas. Abertas é somente o padrão sem uma escolha salva. A escolha não muda tarefas nem a visualização de outras pessoas.

## Caminhos conferidos
| Lugar | Código lido nesta alteração | Resultado |
| --- | --- | --- |
| Tela de tarefas e filtro Etapa | `MarketingTasksTab.tsx` | Corrigido: estado local reiniciava em Abertas; usa agora a preferência pessoal existente e valida situações reconhecidas. |
| Quadro, lista, contagens e filtros combinados | `MarketingTasksTab.tsx`, `MarketingTaskKanban.tsx`, `MarketingTaskList.tsx`, `MarketingTaskSection.tsx` | Todos recebem as mesmas tarefas filtradas; não restauram outra situação. |
| Quadro ampliado e retorno | `MarketingTasksTab.tsx` | Usa o mesmo estado e a mesma coleção filtrada. |
| Limpar filtros, inclusive resultado vazio | `MarketingTasksTab.tsx` | Ambos selecionam Todas pela mesma função persistida. |
| Entrada, troca de aba e reabertura | `MarketingTasks.tsx`, `MarketingProjectsHub.tsx`, `MarketingTabsHub.tsx`, rotas em `App.tsx` | A montagem agora restaura a escolha; redirecionamento antigo abre o mesmo caminho. |
| Preferência pessoal e chegada da identidade | `usePersistedFilter.ts` | Chave por pessoa, restauração inicial ou após identidade chegar. Sem alteração do hook global ou de outros filtros. |
| Abrir tarefa/comentário por aviso | `MarketingTasksTab.tsx`, `useNotifications.tsx`, `GlobalNotificationToast.tsx` | Abre o item legível independentemente do filtro, sem trocar o filtro. |
| Buscar/recarregar após criar, editar, concluir e reordenar | `useMarketingTasks.ts`, callbacks em `MarketingTasksTab.tsx` | Recarrega dados, não altera preferência. Nenhuma mutação executada no teste. |
| Notificações automáticas no servidor | Definições atuais de `public.notify_marketing_task_assignment` e `public.notify_marketing_task_comment`, consultadas somente por leitura | Criam links de tarefa/comentário, sem filtro Etapa, preferência ou regravação de tarefas concluídas. |
| Tarefas vinculadas a projeto | `ProjectDetailSheet.tsx`, bloco `TasksTab` | Outra finalidade: vincular tarefas abertas. Não oferece nem reinicia o filtro pessoal Etapa da tela Tarefas; preservado. |
| Copilot e consulta externa MCP | `marketing-project-copilot/index.ts`, blocos criar tarefa e snapshot; `mcp/index.ts`, `marketing_overview` | Não acessam a preferência do navegador. Não são visualizações do filtro Etapa; preservados, sem alterar tarefas ou regras. |

## Verificação
- 21 testes passaram: 16 de filtro, quatro de abertura da área, um da leitura paginada de tarefas.
- Sessão autenticada: selecionar Todas, Concluídas, Em andamento e Abertas, atualizar e confirmar cada escolha.
- Conferidos lista, quadro ampliado, limpar filtros, sair para Projetos e voltar a Tarefas; Todas permanece.
- Conferido em 803, 390 e 1440 px, sem erros de execução. Dados lidos reais; pedidos de gravação de tarefas bloqueados no teste.
- Preferências locais anteriores restauradas após o teste; nenhuma tarefa, permissão, configuração compartilhada ou registro concluído alterado. Sem publicação.