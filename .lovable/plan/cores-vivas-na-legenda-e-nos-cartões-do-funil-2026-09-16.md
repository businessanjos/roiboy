# Cores vivas na legenda e nos cartões do funil

As cores atuais da barrinha do cartão usam os tons gerais do sistema (verde escuro e um amarelo bege), por isso ficam apagadas. A mudança cria um conjunto de cores exclusivo do indicador de atividade do funil, bem mais saturado, sem mexer no resto do sistema.

## Cores novas

- Vermelho: vermelho forte, bem visível.
- Verde: verde vivo (tipo semáforo), não o verde escuro atual.
- Amarelo: amarelo puro e vibrante, não o bege.
- Laranja: laranja vivo (já está bom, só fica alinhado ao conjunto).

Valem tanto na barrinha lateral dos cartões quanto nos pontinhos da legenda acima das abas, e funcionam no tema claro e no escuro.

## Detalhes técnicos

- `src/index.css`: criar tokens dedicados `--activity-overdue` (~0 85% 55%), `--activity-today` (~142 85% 42%), `--activity-none` (~48 100% 50%) e ajustar `--activity-future` para laranja vivo (~25 95% 53%), com variantes no bloco `.dark` levemente mais claras para contraste. Não alterar `--success`, `--warning` e `--danger` globais.
- `tailwind.config.ts`: registrar as cores `activity-overdue`, `activity-today`, `activity-none` junto do `activity-future` já existente.
- `src/lib/sales/dealActivityIndicator.ts`: trocar `bg-danger`/`bg-success`/`bg-warning` por `bg-activity-overdue`/`bg-activity-today`/`bg-activity-none` (e os `text-*` correspondentes). A legenda (`PipelineActivityLegend.tsx`) e o `DealCard.tsx` já consomem esse mapa, então pegam as cores novas automaticamente.
- Nenhuma mudança de regra: vermelho atrasada, verde hoje, laranja futura, amarelo sem atividade.

## Validação

- Abrir o funil e conferir os quatro estados lado a lado com a legenda, no tema claro e no escuro.
