# Conectar o Claude Desktop ao ROY (MCP)

> Caminho no ROY: **Configurações → Integrações → Assistente IA no Claude**

Cada gestor conecta o seu próprio Claude Desktop usando a conta do ROY. O Claude enxerga apenas os dados que o usuário já tem permissão no sistema.

## O que dá para fazer

- Consultar ligações da 3C Plus (`telephony_calls`)
- Ver pipeline e negócios (`sales_deals`)
- Analisar metas e comissões (`sales_goals_commissions`)
- Ler conversas do RoyZapp (`zapp_conversations`)
- Ver mensagens de uma conversa do RoyZapp (`zapp_messages`)

Tudo é **somente leitura** e respeita as permissões do usuário conectado.

## Passo a passo simples

1. **Abra no ROY**
   - Vá em **Configurações → Integrações → Assistente IA no Claude**.

2. **Copie o link MCP**
   - Clique em **Copiar link**. O link termina com `/functions/v1/mcp`.
   - Se o link estiver vazio, o app ainda precisa ser publicado.

3. **Configure no Claude Desktop**
   - Abra o Claude Desktop.
   - Vá em **Settings → Developer → Edit config**.
   - Cole o link copiado dentro do arquivo `claude_desktop_config.json`:

     ```json
     {
       "mcpServers": {
         "roy-eternum": {
           "url": "COLE_AQUI_O_LINK_MCP_COPIADO_NO_PASSO_2"
         }
       }
     }
     ```

4. **Reinicie o Claude Desktop**
   - Feche e abra novamente.

5. **Autorize**
   - Quando o Claude pedir, faça login com a conta do ROY.
   - Na tela de consentimento, clique em **Autorizar**.

Pronto. O Claude agora pode responder perguntas sobre os dados do ROY usando a sua conta.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Link MCP vazio | Publique o ROY e aguarde o build terminar. |
| Claude não acha as ferramentas | Feche e abra o Claude Desktop. |
| Login recusado | Confirme que a conta existe no ROY e tem acesso às áreas de Vendas/RoyZapp. |
| Link não responde | Verifique se o app foi publicado depois que o MCP foi ativado. |
