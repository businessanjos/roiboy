
# Plano: Notificações Push do Sistema para ROY zAPP

## Objetivo
Implementar notificações nativas do sistema operacional (Web Notifications API) para que alertas sonoros e visuais apareçam mesmo quando:
- O navegador está minimizado
- O usuário está em outra aba
- A janela do ROY zAPP não está em foco

---

## Funcionalidade Atual vs. Proposta

| Cenário | Atual | Após Implementação |
|---------|-------|-------------------|
| Aba do ROY zAPP ativa | ✅ Toast + Som | ✅ Toast + Som |
| Aba do ROY zAPP em background | ❌ Nada visível | ✅ **Push nativo + Som** |
| Navegador minimizado | ❌ Nada | ✅ **Push nativo + Som** |
| Outro programa em foco | ❌ Nada | ✅ **Push nativo** |

---

## Arquivos a Modificar

### 1. `src/hooks/useZappNotifications.tsx`

**Adicionar:**
- Função `showSystemNotification()` usando a Web Notifications API
- Estado `notificationPermission` para rastrear permissão
- Função `requestNotificationPermission()` para solicitar permissão
- Lógica para detectar se a aba está ativa (`document.hidden`)
- Mostrar push nativo quando a aba não está em foco

**Comportamento:**
```
Se aba ativa:
  → Toast customizado + Som
Se aba em background ou navegador minimizado:
  → Notificação push do sistema + Som
```

### 2. `src/pages/RoyZapp.tsx`

**Adicionar:**
- Botão/indicador de permissão de notificações no painel de configurações
- Chamada para solicitar permissão quando necessário

### 3. `src/components/royzapp/ZappSettingsPanel.tsx`

**Adicionar:**
- Toggle ou botão para ativar notificações push do sistema
- Indicador de status da permissão (concedida/negada/não solicitada)

---

## Detalhes Técnicos

### Fluxo de Notificação Melhorado

```text
[Nova mensagem INBOUND]
       ↓
[useZappNotifications.notifyNewMessage()]
       ↓
   ┌───────────────────────────────────┐
   │ Verificações:                     │
   │ • É a conversa selecionada? Skip  │
   │ • Rate limit (2s)? Skip           │
   └───────────────────────────────────┘
       ↓
   ┌───────────────────────────────────┐
   │ document.hidden?                  │
   │ (aba não está em foco)            │
   └───────────────────────────────────┘
       ↓                    ↓
      SIM                  NÃO
       ↓                    ↓
[Push Sistema]      [Toast in-app]
       ↓                    ↓
   [Tocar Som]         [Tocar Som]
```

### Código da Notificação Push

```typescript
const showSystemNotification = (title: string, body: string, data: any) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  
  const notification = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `zapp-${data.conversationId}`, // Agrupa notificações do mesmo chat
    requireInteraction: false, // Fecha automaticamente
  });
  
  notification.onclick = () => {
    window.focus();
    onViewChat(data.conversationId);
    notification.close();
  };
  
  // Auto-close após 5 segundos
  setTimeout(() => notification.close(), 5000);
};
```

### Detecção de Visibilidade da Aba

```typescript
const isTabVisible = () => {
  return !document.hidden;
};

// No notifyNewMessage:
if (isTabVisible()) {
  // Mostrar toast customizado (comportamento atual)
  toast.custom(...);
} else {
  // Mostrar notificação push do sistema
  showSystemNotification(
    `Nova mensagem${isQueue ? " (Fila)" : ""}`,
    `${contactName}: "${messagePreview}"`,
    { conversationId }
  );
}
```

### Solicitação de Permissão

```typescript
const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  
  const permission = await Notification.requestPermission();
  return permission;
};
```

---

## Interface do Usuário

### No Painel de Configurações (ZappSettingsPanel)

```text
┌─────────────────────────────────────────────────┐
│ 🔔 Notificações                                 │
├─────────────────────────────────────────────────┤
│ ○ Som de notificação              [Toggle ON]  │
│ ○ Notificações do sistema         [Ativar]     │
│   └─ Receba alertas mesmo com o navegador      │
│      minimizado ou em outra aba                │
│                                                 │
│   Status: ✅ Ativadas / ❌ Bloqueadas / ⚠️ Pendente │
└─────────────────────────────────────────────────┘
```

---

## Considerações

### Limitações do Navegador
- O usuário precisa conceder permissão explícita
- Alguns navegadores móveis têm restrições adicionais
- Modo anônimo pode bloquear notificações

### Comportamento por Status de Permissão

| Status | Comportamento |
|--------|---------------|
| `granted` | Push nativo funciona |
| `denied` | Apenas toast in-app (já implementado) |
| `default` | Mostra botão para solicitar permissão |

### Som em Background
- Navegadores modernos permitem reprodução de áudio em background
- O áudio será tocado mesmo com a aba inativa
- Apenas pode ser bloqueado se o usuário nunca interagiu com a página

---

## Resultado Esperado

1. **Aba ativa**: Toast customizado verde/âmbar + som (comportamento atual)
2. **Aba em background**: Push nativo do sistema + som
3. **Navegador minimizado**: Push nativo aparece no canto da tela + som
4. **Permissão negada**: Fallback para comportamento atual (toast quando voltar à aba)
5. **Clicar na notificação**: Abre/foca a aba e seleciona a conversa

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useZappNotifications.tsx` | Adicionar Web Notifications API e detecção de visibilidade |
| `src/pages/RoyZapp.tsx` | Integrar permissão de notificações |
| `src/components/royzapp/ZappSettingsPanel.tsx` | Adicionar toggle/botão de permissão |
