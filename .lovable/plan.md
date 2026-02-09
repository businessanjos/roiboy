
# Corrigir campos personalizados: converter labels para values

## Problema identificado

Os campos do tipo `select` e `multi_select` armazenam um **value interno** (ex: `trafego_pago`), mas o n8n esta enviando o **label legivel** (ex: `Trafego Pago`). Por isso os campos aparecem vazios ou nao reconhecidos no sistema.

**Exemplos do problema:**

| Campo | Enviado pelo n8n | Value esperado |
|---|---|---|
| Canal de Venda | `Trafego Pago` | `trafego_pago` |
| MQL | `NAO-Abaixo de 30k` | `nao_abaixo_30k` |
| Faturamento | `Abaixo de 20 mil reais` | `abaixo_20k` |
| Origem da Venda | `[TRAF-IMP-EC]` | `opt_1767723846709` |

## Solucao

Atualizar a Edge Function `create-deal` para:

1. **Buscar os campos personalizados** do banco (`custom_fields`) com suas opcoes
2. **Para cada campo select/multi_select**, fazer match do texto enviado contra o `label` das opcoes e converter para o `value` correto
3. Se nao encontrar match exato, tentar match case-insensitive e parcial
4. Se ainda nao encontrar, salvar o texto original como fallback

## Alteracao tecnica

**Arquivo:** `supabase/functions/create-deal/index.ts`

Antes do bloco de insercao dos campos personalizados, adicionar uma consulta ao banco para buscar as opcoes dos campos select/multi_select envolvidos. Depois, no `.map()` que monta os inserts, converter o valor enviado para o `value` interno correto usando uma funcao auxiliar de matching.

### Funcao auxiliar de matching

```text
function matchOptionValue(options, inputText):
  1. Tentar match exato por label (case-insensitive)
  2. Tentar match exato por value
  3. Tentar match parcial (label contem input ou input contem label)
  4. Se nada, retornar o texto original
```

### Fluxo atualizado

```text
1. Buscar custom_fields com IDs dos campos select/multi_select
2. Para cada campo no payload:
   - Se e select: converter label -> value usando opcoes
   - Se e multi_select: converter cada item do array label -> value
   - Se e text/date: manter comportamento atual
3. Inserir em batch como ja e feito
```

Isso garantira que os valores cheguem corretamente ao banco sem precisar alterar nada no JSON do n8n.
