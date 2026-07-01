## Comparação de permissões — Camila Menaldo × Maria

Verifiquei nas quatro camadas que definem acesso no sistema. **Não estão iguais** — há duas diferenças reais e uma cosmética.

### Resumo

| Camada | Maria | Camila | Igual? |
|---|---|---|---|
| `role` global | member | member | Sim |
| `is_also_admin` | false | false | Sim |
| Papéis de equipe (`user_team_roles`) | **CX** | **CX + CS** | Não |
| Setores ativos (`user_sector_access`) | operacoes, royzapp | operacoes, royzapp | Sim |
| Agente RoyZapp (`zapp_agents`) | 1 linha ativa, sem global | **2 linhas** ativas (duplicado), sem global | Não |

Observação: Maria também tem um registro em `eventos`, mas está `is_active=false`, então não conta como permissão efetiva.

### O que isso significa na prática

1. **Camila enxerga mais que Maria por causa do papel "CS"**
   Ter os dois papéis (CX + CS) faz `usePermissions` unir as permissões dos dois. Dependendo do que estiver configurado em `role_permissions` para "CS", Camila pode ver telas/ações que Maria não vê (por ex. áreas específicas do Customer Success). Maria só herda o conjunto de "CX".

2. **Camila tem um `zapp_agents` duplicado**
   Duas linhas ativas para o mesmo usuário podem inflar `current_chats`, causar dupla atribuição em roteamento round-robin e aparecer duplicada em listas de agentes. É bug de dados, não de permissão, mas convém limpar.

### Plano de ajuste (para deixar 100% iguais à Maria)

1. **Remover o papel "CS" de Camila** em `user_team_roles` (mantendo apenas "CX"), OU adicionar "CS" também à Maria — precisa da sua decisão.
2. **Deduplicar `zapp_agents` da Camila**: manter 1 linha ativa e desativar/apagar a outra.
3. Reconfirmar via nova consulta que as duas usuárias retornam exatamente o mesmo conjunto de papéis, setores ativos e 1 linha de agente.

### Perguntas antes de aplicar

- Quer **igualar Camila à Maria** (remover CS de Camila) ou **igualar Maria à Camila** (adicionar CS à Maria)?
- Posso deduplicar o `zapp_agents` da Camila mantendo a linha mais recente?
