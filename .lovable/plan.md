

## Adicionar coluna Etapa, abrir detalhes do negocio e criar tarefa de follow-up na pagina de Tarefas

### Resumo das 3 alteracoes

1. **Coluna "Etapa do Funil"** na tabela de tarefas, mostrando a etapa atual do negocio vinculado, com opcao de ordenar e filtrar
2. **Clicar na tarefa abre o painel de detalhes do negocio** (DealDetailSheet), igual ao pipeline
3. **Ao concluir uma tarefa, abrir automaticamente o dialogo para criar a proxima tarefa** no mesmo negocio

---

### Detalhes tecnicos

#### Arquivo: `src/pages/Tasks.tsx`

**1. Coluna Etapa do Funil**

- Alterar a query Supabase para incluir `deal_stages` no join do deal:
  ```
  deals:deal_id (
    id, title, client_id, lead_id, contact_name, contact_phone,
    stage_id,
    stage:deal_stages(id, name, color),
    client:clients(...),
    lead:leads(...)
  )
  ```
- Atualizar a interface `Deal` local para incluir `stage_id` e `stage: { id, name, color } | null`
- Adicionar coluna "Etapa" na `TaskTable` entre "Prazo" e "Contexto", exibindo badge colorido com o nome da etapa
- Adicionar opcao de ordenacao `stage` no `SortOption` type
- Adicionar filtro de etapa via `Select` no `FilterBar`, com lista de etapas obtidas via query a `deal_stages`
- A coluna sera clicavel para ordenar (como Prioridade e Prazo)

**2. Clicar na tarefa abre DealDetailSheet**

- Importar `DealDetailSheet` e `useDeals` (para obter stages e deal handlers)
- Adicionar estados: `selectedDealForDetail`, `isDealDetailOpen`
- Ao clicar na row da tarefa (exceto nos dropdowns e checkbox), buscar o deal completo e abrir o `DealDetailSheet`
- Passar os handlers necessarios (`onStageChange`, `onMarkAsWon`, `onMarkAsLost`, `onReopen`, `onEdit`)
- Tarefas sem `deal_id` nao abrem o painel (apenas tarefas vinculadas a negocios)

**3. Follow-up automatico ao concluir tarefa**

- Modificar o handler do checkbox de conclusao: apos marcar como concluido com sucesso, abrir automaticamente o `TaskDialog` para criar nova tarefa
- Pre-preencher `deal_id` da tarefa recem-concluida no novo dialogo
- Usar o mesmo padrao do `DealActivitiesTab` (linhas 193-196): `setEditingTask(null); setTaskDialogOpen(true);`
- Guardar o `deal_id` da tarefa concluida para passar ao `TaskDialog`

### Resultado esperado

- A tabela mostra a etapa do funil de cada tarefa com badge colorido
- Filtrar e ordenar por etapa permite foco em fases especificas do pipeline
- Clicar numa tarefa abre os detalhes completos do negocio, sem sair da pagina de Tarefas
- Ao concluir uma tarefa, o sistema ja abre o formulario para agendar o proximo passo no mesmo negocio
