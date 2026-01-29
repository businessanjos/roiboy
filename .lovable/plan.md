
# Plano: Suporte a Múltiplos Arquivos no Playbook (Tipo Documento)

## Visão Geral

Atualmente, cada item do Playbook aceita apenas **um arquivo**. Para permitir múltiplos documentos em um único item, precisamos modificar a estrutura de dados e a interface do formulário.

## Abordagem Escolhida

Vou implementar suporte a **múltiplos arquivos apenas para o tipo "Documento"**, mantendo os outros tipos (imagem, áudio, vídeo, sticker) com arquivo único, pois faz mais sentido operacionalmente.

## Alterações Técnicas

### 1. Atualizar Estado do Formulário

**Arquivo: `src/components/sales/PlaybookItemForm.tsx`**

Adicionar estados para gerenciar múltiplos arquivos:

```typescript
// Estado para múltiplos arquivos (documentos)
const [mediaFiles, setMediaFiles] = useState<File[]>([]);
const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
```

### 2. Modificar Input de Arquivo

Adicionar atributo `multiple` apenas para documentos:

```typescript
<input
  ref={fileInputRef}
  type="file"
  accept={getAcceptedFileTypes()}
  multiple={contentType === 'document'} // Múltiplos apenas para documentos
  onChange={handleFileSelect}
  className="hidden"
/>
```

### 3. Atualizar Handler de Seleção de Arquivos

```typescript
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  // Para documentos: permitir múltiplos
  if (contentType === 'document') {
    // Validar cada arquivo
    const validFiles = files.filter(file => {
      const ext = getFileExtension(file.name);
      return validExtensions.document.includes(ext);
    });
    
    if (validFiles.length === 0) {
      toast.error('Nenhum arquivo válido selecionado');
      return;
    }
    
    // Adicionar aos arquivos existentes
    setMediaFiles(prev => [...prev, ...validFiles]);
    setExistingMediaUrl(null);
  } else {
    // Outros tipos: manter comportamento de arquivo único
    // ... código existente
  }
};
```

### 4. Atualizar Preview para Múltiplos Documentos

Exibir lista de documentos com opção de remover individualmente:

```typescript
{contentType === 'document' && mediaFiles.length > 0 && (
  <div className="space-y-2">
    {mediaFiles.map((file, index) => (
      <div key={index} className="p-3 bg-muted rounded-lg flex items-center gap-3">
        <File className="h-5 w-5 text-muted-foreground" />
        <span className="flex-1 text-sm truncate">{file.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => removeFile(index)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    ))}
    {/* Botão para adicionar mais */}
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => fileInputRef.current?.click()}
    >
      <Plus className="h-4 w-4 mr-2" />
      Adicionar mais arquivos
    </Button>
  </div>
)}
```

### 5. Modificar Lógica de Upload

No `handleSubmit`, fazer upload de todos os arquivos:

```typescript
// Para documentos: upload de múltiplos arquivos
if (contentType === 'document' && mediaFiles.length > 0) {
  const uploadedUrls: string[] = [];
  const uploadedFilenames: string[] = [];
  
  for (const file of mediaFiles) {
    const url = await uploadMedia(file);
    uploadedUrls.push(url);
    uploadedFilenames.push(file.name);
  }
  
  // Combinar com URLs existentes (se editando)
  mediaUrl = [...existingMediaUrls, ...uploadedUrls].join('|');
  mediaFilename = uploadedFilenames.join('|');
}
```

### 6. Atualizar Exibição no PlaybookDialog

**Arquivo: `src/components/sales/PlaybookDialog.tsx`**

Modificar a exibição de itens de documento para mostrar contador de arquivos:

```typescript
{item.content_type === 'document' && item.media_filename && (
  <p className="text-sm text-muted-foreground truncate">
    {item.media_filename.includes('|') 
      ? `${item.media_filename.split('|').length} arquivos`
      : item.media_filename}
  </p>
)}
```

## Estrutura de Dados

Para armazenar múltiplos arquivos, vou usar o caractere `|` como separador:

| Campo | Exemplo com Múltiplos Arquivos |
|-------|-------------------------------|
| `media_url` | `https://...file1.pdf\|https://...file2.pdf` |
| `media_filename` | `contrato.pdf\|anexo.pdf` |

Isso permite:
- Manter compatibilidade com itens existentes (sem `|` = arquivo único)
- Não requer migração do banco de dados
- Fácil de parsear com `split('|')`

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/sales/PlaybookItemForm.tsx` | Estados múltiplos, handler atualizado, preview de lista, upload em lote |
| `src/components/sales/PlaybookDialog.tsx` | Exibição de múltiplos arquivos |

## Resultado Esperado

1. Usuário seleciona tipo "Documento"
2. Clica para upload e pode selecionar **múltiplos arquivos de uma vez**
3. Arquivos aparecem em lista com botão de remover individual
4. Pode clicar em "Adicionar mais arquivos" para adicionar mais
5. Ao salvar, todos os arquivos são enviados e armazenados
6. No PlaybookDialog, mostra "3 arquivos" em vez do nome do arquivo

## Testes Recomendados

1. Fazer upload de múltiplos PDFs de uma vez
2. Adicionar mais arquivos em sequência
3. Remover arquivos individualmente da lista
4. Salvar e verificar se todos foram enviados
5. Editar item existente e adicionar mais arquivos
6. Verificar exibição correta no PlaybookDialog
