## Problema

Na modal "Campos Obrigatórios → Briefing para Operação" (acionada ao dar Ganho), todos os campos monetários (faturamentos, ticket médio, meta, caixa, tráfego) perdem o foco após cada tecla — é preciso clicar de novo a cada dígito.

## Causa raiz

Em `src/components/operations/OperationBriefingForm.tsx` (linha ~408), o componente auxiliar `Money` é declarado **dentro** do corpo do componente `OperationBriefingForm`:

```tsx
const Money = (props) => <MoneyField {...props} currencySymbol={symbol} ... />;
```

Cada digitação chama `setData` → re-renderiza `OperationBriefingForm` → cria uma nova referência de função para `Money`. React vê um "tipo de componente novo", desmonta o `<input>` antigo e monta um novo no lugar — o foco vai junto. Esse é um anti-pattern clássico do React (definir componentes dentro de outros componentes).

Os campos `NumberField` puros (tempo de atuação, nº funcionários, etc.) não sofrem disso por serem módulo-level — mas a maioria visível dos campos numéricos passa por `Money`.

## Correção

Remover o wrapper `Money` definido inline e usar `MoneyField` diretamente, passando as props de moeda (`currencySymbol`, `currencyCode`, `fxRate`, `showConversion`) em cada chamada. Como `MoneyField` já está em escopo de módulo, sua identidade fica estável entre renders e o `<input>` mantém o foco.

Alterações em `src/components/operations/OperationBriefingForm.tsx`:

1. Deletar o bloco que define `const Money = (props) => <MoneyField ... />` (linhas ~408-416).
2. Substituir cada uso de `<Money ... />` por `<MoneyField ... currencySymbol={symbol} currencyCode={currencyCode} fxRate={fxRate} showConversion={showConversion} />` nas seções de Faturamento, Caixa e Tráfego (6 ocorrências).

Sem mudanças de UI, lógica de salvamento, validação ou tokens de design — apenas estabilização da identidade do componente.

## Verificação

- Abrir um deal no /pipeline, clicar em "Ganha", ir na aba "Briefing para Operação".
- Digitar uma sequência de dígitos em "Mês -1", "Ticket médio", "Meta de faturamento", "Caixa", "Tráfego" sem precisar reclicar — o foco deve permanecer.
