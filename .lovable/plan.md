
## Corrigir dialog "Novo Cliente" - badges de campos obrigatorios ocupando toda a tela

### Problema Identificado

O dialog "Novo Cliente" exibe 169 badges de campos obrigatorios no `DialogHeader` (linhas 1706-1726 de `Clients.tsx`). Esses badges estao **fora** do `ScrollArea` (que comeca na linha 1730), entao quando ha muitos campos obrigatorios, eles ocupam toda a area visivel do dialog e empurram o formulario real (nome, telefone, avatar, etc.) para fora da tela. A usuaria Rosane so consegue ver os badges e nao consegue acessar os campos de entrada.

### Solucao

Duas alteracoes na area de badges de progresso:

1. **Limitar a altura dos badges com scroll proprio** - Envolver a lista de badges (linhas 1706-1726) em um container com `max-h-[80px] overflow-y-auto` quando houver mais de 10 campos. Isso garante que os badges nao ocupem mais que ~80px de altura, com rolagem interna para ver todos.

2. **Tornar os badges colapsaveis** - Quando houver mais de 10 campos obrigatorios, mostrar apenas a barra de progresso com contagem por padrao, e um botao "Ver campos" para expandir/colapsar a lista de badges. Isso mantem o dialog limpo para contas com muitos campos.

### Alteracao tecnica

**Arquivo:** `src/pages/Clients.tsx`

Na secao de badges (linhas 1706-1726), substituir a renderizacao direta por uma versao condicional:

- Se `requiredChecks.length <= 10`: manter badges visiveis normalmente (comportamento atual)
- Se `requiredChecks.length > 10`: esconder badges por padrao, mostrar apenas a barra de progresso e um link "Ver X campos" que ao clicar expande um container com `max-h-[80px] overflow-y-auto` mostrando todos os badges

Sera necessario adicionar um estado `showRequiredBadges` (useState boolean) para controlar a visibilidade.

### Resultado esperado

- Contas com poucos campos obrigatorios: sem mudanca visual
- Contas com muitos campos (como a Rosane com 169): dialog abre mostrando a barra de progresso compacta, formulario visivel e acessivel imediatamente
- Badges podem ser expandidos opcionalmente para conferir quais campos faltam
