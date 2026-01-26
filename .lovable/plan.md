
# Plano: Habilitar Edição de Mensagens no ROY zAPP

## Diagnóstico do Problema

A funcionalidade de editar mensagens está **parcialmente implementada** mas não funciona porque faltam duas conexões críticas:

| Componente | Status | Problema |
|------------|--------|----------|
| `handleEditMessage` em RoyZapp.tsx | ✅ Implementado (linha 1981-2040) | - |
| `onEditMessage` prop em ZappChatView | ✅ Definido | **NÃO está sendo passado** (linha 3386) |
| `is_edited` na Message interface | ❌ Faltando | Não declarado na interface |
| `is_edited` no fetch de mensagens | ❌ Faltando | Não busca/mapeia do banco |
| UI de edição em ZappMessageBubble | ✅ Implementado | Funciona, mas depende das correções |

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO ATUAL (QUEBRADO)                                │
└────────────────────────────────────────────────────────────────────────────┘

   RoyZapp.tsx                     ZappChatView.tsx                ZappMessageBubble.tsx
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│ handleEditMessage│              │ onEditMessage   │              │ onEdit prop     │
│ (implementado)  │──────✗───────│ (não recebe)    │──────?───────│ (undefined)     │
└─────────────────┘              └─────────────────┘              └─────────────────┘
       │                                                                  │
       │        Conexão faltando!                                        │
       │                                                                  │
       └────────────────────────── Ícone ✏️ nunca aparece ───────────────┘


   useZappData.tsx                                    ZappMessageBubble.tsx
┌─────────────────┐                                ┌─────────────────┐
│ Message interface│                               │ message.is_edited│
│ SEM is_edited   │─────────────────────✗──────────│ (undefined)     │
└─────────────────┘                                └─────────────────┘
       │
       │  fetchMessages() não busca is_edited
       │
       └─────────── Indicador "(editado)" nunca aparece
```

---

## Solução Proposta

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO CORRIGIDO                                       │
└────────────────────────────────────────────────────────────────────────────┘

   RoyZapp.tsx                     ZappChatView.tsx                ZappMessageBubble.tsx
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│ handleEditMessage│──────✓──────│ onEditMessage   │──────✓───────│ onEdit prop     │
│ (implementado)  │   CONECTAR  │ (recebe)        │              │ (funciona!)     │
└─────────────────┘              └─────────────────┘              └─────────────────┘
                                                                         │
                                                                         ▼
                                                            ┌─────────────────────┐
                                                            │ Usuário clica ✏️    │
                                                            │ → Abre modo edição  │
                                                            │ → Salva no WhatsApp │
                                                            │ → Salva no banco    │
                                                            │ → Mostra "(editado)"│
                                                            └─────────────────────┘


   useZappData.tsx                                    ZappMessageBubble.tsx
┌─────────────────┐                                ┌─────────────────┐
│ Message interface│                               │ message.is_edited│
│ COM is_edited   │─────────────────────✓──────────│ = true/false    │
└─────────────────┘                                └─────────────────┘
       │
       │  fetchMessages() busca e mapeia is_edited
       │
       └─────────── Indicador "(editado)" aparece corretamente
```

---

## Etapa 1: Adicionar `is_edited` à Interface Message

Atualizar a interface para incluir o campo:

```typescript
// src/hooks/useZappData.tsx
export interface Message {
  // ... campos existentes ...
  is_edited?: boolean;           // ← ADICIONAR
  // ...
}
```

---

## Etapa 2: Buscar `is_edited` no fetchMessages

Atualizar a query SELECT e o mapeamento:

```typescript
// Na query SELECT (linha ~560):
.select("..., is_edited, ...")

// No mapeamento (linha ~572):
const msgs = reversedData.map((m: any) => ({
  // ... campos existentes ...
  is_edited: m.is_edited || false,   // ← ADICIONAR
  // ...
}));
```

---

## Etapa 3: Conectar `handleEditMessage` ao ZappChatView

Adicionar a prop faltante na chamada do componente:

```typescript
// src/pages/RoyZapp.tsx (após linha 3386)
onDeleteMessage={handleDeleteMessage}
onEditMessage={handleEditMessage}    // ← ADICIONAR
onRetryMessage={(msg) => {...}}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useZappData.tsx` | Adicionar `is_edited` à interface Message e incluir no fetch/mapping |
| `src/pages/RoyZapp.tsx` | Passar `onEditMessage={handleEditMessage}` ao ZappChatView |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Passar mouse sobre mensagem própria (< 15 min) | Sem ícone de editar | Aparece ícone ✏️ |
| Clicar no ícone ✏️ | Nada acontece | Abre modo de edição inline |
| Salvar edição | - | Atualiza WhatsApp + banco + mostra "(editado)" |
| Mensagem já editada anteriormente | Não mostra indicador | Mostra "(editado)" ao lado do horário |
| Mensagem > 15 minutos | - | Ícone ✏️ não aparece (limite do WhatsApp) |

---

## Detalhes da Implementação

### Regras de Edição (já implementadas no ZappMessageBubble)

O componente `ZappMessageBubble` já possui a lógica `canEdit` (linhas 193-204):

- Apenas mensagens **de saída** (não do cliente)
- Apenas mensagens de **texto** (sem mídia)
- Apenas mensagens enviadas há **menos de 15 minutos** (limite do WhatsApp)
- Mensagem **não pode ser temporária** (temp-)

### Fluxo de Edição (já implementado no handleEditMessage)

1. Tenta editar via UAZAPI (`POST /message/edit`)
2. Atualiza no banco (`zapp_messages.content`, `is_edited`, `updated_at`)
3. Atualiza estado local para refletir imediatamente
4. Exibe toast de confirmação

A funcionalidade completa já existe - apenas precisa ser **conectada**.
