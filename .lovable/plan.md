

# Plano: Correção do Salvamento de Dados na Análise de Conteúdo

## Problema Identificado

Ao editar posts na Análise de Conteúdo, as alterações não são persistidas. A causa raiz é que o campo `link_clicks` está **faltando** na mutation `updatePost` do hook `useSocialMediaData.tsx`.

## Analise Tecnica

### O que esta acontecendo:

1. O formulario `EditPostDialog.tsx` envia **todos os campos** corretamente, incluindo `link_clicks` (linha 60)
2. A mutation `updatePost` em `useSocialMediaData.tsx` **NAO inclui** `link_clicks` nos parametros (linhas 314-332)
3. A chamada `.update()` do Supabase tambem **NAO inclui** `link_clicks` (linhas 349-373)

### Fluxo do Problema:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (COM BUG)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario edita post no EditPostDialog                        │
│     └─> Envia: { ..., link_clicks: 15, ... }                   │
│                                                                 │
│  2. handleEditPost chama updatePost.mutate                      │
│     └─> Passa: { postId, data }                                │
│                                                                 │
│  3. updatePost mutation em useSocialMediaData                   │
│     └─> IGNORA link_clicks (nao esta nos parametros!)          │
│                                                                 │
│  4. Supabase .update() executa                                  │
│     └─> Salva tudo EXCETO link_clicks                          │
│                                                                 │
│  5. Usuario recarrega pagina                                    │
│     └─> Valor antigo de link_clicks aparece novamente          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Solucao

### Arquivo: `src/hooks/useSocialMediaData.tsx`

**Mudanca 1:** Adicionar `link_clicks` na definicao de tipos da mutation (linhas 314-332)

```typescript
// ADICIONAR na linha 325 (apos saves: number;):
link_clicks: number;
```

**Mudanca 2:** Adicionar `link_clicks` na chamada `.update()` (linhas 349-373)

```typescript
// ADICIONAR apos "saves: data.saves," (linha 362):
link_clicks: data.link_clicks || 0,
```

## Codigo Final Esperado

### Parametros da mutation (linhas 314-332):

```typescript
data: {
  permalink: string;
  post_type: 'reels' | 'carousel' | 'static';
  theme?: string;
  ai_objective: 'growth' | 'connection' | 'authority' | 'sales';
  posted_at: Date;
  caption: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  link_clicks: number;  // <-- ADICIONADO
  views: number;
  reposts: number;
  followers_gained: number;
  profile_visits: number;
  specialist_version?: string;
  composition?: string[];
};
```

### Chamada .update() (linhas 349-373):

```typescript
.update({
  instagram_id: instagramId,
  permalink: data.permalink,
  post_type: data.post_type,
  theme: data.theme || null,
  ai_objective: data.ai_objective,
  ai_objective_confidence: 100,
  posted_at: data.posted_at.toISOString(),
  caption: data.caption || null,
  reach: data.reach,
  likes: data.likes,
  comments: data.comments,
  shares: data.shares,
  saves: data.saves,
  link_clicks: data.link_clicks || 0,  // <-- ADICIONADO
  views: data.views,
  reposts: data.reposts,
  followers_gained: data.followers_gained,
  profile_visits: data.profile_visits || 0,
  specialist_version: data.specialist_version || null,
  composition: data.composition || [],
  engagement_rate: Math.round(engagementRate * 100) / 100,
  virality_rate: Math.round(viralityRate * 100) / 100,
  is_trending: engagementRate >= 12 || viralityRate >= 1.5,
  updated_at: new Date().toISOString(),
})
```

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useSocialMediaData.tsx` | Adicionar `link_clicks` nos parametros e no `.update()` |

## Impacto Esperado

- Todas as metricas editadas no formulario serao salvas corretamente
- O campo `link_clicks` sera persistido no banco de dados
- Apos salvar e recarregar, os valores aparecerao corretamente

