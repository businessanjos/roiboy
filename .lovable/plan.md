

## Corrigir botao "..." (mais opcoes) nos paineis do Insights

### Problema

O `DropdownMenu` e renderizado condicionalmente com base no estado `showActions`, que e controlado por `onMouseEnter`/`onMouseLeave` do div pai. Quando o usuario clica no botao "...", o dropdown abre, mas o conteudo do menu e renderizado em um **portal** (fora do div pai). O mouse saindo do div pai dispara `onMouseLeave`, que seta `showActions = false`, desmontando o `DropdownMenu` inteiro antes que o usuario consiga interagir.

### Solucao

Adicionar um estado `dropdownOpen` controlado para o `DropdownMenu` e incluir essa variavel na condicao de renderizacao, garantindo que o dropdown permaneca montado enquanto estiver aberto.

### Arquivos afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/sidebar/InsightsDashboardItem.tsx` | Adicionar estado `dropdownOpen`, usar `DropdownMenu` controlado (`open`/`onOpenChange`), incluir `dropdownOpen` na condicao de visibilidade |
| `src/components/insights/sidebar/InsightsPanelItem.tsx` | Mesma correcao |

### Detalhes tecnicos

Em ambos os arquivos:

1. Adicionar `const [dropdownOpen, setDropdownOpen] = useState(false);`
2. Mudar a condicao de renderizacao de:
   - `showActions || renameDialogOpen || deleteDialogOpen`
   - para: `showActions || dropdownOpen || renameDialogOpen || deleteDialogOpen`
3. Tornar o `DropdownMenu` controlado:
   - `<DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>`

Isso garante que quando o dropdown esta aberto, ele permanece montado mesmo que o mouse saia do div pai.

