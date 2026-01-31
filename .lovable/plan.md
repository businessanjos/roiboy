
# Plano: Exibir Data de Fechamento nos Negócios Ganhos

## Contexto

O sistema já possui o campo `won_at` na tabela `deals` que é preenchido automaticamente quando um negócio é marcado como ganho. Porém, essa informação não está sendo exibida na listagem de negócios ganhos.

## Solução

Adicionar a exibição da data de fechamento diretamente na linha do negócio ganho, entre o badge de status/etapa e o valor.

## Mudanças Propostas

### Arquivo: `src/pages/SalesPipeline.tsx`

Modificar o componente `DealListView` para exibir a data de fechamento quando o negócio for ganho:

1. Na seção de badges/informações à direita do card, adicionar a data `won_at` formatada:

```text
Antes:
[Avatar] [Barra Colorida] [Nome do Deal]           [Badge Etapa] [R$ Valor]
                          [Nome do Contato]

Depois (para negócios ganhos):
[Avatar] [Barra Colorida] [Nome do Deal]           [Badge Etapa] [📅 01/01/2025] [R$ Valor]
                          [Nome do Contato]
```

2. Usar o ícone `Calendar` do lucide-react (já importado no arquivo)
3. Formatar a data no padrão brasileiro (DD/MM/YYYY)
4. Exibir apenas quando `deal.status === 'won'` e `deal.won_at` existir

### Código de Implementação

Dentro do bloco de informações à direita (linha ~1060), adicionar após o badge de status e antes do valor:

```tsx
{/* Won date - shown only for won deals */}
{deal.status === 'won' && deal.won_at && (
  <div className="flex items-center gap-1 text-sm text-emerald-600">
    <Calendar className="h-3.5 w-3.5" />
    <span>
      {new Date(deal.won_at).toLocaleDateString('pt-BR')}
    </span>
  </div>
)}
```

## Resultado Visual Esperado

A lista de negócios ganhos exibirá:

```text
[Avatar] [Cor] [INSIDE-RM] Anini Beatriz    [Proposta Enviada] [Ganha] [📅 15/01/2025] R$ 70.800,00
              Anini Beatriz
```

## Impacto

- **Visual**: Informação clara de quando cada negócio foi fechado
- **Análise**: Facilita identificar rapidamente a cronologia das vendas
- **Consistência**: Segue o mesmo padrão visual do motivo de perda nos negócios perdidos

## Arquivo a Modificar

1. `src/pages/SalesPipeline.tsx` - Componente `DealListView` (linhas ~1060-1083)
