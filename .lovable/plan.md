
# Plano: Corrigir Sincronização de Estado de Permissão de Notificações

## Problema Identificado

O estado `notificationPermission` no hook `useZappNotifications` é inicializado apenas uma vez quando o componente monta. Se o usuário muda a permissão diretamente nas configurações do navegador (pelo ícone de cadeado), **o aplicativo não detecta essa mudança** e continua exibindo "Bloqueadas" mesmo após a permissão ser concedida.

### Código Atual (Problemático)
```typescript
// Inicialização única - não atualiza quando permissão muda externamente
const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionStatus>(() => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotificationPermissionStatus;
});

useEffect(() => {
  // Executa APENAS uma vez (array vazio)
  setNotificationPermission(Notification.permission as NotificationPermissionStatus);
}, []);
```

---

## Solução Proposta

Adicionar um listener para o evento `visibilitychange` do documento. Quando o usuário volta à aba (após mudar configurações no navegador), o hook re-verifica a permissão atual.

### Modificação: `src/hooks/useZappNotifications.tsx`

**Antes:**
```typescript
useEffect(() => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    setNotificationPermission("unsupported");
    return;
  }
  setNotificationPermission(Notification.permission as NotificationPermissionStatus);
}, []);
```

**Depois:**
```typescript
// Re-verificar permissão quando a aba volta ao foco
// Isso captura mudanças feitas pelo usuário nas configurações do navegador
useEffect(() => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    setNotificationPermission("unsupported");
    return;
  }
  
  // Verificar imediatamente
  setNotificationPermission(Notification.permission as NotificationPermissionStatus);
  
  // Re-verificar quando a aba volta ao foco (usuário pode ter mudado nas configs)
  const handleVisibilityChange = () => {
    if (!document.hidden && "Notification" in window) {
      setNotificationPermission(Notification.permission as NotificationPermissionStatus);
    }
  };
  
  // Re-verificar quando a janela ganha foco
  const handleFocus = () => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission as NotificationPermissionStatus);
    }
  };
  
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
  };
}, []);
```

---

## Fluxo Após a Correção

```text
┌─────────────────────────────────────────────────────────┐
│ 1. Usuário abre ROY zAPP                                │
│    → Permissão lida: "denied" ou "default"              │
│    → UI mostra "Bloqueadas" ou "Ativar"                 │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Usuário clica no cadeado do navegador                │
│    → Muda permissão para "Permitir"                     │
│    (aplicativo não sabe ainda)                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Usuário volta à aba do ROY zAPP                      │
│    → Evento "focus" ou "visibilitychange" dispara       │
│    → Hook re-lê: Notification.permission = "granted"    │
│    → UI atualiza para "Ativadas" ✅                     │
└─────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Muda permissão pelo cadeado | Fica "Bloqueadas" até dar refresh | Atualiza automaticamente ao voltar à aba |
| Abre configurações do navegador | Precisa recarregar página | Sincroniza ao focar na janela |
| Concede permissão pelo botão "Ativar" | Funciona | Continua funcionando |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useZappNotifications.tsx` | Adicionar listeners para `visibilitychange` e `focus` |

---

## Considerações Técnicas

1. **Performance**: Os listeners são leves e só fazem uma leitura simples de `Notification.permission`
2. **Cleanup**: Os listeners são removidos corretamente quando o componente desmonta
3. **Compatibilidade**: Ambos os eventos (`visibilitychange` e `focus`) são suportados em todos os navegadores modernos
4. **Redundância intencional**: Usamos dois eventos porque alguns navegadores/cenários podem não disparar um ou outro
