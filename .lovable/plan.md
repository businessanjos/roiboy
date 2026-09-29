# Responsável pela renovação (obrigatório ao marcar "É uma renovação")

## O que muda para o usuário
- No negócio, ao ligar a chave **É uma renovação**, abre uma janela obrigatória: **"Quem é o responsável pela renovação?"**
- A lista mostra só o time de Customer Success ativo (Camila, Andréia, Dayara, Michele, Ana Maria etc.), com busca.
- Sem escolher alguém, a chave não fica ligada. Se fechar a janela ou cancelar, a chave volta a ficar desligada.
- O responsável do negócio e o vendedor continuam como estão, sem mudança.
- Abaixo da chave aparece "Responsável pela renovação: Nome", com um link **Trocar**.
- Ao desligar a chave, o responsável pela renovação é apagado.

## Detalhes técnicos
- Migração: coluna `deals.renewal_responsible_user_id uuid` com referência a `users(id)` e `ON DELETE SET NULL`, mais um índice. As regras de acesso atuais de `deals` já cobrem a coluna nova.
- Lista do CS: colaboradores ativos em `hr_collaborators`/`hr_service_providers` do departamento Customer Success/CS, ligados a um usuário ativo. Se a lista vier vazia, uso como reserva `fetchActiveConsultants` mais a Camila.
- Novo `RenewalResponsibleDialog.tsx` (Dialog com Command e busca). `handleToggleRenewal` em `DealDetailSheet.tsx`: ao ligar, abre a janela e só salva `is_renewal=true` junto com o responsável escolhido. Ao desligar, salva `is_renewal=false` e o responsável como nulo.
- Adicionar a coluna no select de `useDeals.tsx`.
