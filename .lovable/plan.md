

## Adicionar Toggle de Visual e Remover Cards de Retencao/Valor Perdido

### Mudancas

**1. Novo botao de alternancia no header (ao lado de "Modo Foco")**

Adicionar um state `gestaoViewMode` com dois valores: `"operacoes"` (padrao, visual completo) e `"comercial"` (sem cancelamentos/encerramentos/congelamentos). O botao usara um icone (ex: `ToggleLeft`/`ToggleRight` ou `Eye`/`EyeOff`) e alternara entre os dois modos.

**2. Visual "Comercial" (simplificado)**

Quando ativo:
- **Status cards**: Ocultar os cards de Cancelamentos, Encerramentos e Congelamentos. Manter Total Clientes, Ativos e Vencidos (grid ajusta de 6 para 3 colunas)
- **Grafico Evolucao Mensal**: Mostrar apenas a barra de "Novos" (ocultar cancelamentos, encerramentos, congelamentos). Subtitulo muda para "Novos contratos nos ultimos 6 meses"

**3. Remover cards de Taxa de Retencao e Valor Perdido**

Remover completamente a secao "Retention & Financial Loss Row" (linhas 1110-1165) da view normal e a secao correspondente no Focus Mode (linhas 1343-1391). O `retentionMetrics` e `lostFinancialValue` useMemo podem ser removidos tambem.

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Dashboard.tsx` | Adicionar state `gestaoViewMode`, botao toggle no header, condicionar exibicao de cards/barras do grafico, remover cards de retencao/valor perdido |

### Detalhes tecnicos

**Novo state:**
```typescript
const [gestaoViewMode, setGestaoViewMode] = useState<"operacoes" | "comercial">("operacoes");
```

**Botao no header (ao lado de Modo Foco):**
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => setGestaoViewMode(prev => prev === "operacoes" ? "comercial" : "operacoes")}
>
  {gestaoViewMode === "operacoes" ? <Eye /> : <EyeOff />}
  {gestaoViewMode === "operacoes" ? "Operacoes" : "Comercial"}
</Button>
```

**Status cards**: Envolver os cards de Cancelamentos, Encerramentos e Congelamentos com `{gestaoViewMode === "operacoes" && (...)}`. Ajustar grid para `md:grid-cols-${gestaoViewMode === "operacoes" ? 6 : 3}`.

**Grafico**: Renderizar as `<Bar>` de cancelamentos, encerramentos e congelamentos apenas quando `gestaoViewMode === "operacoes"`.

**Remocoes**: Deletar os blocos de Taxa de Retencao e Valor Perdido tanto na view normal quanto no Focus Mode. Remover os useMemo `retentionMetrics` e `lostFinancialValue` que ficam orfaos.

