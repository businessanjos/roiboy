
# Plano: Adicionar Campo "Cliques no Link" na Janela Editar Post

## Diagnóstico da Causa Raiz

O campo "Cliques no Link" (`link_clicks`) existe corretamente:
- No banco de dados (tabela `instagram_posts`)
- Na interface TypeScript `InstagramPost`
- No `AddPostDialog.tsx` (janela de adicionar)

Porém, foi **completamente omitido** no `EditPostDialog.tsx` quando esse componente foi criado. Esta é uma falha de sincronização entre os dois diálogos - ao copiar ou criar o EditPostDialog, o campo `link_clicks` simplesmente não foi incluído.

## Comparação AddPostDialog vs EditPostDialog

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ADDPOSTDIALOG (CORRETO)                     │
├─────────────────────────────────────────────────────────────────┤
│ Interface: link_clicks: number ............................ ✓  │
│ State: const [linkClicks, setLinkClicks] = useState('') ... ✓  │
│ useEffect: setLinkClicks(post.link_clicks) ................ ✓  │
│ handleSubmit: link_clicks: linkClicksNum .................. ✓  │
│ UI: <Input id="linkClicks" ... /> ......................... ✓  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   EDITPOSTDIALOG (PROBLEMA)                    │
├─────────────────────────────────────────────────────────────────┤
│ Interface: link_clicks: number ............................ ✗  │
│ State: const [linkClicks, setLinkClicks] = useState('') ... ✗  │
│ useEffect: setLinkClicks(post.link_clicks) ................ ✗  │
│ handleSubmit: link_clicks: linkClicksNum .................. ✗  │
│ UI: <Input id="linkClicks" ... /> ......................... ✗  │
└─────────────────────────────────────────────────────────────────┘
```

## Alteracoes Tecnicas Necessarias

### 1. Adicionar `link_clicks` na interface `EditPostFormData`

**Arquivo:** `src/components/marketing/EditPostDialog.tsx`

**Linha 59** - Adicionar entre `saves` e `views`:
```typescript
export interface EditPostFormData {
  // ... campos existentes
  saves: number;
  link_clicks: number;  // ADICIONAR
  views: number;
  // ...
}
```

### 2. Adicionar estado `linkClicks`

**Linha 92** - Adicionar entre `saves` e `views`:
```typescript
const [saves, setSaves] = useState('');
const [linkClicks, setLinkClicks] = useState('');  // ADICIONAR
const [views, setViews] = useState('');
```

### 3. Popular o estado no useEffect

**Linha 114** - Adicionar entre `setSaves` e `setViews`:
```typescript
setSaves(post.saves.toString());
setLinkClicks((post.link_clicks || 0).toString());  // ADICIONAR
setViews((post.views || 0).toString());
```

### 4. Processar no handleSubmit

**Linha 137** - Adicionar entre `savesNum` e `viewsNum`:
```typescript
const savesNum = parseInt(saves) || 0;
const linkClicksNum = parseInt(linkClicks) || 0;  // ADICIONAR
const viewsNum = parseInt(views) || 0;
```

### 5. Incluir no objeto de submissao

**Linha 154** - Adicionar entre `saves` e `views`:
```typescript
saves: savesNum,
link_clicks: linkClicksNum,  // ADICIONAR
views: viewsNum,
```

### 6. Adicionar campo Input na UI (Metricas)

**Linha 382** - Adicionar entre "Salvamentos" e "Views":
```tsx
<div className="space-y-1">
  <Label htmlFor="edit-link-clicks" className="text-xs text-muted-foreground">
    Cliques no Link
  </Label>
  <Input
    id="edit-link-clicks"
    type="number"
    min="0"
    placeholder="0"
    value={linkClicks}
    onChange={(e) => setLinkClicks(e.target.value)}
    className="h-8"
  />
</div>
```

## Layout Final das Metricas (Grid 4 colunas)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Metricas                                                                     │
├──────────────────┬───────────────────┬───────────────────┬───────────────────┤
│ Alcance *        │ Curtidas          │ Comentarios       │ Compartilhamentos │
│ [225952]         │ [4169]            │ [121]             │ [1733]            │
├──────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Salvamentos      │ Cliques no Link   │ Views             │ Reposts           │
│ [781]            │ [___] ← NOVO      │ [431537]          │ [303]             │
├──────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Seg. Ganhos      │ Visitas ao Perfil │                   │                   │
│ [41]             │ [270]             │                   │                   │
└──────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/marketing/EditPostDialog.tsx` | Adicionar `link_clicks` na interface, estado, useEffect, handleSubmit e UI |

## Prevencao de Recorrencia

Este tipo de problema ocorre quando componentes similares (Add vs Edit) divergem. Para evitar no futuro:
1. Manter interfaces de formulario compartilhadas entre Add e Edit
2. Ao adicionar novo campo em um dialog, verificar o outro
3. Considerar extrair a secao de metricas para um componente reutilizavel (ex: `PostMetricsForm`)
