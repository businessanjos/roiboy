

## Correção: Respostas do formulário não aparecem

### Problema

Ao abrir as respostas de um formulário, a seção "Respostas do Formulário" aparece vazia. Isso ocorre porque a função `viewResponses` (que abre o dialog de respostas) busca os dados das respostas, mas **não carrega os campos customizados** (`customFields`) do formulário. Sem os campos carregados, o componente `FormResponseViewer` não consegue mapear e exibir nenhuma resposta.

### Causa raiz

No arquivo `src/pages/Forms.tsx`, a função `viewResponses` (linha 948) faz:
1. Busca as respostas do formulário na tabela `form_responses`
2. Mas **não chama** `fetchCustomFields(form.id)` para carregar as definições dos campos

O estado `customFields` fica vazio (ou com dados de outro formulário editado anteriormente), e o `FormResponseViewer` não tem como renderizar as respostas.

### Solução

Adicionar a chamada `await fetchCustomFields(form.id)` dentro da função `viewResponses`, logo antes ou junto da busca de respostas.

### Alteração

**Arquivo**: `src/pages/Forms.tsx`

Na função `viewResponses` (linha ~948), adicionar `fetchCustomFields(form.id)` para que os campos sejam carregados junto com as respostas:

```typescript
const viewResponses = async (form: Form) => {
  setSelectedForm(form);
  setLoadingResponses(true);
  setResponsesDialogOpen(true);
  resetPreview();

  try {
    // Buscar campos E respostas em paralelo
    const [_, responsesResult] = await Promise.all([
      fetchCustomFields(form.id),
      supabase
        .from("form_responses")
        .select(`*, clients:client_id (id, full_name, phone_e164, avatar_url)`)
        .eq("form_id", form.id)
        .order("submitted_at", { ascending: false }),
    ]);

    if (responsesResult.error) throw responsesResult.error;
    setResponses(responsesResult.data || []);
  } catch (error: any) {
    console.error("Error fetching responses:", error);
    toast.error("Erro ao carregar respostas");
  } finally {
    setLoadingResponses(false);
  }
};
```

Isso garante que os campos customizados estejam disponíveis quando o `FormResponseViewer` renderizar, permitindo exibir as respostas corretamente.

