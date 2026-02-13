

## Restaurar Cards de Taxa de Retencao e Valor Perdido (condicionais ao toggle)

Os cards foram removidos completamente na edicao anterior, mas a intencao era apenas ocultá-los no modo "Comercial". Vou restaura-los com exibicao condicional.

### Mudancas no arquivo `src/pages/Dashboard.tsx`

**1. Restaurar import do icone `DollarSign`**

Adicionar `DollarSign` na lista de imports do `lucide-react`.

**2. Restaurar os dois `useMemo` removidos**

- `retentionMetrics`: calcula taxa de retencao com base no `monthlyChartData` (novos vs cancelamentos do mes atual)
- `lostFinancialValue`: calcula valor financeiro perdido com cancelamentos e encerramentos usando `cancelled_at` e os status corretos (`cancelled`, `dismissed`, `dropout_7d`, `ended`)

**3. Restaurar os cards na view normal (apos o grafico, antes do `</TabsContent>`)**

Dois cards lado a lado em um grid, envolvidos por `{gestaoViewMode === "operacoes" && (...)}`:
- Card "Taxa de Retencao" com porcentagem e indicador visual
- Card "Valor Perdido (Mes Atual)" com valor em R$ de cancelamentos e encerramentos

**4. Restaurar os cards no Focus Mode (apos o grafico de Evolucao Mensal)**

Mesma logica condicional com `gestaoViewMode === "operacoes"`.

### Resultado

- Modo **Operacoes**: Exibe todos os cards incluindo Taxa de Retencao e Valor Perdido
- Modo **Comercial**: Oculta cancelamentos, encerramentos, congelamentos, taxa de retencao e valor perdido
