

## Melhorias no fluxo de solicitacoes de acesso

### Resumo das mudancas

Tres melhorias no sistema de solicitacoes de acesso ao painel compartilhado:

1. **Limpeza automatica a cada 30 minutos** - Solicitacoes pendentes e recusadas com mais de 30 minutos sao removidas automaticamente. Acessos aprovados permanecem.
2. **Rate limit de 5 minutos por email** - Uma pessoa so pode solicitar acesso novamente apos 5 minutos da ultima solicitacao.
3. **Contagem de tentativas** - Quando alguem solicita novamente (apos 5 min), a entrada existente e atualizada com um contador, sem duplicar na lista.

### Alteracoes tecnicas

#### 1. Migracao de banco de dados

Adicionar coluna `request_count` (default 1) a tabela `insights_share_access_requests`:

```sql
ALTER TABLE public.insights_share_access_requests
  ADD COLUMN request_count integer NOT NULL DEFAULT 1;
```

Remover a constraint UNIQUE(share_id, email) nao e necessario pois o comportamento sera de upsert (atualizar a linha existente ao inves de criar nova).

#### 2. Edge Function `shared-dashboard/index.ts` (POST handler)

Antes de processar uma nova solicitacao:

**Cleanup**: Deletar solicitacoes pendentes ou recusadas com `created_at` mais antigo que 30 minutos:
```
DELETE FROM insights_share_access_requests
WHERE share_id = ? AND status IN ('pending', 'rejected')
AND created_at < now() - interval '30 minutes'
```

**Rate limit**: Se ja existe uma solicitacao deste email para este share com `created_at` nos ultimos 5 minutos, retornar erro 429 com mensagem "Aguarde 5 minutos para solicitar novamente".

**Re-solicitacao**: Se existe uma solicitacao antiga (> 5 min) pendente ou recusada, ao inves de criar nova, atualizar a existente: incrementar `request_count`, resetar `created_at` para `now()`, resetar `status` para `pending`. Se o status era `approved`, apenas retornar o status atual sem alterar.

#### 3. Frontend `ShareDashboardModal.tsx`

**fetchRequests**: Incluir `request_count` no select.

**Interface AccessRequest**: Adicionar campo `request_count: number`.

**Renderizacao**: Ao lado do email, se `request_count > 1`, exibir um texto sutil como "(3x)" indicando quantas vezes solicitou.

### Fluxo esperado

1. Visitante acessa link e insere email -> cria solicitacao (count=1)
2. Visitante tenta novamente em 2 min -> recebe mensagem "Aguarde 5 minutos"
3. Visitante tenta apos 5 min -> atualiza a mesma linha (count=2, created_at=now, status=pending)
4. Dono do painel ve: "joao@email.com (2x) - Aguardando"
5. Apos 30 min sem acao, solicitacoes pendentes/recusadas sao limpas automaticamente
6. Solicitacoes aprovadas nunca sao limpas

