

# Correção: Redirecionamento do Calendário de Conteúdo para Redes Sociais

## Problema Identificado

Ao clicar nos ícones de redes sociais no Calendário de Conteúdo, a navegação vai para `/social-media?platform=instagram&postId=xxx`, mas:

1. **A página `SocialMedia.tsx` ignora os parâmetros da URL** - Usa `useState` local sem ler `platform` e `postId` dos query params
2. **Os componentes não recebem o `postId`** - `SocialMediaTab` e `TikTokTab` não sabem qual post foi solicitado
3. **Não há seleção automática de perfil** - O post pode pertencer a um perfil diferente do selecionado

---

## Fluxo Atual (Quebrado)

```text
Calendário → navigate("/social-media?platform=instagram&postId=xxx")
                    ↓
            SocialMedia.tsx
            (ignora query params)
                    ↓
            platform = "instagram" (hardcoded)
            postId = undefined
                    ↓
            SocialMediaTab (sem postId)
                    ↓
            Usuário não vê o post específico
```

---

## Solução Proposta

### Mudança 1: Ler Query Params em SocialMedia.tsx

Usar `useSearchParams` para ler e aplicar os parâmetros da URL:

```typescript
import { useSearchParams } from "react-router-dom";

export default function SocialMedia() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Ler parâmetros da URL
  const urlPlatform = searchParams.get("platform") as "instagram" | "tiktok" | null;
  const urlPostId = searchParams.get("postId");
  
  // Estados controlados pelos query params
  const [platform, setPlatform] = useState<"instagram" | "tiktok">(
    urlPlatform || "instagram"
  );
  
  // Sincronizar mudanças na URL com o estado
  useEffect(() => {
    if (urlPlatform && urlPlatform !== platform) {
      setPlatform(urlPlatform);
    }
  }, [urlPlatform]);
  
  // Passar postId para os componentes filhos
  return (
    // ...
    <SocialMediaTab initialPostId={urlPostId} />
    // ...
    <TikTokTab initialPostId={urlPostId} />
  );
}
```

### Mudança 2: Receber e Usar postId no SocialMediaTab

O componente deve:
1. Receber `initialPostId` como prop
2. Ao carregar, buscar o post para descobrir seu `profile_id`
3. Selecionar automaticamente o perfil correto
4. Abrir o dialog de edição ou scroll para o post

```typescript
interface SocialMediaTabProps {
  initialPostId?: string | null;
}

export function SocialMediaTab({ initialPostId }: SocialMediaTabProps) {
  // ...
  
  useEffect(() => {
    if (initialPostId && posts.length > 0) {
      const targetPost = posts.find(p => p.id === initialPostId);
      if (targetPost) {
        // Selecionar o perfil correto se diferente
        if (targetPost.profile_id !== currentProfile?.id) {
          setSelectedProfileId(targetPost.profile_id);
        }
        // Abrir dialog de edição para o post
        setSelectedPost(targetPost);
        setEditPostDialogOpen(true);
      }
    }
  }, [initialPostId, posts]);
}
```

### Mudança 3: Aplicar a Mesma Lógica no TikTokTab

Implementar a mesma funcionalidade para posts do TikTok.

### Mudança 4: Limpar postId Após Uso

Após abrir o post, limpar o parâmetro da URL para evitar reabrir ao navegar:

```typescript
// Após abrir o dialog
searchParams.delete("postId");
setSearchParams(searchParams, { replace: true });
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/SocialMedia.tsx` | Ler query params (`platform`, `postId`) e passar para componentes filhos |
| `src/components/marketing/SocialMediaTab.tsx` | Receber `initialPostId`, selecionar perfil correto e abrir dialog do post |
| `src/components/marketing/TikTokTab.tsx` | Mesma implementação para TikTok |

---

## Resultado Esperado

Após as mudanças:
1. Clicar em um post no Calendário de Conteúdo → navega para `/social-media?platform=instagram&postId=xxx`
2. A página detecta a plataforma e muda para a aba correta (Instagram ou TikTok)
3. O componente busca o post, seleciona o perfil dono do post automaticamente
4. O dialog de edição abre mostrando os detalhes do post clicado
5. O usuário pode analisar e editar o post sem precisar procurá-lo manualmente

