
# Plano: Permitir Finalização de Grupos Normalmente

## Objetivo

Reverter a lógica que impedia grupos de serem finalizados (ocultados quando status = "closed"). Os grupos passarão a seguir o mesmo comportamento de conversas individuais.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/RoyZapp.tsx` | Remover exceção `!isGroup` no filtro de conversas fechadas |
| `src/components/royzapp/ZappConversationList.tsx` | Remover exceção `!isGroup` no filtro de conversas fechadas |

## Alterações Técnicas

### 1. RoyZapp.tsx (linhas 2988-2992)

**Código Atual:**
```typescript
} else if (filterStatus === "all") {
  // When showing "all", hide closed INDIVIDUAL conversations
  // But ALWAYS keep groups visible - they are permanent, not tickets
  if (isClosed && !isGroup) return false;
}
```

**Código Novo:**
```typescript
} else if (filterStatus === "all") {
  // When showing "all", hide closed conversations
  if (isClosed) return false;
}
```

### 2. ZappConversationList.tsx (linhas 89-93)

**Código Atual:**
```typescript
} else {
  // When not showing closed, HIDE closed conversations
  // EXCEPTION: Groups are always visible (they're permanent, not tickets)
  if (isClosed && !isGroup) return false;
}
```

**Código Novo:**
```typescript
} else {
  // When not showing closed, HIDE closed conversations
  if (isClosed) return false;
}
```

## Resultado

- Grupos poderão ser finalizados normalmente
- Grupos finalizados serão ocultados da lista principal (como conversas individuais)
- Grupos finalizados aparecerão ao usar o filtro "Finalizados"
- Comportamento unificado entre grupos e conversas individuais
