---
name: NFS-e Emission (Notazz) — Sprint NF-1
description: Emissão de NFS-e dentro do ROY via Notazz. CNPJ emissor único (contratadas), trigger automático on_payment, edge functions nfse-issue + nfse-webhook.
type: feature
---

# NFS-e dentro do ROY (Notazz)

## Decisões base
- **1 CNPJ emissor** (Eternum Mentoring Club Ltda) — multi-CNPJ pendente para futuro.
- **Regime de caixa**: emite quando a parcela é paga (`nfse_emission_mode='on_payment'`).
- **Provider**: Notazz. Arquitetura pronta para `focus_nfe` no futuro.

## Schema
- `contratadas` — CNPJs emissores (cnpj, razao_social, IM, regime, item_lista_servico, aliquota_iss, provider, is_default).
- `nfse_issuances` — uma linha por tentativa de emissão (source_type installment|invoice|manual, status pending→queued→processing→issued|rejected|cancelled, nfse_number, pdf_url, xml_url).
- `account_settings.nfse_emission_mode` (`manual` | `on_payment` | `on_won`), `nfse_auto_email`, `nfse_default_contratada_id`.
- `products.nfse_item_lista_servico`, `nfse_codigo_tributacao_municipio`, `nfse_aliquota_iss`, `nfse_description_template`.
- Bucket privado `fiscal-docs` isolado por `account_id/`.

## Trigger
`trg_nfse_auto_on_installment_paid` em `installments`: quando parcela vira paid/pix_confirmado/boleto_pago/cartao_capturado/cheque_recebido E modo = `on_payment` E contratada padrão setada → cria `nfse_issuances` pendente. Edge `nfse-issue` processa.

## Edge functions
- **nfse-issue**: aceita `{installment_id}` ou `{invoice_id}` ou `{issuance_id}`. Monta payload Notazz (`InvoiceInput.php` kind=NFSE), envia, grava número/PDF/XML quando síncrono ou marca `queued`.
- **nfse-webhook** (`verify_jwt=false`): recebe callback Notazz, atualiza status por `externalId` (= issuance_id) ou `provider_request_id`.
- Secret necessário: `NOTAZZ_API_KEY`.

## UI
- **`/financial/configuracoes/fiscal`** — 3 abas: CNPJs emissores (CRUD), Regras de Emissão (modo + auto-email), Provedor (URL do webhook copiável).
- **`<EmitirNFButton installmentId? invoiceId?>`** — componente reutilizável que mostra status (emitida com nº/PDF, processando, rejeitada com motivo, ou botão Emitir).

## Pendente (próximas rodadas)
- Integrar `<EmitirNFButton>` na linha de cada parcela em `/financial/parcelas` e na ficha do cliente.
- Cron `nfse-status-poll` para casos sem webhook.
- Cancelamento (`nfse-cancel`) com motivo.
- Página `/financial/notas-fiscais` precisa ter aba "Emissões (Notazz)" lendo de `nfse_issuances` (hoje lê tabela legada `notas_fiscais`).
- Retenções PJ (IR/INSS/CSLL/PIS/Cofins) por valor.
- Suporte a múltiplos CNPJs emissores (estrutura já permite, falta UI de seleção por produto/deal).
