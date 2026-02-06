

# Plano: Correção da Automação de Onboarding para Conversão de Leads

## Diagnóstico do Problema

A automação de criação de eventos e tarefas de onboarding para novos clientes convertidos de leads **está falhando silenciosamente** desde ~21 de janeiro de 2026.

### Causa Raiz: Coluna Inexistente

O arquivo `src/utils/clientOnboardingAutomation.ts` tenta inserir na coluna `created_by` da tabela `events`, porém essa coluna **não existe** no schema atual:

```typescript
// ❌ Código atual (linha 32)
const { data: event, error: eventError } = await supabase
  .from("events")
  .insert({
    account_id: accountId,
    title: "Onboarding",
    ...
    created_by: userId,  // <-- COLUNA NÃO EXISTE!
  })
```

**Resultado:**
- O Supabase retorna erro ao tentar inserir
- O código lança `throw eventError` (linha 39)
- O fluxo é interrompido, impedindo a criação de tarefas
- Como o catch no `SalesPipeline.tsx` (linha 438-441) apenas loga o erro e continua, o usuário nunca percebe

### Evidências

| Dado | Valor |
|------|-------|
| Eventos "Onboarding" na conta | 1 (criado em 21/01/2026) |
| Clientes com `onboarding_tasks_count = 0` após 01/02 | 90%+ |
| Tarefas de onboarding existentes | Criadas manualmente por usuários (Maria, Dayara, etc.) |

---

## Solução

### Opção Escolhida: Remover o campo inexistente

Remover a referência a `created_by` da inserção, já que:
1. O campo não existe na tabela `events`
2. Não há necessidade crítica de rastrear quem criou o evento automaticamente (é sempre o sistema via conversão de deal)

### Modificação: `src/utils/clientOnboardingAutomation.ts`

```diff
   // STEP 1: Create "Onboarding" event
   const { data: event, error: eventError } = await supabase
     .from("events")
     .insert({
       account_id: accountId,
       title: "Onboarding",
       description: "Onboarding Inicial",
       event_type: "live",
       modality: "online",
       scheduled_at: null,
       category: "operation",
-      created_by: userId,
     })
     .select("id")
     .single();
```

---

## Resumo

| Local | Linha | Ação |
|-------|-------|------|
| `src/utils/clientOnboardingAutomation.ts` | 32 | Remover campo `created_by` |

---

## Impacto

Após a correção:
1. Novos negócios marcados como "Ganhados" criarão automaticamente:
   - 1 evento "Onboarding" com o cliente como participante
   - 2 tarefas: "Implementação da Clínica Ryka" e "Apresentação do Plano de Ação"

2. Clientes que não receberam o onboarding (Ariella Duarte, Thais Flora, etc.) precisarão ter os itens criados manualmente ou por um script de correção posterior.

---

## Considerações Adicionais

**Opção futura (não implementada agora):** 
Se for necessário rastrear quem criou eventos automaticamente, uma migração pode adicionar a coluna `created_by` à tabela `events` com referência a `users.id`. Isso é uma melhoria opcional e não bloqueia a correção atual.

