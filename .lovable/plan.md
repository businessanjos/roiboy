

## Correção: Usar campo "Cidade" do negócio para endereço no cadastro Omie

### Situação atual

O campo "Cidade" no negócio é do tipo `location` e armazena no `value_json` um objeto com esta estrutura:
```json
{
  "formatted_address": "Santo Ângelo, Rio Grande do Sul, Brasil",
  "latitude": ...,
  "longitude": ...
}
```

O endereço formatado segue o padrão: **"Cidade, Estado, País"** (separado por vírgulas).

### Plano

**Arquivo: `supabase/functions/create-omie-os/index.ts`**

1. **Incluir `value_json` no select** de `deal_field_values` (linha 199) — atualmente busca apenas `value_text, value_number, value_boolean, value_date`.

2. **Extrair cidade e estado do campo "Cidade"** (ID: `5accffbd-3d87-4735-b890-bc6c361694b7`):
   - Buscar o `value_json` do campo
   - Parsear `formatted_address` separando por vírgula: `[cidade, estado, país]`
   - Mapear estado completo para UF de 2 letras (ex: "Rio Grande do Sul" → "RS")

3. **Expandir `createOmieClient`** para aceitar e enviar os campos de endereço:
   - `cidade` → campo Omie `cidade`
   - `estado` (UF) → campo Omie `estado`
   - `endereco` → valor padrão "Não informado" (obrigatório mas não temos rua)
   - `endereco_numero` → "S/N"
   - `bairro` → "Não informado"

4. **Mapeamento de estados brasileiros**: Incluir um dicionário de nome completo → UF para converter "Rio Grande do Sul" → "RS", "São Paulo" → "SP", etc.

### Detalhes técnicos

```typescript
// Constante com o ID do campo Cidade
const CIDADE_FIELD_ID = '5accffbd-3d87-4735-b890-bc6c361694b7';

// Parsear "Santo Ângelo, Rio Grande do Sul, Brasil"
const cidadeJson = dealFieldValues?.find(v => v.field_id === CIDADE_FIELD_ID)?.value_json;
const parts = cidadeJson?.formatted_address?.split(',').map(s => s.trim()) || [];
const city = parts[0] || '';
const stateFullName = parts[1] || '';
const stateUF = STATE_MAP[stateFullName] || stateFullName.substring(0, 2).toUpperCase();
```

O payload de `IncluirCliente` receberá:
```typescript
endereco: 'Não informado',
endereco_numero: 'S/N',
bairro: 'Não informado',
cidade: city,        // "Santo Ângelo"
estado: stateUF,     // "RS"
```

### Arquivo alterado
- `supabase/functions/create-omie-os/index.ts`

