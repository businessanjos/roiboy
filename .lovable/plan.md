
# Plano: Corrigir Overflow e Adicionar Opções de Formatação do Scorecard

## Problemas Identificados

### 1. Valor Transbordando o Card
O texto "R$ 36.466.000,00" excede os limites do card porque:
- Usa tamanho de fonte fixo `text-4xl` 
- Não há quebra de linha ou ajuste responsivo
- Valores muito grandes com casas decimais ocupam muito espaço

### 2. Falta Opções de Edição para Formatação
O painel "Ajustes do Visual" (`VisualQuickSettings`) mostra apenas configurações de gráficos:
- Paleta de cores
- Rótulos de dados
- Formato de data

**Falta para Scorecards:**
- Escala de exibição (completo, milhares, milhões, bilhões)
- Quantidade de casas decimais

---

## Solução Proposta

### 1. Adicionar Tipo `DisplayScale` ao Config

Novo tipo para controlar como números grandes são exibidos:

| Escala | Exemplo (36.466.000) | Descrição |
|--------|---------------------|-----------|
| `full` | R$ 36.466.000,00 | Valor completo |
| `auto` | R$ 36,5M | Automático (K/M/B) |
| `thousands` | R$ 36.466K | Sempre em milhares |
| `millions` | R$ 36,5M | Sempre em milhões |
| `billions` | R$ 0,04B | Sempre em bilhões |

### 2. Atualizar ConfigurableScorecard para Responsividade

- Usar tamanho de fonte responsivo que diminui para valores longos
- Adicionar `truncate` e `text-center` para prevenir overflow
- Implementar formatação baseada na nova escala

### 3. Adicionar Seção de Formatação no VisualQuickSettings

Quando o visual for um Scorecard, exibir opções:
- **Escala de Exibição**: Dropdown com as opções (Auto, Completo, Milhares, Milhões, Bilhões)
- **Casas Decimais**: Slider ou input numérico (0-4)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/insights/visual-builder/types.ts` | Adicionar tipo `DisplayScale` e propriedade em `formatting` |
| `src/lib/formula-evaluator.ts` | Criar função `formatValueWithScale` que aceita escala |
| `src/components/insights/visuals/ConfigurableScorecard.tsx` | Usar nova formatação + layout responsivo |
| `src/components/insights/visuals/VisualQuickSettings.tsx` | Adicionar seção de formatação para Scorecards |

---

## Resultado Esperado

```text
ANTES (Valor cortado)
┌───────────────┐
│ R$ 36.466.000…│  ← Texto transborda
│   478 regist… │
└───────────────┘

DEPOIS (Com escala "auto")
┌───────────────┐
│   R$ 36,5M    │  ← Valor legível
│ 478 registros │
└───────────────┘

DEPOIS (Com escala "full" e 0 decimais)
┌───────────────┐
│R$ 36.466.000  │  ← Sem centavos, cabe melhor
│ 478 registros │
└───────────────┘
```

---

## Secao Tecnica

### 1. types.ts - Adicionar DisplayScale

```typescript
// Novo tipo para escala de exibicao
export type DisplayScale = 'full' | 'auto' | 'thousands' | 'millions' | 'billions';

// Atualizar interface formatting em VisualConfig
formatting: {
  type: FormatType;
  decimals: number;
  displayScale?: DisplayScale; // Nova propriedade
};

// Adicionar opcoes para UI
export const DISPLAY_SCALE_OPTIONS: { value: DisplayScale; label: string }[] = [
  { value: 'auto', label: 'Automatico (K/M/B)' },
  { value: 'full', label: 'Valor Completo' },
  { value: 'thousands', label: 'Em Milhares (K)' },
  { value: 'millions', label: 'Em Milhoes (M)' },
  { value: 'billions', label: 'Em Bilhoes (B)' },
];

