

## Corrigir botao "Salvar dominio" quando ja conectado

### Causa raiz

O botao "Salvar dominio" chama a mesma funcao `handle3CPlusConnect`, que exige o campo `threeCPlusToken` preenchido (linha 351). Quando o usuario ja esta conectado, o token foi apagado do estado local (linha 365: `setThreeCPlusToken("")`), entao a validacao falha com "Informe o token da API."

### Correcao

Criar uma funcao separada `handleSaveDomain` que atualiza apenas o campo `metadata` da integracao existente diretamente no banco, sem precisar revalidar o token na API 3C Plus.

### Alteracoes

#### `src/components/integrations/IntegrationsContent.tsx`

1. Criar nova funcao `handleSaveDomain`:
   - Buscar o `access_token` existente da integracao ja conectada (`threeCPlusUserIntegration.access_token`)
   - Chamar `supabase.functions.invoke("threecplus-auth")` enviando o token existente + novo dominio
   - OU atualizar diretamente via Supabase client o campo `metadata` da tabela `user_integrations` (mais simples e eficiente)

   A abordagem mais simples: atualizar diretamente o metadata via Supabase client:
   ```
   await supabase
     .from("user_integrations")
     .update({ metadata: { ...existingMetadata, domain: newDomain } })
     .eq("id", integrationId)
   ```

2. Alterar o botao "Salvar dominio" (linha 831) para chamar `handleSaveDomain` em vez de `handle3CPlusConnect`

### Arquivos envolvidos

- **Editar:** `src/components/integrations/IntegrationsContent.tsx` - Nova funcao e ajuste no onClick do botao
