
# Plano: Correção da Visualização de Respostas do Formulário CX

## Problemas Identificados

### Problema 1: Campos Truncados/Cortados na Visualização

Após análise da imagem e código, identifiquei que os valores das respostas estão sendo cortados visualmente no modal de visualização. O layout atual tem as seguintes limitações:

**Causa raiz no código:**

| Localização | Problema |
|-------------|----------|
| `FormResponseViewer.tsx` linha 640 | Container de valor usa `sm:w-2/3` mas não tem classe de quebra de texto |
| Linha 633 | O layout flex pode não expandir corretamente com textos longos |
| Linha 231 | O `renderValue` para texto usa `break-words` mas o container pai não permite expansão |

**Evidência na imagem:**
- "Thiago -" aparece truncado quando deveria mostrar "Thiago - empresário e gestor de tráfego"
- "Não tenh" truncado de "Não tenho"
- "Nutricion" truncado de "Nutricionista"

### Problema 2: Dados de Cliente Aparecendo Incorretamente

Após investigar o banco de dados, **os dados estão CORRETOS**. O que pode causar confusão:

1. A resposta da **Priscila** contém no campo "Nome e Profissão do Cônjuge" o valor "Thiago - empresário e gestor de tráfego" - isso é dado correto preenchido por ela sobre o esposo
2. Não há dados de um cliente misturados com outro no banco

**Verificação feita:**

| Resposta | Cliente | Número | Rua | Cônjuge |
|----------|---------|--------|-----|---------|
| Priscila | Correto | 216 | Marulo | Thiago - empresário... |
| Thiago | Correto | 170 | (vazio) | Mentoria para nutri... |

A lógica de vinculação de cliente no `submit-form-response` está correta:
- Valida que o telefone submetido corresponde ao cliente da URL
- Se não corresponde, busca por telefone
- Se não encontra, deixa `client_id = null`

---

## Solução Proposta

### Correção 1: Melhorar Layout de Visualização de Respostas

**Arquivo:** `src/components/forms/FormResponseViewer.tsx`

**Mudança no container de campo (linha 633-643):**

```typescript
<div key={field.id} className="flex flex-col gap-2 p-4">
  <div>
    <Label className="text-sm font-medium text-foreground">
      {field.name}
      {field.is_required && <span className="text-destructive ml-1">*</span>}
    </Label>
  </div>
  <div className="text-sm break-words">
    {renderValue(field, value)}
  </div>
</div>
```

Alterações:
- Remover layout side-by-side (`sm:flex-row`) para evitar truncamento
- Usar layout vertical (pergunta em cima, resposta embaixo)
- Garantir `break-words` no container de valor
- Adicionar `min-w-0` para prevenir overflow

### Correção 2: Aumentar Largura do Modal

**Arquivo:** `src/components/forms/FormResponseViewer.tsx` (linha 510)

```typescript
<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
```

Mudança de `max-w-2xl` (672px) para `max-w-3xl` (768px) para acomodar melhor os textos.

### Correção 3: Melhorar Função renderValue

**Arquivo:** `src/components/forms/FormResponseViewer.tsx` (linha 230-231)

```typescript
default:
  return <span className="break-words whitespace-pre-wrap">{String(value)}</span>;
```

Adicionar `whitespace-pre-wrap` para preservar quebras de linha e garantir que textos longos quebrem corretamente.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/forms/FormResponseViewer.tsx` | Ajustar layout de campos, aumentar modal, melhorar renderValue |

---

## Impacto Esperado

1. Todos os valores de respostas serão exibidos por completo
2. Textos longos terão quebra automática de linha
3. O modal terá mais espaço horizontal para exibir as informações
4. Layout vertical (pergunta/resposta) será mais legível

## Consideracoes Adicionais

A lógica de vinculação de clientes já está correta e robusta:
- Valida o telefone submetido contra o cliente da URL
- Faz busca por telefone se não houver match
- Os dados no banco estão íntegros

O que pode parecer "dados de outro cliente" é na verdade informação sobre o cônjuge que a própria cliente preencheu (ex: Priscila preencheu "Thiago" como nome do cônjuge).
