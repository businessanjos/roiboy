

## Diagnóstico: Formulários CX preenchidos mas "inacessíveis"

### Dados confirmados no banco
Os 14 formulários CX preenchidos **existem corretamente** no banco de dados. Não há dados perdidos. As políticas de segurança (RLS) também estão corretas — o SELECT está permitido para o account_id correto.

### Causa raiz do problema
Quando você clica no formulário "Formulário CX - Conhecendo Você" na lista, o diálogo abre na aba **"Preview"** por padrão (que mostra uma prévia do formulário em branco, para testes). As respostas preenchidas ficam na aba **"Respostas [14]"**, que é a terceira aba no topo do diálogo.

O código atual em `Forms.tsx` linha 1735:
```tsx
<Tabs defaultValue="preview" ...>
```

Isso faz com que o diálogo sempre abra na aba Preview, mesmo quando o usuário quer ver as respostas.

### Correção — `src/pages/Forms.tsx`

1. **Mudar o `defaultValue` da Tabs para `"responses"`** quando o diálogo é aberto via clique na linha do formulário (função `viewResponses`). Isso garante que ao clicar em qualquer formulário, o usuário veja imediatamente as respostas preenchidas.

2. Adicionar um estado `activeTab` que controla qual aba está ativa, e setá-lo como `"responses"` em `viewResponses()` e `"fields"/"preview"` quando aberto por outras ações (como editar).

Resultado: Ao clicar no formulário CX na lista, o diálogo abrirá diretamente na aba de Respostas mostrando os 14 cards com os dados preenchidos por cada sócio.

