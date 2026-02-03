
# Plano: Corrigir Overflow do Botão "Transferir"

## Problema Identificado

Na imagem, o botão "Transferir" está vazando para fora do container de detalhes do negócio. Isso ocorre porque a linha onde estão o responsável, "Mesclar" e "Transferir" não possui controle adequado de overflow.

## Análise do Código Atual

```typescript
// Linha 770-810
<div className="flex items-center gap-2">  // ← Sem overflow-hidden
  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  <span className="text-xs text-muted-foreground min-w-[50px]">Resp.</span>
  <div className="flex items-center gap-2 flex-1">  // ← O nome expande
    {/* Avatar + Nome */}
  </div>
  {!isClosed && (
    <div className="flex items-center gap-1">  // ← Botões sem flex-shrink-0
      <Button>Mesclar</Button>
      <Button>Transferir</Button>  // ← Vaza para fora!
    </div>
  )}
</div>
```

## Modificação Proposta

### Arquivo: `src/components/sales/DealDetailSheet.tsx`

**Linha 770:** Adicionar `overflow-hidden` ao container principal para evitar vazamento.

**Linha 789:** Adicionar `flex-shrink-0` aos botões para que não sejam comprimidos mas também não vazem.

**De:**
```typescript
<div className="flex items-center gap-2">
```

**Para:**
```typescript
<div className="flex items-center gap-2 overflow-hidden">
```

**De (linha 789):**
```typescript
<div className="flex items-center gap-1">
```

**Para:**
```typescript
<div className="flex items-center gap-1 flex-shrink-0">
```

Também reduzir o `min-w-[50px]` do label "Resp." para `min-w-[40px]` para dar mais espaço.

## Resumo das Alterações

| Linha | Antes | Depois |
|-------|-------|--------|
| 770 | `flex items-center gap-2` | `flex items-center gap-2 overflow-hidden` |
| 772 | `min-w-[50px]` | `min-w-[40px]` |
| 789 | `flex items-center gap-1` | `flex items-center gap-1 flex-shrink-0` |

## Resultado Esperado

Os botões "Mesclar" e "Transferir" permanecerão dentro do container, e se o espaço for muito limitado, o nome do responsável será truncado ao invés de os botões vazarem.
