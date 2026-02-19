

## Tornar o campo "Link do contrato/invoice" clicavel e removivel

### O que sera feito

Atualizar a exibicao de campos de texto (`text`) que contenham URLs para que sejam renderizados como links clicaveis, e adicionar um botao para limpar o valor do campo.

### Alteracoes

**1. `src/components/custom-fields/FieldValueBadge.tsx`**

No bloco do campo `text` (linhas ~142-150), detectar se o valor e uma URL (comecando com `http://` ou `https://`). Se for:
- Renderizar como um link `<a>` com `target="_blank"` e icone de link externo
- Estilizar com cor primaria e truncamento para URLs longas
- Manter o comportamento atual para textos que nao sao URLs

**2. `src/components/custom-fields/DealFieldValueEditor.tsx`**

No bloco do campo `text` (linhas ~349-377), adicionar:
- Um botao "Limpar" ao lado dos botoes "Salvar" e "Cancelar" que salva `null` como valor
- Quando o valor atual for uma URL, exibir o link clicavel com um botao X para remover diretamente (sem precisar abrir o popover)

### Detalhes tecnicos

- A deteccao de URL usara um regex simples: `/^https?:\/\//i`
- O link tera `rel="noopener noreferrer"` e `target="_blank"` por seguranca
- O botao de remover chamara `saveValue(null)` para limpar o campo
- O `e.stopPropagation()` sera usado nos links e botoes para evitar abrir o popover ao clicar
- A URL sera truncada visualmente mas o link completo sera preservado no `href`

