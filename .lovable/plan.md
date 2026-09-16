# Cores de atividade no funil + legenda

## Nova regra de cor (barra lateral do cartão)

- Vermelho: existe atividade pendente com prazo anterior a hoje (atrasada).
- Verde: a próxima atividade pendente vence hoje.
- Laranja: a próxima atividade pendente vence em data futura.
- Amarelo: nenhuma atividade pendente (inclui negócio sem nenhuma atividade).

Prioridade: atrasada > hoje > futura > sem atividade. Se houver pendência sem data definida, ela entra como "sem prazo" e recebe amarelo, já que não há prazo para cobrar.

Hoje a regra é outra (verde = nada pendente, amarelo = pendente sem atraso), por isso casos como o da Elyane aparecem fora do esperado. A nova regra corrige isso: sem atividade passa a ser amarelo, e vermelho só com prazo realmente vencido.

## Legenda

Faixa de legenda acima das abas do funil (Em Aberto / Ganhas / Perdidas), com quatro marcadores coloridos e os rótulos: "Atrasada", "Hoje", "Futura", "Sem atividade". Compacta, quebrando em duas linhas no celular.

## Detalhes técnicos

- `src/components/sales/DealCard.tsx`: reescrever `getActivityStatusIndicator()` usando `activityStatus.pendingCount`, `hasOverdue` e `nextDueDate` (já disponíveis em `ActivityStatus`), comparando `nextDueDate` com hoje via `parseLocalDate` + `isToday`/`isBefore` (`date-fns`). Cores por token: `bg-danger`, `bg-success`, `bg-warning` e laranja (`bg-orange-500` só se não houver token; preferir token existente de "orange"/`--chart-*` do tema — verificar `tailwind.config.ts` e usar token semântico se existir).
- Ajustar também os rótulos/tooltips que hoje dizem "Feito"/"A fazer"/"Atrasado!" para refletir os quatro estados.
- Novo componente `src/components/sales/PipelineActivityLegend.tsx` renderizado em `src/pages/SalesPipeline.tsx`, logo acima do `TabsList` do bloco de status.
- Verificar se `LeadsTab`/`DealListView` usam o mesmo indicador; se usarem, aplicar a mesma função compartilhada para não divergir.
- Sem mudanças de backend: `get_deal_activity_stats` já devolve `next_due_date`.

## Validação

- Conferir no funil um negócio sem atividade (amarelo), um com prazo vencido (vermelho), um com prazo hoje (verde) e um futuro (laranja).
- Conferir o caso específico da Elyane após a mudança.
