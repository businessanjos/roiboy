
# Plano: Correção do Download de Arquivos no ROY zAPP

## Problema Identificado

O download de arquivos no ROY zAPP não está funcionando corretamente. Quando o usuário clica para baixar um documento (como "Secretátia 1.docx"), o arquivo é baixado mas com um nome incorreto/ilegível.

### Evidências no Banco de Dados:

| Campo | Valor |
|-------|-------|
| `media_filename` | `Secretátia 1.docx` |
| `media_url` | `...document_1769443527484_dcee457d.vnd.openxmlformats-officedocument.wordprocessingml.document` |

O nome do arquivo na URL do Storage usa a extensão do mimetype (`vnd.openxmlformats-officedocument.wordprocessingml.document`) ao invés de preservar o nome original com extensão `.docx`.

### Por que isso acontece:

1. O componente `ZappMessageBubble.tsx` usa uma tag `<a>` simples apontando para `message.media_url`
2. Quando o navegador baixa de URLs cross-origin, ele ignora o atributo `download` por segurança
3. O navegador usa o último segmento da URL como nome do arquivo, resultando em nomes como `document_1769443527484_dcee457d.vnd.openxmlformats-officedocument.wordprocessingml.document`

## Solução Proposta

Implementar o padrão **fetch-to-blob** que já está sendo usado com sucesso no Timeline de clientes (`src/components/client/Timeline.tsx`).

### Como funciona:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (COM BUG)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario clica no link                                       │
│     └─> <a href={media_url} target="_blank">                   │
│                                                                 │
│  2. Navegador abre nova aba com a URL                           │
│     └─> Baixa usando nome da URL (sem extensao correta)        │
│                                                                 │
│  3. Arquivo salvo com nome incorreto                            │
│     └─> "document_...vnd.openxmlformats..."                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRIGIDO                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario clica no botao de download                          │
│     └─> handleDownload(message)                                │
│                                                                 │
│  2. Frontend faz fetch do arquivo                               │
│     └─> const blob = await fetch(media_url).blob()             │
│                                                                 │
│  3. Cria URL local temporaria                                   │
│     └─> const url = URL.createObjectURL(blob)                  │
│                                                                 │
│  4. Cria link programatico com nome correto                     │
│     └─> link.download = message.media_filename                 │
│                                                                 │
│  5. Dispara download e limpa recursos                           │
│     └─> link.click(); URL.revokeObjectURL(url)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementacao Tecnica

### Arquivo: `src/components/royzapp/ZappMessageBubble.tsx`

**Mudanca 1:** Adicionar funcao de download (apos as funcoes existentes, antes do componente)

```typescript
// Function to handle file download with correct filename
async function handleFileDownload(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Falha ao baixar arquivo");
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename || "documento";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Erro ao baixar arquivo:", error);
    throw error;
  }
}
```

**Mudanca 2:** Adicionar estado de loading e toast hook (dentro do componente)

```typescript
const [isDownloading, setIsDownloading] = useState(false);
const { toast } = useToast();
```

**Mudanca 3:** Substituir tag `<a>` por elemento clicavel com handler (linhas 452-472)

```typescript
{message.media_url && message.media_type === "document" && (
  <button
    onClick={async (e) => {
      e.preventDefault();
      if (isDownloading) return;
      setIsDownloading(true);
      try {
        await handleFileDownload(
          message.media_url!,
          message.media_filename || "documento"
        );
        toast({
          title: "Download iniciado",
          description: message.media_filename || "documento",
        });
      } catch (error) {
        toast({
          title: "Erro ao baixar",
          description: "Não foi possível baixar o arquivo",
          variant: "destructive",
        });
      } finally {
        setIsDownloading(false);
      }
    }}
    disabled={isDownloading}
    className="flex items-center gap-3 bg-black/20 rounded-lg p-3 mb-1 hover:bg-black/30 transition-colors w-full text-left cursor-pointer disabled:opacity-50"
  >
    <div className="w-10 h-10 rounded-lg bg-[#7f66ff]/20 flex items-center justify-center">
      <FileText className="h-5 w-5 text-[#7f66ff]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-zapp-text truncate">
        {message.media_filename || "Documento"}
      </p>
      <p className="text-xs text-zapp-text-muted">
        {isDownloading ? "Baixando..." : "Clique para baixar"}
      </p>
    </div>
    {isDownloading ? (
      <Loader2 className="h-4 w-4 text-zapp-text-muted flex-shrink-0 animate-spin" />
    ) : (
      <Download className="h-4 w-4 text-zapp-text-muted flex-shrink-0" />
    )}
  </button>
)}
```

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/royzapp/ZappMessageBubble.tsx` | Substituir link direto por handler fetch-to-blob |

## Impacto Esperado

- Arquivos serao baixados com o nome original preservado (ex: "Secretátia 1.docx")
- Indicador visual de loading durante o download
- Feedback via toast ao usuario
- Melhor experiencia de usuario

## Consideracoes

Esta solucao:
- Usa o mesmo padrao ja comprovado no Timeline de clientes
- Nao requer alteracoes no backend ou Edge Functions
- Funciona para todos os tipos de documentos (PDF, DOCX, XLSX, etc.)
- Preserva o `media_filename` original armazenado no banco de dados
