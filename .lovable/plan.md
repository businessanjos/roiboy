
# Adicionar Anexos de Imagens e Documentos nas Anotações do Histórico de Negócios

## Visão Geral

Adicionar botões para anexar imagens (fotos/vídeos) e documentos nas anotações do histórico de negócios (Deal Detail Sheet), similar ao que já existe no FinancialQuickNoteInput.

---

## Mudanças Necessárias

### 1. Alteração no Banco de Dados

Adicionar colunas para armazenar informações de arquivos anexados na tabela `deal_activities`:

```sql
ALTER TABLE deal_activities 
ADD COLUMN file_url TEXT,
ADD COLUMN file_name TEXT,
ADD COLUMN file_size BIGINT;
```

### 2. Criar Bucket de Storage

Criar um bucket público para armazenar arquivos anexados aos deals:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-activities', 'deal-activities', true);
```

Com políticas de RLS para permitir upload/download.

---

## Arquivos a Modificar

### `src/components/sales/DealDetailSheet.tsx`

| Mudança | Descrição |
|---------|-----------|
| Importações | Adicionar `Camera`, `Paperclip`, `useRef` |
| Estados | Adicionar `isUploadingImage`, `isUploadingFile` e refs para inputs de arquivo |
| Função `handleFileSelect` | Nova função para upload de arquivos ao storage |
| Área de input | Adicionar botões de câmera e clipe ao lado do botão Adicionar |
| Interface `DealActivity` | Adicionar campos `file_url`, `file_name`, `file_size` |
| Timeline | Exibir anexos (imagens e documentos) nas atividades |

---

## Layout Proposto para Área de Input

```text
┌─────────────────────────────────────────────────────────────┐
│  [▼ Nota]    Registrar interação                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Descreva a interação...                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [📷] [📎]    [+ Adicionar]    │
└─────────────────────────────────────────────────────────────┘

📷 = Anexar imagem/vídeo
📎 = Anexar documento (PDF, DOC, etc.)
```

---

## Implementação da Função de Upload

```typescript
const handleFileSelect = async (
  event: React.ChangeEvent<HTMLInputElement>,
  type: "image" | "file"
) => {
  const file = event.target.files?.[0];
  if (!file || !currentUser?.account_id || !deal?.id) return;

  // Validar tamanho (50MB max)
  if (file.size > 50 * 1024 * 1024) {
    toast.error("Arquivo muito grande. Máximo 50MB.");
    return;
  }

  const setUploading = type === "image" ? setIsUploadingImage : setIsUploadingFile;
  setUploading(true);

  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${currentUser.account_id}/deals/${deal.id}/${fileName}`;

    // Upload para storage
    const { error: uploadError } = await supabase.storage
      .from("deal-activities")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("deal-activities")
      .getPublicUrl(filePath);

    // Criar atividade com arquivo anexado
    await supabase.from("deal_activities").insert({
      account_id: currentUser.account_id,
      deal_id: deal.id,
      type: type === "image" ? "image" : "file",
      title: type === "image" ? "Imagem anexada" : "Documento anexado",
      user_id: currentUser.id,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
    });

    fetchActivities();
    toast.success(type === "image" ? "Imagem anexada!" : "Documento anexado!");
  } catch (error) {
    toast.error("Erro ao fazer upload do arquivo");
  } finally {
    setUploading(false);
    // Reset input
  }
};
```

---

## Exibição de Anexos no Timeline

Para atividades do tipo `image`:
- Thumbnail da imagem clicável (abre lightbox ou nova aba)
- Nome do arquivo e tamanho

Para atividades do tipo `file`:
- Ícone de documento
- Nome do arquivo e tamanho
- Botão de download

---

## Resumo dos Arquivos

| Tipo | Arquivo/Recurso | Descrição |
|------|-----------------|-----------|
| Migração SQL | Nova migração | Adicionar colunas na tabela + criar bucket |
| Modificar | `DealDetailSheet.tsx` | Adicionar upload e exibição de anexos |

---

## Resultado Esperado

- Botões de câmera e clipe visíveis ao lado do botão "Adicionar"
- Upload de imagens/vídeos funcional
- Upload de documentos (PDF, DOC, XLS, etc.) funcional
- Anexos visíveis no histórico do negócio
- Download direto dos arquivos
