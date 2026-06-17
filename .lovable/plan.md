# Liberar conversas de Dayara e Michele

## Situação
- **Dayara Grecco** (inativa): 10 conversas abertas (8 active + 2 waiting)
- **Michele Santos** (inativa): 15 conversas abertas (9 active + 6 waiting)
- As 33 já fechadas serão ignoradas (não precisam liberar).

## Ação
Migration única em `zapp_conversation_assignments` que, para todas as conversas das duas usuárias com status diferente de `closed`:
- Limpa `agent_id` (volta para a fila)
- Muda `status` para `triage` (estado padrão da fila)
- Atualiza `updated_at`

Isso reproduz exatamente o que o botão "Liberar para fila" do RoyZapp faz (`releaseToQueue` em `useZappConversationActions.ts:149`), só que em lote.

Após o lote, qualquer atendente do setor vai ver essas conversas na fila e poderá puxá-las normalmente.

## Observações
- Os assignments `closed` não são alterados (são histórico).
- Não mexo no registro `zapp_agents` delas — fica como histórico para auditoria/relatórios passados.
- Se quiser também desativar o agente no RoyZapp (`zapp_agents.is_active = false`) para impedir transferências futuras manuais para elas, posso incluir — me avise.
