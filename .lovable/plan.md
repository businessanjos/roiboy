
## Reconectar instância [CANAL] Eternum Club ao setor de Operacoes

### Problema

Na acao anterior, o comando `unlink_instance` **deletou o registro** da instancia "[CANAL] Eternum Club" do banco de dados. O objetivo era apenas desconecta-la do setor, nao remove-la completamente. Agora a instancia existe no UAZAPI (connected, phone 554388346806) mas nao existe mais na tabela `integrations` do ROY.

### Solucao

**Passo 1: Re-inserir o registro na tabela `integrations`**

Usar a action `add_instance_to_sector` que ja existe no `uazapi-manager` para re-vincular a instancia "[CANAL] Eternum Club" ao setor `operacoes`. Essa action busca a instancia no UAZAPI pelo nome, obtem o token e status, e insere no banco automaticamente.

Chamar via edge function:
```text
action: "add_instance_to_sector"
instance_name: "[CANAL] Eternum Club"
sector_id: "operacoes"
```

**Passo 2: Verificar a conexao**

Apos a insercao, consultar o banco para confirmar que o registro foi criado corretamente com status `connected` e o token da instancia.

**Passo 3: Configurar webhook (se necessario)**

Verificar se o campo `webhook_configured` precisa ser atualizado no config da integracao, garantindo que mensagens recebidas sejam processadas corretamente.

### Observacao importante sobre o webhook

O webhook do WhatsApp (`uazapi-webhook`) possui um kill switch ativo (`FUNCTION_DISABLED = true`). Mesmo reconectando a instancia, mensagens NAO serao processadas ate que o kill switch seja desativado. Isso e uma decisao separada.

### Arquivos que serao modificados

Nenhum arquivo de codigo precisa ser alterado. A acao sera feita via chamada direta ao edge function existente e, se necessario, insercao manual no banco.
