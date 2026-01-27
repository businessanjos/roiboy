
# Plano: Corrigir Truncamento de Nomes de Grupos na Busca

## Diagnóstico do Problema

### A Busca Está Funcionando!

Os logs do console confirmam que a busca está **funcionando corretamente**:

```
[SearchContacts] Query term: henrique & leticia
[SearchContacts] Groups result: {
  "count": 1,
  "data": [{
    "id": "d2310d91-50ad-4d02-824b-de05e103e3d1",
    "name": "Henrique & Leticia - Eternum Club ♾️🪽",
    "sector": "diretoria"
  }]
}
```

### O Problema Real: Truncamento Excessivo

A função `formatName()` no componente `ZappNewConversationDialog.tsx` está truncando o nome do grupo de forma muito agressiva:

| Original | Exibido | Motivo |
|----------|---------|--------|
| "Henrique & Leticia - Eternum Club ♾️🪽" | "Henrique ♾️🪽" | `maxLength = 22` + lógica de abreviação |

A lógica atual:
1. Divide o nome por espaços: `["Henrique", "&", "Leticia", "-", "Eternum", "Club", "♾️🪽"]`
2. Pega `firstName = "Henrique"` e `lastName = "♾️🪽"` (última "palavra")
3. Combina: `"Henrique ♾️🪽"` - perdendo completamente "Leticia", "Eternum", "Club"

### Por Que o Usuário Não Reconhece

Na screenshot, o usuário vê "Henrique ∞ 🪽" (os emojis) e não consegue identificar que esse É o grupo "Henrique & Leticia - Eternum Club" que está procurando.

## Solução Proposta

### Opção 1: Aumentar maxLength para Grupos

Passar um `maxLength` maior para grupos (ex: 40 caracteres) para mostrar mais contexto.

### Opção 2: Não Truncar Nomes de Grupos

Para grupos, evitar a lógica de abreviação agressiva e simplesmente usar truncamento com ellipsis:

```typescript
// Para grupos, truncar com ellipsis ao invés de abreviar
if (isGroup) {
  return name.length > maxLength ? name.slice(0, maxLength - 3) + '...' : name;
}
```

### Opção 3 (Recomendada): Ajustar formatName para Grupos

Passar o tipo de contato para a função e ajustar o comportamento:

```typescript
const formatName = (name: string, type?: string, maxLength: number = 22): string => {
  // Para grupos, usar limite maior e truncar com ellipsis
  const effectiveMaxLength = type === 'group' ? 40 : maxLength;
  
  if (!name || name.length <= effectiveMaxLength) return name || '';
  
  // Para grupos, apenas truncar com ellipsis
  if (type === 'group') {
    return name.slice(0, effectiveMaxLength - 3) + '...';
  }
  
  // Lógica existente para pessoas...
};
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/royzapp/dialogs/ZappNewConversationDialog.tsx` | Ajustar `formatName` para tratar grupos de forma diferente |

## Detalhes Técnicos

### Modificação em ZappNewConversationDialog.tsx

**1. Alterar a assinatura de formatName:**

```typescript
const formatName = (name: string, type?: string, maxLength: number = 22): string => {
  const effectiveMaxLength = type === 'group' ? 40 : maxLength;
  
  if (!name || name.length <= effectiveMaxLength) return name || '';
  
  // Para grupos, usar truncamento simples com ellipsis
  if (type === 'group') {
    return name.slice(0, effectiveMaxLength - 3) + '...';
  }
  
  // Lógica existente para pessoas (firstName + middleInitials + lastName)
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  // ... resto da lógica atual
};
```

**2. Atualizar a chamada no JSX:**

```tsx
<span className="text-[#e9edef] font-medium whitespace-nowrap">
  {formatName(client.full_name, client.type)}
</span>
```

## Resultado Esperado

Antes:
- "Henrique ♾️🪽" (confuso, usuário não reconhece)

Depois:
- "Henrique & Leticia - Eternum Club ♾️🪽" (completo, se couber)
- ou "Henrique & Leticia - Eternum Cl..." (truncado com ellipsis, reconhecível)

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│           FORMATAÇÃO DE NOMES - GRUPOS                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nome Original: "Henrique & Leticia - Eternum Club ♾️🪽"    │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ formatName(name, type='group', maxLength=22)         │  │
│  │                                                      │  │
│  │ → type === 'group' ? effectiveMaxLength = 40        │  │
│  │ → Truncar com ellipsis se > 40 chars                │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  Exibido: "Henrique & Leticia - Eternum Club ♾️🪽"         │
│  (nome completo cabe em 40 chars)                          │
│                                                             │
│  OU se fosse maior:                                         │
│  Exibido: "Henrique & Leticia - Eternum Cl..."             │
│  (reconhecível mesmo truncado)                              │
└─────────────────────────────────────────────────────────────┘
```

## Benefícios

| Aspecto | Descrição |
|---------|-----------|
| **Reconhecibilidade** | Usuário consegue identificar o grupo correto |
| **Contexto Preservado** | Mostra "Leticia", "Eternum Club" que são identificadores importantes |
| **Backward Compatible** | Pessoas continuam com a lógica de abreviação existente |
| **Flexibilidade** | Grupos têm mais espaço por serem identificados diferentemente |
