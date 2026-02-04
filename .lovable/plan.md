
# Plano: Corrigir Vazamento do Quadrante Card

## Problema Identificado

Analisando a imagem, o badge "Em Recuperação" dentro do card **Quadrante** está vazando para fora dos limites do card. O problema ocorre porque:

1. O `QuadrantIndicator` usa `inline-flex` que permite expansão ilimitada
2. O texto "Em Recuperação" é mais longo que outros labels
3. Não há controle de overflow no container pai

## Solução

Adicionar `max-w-full` e `overflow-hidden` ao `QuadrantIndicator` para garantir que ele respeite os limites do container pai, e também adicionar `truncate` ao texto como fallback de segurança.

## Modificação

### Arquivo: `src/components/ui/status-indicator.tsx`

Alterar o componente `QuadrantIndicator` (linhas 176-191):

**De:**
```tsx
return (
  <div
    className={cn(
      "inline-flex items-center rounded-full font-medium",
      config.bg,
      config.color,
      sizes.padding,
      sizes.gap,
      sizes.text,
      className
    )}
  >
    <Icon className={sizes.icon} />
    {showLabel && <span className="whitespace-nowrap">{config.label}</span>}
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
      sizes.text,
      className
    )}
  >
    <Icon className={cn(sizes.icon, "flex-shrink-0")} />
    {showLabel && <span className="truncate">{config.label}</span>}
  </div>
);
```

## Alterações Detalhadas

| Elemento | Antes | Depois | Motivo |
|----------|-------|--------|--------|
| Container | `inline-flex items-center` | + `max-w-full` | Limita largura máxima ao container pai |
| Icon | `{sizes.icon}` | + `flex-shrink-0` | Impede que o ícone seja comprimido |
| Span | `whitespace-nowrap` | `truncate` | Permite truncar texto com "..." se necessário |

## Resultado Visual

```
┌─────────────────────────┐
│       Quadrante         │
│  [↗ Em Recuperação]     │  ← Agora contido dentro do card
└─────────────────────────┘
```

Se o espaço for muito pequeno, o texto será truncado:
```
│  [↗ Em Recupera...]     │
```

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/ui/status-indicator.tsx` | Adicionar `max-w-full`, `flex-shrink-0` e trocar `whitespace-nowrap` por `truncate` |
