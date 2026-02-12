
## Adicionar campo de titulo editavel na janela de ajustes do visual

### O que sera feito

Adicionar um campo de texto editavel para o titulo do visual no topo da janela "Ajustes do Visual" (componente `VisualQuickSettings`), permitindo renomear o visual a qualquer momento.

### Detalhes tecnicos

**Arquivo:** `src/components/insights/visuals/VisualQuickSettings.tsx`

1. Importar o componente `Input` de `@/components/ui/input`
2. Adicionar estado local `title` inicializado com `visual.title`
3. Resetar o estado `title` no `useEffect` existente (quando o sheet abre)
4. Adicionar um campo `Input` com label "Titulo do Visual" logo apos o `SheetHeader`, antes das demais secoes
5. No `handleSave`, incluir `title` na chamada `updateVisual` para persistir a alteracao:

```text
await updateVisual(visual.id, { 
  config: newConfig, 
  title: title.trim() || visual.title 
});
```

O `SheetDescription` atual que mostra o titulo estatico sera substituido pelo campo editavel dentro do corpo do sheet.
