
# Plano: Corrigir Atualização de Dados na Análise de Conteúdos

## Diagnóstico do Problema

Após investigação detalhada, identifiquei **4 causas potenciais** para os dados não atualizarem após edição de métricas dos posts:

### 1. Query Key Inconsistente com Invalidação

**Problema:**
```typescript
// Query usa 3 elementos
queryKey: ['instagram-posts', currentProfile?.id, useMockData]

// Invalidação usa apenas prefixo
queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
```

O estado `useMockData` é gerenciado internamente e pode estar dessincronizado entre diferentes renderizações, fazendo com que a invalidação não atinja a query correta.

### 2. staleTime Global de 5 Minutos

O cache está configurado para manter dados "frescos" por 5 minutos, o que pode interferir com refetch imediato após invalidação em certas condições de rede ou estado.

### 3. Warning de forwardRef no DialogFooter

Console mostra erro de ref no `DialogFooter`, indicando problema potencial no fluxo de fechamento do dialog que pode afetar a execução do callback `onSuccess`.

### 4. Múltiplos Estados Interdependentes

A query de posts depende de `currentProfile` e `useMockData`, que são derivados de outras queries/estados. Uma mudança em qualquer um deles pode causar re-fetch com dados antigos.

---

## Solução Proposta

### Mudança 1: Melhorar Invalidação de Cache no Hook

**Arquivo:** `src/hooks/useSocialMediaData.tsx`

Alterar a invalidação para usar `exact: false` explicitamente e também forçar refetch:

```typescript
// No updatePost.onSuccess (linha ~383)
onSuccess: () => {
  // Invalidar todas as queries de posts com prefixo
  queryClient.invalidateQueries({ 
    queryKey: ['instagram-posts'],
    exact: false,
    refetchType: 'all'
  });
  // Também invalidar dashboard que pode usar esses dados
  queryClient.invalidateQueries({ queryKey: ['instagram-dashboard'] });
  toast.success('Post atualizado com sucesso!');
},
```

### Mudança 2: Remover `useMockData` da Query Key

Simplificar a query key para não depender de estado volátil:

```typescript
// Linha ~101-102
const { data: posts = [], isLoading: isLoadingPosts } = useQuery({
  queryKey: ['instagram-posts', currentProfile?.id],
  queryFn: async () => {
    if (!currentProfile) return [];
    
    // Verificar mock data dentro da função, não na key
    const { data, error } = await supabase
      .from('instagram_posts')
      .select('*')
      .eq('profile_id', currentProfile.id)
      .order('posted_at', { ascending: false });

    // Se não houver dados reais e perfil for mock, retornar mock
    if (error) throw error;
    return data as InstagramPost[];
  },
  enabled: !!currentProfile && !useMockData,
  staleTime: 30000, // 30 segundos para posts - mais responsivo
});
```

### Mudança 3: Adicionar staleTime Específico para Posts

Reduzir o staleTime especificamente para a query de posts para garantir refetch após invalidação:

```typescript
staleTime: 30000, // 30 segundos em vez de 5 minutos global
```

### Mudança 4: Corrigir Warning de forwardRef no DialogFooter

**Arquivo:** `src/components/ui/dialog.tsx`

Atualizar `DialogFooter` para usar `React.forwardRef`:

```typescript
const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref}
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} 
    {...props} 
  />
));
DialogFooter.displayName = "DialogFooter";
```

### Mudança 5: Adicionar Fallback de Refetch Manual

Garantir que após fechar o dialog, os dados sejam recarregados:

**Arquivo:** `src/components/marketing/SocialMediaTab.tsx`

```typescript
const handleEditPost = (postId: string, data: EditPostFormData) => {
  updatePost.mutate(
    { postId, data },
    {
      onSuccess: () => {
        setEditPostDialogOpen(false);
        setSelectedPost(null);
        // Força refetch explícito após 100ms
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['instagram-posts'] });
        }, 100);
      },
    }
  );
};
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSocialMediaData.tsx` | Melhorar invalidação e simplificar query key |
| `src/components/ui/dialog.tsx` | Corrigir forwardRef no DialogFooter |
| `src/components/marketing/SocialMediaTab.tsx` | Adicionar refetch manual como fallback |

---

## Resultado Esperado

Após as correções:
1. A invalidação de cache será mais agressiva e confiável
2. A query key não dependerá de estado volátil
3. O staleTime menor garantirá refetch mais rápido
4. O warning do console será eliminado
5. Um refetch manual como fallback garantirá atualização mesmo em edge cases

---

## Seção Técnica: Detalhes de Implementação

### Comportamento do React Query com invalidateQueries

A invalidação por prefixo funciona com `exact: false` (padrão), mas há nuances:
- Se a query está "fresh" (dentro do staleTime), ela é marcada como "stale" mas não refetch automaticamente
- O `refetchType: 'all'` força refetch de todas as queries matching

### Por que o problema não afeta todos os usuários?

Usuários que:
- Têm conexão mais lenta (a invalidação completa antes do re-render)
- Navegam entre abas (forçam refetch ao retornar)
- Têm menos dados em cache

Não experienciam o problema porque o timing naturalmente favorece o refetch.

### Diagnóstico para o Warning de Ref

O Radix UI Dialog internamente pode passar refs para children. O `DialogFooter` sendo um componente funcional simples não suporta isso, causando o warning. Embora seja apenas um warning, pode indicar comportamentos inesperados no lifecycle do componente.
