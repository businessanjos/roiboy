---
name: Contrato Eternum Mentoring Low (sem consultor)
description: Template de contrato do produto EML no wizard de vendas, com PF/PJ e 4 formas de pagamento
type: feature
---

Produto **EML l Eternum Mentoring Low** (`311124ee-a8ee-4695-b26d-972742eb751b`) tem template padrão
"Eternum Mentoring Low — sem consultor (PF/PJ + Pagamentos)" em `contract_templates`.

- Derivado do template "Rykas Mentoring — v2", sem as cláusulas de CONSULTOR / ANJO CONSULTOR e sem o bloco dos 3 passos.
- Formas de pagamento (chave `FORMA_PAGAMENTO_RYKAS`, presets em `src/lib/contractTemplates.ts`):
  `EML_A_VISTA` R$ 45.000 (10% desconto), `EML_CARTAO_12X`, `EML_BOLETO_1_11`, `EML_CHEQUE_1_11` — R$ 50.000.
- Modalidade da UI é derivada do nome da chave (contém CHEQUE / A_VISTA / senão parcelado).
- Vigência fixa de 6 meses: regex em `DigitalContractTab.tsx` é `/(ryka|eternum).*mentoring/i`.
- A versão "com consultor" continua existindo separadamente.

- A condição de pagamento escolhida é a **fonte de verdade do valor total**: o preset sobrescreve
  `TOTAL_VALUE`/`VALOR_TOTAL` vindos do negócio (evita contrato de 12x sair com valor à vista).
