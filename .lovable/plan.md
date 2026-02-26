

## Corrigir Visual de Funil: Remover Scrollbar e Implementar Contagem Cumulativa

### Problemas Identificados

1. **Scrollbar indesejada**: O container do funil usa `overflow-auto`, criando uma barra de rolagem desnecessaria.

2. **Logica de contagem errada**: O funil mostra apenas os negocios que estao **atualmente** em cada etapa. O correto e mostrar contagem cumulativa -- "Chegou Lead" deve incluir TODOS os negocios (pois todos passaram por la), "Contato Realizado" deve incluir todos que estao nessa etapa ou em qualquer etapa posterior, e assim por diante. Isso e exatamente como o `SalesFunnelChart` do dashboard WhatsApp ja funciona.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableFunnel.tsx`

Duas alteracoes:

1. Trocar `overflow-auto` por `overflow-hidden` no container principal para eliminar a scrollbar.

2. Implementar contagem cumulativa de baixo para cima antes de renderizar:
   - A ultima etapa mostra seu valor bruto
   - Cada etapa acima soma seu valor com a soma de todas as etapas abaixo
   - A primeira etapa (topo) sempre tera o maior valor, garantindo a forma de funil
   - A conversao entre etapas e calculada sobre os valores cumulativos

```text
Exemplo com dados brutos ordenados por pipeline:
  Chegou Lead:        10 negocios nessa etapa
  Contato Realizado:  8 negocios nessa etapa
  Reuniao Agendada:   5 negocios nessa etapa
  Proposta Enviada:   3 negocios nessa etapa

Resultado cumulativo (de baixo pra cima):
  Chegou Lead:        26 (10+8+5+3) -- todos passaram por aqui
  Contato Realizado:  16 (8+5+3)    -- 62% de conversao
  Reuniao Agendada:   8 (5+3)       -- 50% de conversao
  Proposta Enviada:   3             -- 38% de conversao
```

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/visuals/ConfigurableFunnel.tsx` | Remover overflow-auto, adicionar logica de contagem cumulativa |

