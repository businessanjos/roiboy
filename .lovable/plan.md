
## Corrigir layout achatado no painel compartilhado

### Causa raiz (encontrada com certeza)

O problema NAO esta no GridLayout nem na medicao de largura. Existem dois estilos CSS globais no `#root` que comprimem o conteudo:

1. **`src/App.css`** (linhas 1-6):
```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
```

2. **`index.html`** (linha 49, inline style):
```css
#root { display: flex; align-items: center; justify-content: center }
```

A combinacao faz com que o `#root` seja um container flex que centraliza filhos E limita a 1280px. Quando o SharedInsightsDashboard renderiza seu div externo (`min-h-screen bg-background`), ele nao se expande para preencher o flex parent -- o flex shrink-to-fit reduz o div ao tamanho do seu conteudo (o grid comeca pequeno), resultando no grid de ~200px.

As outras paginas do app funcionam porque o `AppLayout` provavelmente ocupa largura total. O formulario de email funciona porque usa seu proprio `flex items-center justify-center`.

### Solucao

**Arquivo: `src/pages/SharedInsightsDashboard.tsx`**

Adicionar classes utilitarias do Tailwind ao div externo do componente (na view "approved" e nas views de estado) para garantir que ele ocupe toda a largura disponivel, ignorando as restricoes do `#root`:

1. Adicionar `w-full` ao div externo da view "approved" para forcar largura total dentro do flex parent
2. Adicionar `text-left` para sobrescrever o `text-align: center` do App.css
3. Aplicar o mesmo `w-full` nas views de loading, error, email_form, pending e rejected para consistencia

A alteracao e apenas adicionar `w-full text-left` ao wrapper externo de cada estado do componente. Nao e necessario alterar nenhuma logica de grid, medicao de largura ou qualquer outra parte do codigo.

### Resultado esperado

O grid do painel compartilhado ocupara toda a largura do `#root` (ate 1280px), com os visuais posicionados e dimensionados corretamente, exatamente como no painel original do sistema. O `max-width: 1280px` do App.css limita o `#root` mas o grid ocupara 100% desse espaco.

**Nota**: Idealmente o `src/App.css` deveria ser limpo (ele parece ser o template padrao do Vite que nunca foi removido), mas isso pode afetar outras paginas. A solucao mais segura e apenas adicionar `w-full text-left` no SharedInsightsDashboard. Se desejado, podemos tambem remover os estilos do `App.css` como melhoria futura.
