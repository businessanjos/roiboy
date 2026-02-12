

## Corrigir botao "+ X outras" nas atividades concluidas

### Problema

O texto "+ X outras" na lista de atividades concluidas e apenas um `div` estatico sem nenhum evento de clique. Nao ha logica para expandir e mostrar todas as atividades.

### Solucao

Adicionar um estado `showAllCompleted` ao componente `DealActivitiesTab` que controla se a lista mostra apenas 5 ou todas as atividades concluidas.

### Arquivo afetado

`src/components/sales/DealActivitiesTab.tsx`

### Mudancas

1. Adicionar estado `const [showAllCompleted, setShowAllCompleted] = useState(false)`
2. Trocar `completedTasks.slice(0, 5)` por `completedTasks.slice(0, showAllCompleted ? completedTasks.length : 5)`
3. Transformar o `div` estatico "+ X outras" em um botao clicavel que alterna `showAllCompleted`
4. Quando expandido, mostrar texto "Mostrar menos" para permitir recolher a lista

### Detalhes tecnicos

```
// Linha 321: slice condicional
completedTasks.slice(0, showAllCompleted ? completedTasks.length : 5)

// Linhas 341-345: trocar div por button
<button
  onClick={() => setShowAllCompleted(!showAllCompleted)}
  className="w-full text-center text-[10px] text-muted-foreground py-1.5 hover:bg-muted/30 cursor-pointer"
>
  {showAllCompleted ? "Mostrar menos" : `+ ${completedTasks.length - 5} outras`}
</button>
```

