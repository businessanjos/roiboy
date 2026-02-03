
# Plano: Detecção Proativa de Tokens Zoom Incompatíveis

## Situação Atual

Após a investigação minuciosa, identifiquei que:

1. **O erro já foi corrigido** - Ambos os usuários (Jonathan e João Ferrari) reconectaram suas contas e agora têm tokens válidos com os escopos corretos (`user:read:user meeting:write:meeting`)
2. **O código está funcionando** - Os escopos foram atualizados e o fluxo OAuth está correto
3. **Tokens expiram em 1 hora** - O Zoom tem tokens de curta duração, o que significa que o refresh automático é crucial

## Problema Identificado

O sistema atual só detecta tokens expirados **quando o usuário tenta criar uma reunião**. Se o refresh falhar, o usuário recebe um erro e precisa reconectar manualmente.

**Melhorias necessárias:**

1. Detectar tokens que podem ter problemas (user_email nulo, escopos antigos) **antes** de tentar criar reunião
2. Mostrar alerta proativo na UI de integrações
3. Melhorar logs para facilitar diagnóstico

---

## Modificações Propostas

### Arquivo 1: `src/components/integrations/IntegrationsContent.tsx`

Adicionar função para detectar tokens potencialmente problemáticos:

```typescript
// Verificar se token pode ter problemas (além de apenas expirado)
const hasTokenIssues = (integration: UserIntegration) => {
  // Token expirado
  if (isTokenExpired(integration)) return { type: 'expired', message: 'Sessão expirada' };
  
  // Sem email (indica problema no escopo user:read:user)
  if (!integration.user_email) return { type: 'incomplete', message: 'Conexão incompleta' };
  
  return null;
};
```

Atualizar a UI para mostrar alertas mais específicos:

```typescript
{zoomUserIntegration && (() => {
  const issue = hasTokenIssues(zoomUserIntegration);
  if (!issue) return null;
  
  return (
    <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
      <XCircle className="h-5 w-5 text-destructive" />
      <div className="flex-1">
        <p className="font-medium text-destructive">{issue.message}</p>
        <p className="text-sm text-muted-foreground">
          {issue.type === 'expired' 
            ? 'Reconecte sua conta Zoom para continuar criando reuniões.'
            : 'Sua conexão Zoom precisa ser reautorizada com as permissões corretas.'}
        </p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => handleOAuthConnect("zoom")}
        disabled={connectingProvider === "zoom"}
      >
        {connectingProvider === "zoom" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconectar
          </>
        )}
      </Button>
    </div>
  );
})()}
```

### Arquivo 2: `supabase/functions/create-meeting/index.ts`

Adicionar validação prévia antes de tentar usar o token:

```typescript
// Validar token antes de usar
if (!accessToken) {
  throw new Error("Zoom não conectado. Por favor, conecte sua conta Zoom em Configurações → Integrações.");
}

// Verificar se token parece válido (não vazio, tem formato esperado)
if (accessToken.length < 20) {
  throw new Error("Token Zoom inválido. Por favor, reconecte sua conta em Configurações → Integrações.");
}
```

Melhorar logs para diagnóstico:

```typescript
console.log(`Zoom token status: expires_at=${expiresAt}, now=${now}, needs_refresh=${expiresAt < now + 300}`);
```

---

## Fluxo Proposto

```text
┌────────────────────────────────────────────────────────────────┐
│           FLUXO DE DETECÇÃO PROATIVA                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   1. Usuário acessa Configurações → Integrações                │
│                                                                │
│   2. Sistema verifica integrações do usuário:                  │
│      ┌──────────────────────────────────────┐                  │
│      │ hasTokenIssues(zoomIntegration)      │                  │
│      │   - Token expirado?                  │                  │
│      │   - user_email nulo?                 │                  │
│      │   - Escopos incompatíveis?           │                  │
│      └──────────────────────────────────────┘                  │
│                                                                │
│   3. Se houver problema → Mostra alerta + botão Reconectar     │
│                                                                │
│   4. Usuário reconecta → Novos tokens com escopos corretos     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/integrations/IntegrationsContent.tsx` | Adicionar `hasTokenIssues()` para detectar tokens problemáticos e exibir alertas específicos |
| `supabase/functions/create-meeting/index.ts` | Adicionar logs de diagnóstico e validação prévia de token |

---

## Benefícios

1. **Detecção proativa** - Usuários veem problemas antes de tentar criar reunião
2. **Mensagens claras** - Diferentes tipos de problema têm mensagens específicas
3. **Menos frustração** - Botão de reconexão visível e acessível
4. **Diagnóstico facilitado** - Logs mais detalhados para depuração

---

## Nota Importante

Atualmente, **ambos os usuários já têm tokens válidos** após reconectarem. Este plano adiciona camadas de proteção para evitar problemas futuros quando tokens expirarem ou se tornarem inválidos.
