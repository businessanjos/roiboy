
## Correção: Ana Maria não consegue salvar sua senha

### Diagnóstico

Ana Maria é consultora (`role: "mentor"`, `is_also_admin: false`). Quando ela edita seu próprio perfil na aba Equipe e tenta salvar uma nova senha, o sistema chama a edge function `update-team-user-password`. Essa função na linha 64 exige que o usuário solicitante tenha `role === "admin"`, caso contrário retorna erro 403 "Apenas administradores podem alterar senhas".

O problema: a função **não permite que um usuário altere sua própria senha**, mesmo sendo o dono da conta que está sendo editada.

### Causa raiz

A edge function `update-team-user-password` (linha 64) rejeita qualquer usuário que não seja admin, sem verificar se o usuário está alterando sua própria senha.

### Solução

Modificar a edge function para permitir dois cenários:

1. **Admin ou is_also_admin** pode alterar a senha de qualquer membro da mesma conta (comportamento atual ampliado)
2. **Qualquer usuário** pode alterar **sua própria** senha

### Detalhes técnicos

**Arquivo:** `supabase/functions/update-team-user-password/index.ts`

**Alteração 1** -- Query do perfil (linha ~55): incluir `is_also_admin` e `id` na seleção:
```typescript
.select("id, account_id, role, is_also_admin")
```

**Alteração 2** -- Lógica de permissão (linhas 64-69): mover a verificação de admin para depois de sabermos quem é o usuário-alvo, e permitir auto-edição:
```typescript
// Ler o body ANTES da verificação de admin
const body: UpdatePasswordRequest = await req.json();
const { user_id, new_password } = body;

// Verificar se é auto-edição (usuário alterando própria senha)
const isSelfEdit = requestingProfile.id === user_id;
const isAdmin = requestingProfile.role === "admin" || requestingProfile.is_also_admin === true;

// Permitir se for admin OU se for auto-edição
if (!isAdmin && !isSelfEdit) {
  return new Response(
    JSON.stringify({ error: "Apenas administradores podem alterar senhas de outros membros" }),
    { status: 403, ... }
  );
}
```

Isso reorganiza a ordem das verificações: primeiro faz o parse do body, depois verifica se o usuário tem permissão (admin, is_also_admin, ou editando a si mesmo), e só então prossegue com a validação e atualização da senha.
