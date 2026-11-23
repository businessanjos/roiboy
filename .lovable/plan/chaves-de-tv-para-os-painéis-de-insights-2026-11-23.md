# Chaves de TV para os painéis de Insights

## Ponto importante antes de aprovar
O painel normal de Insights (`/insights/<id>`) busca os dados direto do navegador, com o login de quem está vendo. Sem login, ele não tem como buscar nada, e a chave não pode virar um login (regra de segurança que você mesmo pediu).

O Roy já tem um caminho seguro que monta o painel no servidor: o **link compartilhado de Insights** (o mesmo dos painéis enviados para fora). A proposta é usar esse caminho para a TV.

- **O que muda na TV:** com `tv_token`, `/insights/<id>` abre a versão de painel montada no servidor, em tela cheia, com período, setor, foco e zoom do link.
- **Diferença visual possível:** essa versão usa os cartões do link compartilhado. Gráficos especiais (por exemplo, as pílulas EM/EC do Ranking de Vendedores, a ocultação do E-Pass) podem precisar de ajustes depois, para ficarem iguais ao painel normal. Vou conferir os painéis que as TVs usam hoje e corrigir as diferenças que achar.
- **Quem tem login continua vendo o painel normal**, como hoje.

## O que será feito
1. **Chave por TV (Configurações > TVs):** no painel da TV, "Gerar chave", "Gerar nova chave" (a antiga morre na hora) e "Cancelar chave", com data de criação e de último uso.
   - A chave tem 32 bytes aleatórios e é gerada no servidor. O banco guarda só o hash.
   - A chave nunca é mostrada: ela só sai do servidor para o computador das TVs.
2. **Uso no link:** `?tv_token=<chave>` vale para qualquer painel de Insights da conta, com qualquer período, setor, foco ou zoom. Mudar os seletores mantém o `tv_token` no link.
3. **Segurança:**
   - Com a chave, dá só para ver painéis de Insights, em modo somente leitura.
   - A conferência da chave e a busca dos dados acontecem numa função do servidor.
   - Não há sessão de usuário nem acesso aos dados de quem criou a chave.
   - Chave inválida ou cancelada mostra "Chave de TV inválida ou cancelada — gere uma nova em Configurações > TVs", sem mandar para o login.
   - Cada uso grava a data e a hora do último uso.
4. **Entrega automática:** quando o link da TV é um painel de Insights do Roy e a TV tem chave ativa, a função das TVs acrescenta o `tv_token` ao link entregue. Isso vem depois da troca para a visão anual do início do mês. Os outros links (YouTube, Central de Tráfego, imagem, descanso) saem como estão salvos.

## Detalhes técnicos
- Tabela `tv_screen_tokens`: slot, token_hash (sha-256), created_at, last_used_at, revoked_at, created_by. RLS só para quem gerencia TVs, e sem o hash na leitura do app.
- RPCs `tv_token_issue(slot)` e `tv_token_revoke(slot)`, só para quem gerencia TVs. O valor puro fica guardado de forma cifrada só para a tv-agent anexar ao link.
  - Alternativa sem guardar o valor: a tv-agent gera e guarda a chave, e o app só pede a geração.
- `shared-insights` ganha `tv_load_dashboard` e `tv_fetch_filtered_data`: conferem o hash, confirmam que o painel é da conta, atualizam `last_used_at` e reaproveitam o motor de dados já existente.
- Página: a rota `/insights/:id` detecta `tv_token` sem sessão e renderiza `TvInsightsView` (baseada em `SharedVisualCard`), sem passar pelo login.
- tv-agent: `withTvToken(url, token)` em `_shared/`, aplicado depois de `toAnnualUrl`. Testes de: anexar só em links do Roy, manter o token ao trocar o período, sem chave = link igual.
