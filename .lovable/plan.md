# Replicar N8N direto no typeform-webhook

## O que o N8N faz hoje

Ao receber uma submissão do Typeform, o N8N:

1. Lê `answers[]` do payload e extrai por tipo/ref do campo:
   - `email`, `phone_number`, `short_text` de nome, `short_text` de @instagram
   - `multiple_choice` de faturamento → vira `revenue_range` (label crua, ex.: "Entre 70 e 100 mil reais")
   - Demais multiple_choices ficam guardados nas respostas (o Roy já persiste isso em `typeform_responses.answers`)
2. Lê o **título/tag do formulário** ([TRAF-IMP-EC], [ORG-EVER] etc.) e deriva:
   - `tags = ["[TRAF-IMP-EC]"]`
   - `source = "Tráfego Pago"` (prefixo TRAF-*) ou `"Orgânico"` (ORG-*)
   - `canal = mesmo do source`
3. Calcula `mql` (regra "SIM - Acima de 30k" / "NÃO - Abaixo de 30k") pelo faturamento
4. Chama o endpoint `create-lead` do Roy com esse payload
5. O `create-lead` já faz o resto: cria o lead, popula custom fields (MQL, Canal, Faturamento), roda MQL avançado por produto

## O que muda

O `typeform-webhook` passa a fazer os passos 1–4 **antes** do match. Fluxo novo:

```text
Typeform submit
   └──► typeform-webhook (Roy)
          1. grava resposta em typeform_responses
          2. tenta match (lead/deal existente por email/phone)
          3. SE NÃO ACHOU e a resposta é completa:
             ├── deriva source/tag/canal a partir do form.title
             ├── extrai revenue_range e mql
             └── chama create-lead com o payload
          4. re-linka a resposta ao lead criado
```

Nenhuma tabela nova. O N8N pode ser desligado do Typeform depois de validado.

## Detalhes técnicos

### Extração de campos (heurística por ref/title)

Já temos `extractContact` para email/phone/nome. Estender com:

- **Instagram**: `short_text` cujo `field.ref` ou `field.title` contenha `instagram`/`insta`/`@`
- **Faturamento**: `multiple_choice` cujo `ref`/`title` contenha `faturamento`/`fatura`/`receita` → pega o `choice.label`
- **Segmento/Nicho**: opcional, ref contém `segmento`/`nicho`/`area` → `business_niche`

### Derivação por form.title

Parse regex `^\[([^\]]+)\]` no título:

| Prefixo   | source          | canal           |
| --------- | --------------- | --------------- |
| `TRAF-*`  | `Tráfego Pago`  | `Tráfego Pago`  |
| `ORG-*`   | `Orgânico`      | `Orgânico`      |
| outros    | `Typeform`      | `Typeform`      |

`tags = ["[TAG-COMPLETA]"]` (o rótulo inteiro entre colchetes).

### MQL (regra atual do N8N)

`mql = "SIM - Acima de 30k"` se `revenue_range` NÃO for "Abaixo de 30 mil reais" / "Até 30 mil"; senão `"NÃO - Abaixo de 30k"`. O `create-lead` sobrescreve com a lógica avançada por produto quando aplicável — mantemos compatibilidade.

### Chamada ao create-lead

Chamada interna via `supabase.functions.invoke("create-lead", { body: payload })` usando service-role (webhook já roda com SR). Só cria se:

- `is_completed = true` (submitted_at existe)
- `email` presente
- Match falhou (evita duplicar)

### Idempotência

- Reprocesso do mesmo `response_id` já é seguro (upsert). O bloco de criação de lead checa match novamente antes de chamar `create-lead`.
- Se o N8N ainda estiver rodando em paralelo durante a transição, o segundo a rodar vai encontrar o lead do primeiro pelo email e não duplicar.

## Depois de validar

1. Ligar em 1 form primeiro (ex.: `[TRAF-IMP-EC]`) e comparar 24h de leads gerados vs N8N.
2. Se bater 100%, desligar o workflow correspondente no N8N.
3. Repetir por form até desligar todos.

## Fora do escopo

- Não vou tocar em `create-lead` (já faz tudo que precisamos).
- Não vou criar UI para editar mapping por form — a heurística cobre os 5 forms atuais. Se aparecer form com layout diferente, aí sim viramos configurável.
