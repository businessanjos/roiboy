

## Corrigir: Seletor de etapas nao aparece ao editar campos fora do Pipeline

### Problema

Quando um campo personalizado e editado a partir da pagina de Clientes (ou qualquer lugar fora do Pipeline de Vendas), o seletor de etapas obrigatorias nao aparece, mesmo que o campo esteja marcado como obrigatorio. Isso acontece porque o seletor so e exibido quando `sectorContext === "deals"`, e a pagina de Clientes abre o gerenciador com `sectorContext = "clients"` (padrao).

### Causa raiz

No `CustomFieldsManager.tsx`:
- **Linha 320**: `dealStages` so e buscado quando `sectorContext === "deals"`
- **Linha 741**: O seletor de etapas so renderiza quando `sectorContext === "deals" && dealStages.length > 0`
- A pagina de Clientes (e Settings) nao passa `sectorContext="deals"`, entao o seletor nunca aparece

### Solucao

Modificar a logica para buscar e exibir as etapas do pipeline sempre que o campo sendo editado tenha `show_in_deals: true`, independentemente do `sectorContext` de onde o gerenciador foi aberto.

### Alteracoes tecnicas

**Arquivo:** `src/components/custom-fields/CustomFieldsManager.tsx`

1. **Buscar deal stages sempre** - Alterar o `useEffect` (linha 318-334) para buscar etapas do pipeline independente do `sectorContext`, removendo a condicao `sectorContext === "deals"`. Isso garante que `dealStages` esteja sempre disponivel

2. **Mostrar seletor baseado no campo, nao no contexto** - Alterar a condicao de renderizacao (linha 741) de `sectorContext === "deals"` para verificar se o campo sendo editado tem `show_in_deals: true` (usando `editingField?.show_in_deals`). Isso faz o seletor aparecer quando relevante

3. **Ajustar logica de edicao** - Na funcao `handleEditField` (linha 450), remover a condicao `sectorContext === "deals"` para buscar `required_stages` sempre que o campo tem `show_in_deals`

4. **Ajustar logica de salvamento** - Na construcao do payload (linha 563), trocar `sectorContext === "deals"` por verificar se o campo tem `show_in_deals`, para salvar `required_stages` corretamente

| Local no codigo | Mudanca |
|---|---|
| useEffect dealStages (L318-334) | Remover condicao `sectorContext === "deals"` |
| handleEditField (L450) | Trocar `sectorContext === "deals"` por `field.show_in_deals` |
| Payload de save (L563) | Trocar `sectorContext === "deals"` por verificacao de `show_in_deals` |
| Renderizacao do seletor (L741) | Trocar `sectorContext === "deals"` por `editingField?.show_in_deals` |
