

## Plano: Leads com múltiplos telefones no ROY zAPP

### Problema
Atualmente, leads com telefones adicionais aparecem como uma única entrada na busca do "Nova Conversa". Além disso, ao clicar no botão de conversa no setor Vendas, o sistema usa apenas o telefone principal sem oferecer escolha.

### Alterações

**1. Busca no "Nova Conversa" (`src/pages/RoyZapp.tsx` — função `searchContacts`)**

- Na query de leads (linha ~3088), incluir `additional_phones` no select
- Ao mapear os resultados dos leads (linhas ~3147-3153): para cada lead que tenha `additional_phones`, gerar **entradas separadas** — uma para o telefone principal e uma para cada telefone adicional
- Cada entrada terá o mesmo `id` do lead mas com sufixo do telefone (ex: `lead.id + "-alt-0"`) e `phone_e164` correspondente ao telefone alternativo
- Se a busca for por telefone (`isPhoneSearch`), filtrar para retornar apenas o(s) número(s) que correspondem à busca
- Na UI do `ZappNewConversationDialog`, mostrar o número abaixo do nome normalmente (já faz isso)

**2. Seletor de telefone no botão Vendas (`src/components/sales/LeadsTab.tsx`)**

- Criar um novo componente `ZappLeadPhonePickerDialog` — dialog simples com lista dos telefones disponíveis do lead (principal + adicionais)
- No `LeadsTab`, ao clicar no botão de conversa do lead:
  - Se o lead tem `additional_phones` com ao menos 1 item → abrir o picker
  - Se o lead tem apenas o telefone principal → comportamento atual (direto)
- Ao selecionar um telefone no picker, chamar `openZappConversation` com o telefone escolhido

**3. Novo componente: `src/components/royzapp/dialogs/ZappLeadPhonePickerDialog.tsx`**

Dialog compacto com:
- Título: "Selecione o número"
- Lista dos telefones com indicação "(Principal)" no primeiro
- Ao clicar, fecha o dialog e dispara a ação

### Arquivos alterados
- `src/pages/RoyZapp.tsx` — expandir leads com múltiplos telefones na busca
- `src/components/sales/LeadsTab.tsx` — lógica de verificação antes de abrir conversa
- `src/components/royzapp/dialogs/ZappLeadPhonePickerDialog.tsx` — novo componente
- `src/components/royzapp/dialogs/index.ts` — exportar novo componente

