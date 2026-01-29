

# Plano: Garantir Acesso Irrestrito para Equipe Anjos Business

## Problema Identificado

A conta da Maria (e toda a equipe Anjos Business) está sendo bloqueada pela lógica de verificação de assinatura no `useSubscriptionStatus.tsx`. A conta tem:
- `subscription_status: "trial"` 
- `trial_ends_at: null` (sem data de expiração)
- `payment_method_configured: false`

A lógica atual exige que usuários em trial tenham `payment_method_configured = true`, o que bloqueia a Maria e outros membros da equipe.

## Solução Proposta

Modificar a lógica de `useSubscriptionStatus` para dar acesso completo quando a conta não tiver data de expiração de trial definida (`trial_ends_at = null`). Isso funciona como um "trial infinito" para contas de desenvolvimento/internas.

## Alterações Técnicas

### Arquivo: `src/hooks/useSubscriptionStatus.tsx`

**Modificar a lógica de verificação de acesso (linhas 87-97):**

De:
```typescript
const paidStatuses = ["active", "paid", "trialing", "pending"];
const hasActiveSubscription = paidStatuses.includes(account.subscription_status || "");

// For trial users: must have payment method configured to access
const isInTrial = account.subscription_status === "trial" && !isTrialExpired;
const trialWithPayment = isInTrial && account.payment_method_configured;

const hasAccess = hasActiveSubscription || trialWithPayment;
```

Para:
```typescript
const paidStatuses = ["active", "paid", "trialing", "pending"];
const hasActiveSubscription = paidStatuses.includes(account.subscription_status || "");

// Trial logic
const isInTrial = account.subscription_status === "trial";

// Grant access if:
// 1. Has active subscription (active, paid, trialing, pending)
// 2. Trial with no expiration date set (internal/dev accounts)
// 3. Trial not expired and has payment method configured
const hasUnlimitedTrial = isInTrial && !trialEndsAt; // No expiration = unlimited trial
const hasValidTrial = isInTrial && !isTrialExpired && account.payment_method_configured;

const hasAccess = hasActiveSubscription || hasUnlimitedTrial || hasValidTrial;
```

## Justificativa da Solução

1. **Retrocompatibilidade**: Contas normais com `trial_ends_at` definido continuam funcionando como antes
2. **Flexibilidade**: Contas internas/dev podem ter `trial_ends_at = null` para acesso permanente
3. **Sem necessidade de migração**: Apenas alteração de lógica no código
4. **Segurança**: Não cria brechas - apenas contas configuradas especificamente com `trial_ends_at = null` terão esse benefício

## Comportamento Esperado

| Cenário | `subscription_status` | `trial_ends_at` | `payment_method` | `hasAccess` |
|---------|----------------------|-----------------|------------------|-------------|
| Conta Anjos Business | trial | null | false | ✅ TRUE |
| Cliente novo em trial | trial | 2026-02-05 | false | ❌ FALSE |
| Cliente trial com cartão | trial | 2026-02-05 | true | ✅ TRUE |
| Cliente trial expirado | trial | 2026-01-01 | false | ❌ FALSE |
| Cliente pagante | active | null | true | ✅ TRUE |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSubscriptionStatus.tsx` | Adicionar lógica de "trial ilimitado" quando `trial_ends_at = null` |

## Resultado Esperado

1. Maria e toda equipe Anjos Business terão acesso imediato
2. A tela de carregamento infinito será resolvida
3. Clientes futuros em trial normal continuarão com as regras de negócio existentes
4. Não há necessidade de alterar dados no banco

