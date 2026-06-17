# Auto-liberar conversas ao desativar membro

## Comportamento desejado
Quando um usuário é desativado (`users.is_active` vira `false`):
1. Todas as conversas abertas dele no RoyZapp voltam para a fila imediatamente.
2. Ele é marcado como agente inativo no RoyZapp (`zapp_agents.is_active = false`).
3. Novas atribuições (insert/update de `agent_id`) apontando para esse agente são bloqueadas no banco.

## Implementação (migration única)

### 1. Função `release_zapp_assignments_for_user(uuid)`
SECURITY DEFINER, recebe `user_id`. Para esse usuário:
- `UPDATE zapp_agents SET is_active = false WHERE user_id = $1`
- `UPDATE zapp_conversation_assignments SET agent_id = NULL, status = 'triage', updated_at = now()` para todos os assignments cujo `agent_id` pertence ao usuário e `status <> 'closed'`.

### 2. Trigger `on_user_deactivated`
`AFTER UPDATE OF is_active ON public.users` quando `OLD.is_active = true AND NEW.is_active = false` → chama a função acima. Cobre desativações por qualquer caminho (UI, admin, offboarding).

### 3. Trigger `block_assignment_to_inactive_agent`
`BEFORE INSERT OR UPDATE OF agent_id ON public.zapp_conversation_assignments`. Se `NEW.agent_id IS NOT NULL` e o agente está inativo (ou o user está inativo), levanta exceção: `agent_id refere-se a um atendente desativado`. Permite `agent_id = NULL` (fila) normalmente.

### 4. Backfill imediato
No final da migration, executar a função para **todos** os usuários atualmente `is_active = false`. Hoje isso libera **470 conversas órfãs** (1 pending + 121 active + 348 waiting) que já estão presas a ex-membros. Se preferir não fazer o backfill em massa e tratar uma a uma, me avise antes de aprovar — caso contrário aplico tudo.

## Observações
- Reativar um usuário NÃO reativa automaticamente o `zapp_agents` (precisa ser manual via tela de gestão), evitando reativações acidentais.
- O bloqueio é em DB, então qualquer canal (UI, edge function, integração) respeita.
- Sem mudança de frontend necessária — a UI de seleção de agente já filtra por `is_active = true`.
