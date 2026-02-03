
# Plano: Corrigir Duplicação de Conversas no ROY zAPP

## ✅ IMPLEMENTADO

### Problema Identificado

Conversas legadas (criadas antes do sistema multi-instância) não possuem `integration_id`, causando duplicação quando o usuário envia mensagens para contatos existentes.

### Solução Aplicada

Adicionado fallback para buscar conversas legadas em 3 locais:

1. **`createConversationWithContact`** (linha ~3214)
2. **`createConversationFromUrl`** (linha ~346)  
3. **`uazapi-webhook`** (linha ~847)

### Fluxo Corrigido

```
1. Busca conversa por phone + integration_id
   └── Encontrou? → Usa essa conversa ✓

2. [NOVO] Se não encontrou, busca por phone + sector_id + integration_id IS NULL
   └── Encontrou conversa legada?
       ├── SIM: Atualiza integration_id + Usa essa conversa ✓
       └── NÃO: Cria nova conversa
```

### Benefícios
- Elimina duplicação de conversas
- Migração on-demand das 116 conversas legadas
- Preserva todo o histórico de mensagens
