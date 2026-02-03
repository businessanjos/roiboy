
# Plano: Criar Constraint Única para Evitar Duplicatas

## Diagnóstico Final

Existem **9 pares de conversas duplicadas** no setor Vendas:
- **6 casos**: conversa legada (NULL) + conversa nova (com integration_id)
- **3 casos**: duas conversas com integration_ids diferentes (permitido - instâncias diferentes)

O problema específico da Monick (`+5575991258078`) é do tipo 1: uma conversa legada + uma nova.

### Índice Atual

O índice único existente:
```sql
CREATE UNIQUE INDEX zapp_conversations_account_phone_integration_unique 
ON public.zapp_conversations (account_id, phone_e164, integration_id) 
WHERE ((is_group = false) AND (phone_e164 IS NOT NULL) AND (integration_id IS NOT NULL))
```

**Problema**: Só protege quando `integration_id IS NOT NULL`. Conversas legadas (NULL) não são cobertas.

---

## Solução em 2 Etapas

### Etapa 1: Limpar Duplicatas Existentes

Antes de criar a constraint, preciso eliminar as duplicatas existentes via uma migração SQL que:

1. Encontra pares de duplicatas (mesmo telefone + setor)
2. Move todas as mensagens para a conversa mais recente (que tem integration_id)
3. Deleta a conversa legada duplicada

```sql
-- Para cada duplicata do tipo legada + nova:
WITH duplicates AS (
  SELECT 
    c1.id as keep_id,      -- Conversa com integration_id (manter)
    c2.id as delete_id     -- Conversa legada (deletar)
  FROM zapp_conversations c1
  JOIN zapp_conversations c2 ON 
    c1.account_id = c2.account_id 
    AND c1.phone_e164 = c2.phone_e164
    AND c1.sector_id = c2.sector_id
    AND c1.is_group = false
    AND c2.is_group = false
    AND c1.integration_id IS NOT NULL
    AND c2.integration_id IS NULL
    AND c1.id != c2.id
)
-- 1. Mover mensagens
UPDATE zapp_messages SET zapp_conversation_id = d.keep_id
FROM duplicates d WHERE zapp_conversation_id = d.delete_id;

-- 2. Deletar assignments
DELETE FROM zapp_conversation_assignments 
WHERE zapp_conversation_id IN (SELECT delete_id FROM duplicates);

-- 3. Deletar conversas legadas duplicadas
DELETE FROM zapp_conversations 
WHERE id IN (SELECT delete_id FROM duplicates);
```

### Etapa 2: Criar Índice Único para Conversas Legadas

Adicionar um segundo índice único que proteja conversas sem integration_id:

```sql
-- Garantir uma conversa por telefone+setor quando integration_id é NULL
CREATE UNIQUE INDEX zapp_conversations_account_phone_sector_legacy_unique 
ON public.zapp_conversations (account_id, phone_e164, sector_id) 
WHERE (
  is_group = false 
  AND phone_e164 IS NOT NULL 
  AND integration_id IS NULL
);
```

Este índice garante que:
- Só pode existir **UMA** conversa legada (sem integration_id) por telefone + setor
- O índice existente continua garantindo uma conversa por telefone + integration_id

### Alternativa: Forçar migration de todas conversas legadas

Outra opção é migrar TODAS as conversas legadas para receberem o `integration_id` da primeira integração do setor:

```sql
-- Atualizar conversas legadas com o integration_id do setor
UPDATE zapp_conversations c
SET integration_id = (
  SELECT i.id FROM integrations i 
  WHERE i.sector_id = c.sector_id 
    AND i.status = 'connected'
  ORDER BY i.created_at ASC
  LIMIT 1
)
WHERE c.integration_id IS NULL
  AND c.is_group = false
  AND c.sector_id IS NOT NULL;
```

---

## Resumo das Modificações

| Tipo | Descrição |
|------|-----------|
| **Migração SQL** | Limpar duplicatas existentes + criar índice único para legadas |
| **Nenhum código** | Não precisa alterar código (índice protege no nível do banco) |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| Migração SQL | Limpar duplicatas + criar constraint `zapp_conversations_account_phone_sector_legacy_unique` |

---

## Benefícios

1. **Proteção no nível do banco** - impossível criar duplicatas mesmo com bugs no código
2. **Limpa duplicatas existentes** - resolve os 6 casos atuais
3. **Simples** - não requer mudanças de código
4. **Performático** - índice ajuda nas buscas por telefone+setor
