---
name: Renewal Successor Auto-Detection
description: Renovações ocultam contratos vencidos quando há sucessor ativo (mesmo cliente+produto) iniciando perto do vencimento
type: feature
---
Em /renewals, contratos vencidos são automaticamente filtrados quando o mesmo cliente tem outro contrato ativo do mesmo produto iniciando entre [end_date - 30d, end_date + 365d]. Isso integra Comercial (deal ganho cria novo contrato) com Operações (lista de renovações) sem ação manual.
