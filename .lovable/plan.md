
# Diagnóstico: Vazamento de Grupos Entre Instâncias WhatsApp

## Problema Identificado

Grupos exclusivos da instância **Jonathan Marcato** estão aparecendo na instância **[COMERCIAL] Eternum Club**, mesmo que o número da Eternum não seja participante desses grupos.

---

## Análise Técnica

### Causa Raiz Confirmada

No arquivo `src/hooks/useZappData.tsx`, linha 1010, existe uma regra de exceção que **ignora o isolamento de instâncias para todos os grupos**:

```typescript
// Linha 1006-1010
// 3. It's a GROUP (groups are cross-integration by nature) ← COMENTÁRIO INCORRETO
const matchesIntegration = convIntegrationId === integrationId;
const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;

return matchesIntegration || isLegacySameSector || isGroup;  // ← PROBLEMA
```

A condição `|| isGroup` faz com que **qualquer grupo do mesmo setor** seja exibido em **todas as instâncias** daquele setor, independentemente de qual instância realmente participa do grupo.

### Por Que Isso Foi Implementado Assim?

O comentário sugere que a intenção era "grupos são cross-integration por natureza", mas isso está errado:
- O webhook já cria conversas de grupo **separadas por instância** (cada `integration_id` tem sua própria `zapp_conversation`)
- Se duas instâncias participam do mesmo grupo, cada uma terá seu próprio registro de conversa

### Dados do Banco Confirmam

| Grupo | integration_id | Instância |
|-------|---------------|-----------|
| Rafael/Vendas FIAT AUTO ARAPONGAS | `ac869d1d...` | Jonathan Marcato ✓ |
| Desafio Ano Novo, Pele Renovada | `ac869d1d...` | Jonathan Marcato ✓ |
| #216 Conquer | `ac869d1d...` | Jonathan Marcato ✓ |

Todos esses grupos têm `integration_id` do Jonathan, mas aparecem na Eternum devido à regra `|| isGroup`.

---

## Solução

### Mudança Necessária

Remover a exceção `|| isGroup` do filtro de isolamento de instâncias:

```typescript
// ANTES (linha 1010):
return matchesIntegration || isLegacySameSector || isGroup;

// DEPOIS:
return matchesIntegration || isLegacySameSector;
```

### Comportamento Após a Correção

| Cenário | Antes | Depois |
|---------|-------|--------|
| Grupo onde só Jonathan participa | Aparece em ambas ❌ | Aparece só no Jonathan ✓ |
| Grupo onde só Eternum participa | Aparece em ambas ❌ | Aparece só na Eternum ✓ |
| Grupo onde ambos participam | Aparece em ambas ✓ | Cada um vê sua própria conversa ✓ |
| Grupo legado sem integration_id | Aparece em ambas ✓ | Aparece em ambas (via isLegacySameSector) ✓ |

### Por Que Isso Não Quebra Grupos Compartilhados?

Quando **ambas** as instâncias participam do mesmo grupo:
1. O webhook cria **duas** `zapp_conversations` separadas (uma com cada `integration_id`)
2. Cada instância verá sua própria versão da conversa
3. A filtragem por `matchesIntegration` garantirá que cada uma veja a sua

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useZappData.tsx` | Remover `\|\| isGroup` da linha 1010 e atualizar comentário |

---

## Código da Correção

```typescript
// src/hooks/useZappData.tsx - Linhas 1003-1010

// Include conversation if:
// 1. It belongs to this exact integration, OR
// 2. It has no integration_id (legacy) but belongs to the same sector
// NOTE: Groups are NOT exempt - they follow the same isolation rules as direct messages
//       If two instances are in the same group, each will have its own zapp_conversation
const matchesIntegration = convIntegrationId === integrationId;
const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;

return matchesIntegration || isLegacySameSector;
```

---

## Resultado Esperado

1. **Grupos privados isolados**: Jonathan só verá grupos onde seu número participa
2. **Grupos compartilhados funcionam**: Se ambos participam do mesmo grupo, cada um vê sua própria conversa
3. **Legado preservado**: Grupos antigos sem `integration_id` continuam visíveis no setor
4. **Sem impacto em conversas individuais**: A lógica de isolamento para DMs permanece igual
