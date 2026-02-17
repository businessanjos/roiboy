
## Corrigir filtro de tarefas: tarefas concluidas aparecendo na aba Pendente

### Problema

Tarefas que possuem `completed_at` preenchido (ou seja, ja foram concluidas) mas nao possuem `custom_status_id` definido estao aparecendo na aba "Pendente". Isso ocorre porque a logica atual na linha 489 do `Tasks.tsx` diz:

```
if (!task.custom_status_id && activeTab === defaultStatus?.id) return true;
```

Essa condicao inclui TODAS as tarefas sem `custom_status_id` quando o tab ativo e o status padrao (Pendente), inclusive tarefas que ja foram concluidas (tem `completed_at` preenchido).

### Solucao

Adicionar uma verificacao extra na linha 489: tarefas sem `custom_status_id` so devem aparecer no tab "Pendente" se NAO estiverem concluidas (`completed_at === null`).

### Mudanca tecnica

**Arquivo: `src/pages/Tasks.tsx` (linha 489)**

De:
```typescript
if (!task.custom_status_id && activeTab === defaultStatus?.id) return true;
```

Para:
```typescript
if (!task.custom_status_id && activeTab === defaultStatus?.id && !task.completed_at) return true;
```

Isso garante que tarefas sem status personalizado mas com `completed_at` preenchido nao aparecerao na aba Pendente -- elas serao corretamente mostradas apenas na aba Concluido (via linha 490).

Mesma correcao tambem no `statusCounts` (linhas 540-543) para que a contagem no tab reflita os numeros corretos, adicionando `&& !t.completed_at` quando checando o status padrao.

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `src/pages/Tasks.tsx` | 489 | Adicionar `&& !task.completed_at` para excluir concluidas do tab Pendente |
| `src/pages/Tasks.tsx` | 540-543 | Adicionar `&& !t.completed_at` na contagem do status padrao |
