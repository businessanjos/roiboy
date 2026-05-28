## Objetivo

Substituir os 6 contratos do Rykas Mentoring (PF/PJ × 3 formas de pagamento) por **1 template único** com blocos condicionais, mantendo o template atual como histórico.

---

## Mapeamento do que muda entre os 6 arquivos

**Eixo PF vs PJ** — muda só o bloco de qualificação do CONTRATANTE e a linha de assinatura.

**Eixo Forma de Pagamento:**
- **À vista (R$ 70.000):** cláusula simples.
- **Cartão 12x (R$ 80.400):** + 4 parágrafos (chargeback, terceiros, limite, fatura) e parágrafo de atraso 2+ parcelas.
- **Cheque 1+11 (R$ 80.400):** + bloco operacional (envio SEDEX p/ CAIXA POSTAL 2002 Arapongas-PR, e-mail `financeiro@anjosbusiness.com.br`, taxa R$ 2.000, PIX backup) e parágrafo de atraso 2+ parcelas.

Todo o resto (objeto, cláusulas de mentoria, responsabilidades, confidencialidade, rescisão, sistema Clínica Ryka 6 meses, autorização de imagem) é idêntico nos 6.

**Bug encontrado nos 3 arquivos PJ:** valor à vista descrito como "setenta e nove mil reais" — vou corrigir para "setenta mil reais" (combinando com o valor numérico R$ 70.000,00). Se você quiser manter o erro original, é só avisar.

---

## Mudanças no código

### 1. Engine de templates — `src/lib/contractTemplates.ts`

Adicionar **suporte a blocos condicionais** antes do replace existente em `renderTemplate`:

```
{{#if FORMA_PAGAMENTO_RYKAS=CARTAO_12X}}...conteúdo...{{/if}}
```

Implementação: 1 regex extra que processa blocos antes da substituição de placeholders escalares. Suporta também `{{#if KEY!=value}}` para negação.

Atualizar `extractPlaceholders` para ignorar tokens dentro de blocos condicionais ao detectar variáveis de wizard, evitando duplicação.

Adicionar tipo de variável `"select"` com `options: string[]` para o wizard renderizar um dropdown.

### 2. Wizard — `src/components/sales/contracts/ContractWizard.tsx`

- Renderizar variáveis tipo `select` como dropdown (componente Select da shadcn).
- Injetar automaticamente no `values` o placeholder `DOC_TYPE` = "PF" ou "PJ" baseado no `docType` já existente, para que o template condicional funcione sem o vendedor precisar selecionar manualmente.

### 3. Banco — migration

- Criar 1 novo registro em `contract_templates` chamado **"Rykas Mentoring — v2 (PF/PJ + Pagamentos)"**, vinculado ao produto Rykas Mentoring (id `8d3e9bb6...`), com `is_default = true`.
- HTML do template contém blocos condicionais para `DOC_TYPE` (PF/PJ) e `FORMA_PAGAMENTO_RYKAS` (A_VISTA / CARTAO_12X / CHEQUE_1_11).
- Variáveis definidas: campos comuns + `FORMA_PAGAMENTO_RYKAS` (select com 3 opções) + `VALOR_TOTAL_RYKAS` (auto-preenchido conforme escolha).
- Marcar o template Rykas antigo como `is_active = false` (preserva como histórico, contratos já gerados continuam funcionando — eles têm snapshot em `digital_contracts.template_html`).

### 4. Produto Rykas — `data update`

O produto **`Rykas Mentoring`** (id `8d3e9bb6...`) hoje tem `price = 70000`. Mantém como **preço base (à vista)**. As variações (80.400) ficam dentro do wizard via select, refletidas em `VALOR_TOTAL_RYKAS` e na cláusula condicional. Isso preserva métricas/dashboards baseadas em `products.price`.

Se você preferir 3 produtos separados (Rykas Mentoring À Vista / Cartão / Cheque) para dashboards distinguirem, me avise antes de eu rodar a migration — é uma decisão de modelagem.

---

## Resumo dos arquivos

| Arquivo | Mudança |
|---|---|
| `src/lib/contractTemplates.ts` | + parser de `{{#if}}`, + tipo `select` |
| `src/components/sales/contracts/ContractWizard.tsx` | + render select, + inject `DOC_TYPE` |
| Migration nova | + template Rykas v2, desativa antigo |

---

## Pontos para você confirmar antes de eu rodar

1. **Bug do extenso PJ** ("setenta e nove" → corrigir para "setenta")? Sim/não.
2. **Produto único com select** (recomendado) ou **3 produtos separados** no cadastro?
3. **Tudo o resto** segue como nos arquivos enviados, incluindo: Anjo Consultor como bônus, Clínica Ryka 6 meses, 3 usuários, mentoria quinta 07h, vigência 6 meses, taxa cheque R$ 2.000, CAIXA POSTAL 2002 Arapongas-PR, e-mail `financeiro@anjosbusiness.com.br`. Confirma esses dados?