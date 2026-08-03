---
name: Relatório comercial diário no WhatsApp
description: Edge function daily-sales-report-whatsapp envia resumo do comercial às 8h BRT pela instância [COMERCIAL] Eternum Club
type: feature
---

- Edge function `daily-sales-report-whatsapp` monta e envia o relatório comercial.
- Envio pela instância WhatsApp do setor `vendas` ([COMERCIAL] Eternum Club); host vem de `sector_settings.royzapp_host` quando `config.host_url` está vazio.
- Cron `daily-sales-report-whatsapp-8h` roda `0 11 * * *` (8h BRT) com `{"offsetDays": -1, "to": "11976461705"}` — relatório do dia anterior para o Everton.
- Params: `to` (telefone, default 5511976461705), `offsetDays` (0 = hoje), `dryRun` (só devolve o texto).
- Seções: Entrada (leads, MQL %, negócios criados, canais), Agenda comercial (reuniões do dia / amanhã), Fechamento do dia (vendas, valor, perdas + lista), Mês até agora (vendas, faturamento, pipeline aberto, meta e % via `sales_monthly_goals`), Ranking do mês por closer e ranking separado de SDR (`sdr_user_id`).
