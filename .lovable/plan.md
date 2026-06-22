Nenhuma alteração necessária.

O Supervisor CX já consegue cadastrar novos membros no seu setor, com as seguintes regras (já implementadas):

- Vê a aba **Configurações → Equipe** mesmo sem ser admin (via permissão `team.edit_cx`).
- Só pode atribuir papéis cuja `area = 'CX'` (validado no frontend e na edge function `create-team-user`).
- Não pode marcar "Também é Admin" (bloqueado na UI e rejeitado no backend).
- Novos membros criados por ele recebem automaticamente acesso aos setores **Operações** e **RoyZapp**.
- Mantém a mesma `account_id` do supervisor.

Se quiser, posso ajustar algum desses comportamentos depois — basta pedir.