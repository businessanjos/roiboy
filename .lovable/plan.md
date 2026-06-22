## Diagnóstico

Com o print ficou claro o que aconteceu:

- Andreia abriu **Adicionar Membro** e preencheu os dados da **Camila Menaldo** (`camilaconsultora@anjosbusiness.com.br`).
- Esse email **já existe na mesma conta** (Camila é admin desde antes).
- A edge function `create-team-user` retornou corretamente **HTTP 400** com `{ error: "Este usuário já faz parte da sua equipe" }`.
- O frontend, porém, exibiu apenas o toast genérico **"Erro ao criar usuário"** — escondendo a causa real e fazendo parecer que o sistema "não deixou" sem explicar o motivo.

## Causa raiz no código

Em `src/components/settings/TeamManager.tsx` (`handleAddUser`, linhas 355-373):

```ts
if (response.error.context?.body) {
  const bodyError = JSON.parse(response.error.context.body);
  ...
}
```

No SDK atual do supabase-js, `FunctionsHttpError.context` é um **`Response` object**, não um objeto com `.body` string. Por isso o `if` falha, cai no fallback e mostra `"Erro ao criar usuário"`.

Resultado: toda mensagem de validação da edge function (email duplicado, role inválido, "supervisor CX não pode criar admin", etc.) some.

## O que vamos corrigir

**1. Extrair a mensagem real do `FunctionsHttpError`** em `TeamManager.tsx`:

```ts
if (response.error) {
  let errorMessage = "Erro ao criar usuário";
  const ctx: any = (response.error as any).context;
  try {
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.clone().json();
      if (body?.error) errorMessage = body.error;
    } else if (ctx && typeof ctx.text === "function") {
      const txt = await ctx.clone().text();
      const body = JSON.parse(txt);
      if (body?.error) errorMessage = body.error;
    } else if (typeof ctx?.body === "string") {
      const body = JSON.parse(ctx.body);
      if (body?.error) errorMessage = body.error;
    }
  } catch {/* mantém fallback */}
  throw new Error(errorMessage);
}
```

Aplicar o mesmo tratamento no `handleEditUser` (linha ~395) e onde mais a tela invoque edge functions e mostre toast.

**2. Pequena melhoria de UX no dialog "Adicionar Membro"**

Quando o email já existe na conta, sugerir explicitamente:
> "Já existe um membro com este email (Camila Menaldo). Use 'Editar' no card dele para alterar funções."

Isso pode ser feito ampliando a mensagem da edge function: incluir o `name` do usuário existente no retorno (já temos `globalUser.name` em mãos na função).

## Confirmação para a Andreia

- O cadastro **não foi duplicado** — nada foi criado.
- A intenção dela era provavelmente **adicionar a função "Supervisor CX" para a Camila** (ou editar o cadastro dela), não criar um novo. Camila já existe como admin.

## Arquivos a tocar

- `src/components/settings/TeamManager.tsx` — corrigir parsing do erro em `handleAddUser` e `handleEditUser`.
- `supabase/functions/create-team-user/index.ts` — incluir `name` do usuário existente na mensagem de erro de email duplicado (mesma conta).

Sem migrations, sem mudança de RLS, sem mudança de permissão.