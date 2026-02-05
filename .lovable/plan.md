
# Correção: Erro de Upload de Arquivos nas Anotações do Negócio

## Problema Identificado

O erro ocorre porque a tabela `deal_activities` possui um **CHECK constraint** que limita os valores permitidos para a coluna `type`:

```sql
CHECK ((type = ANY (ARRAY['note', 'call', 'email', 'meeting', 'task', 'stage_change', 'status_change'])))
```

Os valores `"image"` e `"file"` que estamos tentando inserir **não estão incluídos** nessa lista.

---

## Solução

Atualizar o constraint para incluir os novos tipos `image` e `file`:

```sql
-- Remover constraint antigo
ALTER TABLE deal_activities DROP CONSTRAINT deal_activities_type_check;

-- Adicionar constraint atualizado com novos tipos
ALTER TABLE deal_activities ADD CONSTRAINT deal_activities_type_check 
CHECK (type = ANY (ARRAY['note', 'call', 'email', 'meeting', 'task', 'stage_change', 'status_change', 'image', 'file']));
```

---

## Mudança Necessária

| Tipo | Descrição |
|------|-----------|
| Migração SQL | Atualizar o CHECK constraint na tabela `deal_activities` para incluir `image` e `file` |

---

## Resultado Esperado

Após a migração:
- Upload de imagens funcionará corretamente
- Upload de documentos funcionará corretamente
- Novos tipos `image` e `file` serão aceitos na coluna `type`
