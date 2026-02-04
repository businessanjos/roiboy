
# Plano: Usar Fonte Menor no QuadrantIndicator

## Problema

O truncamento ("Em R...") deixou o texto ilegível. O usuário prefere que o texto apareça completo, mas com fonte menor.

## Solução

Remover o `truncate` e utilizar `text-[10px]` para o texto do badge, permitindo que "Em Recuperação" apareça inteiro dentro do espaço disponível.

## Modificação

### Arquivo: `src/components/ui/status-indicator.tsx`

Alterar linhas 176-191 do `QuadrantIndicator`:

**De:**
```tsx
return (
  <div
    className={cn(
      "inline-flex items-center rounded-full font-medium max-w-full",
      config.bg,
      config.color,
      sizes.padding,
      sizes.gap,
      sizes.text,  // text-sm (14px) para size="md"
      className
    )}
  >
    <Icon className={cn(sizes.icon, "flex-shrink-0")} />
    {showLabel && <span className="truncate">{config.label}</span>}
  </div>
);
```

**Para:**
```tsx
return (
  <div
    className={cn(
      "inline-flex items-center rounded-full font-medium max-w-full",
      config.bg,
      config.color,
      sizes.padding,
      sizes.gap,
      "text-[10px]",  // Fonte fixa menor para caber no card
      className
    )}
  >
    <Icon className={cn(sizes.icon, "flex-shrink-0")} />
    {showLabel && <span className="whitespace-nowrap">{config.label}</span>}
  </div>
);
```

## Alterações Detalhadas

| Elemento | Antes | Depois | Motivo |
|----------|-------|--------|--------|
| Tamanho do texto | `sizes.text` (text-sm/14px) | `text-[10px]` | Fonte menor para caber texto completo |
| Span | `truncate` | `whitespace-nowrap` | Mantém texto em uma linha, sem cortar |

## Resultado Visual

```
┌─────────────────────────┐
│       Quadrante         │
│  [↗ Em Recuperação]     │  ← Texto completo, fonte menor
└─────────────────────────┘
```

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/ui/status-indicator.tsx` | Trocar `sizes.text` por `text-[10px]` e `truncate` por `whitespace-nowrap` |
