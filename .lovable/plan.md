
# Plano: Corrigir Layout dos Cards de Métricas no Perfil do Cliente

## Problema Identificado

Analisando a imagem, os cards "ROIzômetro", "E-Score" e "Quadrante" estão com problemas visuais:

1. **ROIzômetro0/100** - O label e o valor estão "grudados" sem espaço
2. **E-Score** - O texto está quebrando em duas linhas ("E-" / "Score")  
3. **Quadrante** - O texto "Em Recuperação" está vazando para fora do card

### Causa Raiz

O componente `ScoreGauge` usa layout horizontal (`flex items-center justify-between`) para colocar label e valor na mesma linha. Em telas menores ou quando o grid está comprimido (6 colunas), não há espaço suficiente.

## Solução Proposta

Alterar o layout do `ScoreGauge` para **formato vertical centralizado**, igual aos outros cards (V-NPS, Quadrante, Tendência), criando consistência visual:

### Antes (Layout Horizontal)
```
┌─────────────────────────┐
│ ROIzômetro      0/100   │
│ ████████████░░░░░░░░░░  │
└─────────────────────────┘
```

### Depois (Layout Vertical Centralizado)
```
┌─────────────────────────┐
│      ROIzômetro         │
│        0/100            │
│ ████████████░░░░░░░░░░  │
└─────────────────────────┘
```

## Modificações

### Arquivo: `src/components/ui/score-gauge.tsx`

Ajustar o layout do componente:

```tsx
return (
  <div className={cn("w-full flex flex-col", config.gap, className)}>
    {/* Layout vertical centralizado */}
    <div className="flex flex-col items-center gap-0.5 mb-2">
      <span className={cn(
        "font-medium text-muted-foreground whitespace-nowrap", 
        config.text
      )}>
        {label}
      </span>
      <span className={cn("font-mono font-bold text-foreground", valueSizes[size])}>
        {score}
        <span className="text-muted-foreground font-normal">/{maxScore}</span>
      </span>
    </div>
    {/* Barra de progresso */}
    <div className={cn(
      "w-full bg-muted rounded-full overflow-hidden",
      config.height
    )}>
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out",
          getGradientColor()
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);
```

### Arquivo: `src/components/ui/status-indicator.tsx`

Adicionar `whitespace-nowrap` no `QuadrantIndicator` para evitar quebra de texto "Em Recuperação":

```tsx
{showLabel && <span className="whitespace-nowrap">{config.label}</span>}
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| ROIzômetro0/100 (grudado) | ROIzômetro (centralizado) |
| E-Score quebrado em 2 linhas | E-Score em 1 linha |
| "Em Recuperação" vazando | Texto contido ou truncado |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/ui/score-gauge.tsx` | Alterar para layout vertical centralizado |
| `src/components/ui/status-indicator.tsx` | Adicionar `whitespace-nowrap` no QuadrantIndicator |

## Benefícios

1. **Consistência visual** - Todos os cards seguem o mesmo padrão (label em cima, valor embaixo)
2. **Responsivo** - Funciona bem em qualquer largura de tela
3. **Legibilidade** - Texto não quebra nem fica grudado
