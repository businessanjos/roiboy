
# Adicionar responsavel fixo (Jonathan Marcato) ao create-deal

## O que sera feito

Adicionar o parametro `responsible_user_id` na Edge Function `create-deal` para que o negocio seja criado ja com um responsavel atribuido. No JSON do n8n, esse campo sera preenchido com o ID fixo do Jonathan Marcato.

## Dados identificados

- **Jonathan Marcato**: `1232ec15-5f66-4b5f-9e74-f40d436f9d0f`
- A tabela `deals` ja possui a coluna `responsible_user_id`

## Alteracoes no codigo

**Arquivo:** `supabase/functions/create-deal/index.ts`

1. Adicionar `responsible_user_id?: string` na interface `CreateDealPayload`
2. Incluir `responsible_user_id: payload.responsible_user_id || null` no insert do deal (junto dos outros campos ja existentes)

## JSON atualizado para o n8n

```text
{
  "title": "{{ $json.finalDealTitle }} {{ $json.leadName }}",
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
  "faturamento": "{{ $json.FaturamentoTexto }}",
  "origem_da_venda": "{{ $json.OrigemDaVenda }}",
  "instagram": "{{ $json.LeadInstagram }}",
  "data_primeiro_contato": "{{ $json.DataPrimeiroContato }}",
  "responsible_user_id": "1232ec15-5f66-4b5f-9e74-f40d436f9d0f"
}
```

O `responsible_user_id` sera fixo no JSON, garantindo que todo negocio criado por esse fluxo seja automaticamente atribuido ao Jonathan Marcato.
