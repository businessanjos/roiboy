# Responsável pela renovação (obrigatório ao marcar "É uma renovação")

## O que muda para o usuário
- No negócio, ao ligar a chave **É uma renovação**, abre uma janela obrigatória: **"Quem é o responsável pela renovação?"**
- A lista mostra só o time de Customer Success ativo (Camila, Andréia, Dayara, Michele, Ana Maria etc.), com busca.
- Sem escolher alguém, a chave não fica ligada. Se fechar a janela ou cancelar, a chave volta a ficar desligada.
- O responsável do negócio e o vendedor continuam como estão, sem mudança.
- Abaixo da chave aparece "Responsável pela renovação: Nome", com um link **Trocar**.
- Ao desligar a chave, o responsável pela renovação é apagado, mas fica registrado no histórico do negócio.
- O histórico do negócio registra cada mudança: "Marcou como renovação · Responsável: Camila", "Trocou o responsável pela renovação: Camila → Andréia" e "Desmarcou renovação (responsável anterior: Andréia)".

## Detalhes técnicos
- Migração: coluna `deals.renewal_responsible_user_id uuid` com referência a `users(id)` e `ON DELETE SET NULL`, mais um índice. As regras de acesso atuais de `deals` já cobrem a coluna nova.
- Lista do CS: colaboradores ativos em `hr_collaborators`/`hr_service_providers` do departamento Customer Success/CS, ligados a um usuário ativo. Se a lista vier vazia, uso como reserva `fetchActiveConsultants` mais a Camila.
- Novo `RenewalResponsibleDialog.tsx` (Dialog com Command e busca). `handleToggleRenewal` em `DealDetailSheet.tsx`: ao ligar, abre a janela e só salva `is_renewal=true` junto com o responsável escolhido. Ao desligar, salva `is_renewal=false` e o responsável como nulo.
- Adicionar a coluna no select de `useDeals.tsx`.
- Histórico: gravar um registro em `deal_activities`, o mesmo lugar que aparece no histórico do negócio, a cada vez que marcar, trocar ou desmarcar a renovação, com o nome do responsável anterior e do novo.
