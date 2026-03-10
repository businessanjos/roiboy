

## Problema raiz

O `minWidth: '180px'` no CSS está sobrepondo os percentuais calculados. Quando o container tem ~800px de largura:
- "Em Qualificação" (30%) = 240px — OK
- "Reunião Agendada" (15.7%) = 126px → **forçado para 180px**
- "Reunião Realizada" (11.4%) = 91px → **forçado para 180px**
- "Proposta/Follow/Ganhos" (~3-9%) → **todos forçados para 180px**

Todas as barras menores ficam com exatamente 180px, por isso parecem iguais.

## Correção — `ConfigurableFunnel.tsx`

1. **Reduzir `minWidth`** de `180px` para `80px` — apenas para garantir que o texto mínimo caiba
2. **Reduzir piso percentual** de `15%` para `10%` — permite mais diferenciação entre etapas pequenas
3. **Aplicar mesma lógica na barra de Ganhos**

Com isso, no container de 800px:
- Em Qualificação (30%) = 240px ✓
- Reunião Agendada (15.7%) = 126px ✓ (visivelmente menor)
- Reunião Realizada (11.4%) = 91px ✓ (visivelmente menor que 126px)
- Proposta/Follow (8.6%) = 80px (piso) ✓

