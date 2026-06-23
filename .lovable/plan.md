## Mover Camila para a conta da equipe

A Camila Menaldo está cadastrada em uma conta diferente (`d606856a-...`) da equipe da Andreia (`796e7970-...`). Por isso ela não aparece na lista de membros e a criação dela pela Andreia foi bloqueada pelo check global de email duplicado.

### Ação (1 update de dados, sem schema)

Atualizar `users.account_id` da Camila para a conta da equipe:

```sql
UPDATE public.users
SET account_id = '796e7970-fd93-4574-a871-6090624cace6',
    updated_at = now()
WHERE id = '95828516-4536-45ab-93a2-4aa278081d33';
```

### Pós-ação

- A Camila passa a aparecer no card "Adicionar Membro" → lista de membros da Andreia, entre Bruna e Darlan.
- Login (`camilaconsultora@anjosbusiness.com.br`) e auth_user_id continuam os mesmos — ela não precisa redefinir senha.
- Como não existem linhas em `user_team_roles` para ela, ela aparece sem funções atribuídas. A Andreia pode editar o card e adicionar as funções desejadas (ex.: Supervisor CX, Consultor) depois.
- Conta órfã `d606856a-...`: deixar como está por enquanto. Se quiser limpar depois, posso checar se há dados ligados a esse account_id em outras tabelas e propor remoção numa próxima etapa.

### Não vou mexer agora

- Nem na edge function `create-team-user` (o comportamento de bloquear emails duplicados globalmente continua válido — só faz sentido revisar se isso voltar a acontecer com outros casos).
- Nem em `user_team_roles` (atribuir função é decisão da Andreia pela UI).
