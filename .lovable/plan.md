
## Corrigir uploads de arquivos/imagens na Timeline e Chat Interno

### Problemas identificados

1. **Bucket `client-files` inexistente**: O componente `FinancialQuickNoteInput.tsx` tenta fazer upload para o bucket `client-files`, que nunca foi criado. Todo upload financeiro falha silenciosamente.

2. **Tipos MIME restritivos no bucket `client-followups`**: A lista de `allowed_mime_types` nao inclui varios formatos comuns (text/plain, PPT, ZIP, RAR, SVG, BMP, HEIC, etc.). Alem disso, alguns navegadores reportam `image/jpg` ao inves de `image/jpeg`, causando rejeicao inesperada.

3. **Mensagens de erro genericas**: Todos os handlers de upload exibem "Erro ao enviar arquivo" sem detalhes, dificultando diagnostico.

### Solucao

#### 1. Migracao SQL: Criar bucket `client-files` e expandir mime types

Criar uma migracao que:
- Crie o bucket `client-files` com politicas RLS adequadas (public, com INSERT/SELECT/DELETE para usuarios autenticados)
- Atualize o bucket `client-followups` removendo a restricao de `allowed_mime_types` (definindo como NULL para aceitar qualquer tipo) e mantendo o limite de 100MB
- Atualize o bucket `internal-chat-files` para garantir que nao tenha restricoes de mime type

#### 2. Melhorar mensagens de erro nos componentes

Atualizar os handlers de erro nos seguintes arquivos para exibir a mensagem real do erro (quando disponivel) ao inves da mensagem generica:

- `src/components/client/Timeline.tsx` (linha ~1010)
- `src/components/client/ClientFollowup.tsx` (linhas ~528 e ~657)
- `src/components/client/ClientFinancial.tsx` (linha ~507)
- `src/components/client/SalesPerformance.tsx` (linha ~244)
- `src/components/client/FinancialNotes.tsx` (linha ~181)
- `src/components/client/FinancialQuickNoteInput.tsx` (trocar bucket de `client-files` para `client-followups`)

#### 3. Corrigir `FinancialQuickNoteInput.tsx`

Alterar o bucket de `client-files` para `client-followups` em vez de criar um bucket separado, mantendo consistencia com os demais componentes.

### Detalhes tecnicos

**Migracao SQL:**
```sql
-- Remover restricoes de mime types do bucket client-followups
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'client-followups';

-- Garantir que internal-chat-files nao tem restricoes
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'internal-chat-files';
```

**FinancialQuickNoteInput.tsx (linhas 105-113):**
Trocar `client-files` por `client-followups` nas duas referencias ao bucket.

**Handlers de erro (em todos os 6 arquivos):**
Trocar `toast.error("Erro ao enviar arquivo")` por `toast.error(error?.message || "Erro ao enviar arquivo")` para expor a causa real.

### Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| Nova migracao SQL | Remover restricao de mime types |
| FinancialQuickNoteInput.tsx | Trocar bucket `client-files` por `client-followups` |
| Timeline.tsx | Melhorar mensagem de erro |
| ClientFollowup.tsx | Melhorar mensagem de erro (2 locais) |
| ClientFinancial.tsx | Melhorar mensagem de erro |
| SalesPerformance.tsx | Melhorar mensagem de erro |
| FinancialNotes.tsx | Melhorar mensagem de erro |
