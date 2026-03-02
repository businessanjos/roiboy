

## Corrigir overflow do dialog de campos personalizados

### Problema

O dialog de edição de campos personalizados (`CustomFieldsManager.tsx`) não possui limitação de altura nem barra de rolagem. Quando um campo tem muitas opções (como o caso mostrado na imagem com 20+ opções de select), o conteúdo ultrapassa os limites da tela e fica inacessível.

### Solução

Adicionar `max-h-[85vh] overflow-y-auto` ao `DialogContent` do editor de campos na linha 631 do arquivo `CustomFieldsManager.tsx`.

Isso limita a altura do dialog a 85% da viewport e adiciona uma barra de rolagem vertical quando o conteúdo excede esse limite.

### Alteração técnica

**Arquivo:** `src/components/custom-fields/CustomFieldsManager.tsx`

- **Linha 631**: Alterar de `className="max-w-lg"` para `className="max-w-lg max-h-[85vh] overflow-y-auto"`

