
# Plano: Corrigir Upload de PDFs no Playbook

## Problema Identificado

Usuários não conseguem fazer upload de arquivos PDF no Playbook quando selecionam o tipo "Documento". Após análise do código, identifiquei múltiplas causas:

## Causas Raiz

### 1. Atributo `accept` incompleto
O atributo `accept` do input de arquivo está truncado e não inclui todos os MIME types necessários:

```typescript
// Atual (incompleto):
case 'document':
  return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Faltam os MIME types para Excel e PowerPoint!
```

Isso pode fazer com que o seletor de arquivos do navegador não mostre PDFs corretamente em alguns dispositivos.

### 2. MIME types de PDF incompletos
Em alguns navegadores/dispositivos (especialmente móveis), o `file.type` pode retornar:
- String vazia `""`
- `text/pdf` (tipo antigo)
- `binary/octet-stream` ou similar

A lista `validTypes.document` não inclui esses tipos alternativos.

### 3. Fallback para application/octet-stream no upload
Quando `file.type` está vazio, o hook usa `getMimeTypeFromExtension()` que retorna o tipo correto. Mas se o bucket rejeitar tipos não listados em `allowed_mime_types`, o upload falhará.

## Solução Proposta

### Arquivo 1: `src/components/sales/PlaybookItemForm.tsx`

**Modificação 1 - Adicionar MIME types alternativos para documentos (linha 188-197):**

```typescript
document: [
  'application/pdf',
  'text/pdf', // Tipo alternativo para PDF em alguns sistemas
  'application/x-pdf', // Outro tipo alternativo
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream', // Fallback para tipos desconhecidos
  '', // String vazia que alguns navegadores retornam
],
```

**Modificação 2 - Corrigir atributo `accept` para documentos (linha 397-398):**

```typescript
case 'document':
  return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
```

**Modificação 3 - Priorizar validação por extensão quando file.type está vazio (linha 210-218):**

```typescript
const fileExtension = getFileExtension(file.name);
// Priorizar extensão quando file.type está vazio ou é genérico
const isValidByExtension = validExtensions[contentType]?.includes(fileExtension);
const isValidByType = file.type && file.type !== 'application/octet-stream' 
  ? validTypes[contentType]?.includes(file.type)
  : false;

console.log('[Playbook Form] Validation:', { isValidByType, isValidByExtension, fileExtension, fileType: file.type });

// Aceitar se válido por extensão OU por tipo
if (!isValidByType && !isValidByExtension) {
  toast.error(`Tipo de arquivo inválido para ${contentType}. Extensões aceitas: ${validExtensions[contentType]?.join(', ')}`);
  return;
}
```

### Arquivo 2: Atualizar bucket no banco (SQL Migration)

Adicionar MIME types alternativos para PDF no bucket:

```sql
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/aac', 'audio/x-m4a', 'audio/mp4',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi',
  'application/pdf', 'text/pdf', 'application/x-pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream'
]
WHERE id = 'playbook-media';
```

## Resultado Esperado

Após as correções:
1. PDFs serão aceitos independentemente de como o navegador reporta o MIME type
2. O seletor de arquivos mostrará PDFs corretamente em todos os dispositivos
3. O bucket aceitará upload de PDFs com MIME types alternativos
4. A validação priorizará a extensão do arquivo como método mais confiável

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/sales/PlaybookItemForm.tsx` | Adicionar MIME types, corrigir accept, melhorar validação |
| Nova migration SQL | Atualizar allowed_mime_types do bucket |

## Testes Recomendados

1. Upload de PDF no desktop (Chrome, Firefox, Safari)
2. Upload de PDF em dispositivo móvel (iOS Safari, Android Chrome)
3. Upload de documentos Word, Excel e PowerPoint
4. Verificar se PDFs existentes continuam funcionando
