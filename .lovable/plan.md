# Processos: abrir em "Processos" e liberar "ver todas" por pessoa

## O que muda
1. **Ao abrir a aba, o foco fica em "Processos".** O botão "Processos" passa para a esquerda e "Em andamento" fica à direita. Quem quiser acompanhar o andamento clica nele. Os links que já chegam com uma cliente, um evento ou uma etapa continuam abrindo direto no processo.
2. **Só administrador e gestor veem todas as clientes.** Em "Em andamento", o filtro "Todas" e a escolha de uma consultora aparecem apenas para administradores e gestores, como já é hoje. As consultoras veem só as clientes delas.
3. **O gestor pode liberar "ver todas" para uma pessoa específica.** Ao lado do filtro aparece um botão discreto, "Quem vê todas", visível só para gestor e administrador. Ele abre uma janela com a lista da equipe e uma chave por pessoa. Quem tiver a chave ligada passa a ver o filtro "Todas" e as clientes de todas as consultoras. Cada mudança fica registrada com quem fez e quando.

## Detalhes técnicos
- `CSProcesses.tsx`: o estado inicial de `tab` vira `"process"`, e a ordem dos botões é trocada.
- A liberação usa o modelo de permissões que já existe (`user_permission_overrides`), com um item novo `cs` / `processos_ver_todas`. Ele é lido por `useUserPermissions`, e não é preciso criar tabela nova. Se o gravador de overrides só aceitar itens do catálogo, o item novo será incluído no catálogo de módulos.
- `InProgressBoard.tsx`: `canSeeAll = isManagementUser || override ativo`. Esse valor controla o "Todas" e a lista de consultoras.
- Novo `SeeAllAccessDialog.tsx`: lista os usuários da conta e grava ou remove o override. A gravação segue as regras de acesso que já valem para os overrides (só gestor e administrador).
- Atualizar o `AGENTS.md` de `csProcesses` com a regra de visibilidade.
