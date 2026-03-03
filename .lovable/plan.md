

## Diagnóstico: Tela de Carregamento Infinita

### Causa Raiz Identificada

O problema é uma **cascata sequencial de carregamento** entre providers aninhados, onde cada um depende do anterior terminar antes de iniciar. O fluxo atual é:

```text
AuthProvider (até 10s timeout)
  └─ CurrentUserProvider (até 10s timeout)
       └─ PermissionsProvider (espera currentUser)
            └─ PlanLimitsProvider (espera currentUser)
                 └─ AppLayout (espera auth + subscription)
                      └─ useSubscriptionStatus (até 8s timeout)
                           └─ Faz 3 queries sequenciais ao DB
```

**Pior caso sem falha**: Auth (rede lenta) + CurrentUser + Subscription = facilmente 5-10s.
**Pior caso com falha**: Safety timeouts somam: 10s (auth) + 10s (currentUser) + 8s (subscription) = **até 28 segundos** antes de exibir qualquer coisa.

### Problemas Específicos

1. **`useAuth` lê `loading` no closure do timeout** (linha 27) — o `loading` capturado é sempre `true` (valor inicial). O timeout funciona, mas por coincidência. Se `setLoading(false)` for chamado antes e depois resetado (race condition com `onAuthStateChange`), o timeout pode não disparar.

2. **`useSubscriptionStatus` faz 3 queries sequenciais** (is_super_admin → users → accounts) — cada uma espera a anterior. Em rede instável, isso pode levar vários segundos.

3. **`CurrentUserProvider` não tem nenhum tratamento de erro para falha na query** — se a query ao DB falhar silenciosamente (e.g., timeout de rede), o `loading` fica `true` até o safety timeout de 10s.

4. **`PlanLimitsProvider` faz 8 queries em paralelo** (`Promise.all` com 6 counts + account + plan) — isso pode saturar conexões em redes lentas, atrasando tudo.

5. **Todos os providers rodam MESMO em rotas públicas** — `/auth`, `/home`, etc. não precisam de CurrentUser/Permissions/PlanLimits, mas os providers fazem queries ao DB mesmo sem usuário logado.

### Correções Propostas

#### 1. Reduzir timeouts de segurança
- `useAuth`: 10s → **5s**
- `useCurrentUser`: 10s → **5s**  
- `useSubscriptionStatus`: 8s → **5s**
- AppLayout retry button: 12s → **6s**

#### 2. Paralelizar queries no `useSubscriptionStatus`
Usar `Promise.all` para rodar `is_super_admin` + `users` ao mesmo tempo, em vez de sequencialmente.

#### 3. Adicionar tratamento de erro robusto no `useCurrentUser`
Se a query falhar, `setLoading(false)` imediatamente em vez de depender do timeout.

#### 4. Lazy-load providers pesados
Mover `PlanLimitsProvider` e `NotificationsProvider` para DENTRO do `AppLayout`, pois só são necessários quando autenticado. Isso evita queries desnecessárias em rotas públicas.

### Arquivos Alterados

- `src/hooks/useAuth.tsx` — reduzir timeout para 5s
- `src/hooks/useCurrentUser.tsx` — reduzir timeout para 5s, melhorar error handling
- `src/hooks/useSubscriptionStatus.tsx` — reduzir timeout para 5s, paralelizar queries
- `src/components/layout/AppLayout.tsx` — reduzir timeout do botão para 6s, mover providers pesados para dentro
- `src/App.tsx` — remover `PlanLimitsProvider` e `NotificationsProvider` do wrapper global (mover para AppLayout)

