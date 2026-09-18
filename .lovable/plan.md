# Kleberson nos SPIFFs e remoção de vendedores inativos

## O que está acontecendo (confirmado no sistema)

1. **Kleberson não aparece** porque a ficha dele no RH ("Kleberson Alves", cargo Executivo Comercial, ativo) **não está ligada ao usuário dele do sistema** (klebersonalves@anjosbusiness.com). Todas as telas de Metas & Incentivos montam a lista de vendedores a partir das fichas de RH que têm usuário vinculado — sem esse vínculo ele é descartado antes de qualquer cálculo.
2. **Vanessa Minelli continua aparecendo** mesmo estando desligada no RH (inativa desde 01/06/2026). As telas filtram pelo cargo, mas não olham a situação da pessoa.
3. Duas telas (**Metas** e **Simulador de Comissão**) têm a lista de vendedores **escrita à mão no código** (só Darlan, Vanessa e Jonathan). Por isso Kleberson não aparece em nenhuma função dessa aba.

## O que será feito

1. **Vincular a ficha do Kleberson ao usuário dele** no cadastro de colaboradores, para que ele passe a ser reconhecido como vendedor em todo o sistema.
2. **Esconder vendedores inativos** em todas as telas de Metas & Incentivos: quem está desligado no RH ou com usuário desativado deixa de aparecer nos painéis de SPIFFs, roletas, OTE, metas e simulador. Registros históricos (giros já pagos, comissões passadas) continuam preservados.
3. **Trocar as listas fixas por lista dinâmica**: Metas e Simulador passam a usar a mesma regra das demais telas (cargo comercial + pessoa ativa), então qualquer vendedor novo aparece sozinho, sem precisar mexer no código.

## Detalhes técnicos

- Dado: `hr_collaborators` id `e692bf26-731e-497b-89e2-2878b2f3b0a7` recebe `user_id = a19843c8-3790-41b3-9b3d-4490b385316d` (users.id do Kleberson, conta 796e7970-…).
- Criar helper compartilhado `src/lib/sales/salesClosers.ts` com o hook `useActiveSalesClosers()`: consulta `hr_collaborators` (`account_id`, `user_id not null`, `position ilike %closer%|%executiv%`, excluindo sdr/gerente/manager) **com `status = 'active'` e `termination_date is null`**, cruza com `users` filtrando `is_active <> false`, devolve `{ userId, name, position }`.
- Substituir as consultas duplicadas pelo hook em:
  - `SpiffsSection.tsx` (linhas ~83, ~1094, ~1404)
  - `PaymentMethodSpiffPanel.tsx` (~58)
  - `OTESection.tsx` (~63 — manter filtro por `positionTitle`, somar status/termination)
  - `QuotasSection.tsx` e `CommissionSimulator.tsx`: remover as constantes `SALES_USER_IDS` e usar o hook (Jonathan permanece se a ficha de RH dele estiver em cargo comercial ativo; caso contrário, manter inclusão explícita apenas nas telas em que ele hoje aparece).
- Sem alteração de RLS, de esquema ou de dados históricos além do vínculo de `user_id`.

## Validação

- Conferir que SPIFFs, Cash Collect, War Day, Hat Trick, OTE, Metas e Simulador listam Darlan e Kleberson e **não** listam Vanessa.
- `bun x tsgo --noEmit` e build limpos.
