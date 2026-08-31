# Conectar o Claude Desktop do Jonathan ao ROY (MCP)

> Passo a passo simples. Se alguma tela não aparecer exatamente igual, procure os mesmos nomes em inglês — o ROY está em português, mas o Lovable/Claude podem mostrar labels em inglês.

## 1. Publique o ROY

Sem o publish, o endpoint MCP não fica no ar.

- No editor do Lovable, clique no **ícone de publicar** (canto superior direito, símbolo de globo/aviao de papel).
- Aguarde o build terminar.

## 2. Pegue o link MCP do app

- No editor do ROY, abra **Mais → Integrações de Agente** (`More → Agent integrations`).
- Procure o card **"Seu link MCP"** (`Your MCP link`).
- Clique em copiar. O link termina com `/functions/v1/mcp`.

Se o card não aparecer, republique o app e espere o build.

## 3. Configure no Claude Desktop

1. Abra o **Claude Desktop**.
2. Vá em **Configurações → Desenvolvedor → Editar configuração** (`Settings → Developer → Edit config`).
3. Isso abre o arquivo `claude_desktop_config.json`.
4. Adicione um servidor MCP com o link copiado:

```json
{
  "mcpServers": {
    "roy-eternum": {
      "url": "COLE_AQUI_O_LINK_MCP_COPIADO_NO_PASSO_2"
    }
  }
}
```

5. Salve o arquivo.
6. Feche e abra novamente o Claude Desktop.

## 4. Faça login com a conta do Jonathan

- No Claude, quando ele tentar usar as ferramentas do ROY, uma janela de login vai aparecer.
- Entre com a conta do Jonathan no ROY.
- Na tela de consentimento que aparecer (`Conectar [aplicativo] ao ROY`), clique em **Autorizar**.

Pronto. O Claude do Jonathan agora pode consultar:

- Ligações da 3C Plus (`telephony_calls`)
- Pipeline e negócios (`sales_deals`)
- Metas e comissões (`sales_goals_commissions`)
- Conversas do RoyZapp (`zapp_conversations`)
- Mensagens de uma conversa do RoyZapp (`zapp_messages`)

Tudo respeita as permissões dele no ROY — cada gestor que quiser conectar faz o mesmo com a própria conta.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Card MCP não aparece | Republique o app e aguarde o build. |
| Claude diz que não achou ferramentas | Feche e abra o Claude Desktop. |
| Login recusado / sem permissão | Confirme que a conta do Jonathan existe no ROY e tem acesso às áreas de Vendas/RoyZapp. |
| Link não responde | Verifique se o app foi publicado depois que o MCP foi ativado. |
