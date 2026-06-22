## Conclusão da investigação — Camila Menaldo

A Camila **existe** no banco. A confusão foi entre dois IDs distintos:

- `users.id` = `95828516-4536-45ab-93a2-4aa278081d33` (FK interna do app)
- `users.auth_user_id` = `6f72e53c-e71d-49f4-87ed-c8217cf356de` (Supabase Auth — o ID que você pesquisou)

Dados do registro:
- Nome: Camila Menaldo
- Email: camilaconsultora@anjosbusiness.com.br
- Conta: `d606856a-697a-45be-9e98-7405994b74a9` (mesma da Andreia)
- Role: admin
- Criada em: 22/06/2026

## Por que a Andreia recebeu erro

A edge function `create-team-user` bloqueou corretamente: a Camila já é membro da conta. Com a correção que aplicamos no `TeamManager.tsx` + `extractEdgeFunctionError`, próximas tentativas mostrarão a mensagem clara:

> "Já existe um membro com este email (Camila Menaldo) na sua equipe. Use 'Editar' no card dele para alterar funções ou senha."

## Ação

Nenhuma. Apenas confirmação. Nenhuma mudança de código, schema, RLS ou dados é necessária.
