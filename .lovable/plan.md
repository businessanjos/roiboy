
# Adicionar campos personalizados ao create-deal e atualizar JSON do n8n

## O que sera feito

Atualizar a Edge Function `create-deal` para aceitar 7 novos parametros e salva-los automaticamente nos campos personalizados correspondentes. Alem disso, fornecer o JSON completo atualizado para usar no n8n.

## Novos parametros e mapeamento

| Parametro | Campo | Field ID | Coluna |
|---|---|---|---|
| `canal_de_venda` | Canal de Venda | `16ebda9f-cd3b-412c-bb06-0950001963c5` | `value_text` |
| `mql` | MQL | `448404cd-0344-4892-a574-2387b1c17578` | `value_text` |
| `faturamento` | Faturamento Atual | `ed5c7c0e-0740-4945-b982-70a593ffae0c` | `value_text` |
| `origem_da_venda` | Origem da Venda | `43d7d9a1-9370-45f3-803a-93717d2a6d1d` | `value_json` |
| `instagram` | Instagram | `47df969b-735e-414f-a25e-2a56e589551d` | `value_json` |
| `observacoes` | Observacoes do Cliente | `f906c26d-7dc7-43bb-902e-f3878e7535d2` | `value_text` |
| `data_primeiro_contato` | Data do primeiro contato | `166fe351-b29b-4f08-b330-88f82c65f625` | `value_date` |

## Alteracoes no codigo

**Arquivo:** `supabase/functions/create-deal/index.ts`

1. Adicionar os 7 novos campos opcionais na interface `CreateDealPayload`
2. Apos a criacao do deal (apos o bloco existente do `product_id`), montar um array de inserts para `deal_field_values` com todos os campos fornecidos
3. Fazer um unico `insert` em batch na tabela `deal_field_values`
4. Tratamento non-blocking (try/catch) para nao impedir a criacao do deal

## JSON completo para o n8n

Apos a implementacao, o JSON do HTTP Request no n8n ficara assim:

```text
{
  "title": "{{ $json.finalDealTitle }}",
  "lead_id": "{{ $json.finalPersonId }}",
  "contact_name": "{{ $json.leadName }}",
  "contact_phone": "{{ $json.LeadPhone }}",
  "contact_email": "{{ $json.leadEmail }}",
  "source": "{{ $json.CanalDeVenda }}",
  "tags": {{ JSON.stringify([$json.FormTitle, $json.MQL].filter(Boolean)) }},
  "notes": {{ JSON.stringify("Item da Venda: " + ($json.ItemDaVenda || "").trim() + "\nMaior Dificuldade: " + $json.MaiorDificuldade) }},
  "product_id": "{{ ($json.ItemDaVenda || '').trim() }}",
  "canal_de_venda": "{{ $json.CanalDeVenda }}",
  "mql": "{{ $json.MQL }}",
  "faturamento": "{{ $json.FaturamentoAtual }}",
  "origem_da_venda": "{{ $json.OrigemDaVenda }}",
  "instagram": "{{ $json.Instagram }}",
  "observacoes": "{{ $json.Observacoes }}",
  "data_primeiro_contato": "{{ $json.DataPrimeiroContato }}"
}
```

Os nomes das variaveis n8n (`$json.CanalDeVenda`, `$json.FaturamentoAtual`, etc.) deverao ser ajustados conforme os nomes reais dos campos no seu workflow.
