

## Corrigir tela de carregamento infinita

### Problema Identificado

A tela de carregamento infinita acontece porque os hooks de autenticacao e assinatura (`useAuth`, `useSubscriptionStatus`, `useCurrentUser`) fazem chamadas de rede ao backend SEM nenhum mecanismo de timeout. Se qualquer chamada travar (rede lenta, instabilidade do servidor), o estado `loading` nunca muda para `false` e a tela fica presa no "Carregando..." para sempre.

Alem disso, o hook `useAuth` usa um `initializedRef` que, em certas condicoes de remontagem do componente, pode impedir a re-inicializacao da sessao.

### Solucao

Adicionar timeouts de seguranca em 3 pontos criticos, garantindo que a tela de carregamento nunca fique presa por mais de 10 segundos:

### Alteracoes tecnicas

**1. `src/hooks/useAuth.tsx` - Adicionar timeout de seguranca**

- Adicionar um `setTimeout` de 10 segundos dentro do `useEffect` de inicializacao
- Se `loading` ainda for `true` apos 10s, forcar `setLoading(false)` com log de aviso
- Limpar o timeout no cleanup do effect
- Remover o `initializedRef` que pode causar problemas de re-inicializacao, substituindo por logica mais segura com a flag `mounted`

**2. `src/hooks/useSubscriptionStatus.tsx` - Adicionar timeout de seguranca**

- Adicionar um `setTimeout` de 8 segundos dentro do `useEffect` de verificacao
- Se `isLoading` ainda for `true` apos 8s, forcar `setStatus` com `isLoading: false` e `hasAccess: true` (fail open)
- Isso evita que chamadas sequenciais ao backend (super_admin check, user query, account query) travem a tela

**3. `src/hooks/useCurrentUser.tsx` - Adicionar timeout de seguranca**

- Adicionar um `setTimeout` de 10 segundos dentro do `useEffect` do `fetchUser`
- Se `loading` ainda for `true` apos 10s, forcar `setLoading(false)`
- Isso garante que paginas que dependem de `currentUser` (como Clients) nao fiquem presas

**4. `src/components/layout/AppLayout.tsx` - Adicionar timeout com botao de retry**

- Adicionar um estado `loadingTimeout` que ativa apos 12 segundos
- Quando ativado, exibir um botao "Tentar novamente" abaixo da mensagem de carregamento
- O botao recarrega a pagina (`window.location.reload()`)
- Isso da ao usuario uma saida mesmo se todos os outros timeouts falharem

### Resultado esperado

- Carregamento normal: sem mudanca visivel (tudo resolve em 1-3s)
- Rede lenta: apos 10s, o app para de esperar e tenta mostrar o conteudo (fail open)
- Falha total: apos 12s, aparece um botao "Tentar novamente" para o usuario recarregar