// Valor padrao atualizado
export const DEFAULT_DISPLAY_SCALE: DisplayScale = 'auto';
```

### 2. formula-evaluator.ts - Nova Funcao de Formatacao

```typescript
export function formatValueWithScale(
  value: number,
  formatType: FormatType,
  decimals: number,
  displayScale: DisplayScale = 'full'
): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return '-';
  }

  const prefix = formatType === 'currency' ? 'R$ ' : '';
  const suffix = formatType === 'percentage' ? '%' : '';

  // Se nao for escala auto ou full, forcar a divisao
  let displayValue = value;
  let scaleSuffix = '';

  switch (displayScale) {
    case 'auto':
      if (Math.abs(value) >= 1_000_000_000) {
        displayValue = value / 1_000_000_000;
        scaleSuffix = 'B';
      } else if (Math.abs(value) >= 1_000_000) {
        displayValue = value / 1_000_000;
        scaleSuffix = 'M';
      } else if (Math.abs(value) >= 1_000) {
        displayValue = value / 1_000;
        scaleSuffix = 'K';
      }
      break;
    case 'thousands':
      displayValue = value / 1_000;
      scaleSuffix = 'K';
      break;
    case 'millions':
      displayValue = value / 1_000_000;
      scaleSuffix = 'M';
      break;
    case 'billions':
      displayValue = value / 1_000_000_000;
      scaleSuffix = 'B';
      break;
    case 'full':
    default:
      // Valor completo, usa formatacao normal
      break;
  }

  // Se tem escala, formatar de forma compacta
  if (scaleSuffix) {
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(displayValue);
    return `${prefix}${formatted}${scaleSuffix}${suffix}`;
  }

  // Valor completo, usa formatacao padrao
  return formatValue(value, formatType, decimals);
}
```

### 3. ConfigurableScorecard.tsx - Layout Responsivo

```typescript
export function ConfigurableScorecard({ data, formatting, title }: ConfigurableScorecardProps) {
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);
  const totalCount = data.reduce((acc, item) => acc + (item.count || 0), 0);
  
  // Usar nova funcao com escala
  const formattedValue = formatValueWithScale(
    totalValue, 
    formatting.type, 
    formatting.decimals,
    formatting.displayScale || 'auto' // Padrao auto para scorecards
  );

  // Calcular tamanho de fonte baseado no comprimento do valor
  const fontSize = formattedValue.length > 15 
    ? 'text-2xl' 
    : formattedValue.length > 10 
      ? 'text-3xl' 
      : 'text-4xl';

  return (
    <div className="flex flex-col items-center justify-center h-full py-4 px-2 overflow-hidden">
      <p className={`${fontSize} font-bold text-foreground mb-2 text-center break-all`}>
        {formattedValue}
      </p>
      {totalCount > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {totalCount.toLocaleString('pt-BR')} {totalCount === 1 ? 'registro' : 'registros'}
        </p>
      )}
    </div>
  );
}
```

### 4. VisualQuickSettings.tsx - Secao de Formatacao para Scorecards

```typescript
// Adicionar estados locais
const [displayScale, setDisplayScale] = useState<DisplayScale>(
  config?.formatting?.displayScale ?? 'auto'
);
const [decimals, setDecimals] = useState<number>(
  config?.formatting?.decimals ?? 2
);

// Detectar se e scorecard
const isScorecard = visual.chart_type === 'scorecard';

// No useEffect, resetar tambem essas opcoes
useEffect(() => {
  if (open) {
    // ... outras configs
    setDisplayScale(config?.formatting?.displayScale ?? 'auto');
    setDecimals(config?.formatting?.decimals ?? 2);
  }
}, [open, config]);

// No handleSave, incluir formatting
const newConfig: VisualConfig = {
  ...config,
  formatting: {
    ...config.formatting,
    displayScale,
    decimals,
  },
  appearance: { ... },
};

// No JSX, antes da AppearanceSection
{isScorecard && (
  <div className="space-y-4 mb-6">
    <Label className="text-base font-medium">Formatacao do Valor</Label>
    
    {/* Escala de Exibicao */}
    <div className="space-y-2">
      <Label className="text-sm font-normal">Escala de Exibicao</Label>
      <Select value={displayScale} onValueChange={setDisplayScale}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DISPLAY_SCALE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    
    {/* Casas Decimais */}
    <div className="space-y-2">
      <Label className="text-sm font-normal">Casas Decimais</Label>
      <Select value={String(decimals)} onValueChange={(v) => setDecimals(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[0, 1, 2, 3, 4].map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} {n === 1 ? 'casa' : 'casas'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    
    <Separator />
  </div>
)}
```

### 5. AddVisualModal.tsx - Padrao Auto para Scorecards

```typescript
// Na criacao do scorecard, definir displayScale: 'auto'
formatting: { 
  type: metricConfig.formatType, 
  decimals: metricConfig.formatType === 'currency' ? 0 : 1,
  displayScale: 'auto', // Padrao compacto para scorecards
}
```
