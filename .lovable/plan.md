
# Plano: Corrigir Upload de PDFs no Playbook (Problema de onChange no Edge)

## Problema Identificado

O upload de PDFs não está funcionando porque o evento `onChange` do input de arquivo **nunca é disparado**. O usuário seleciona o arquivo PDF, clica em "Abrir", mas nada acontece.

## Causa Raiz

O atributo `accept` para documentos está **extremamente longo** (300+ caracteres) com muitos MIME types complexos:

```typescript
case 'document':
  return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,text/pdf,application/x-pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
```

O Microsoft Edge (navegador que o usuário está usando) tem problemas conhecidos com atributos `accept` muito longos ou com MIME types específicos demais. Quando isso acontece:
- O seletor de arquivos abre normalmente
- O usuário consegue selecionar o arquivo
- Ao clicar "Abrir", **o navegador falha silenciosamente** e não dispara o evento `onChange`

Os logs não mostram nenhuma mensagem `[Playbook Form] File selected:` porque o `handleFileSelect` nunca é chamado.

## Solução

**Simplificar o atributo `accept` para usar apenas extensões de arquivo**, que são mais confiáveis entre navegadores. A validação detalhada por MIME type já é feita dentro do `handleFileSelect`, então não precisamos dos MIME types no atributo `accept`.

## Alteração Proposta

### Arquivo: `src/components/sales/PlaybookItemForm.tsx`

**Modificar a função `getAcceptedFileTypes` (linhas 396-411):**

De:
```typescript
case 'document':
  return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,text/pdf,application/x-pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
```

Para:
```typescript
case 'document':
  return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
```

Esta simplificação:
1. Remove MIME types problemáticos do atributo `accept`
2. Usa apenas extensões de arquivo (suportadas universalmente)
3. Mantém a validação completa dentro do `handleFileSelect` (que já valida por extensão E por MIME type)
4. Resolve o problema do Edge não disparar o evento `onChange`

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/sales/PlaybookItemForm.tsx` | Simplificar `accept` para documentos usando apenas extensões |

## Justificativa Técnica

- O atributo `accept` serve apenas para **filtrar os arquivos visíveis** no seletor de arquivos
- A **validação real** ocorre no JavaScript (`handleFileSelect`), que já valida por extensão e MIME type
- Extensões de arquivo são mais confiáveis entre navegadores do que MIME types longos
- Esta abordagem já é usada em outros tipos (audio, video, image usam `audio/*`, `video/*`, `image/*` como fallback)

## Teste Recomendado

1. Abrir o formulário de novo item do Playbook
2. Selecionar tipo "Documento"
3. Clicar na área de upload
4. Selecionar um arquivo PDF
5. Clicar "Abrir"
6. Verificar se o arquivo aparece no preview (ícone de documento com nome do arquivo)
