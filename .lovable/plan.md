
## Corrigir seletor de etapas obrigatorias nos campos personalizados

### Problema

Quando um campo e marcado como obrigatorio, o seletor de etapas mostra apenas 3 opcoes fixas: "Todas as etapas", "Ao dar Ganho" e "Ao dar Perdido". As etapas individuais do pipeline ficam escondidas atras da checkbox "Todas as etapas" (so aparecem quando ela e desmarcada). Alem disso, o valor padrao e `["all"]`, entao ao abrir o editor o usuario nunca ve as etapas individuais.

### Causa raiz

No `CustomFieldsManager.tsx`:
- **Linha 763**: A condicao `!requiredStages.includes("all")` esconde as etapas individuais quando "Todas as etapas" esta marcada
- **Linha 460**: O valor padrao ao editar e `["all"]`, escondendo as etapas sempre
- **Linha 727**: Ao ativar "Obrigatorio", o padrao tambem e `["all"]`

### Solucao

**Arquivo:** `src/components/custom-fields/CustomFieldsManager.tsx`

1. **Sempre mostrar todas as etapas individuais** - Remover a condicao que esconde etapas quando "all" esta selecionado

2. **"Todas as etapas" vira um toggle de selecionar/desselecionar tudo** - Quando marcada, seleciona todos os IDs individuais das etapas. Quando desmarcada, limpa todos. O estado salvo passa a conter os IDs reais das etapas, nao mais a string "all"

3. **Manter "Ao dar Ganho" e "Ao dar Perdido" como opcoes separadas** - Eles continuam independentes das etapas do pipeline

4. **Ajustar o valor padrao** - Ao editar um campo com `required_stages: ["all"]` (legado), converter para todos os IDs individuais das etapas. Ao criar novo campo obrigatorio, iniciar sem nenhuma etapa selecionada (array vazio) para forcar selecao manual

5. **Ajustar a validacao em `useRequiredFieldsValidation.tsx`** - Remover a logica que trata "all" como caso especial, ja que agora o banco tera apenas IDs reais de etapas. Manter compatibilidade com dados legados que ainda contenham "all"

### Alteracoes tecnicas

| Arquivo | O que muda |
|---|---|
| `src/components/custom-fields/CustomFieldsManager.tsx` | Refatorar UI do seletor de etapas: sempre mostrar etapas individuais, "Todas" como toggle, ajustar defaults |
| `src/hooks/useRequiredFieldsValidation.tsx` | Nenhuma alteracao necessaria - ja trata "all" como fallback |
