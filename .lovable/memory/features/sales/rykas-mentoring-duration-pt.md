---
name: Rykas Mentoring vigência fixa
description: Vigência de contratos do produto Rykas Mentoring é sempre 6 meses
type: feature
---

Todo contrato digital cuja origem é um produto da família **Rykas Mentoring** (match `/ryka.*mentoring/i` — inclui "Rykas Mentoring", "Ren. Rykas Mentoring", "Rykas Mentoring Low") deve ter `contract_duration_months = 6`.

- Aplicado no autofill do wizard em `DigitalContractTab.tsx` logo após `mapItemVendaToProductId` resolver o produto.
- Texto da cláusula de multa (incisos II/III/IV) já é redigido assumindo vigência de 6 meses — não alterar duração sem revisar essas cláusulas.
- Não aplicar para `Rykas Pass` ou outros produtos.
