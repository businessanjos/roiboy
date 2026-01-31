# Plano Atual: Concluído ✅

## Implementação Realizada: Campos Obrigatórios para Ganho/Perdido

A funcionalidade foi implementada com sucesso. Agora os campos personalizados de negócios podem ser configurados como obrigatórios especificamente para as ações de "Ganho" e "Perdido".

### Arquivos Modificados

1. **`src/components/custom-fields/CustomFieldsManager.tsx`**
   - Adicionados checkboxes "Ao dar Ganho" (com ícone Trophy verde) e "Ao dar Perdido" (com ícone XCircle vermelho)
   - Os checkboxes ficam independentes da opção "Todas as etapas"
   - Valores "won" e "lost" são armazenados no array `required_stages`

2. **`src/hooks/useRequiredFieldsValidation.tsx`**
   - Adicionada nova função `validateDealOutcome(dealId, outcome, accountId)`
   - Filtra campos onde `required_stages` inclui "won" ou "lost"
   - Retorna campos faltantes da mesma forma que `validateDealMove`

3. **`src/components/sales/RequiredFieldsModal.tsx`**
   - Adicionada prop opcional `outcomeType` ("won" | "lost")
   - Mensagens e botões contextuais:
     - "Para marcar como Ganha..." / "Preencher e Ganhar"
     - "Para marcar como Perdida..." / "Preencher e Perder"

4. **`src/pages/SalesPipeline.tsx`**
   - `handleMarkAsWon` agora valida campos obrigatórios antes de prosseguir
   - `handleMarkAsLost` também valida campos obrigatórios
   - Adicionado estado `outcomeRequiredFieldsModal` para controlar o modal
   - Callback `handleOutcomeRequiredFieldsComplete` re-executa a ação após preenchimento

### Como Funciona

1. Usuário marca um campo como obrigatório e seleciona "Ao dar Ganho" e/ou "Ao dar Perdido"
2. Ao clicar em "Ganhar" ou "Perder" um negócio, o sistema valida se há campos faltantes
3. Se houver, exibe o `RequiredFieldsModal` com os campos obrigatórios
4. Após preenchimento, a ação de ganho/perda é executada automaticamente

### Estrutura do `required_stages`

```json
// Obrigatório ao dar ganho
["won"]

// Obrigatório ao perder
["lost"]

// Obrigatório em todas as etapas + ganho
["all", "won"]

// Obrigatório em etapas específicas + perdido
["uuid-etapa-1", "lost"]
```
