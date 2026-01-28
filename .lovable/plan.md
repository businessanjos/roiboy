
# Plano: Notificações Sonoras e Visuais no ROY zAPP

## Resumo
Implementar sistema de notificações para novas mensagens recebidas no ROY zAPP com:
- **Som "pop"** para mensagens em "Minhas" (conversas atribuídas ao agente)
- **Som "ding"** para mensagens na "Fila" (conversas sem agente)
- **Toast visual** com avatar, nome do contato, preview da mensagem, origem e botão "Ver chat"

---

## Arquivos a Criar

### 1. `src/hooks/useZappNotifications.tsx`
Hook centralizado para gerenciar notificações do Zapp:
- Controle de reprodução de áudio (pop vs ding)
- Lógica para determinar origem (Minhas/Fila)
- Validação: não notificar conversa atualmente selecionada
- Respeitar configuração de som habilitado

### 2. `src/components/royzapp/ZappNotificationToast.tsx`
Componente de toast customizado:
- Avatar do contato (iniciais como fallback)
- Nome do contato
- Preview da mensagem (truncado em ~50 caracteres)
- Badge colorido indicando origem: "Minhas" (verde) ou "Fila" (âmbar)
- Botão "Ver chat" que navega para a conversa
- Auto-dismiss após 5 segundos

### 3. `public/sounds/notification-pop.mp3`
Som curto (~0.3s) tipo "pop" suave para conversas em "Minhas"

### 4. `public/sounds/notification-ding.mp3`
Som curto (~0.5s) tipo "ding" mais perceptível para conversas na "Fila"

---

## Arquivos a Modificar

### 1. `src/hooks/useZappData.tsx`
Adicionar callback `onNewInboundMessage` que é chamado quando uma mensagem INBOUND chega:
- Extrair dados necessários: conversationId, contactName, messagePreview, agentId
- Passar para o hook de notificações

### 2. `src/pages/RoyZapp.tsx`
Integrar o hook `useZappNotifications`:
- Passar referência da conversa selecionada (para não notificar)
- Passar currentAgent.id (para determinar se é "Minhas" ou "Fila")
- Passar configuração soundEnabled
- Callback para selecionar conversa ao clicar no toast

### 3. `src/components/royzapp/index.ts`
Exportar o novo componente `ZappNotificationToast`

---

## Fluxo Técnico

```text
[Webhook] Mensagem INBOUND
     ↓
[Realtime] INSERT em zapp_messages
     ↓
[useZappData] Detecta nova mensagem
     ↓
[useZappNotifications] Verifica:
  ├─ Conversa selecionada? → Não notificar
  ├─ Som habilitado? → Tocar áudio
  └─ Determina origem (agent_id == null → Fila)
     ↓
[ZappNotificationToast] Exibe toast com:
  • Avatar + Nome
  • Preview da mensagem
  • Badge "Minhas" ou "Fila"
  • Botão "Ver chat"
```

---

## Layout do Toast

```text
┌────────────────────────────────────────────────┐
│  🔔 Nova mensagem                          ✕   │
│                                                │
│  [Avatar]  João Silva                          │
│            "Olá, preciso de ajuda com..."      │
│                                                │
│  🟢 Minhas                         [Ver chat]  │
└────────────────────────────────────────────────┘
```

Ou para Fila:
```text
│  🟡 Fila                           [Ver chat]  │
```

---

## Detalhes Técnicos

### Sons
Serão criados dois arquivos de áudio sintéticos leves (~5KB cada):
- **Pop**: Tom mais suave, frequência média (~440Hz), decay rápido
- **Ding**: Tom mais agudo (~880Hz), decay um pouco mais longo

### Reprodução de Áudio
```typescript
const playNotificationSound = (isQueue: boolean) => {
  if (!soundEnabled) return;
  const audio = new Audio(
    isQueue ? '/sounds/notification-ding.mp3' : '/sounds/notification-pop.mp3'
  );
  audio.volume = 0.5;
  audio.play().catch(() => {}); // Ignorar erros de autoplay
};
```

### Determinação da Origem
```typescript
const getMessageOrigin = (assignment: ConversationAssignment) => {
  // Se não tem agent_id ou agent_id diferente do atual → Fila
  if (!assignment.agent_id || assignment.agent_id !== currentAgentId) {
    return 'queue';
  }
  return 'mine';
};
```

### Validação (Não Notificar)
```typescript
const shouldNotify = (conversationId: string) => {
  // Não notificar se é a conversa atualmente selecionada
  if (selectedConversationId === conversationId) return false;
  // Não notificar se som está desabilitado (para áudio)
  return true;
};
```

---

## Resultado Esperado

1. Ao receber mensagem em conversa atribuída ao agente → Som "pop" + Toast com badge verde "Minhas"
2. Ao receber mensagem em conversa na fila → Som "ding" + Toast com badge âmbar "Fila"
3. Conversa selecionada → Sem notificação (usuário já está vendo)
4. Som desabilitado nas configurações → Apenas toast visual
5. Clicar em "Ver chat" → Navega para a conversa e seleciona ela

