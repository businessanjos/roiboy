
# Plano: Transferir Anotações de "Call Comercial Concluída" para Timeline do Cliente

## Contexto

Quando um negócio é marcado como **Ganho** e o Lead é convertido em Cliente, queremos que todas as anotações registradas nas tarefas do tipo **"Call Comercial Concluída"** sejam automaticamente copiadas para a Timeline do perfil do cliente.

## Estrutura de Dados Atual

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `internal_tasks` | `deal_id` | Referência ao negócio |
| `internal_tasks` | `activity_type_id` | Tipo de atividade (Call Comercial Concluída) |
| `internal_tasks` | `description` | **Conteúdo das anotações da call** |
| `internal_tasks` | `completed_at` | Data de conclusão |
| `activity_types` | `id` | `da801f68-1f0e-4393-ab73-28c359a1bb62` (Call Comercial Concluída) |
| `client_followups` | `content` | Onde as notas da timeline são armazenadas |

## Solução Proposta

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/SalesPipeline.tsx` | Adicionar transferência de anotações no `handleMarkAsWon` |

### Lógica de Transferência

Após a conversão do lead para cliente (e antes de marcar como ganho), o sistema irá:

1. **Buscar tarefas do negócio** com `activity_type_id` correspondente a "Call Comercial Concluída"
2. **Filtrar apenas tarefas concluídas** (`completed_at IS NOT NULL`)
3. **Para cada tarefa**, criar um registro em `client_followups` com:
   - `type: "note"`
   - `title: "📞 Anotações da Call Comercial"`
   - `content`: Descrição da tarefa
   - `client_id`: ID do cliente convertido

### Código a Adicionar

```typescript
// STEP 4.5: Transfer Call Comercial Concluída notes to client timeline
if (clientId && currentUser?.account_id) {
  try {
    // 1. Find the "Call Comercial Concluída" activity type
    const { data: activityType } = await supabase
      .from("activity_types")
      .select("id")
      .eq("account_id", currentUser.account_id)
      .eq("name", "Call Comercial Concluída")
      .maybeSingle();

    if (activityType?.id) {
      // 2. Fetch completed tasks of this type for this deal
      const { data: callTasks } = await supabase
        .from("internal_tasks")
        .select("id, title, description, completed_at, created_by")
        .eq("deal_id", dealId)
        .eq("activity_type_id", activityType.id)
        .not("completed_at", "is", null)
        .not("description", "is", null)
        .order("completed_at", { ascending: true });

      // 3. Transfer each task's notes to client timeline
      if (callTasks && callTasks.length > 0) {
        const followupsToInsert = callTasks
          .filter(task => task.description?.trim())
          .map(task => ({
            account_id: currentUser.account_id,
            client_id: clientId,
            user_id: task.created_by || currentUser.id,
            type: "note",
            title: `📞 ${task.title || "Call Comercial Concluída"}`,
            content: task.description?.trim(),
          }));

        if (followupsToInsert.length > 0) {
          const { error: followupsError } = await supabase
            .from("client_followups")
            .insert(followupsToInsert);

          if (followupsError) {
            console.error("[MarkAsWon] Error transferring call notes:", followupsError);
          } else {
            console.log(`[MarkAsWon] Transferred ${followupsToInsert.length} call notes to client timeline`);
          }
        }
      }
    }
  } catch (transferError) {
    console.error("[MarkAsWon] Error in call notes transfer:", transferError);
    // Don't block the flow - this is a non-critical enhancement
  }
}
```

### Posição no Código

O código será inserido **após o STEP 4** (Update client with deal data) e **antes do STEP 5** (Create contract), aproximadamente na **linha 390** do arquivo `SalesPipeline.tsx`.

## Fluxo Atualizado

```text
┌─────────────────────────────────────────────────────────────┐
│              handleMarkAsWon - FLUXO ATUALIZADO             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STEP 1: Convert Lead → Client (se necessário)             │
│                          │                                  │
│                          ▼                                  │
│  STEP 2: Validar clientId                                  │
│                          │                                  │
│                          ▼                                  │
│  STEP 3: Update deal com client_id                         │
│                          │                                  │
│                          ▼                                  │
│  STEP 4: Update client com dados do deal                   │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ STEP 4.5: NOVO - Transferir anotações               │  │
│  │                                                      │  │
│  │  1. Buscar activity_type "Call Comercial Concluída" │  │
│  │  2. Buscar internal_tasks concluídas do deal        │  │
│  │  3. Inserir em client_followups                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  STEP 5: Create contract                                   │
│                          │                                  │
│                          ▼                                  │
│  STEP 6: Mark as won                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

Quando um negócio for marcado como ganho:

### Antes (Atual)
- Lead é convertido para Cliente
- Anotações ficam apenas no histórico do Negócio
- Cliente novo não tem contexto da negociação

### Depois (Proposto)
- Lead é convertido para Cliente
- **Anotações da Call Comercial são copiadas para a Timeline do Cliente**
- Equipe de Operações recebe o cliente com contexto completo

## Exemplo Visual

### Timeline do Cliente (após conversão)

```text
┌─────────────────────────────────────────────────────────────┐
│  TIMELINE DO CLIENTE                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📞 Call Video - Concluida           por Jonathan Marcato   │
│  ─────────────────────────────────                          │
│  Barbara                                                    │
│  Ipatinga-MG                                                │
│  Quer melhorar o posicionamento.                           │
│  Cresceu muito sozinha sem organização.                    │
│  Faturamento 30 a 100k                                     │
│  ...                                                        │
│                                                  há 7 dias  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🎉 Cliente cadastrado (conversão de lead)    Sistema      │
│                                                  há 7 dias  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Benefícios

| Aspecto | Descrição |
|---------|-----------|
| **Contexto preservado** | Operações recebe cliente com histórico completo da negociação |
| **Continuidade** | Anotações de vendas acompanham o cliente |
| **Auditoria** | Mantém registro de quem fez a call e quando |
| **Não-bloqueante** | Erros na transferência não impedem o fluxo de marcar como ganho |

## Considerações Técnicas

- A transferência é **não-bloqueante**: se falhar, o fluxo principal continua
- Preserva o `user_id` original de quem criou a anotação
- Filtra apenas tarefas **concluídas** e com **descrição não-vazia**
- Usa título descritivo com emoji 📞 para identificação visual
