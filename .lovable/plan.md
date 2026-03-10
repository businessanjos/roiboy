

## Corrigir Barras do Funil — Legibilidade e Proporção

### Problema
O `min-width: 8%` tornou barras muito estreitas e a fórmula de redução de fonte (`widthPct / 40`) encolhe o texto a ponto de ficar ilegível. Etapas com 10 itens vs 2 itens ficam visualmente iguais porque ambas caem na faixa ilegível.

### Correção — `ConfigurableFunnel.tsx`

1. **Aumentar piso mínimo de largura** para `15%` — garante que a menor barra ainda seja legível
2. **Remover escala dinâmica de fonte** — usar tamanho fixo (`13 * m`) para nome e valor, confiando no `truncate` para nomes longos em barras estreitas
3. **Manter `minWidth: 180px`** para garantir que texto + valor caibam mesmo em containers pequenos
4. Aplicar as mesmas correções na barra de Ganhos

Resultado: "Chegou Lead" ocupa 100%, "Contato Realizado" ~60%, "Em Qualificação" ~24% (mas com piso de 15%), etapas com 2 items ~8% → piso de 15%. A diferença entre 24% e 15% será visível, e todas as barras terão texto legível.

