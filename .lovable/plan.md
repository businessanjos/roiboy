# Ampliar o Claude para analisar todo o ROY

## Objetivo
Expandir o servidor MCP já existente para que o Claude consulte e analise todas as áreas do ROY, sempre como o usuário conectado, somente em modo leitura e respeitando integralmente suas permissões.

## O que será entregue

### 1. Catálogo completo de análises
Adicionar ferramentas específicas para:
- **Clientes e contratos:** carteira, contratos, produtos, vencimentos, renovações e risco.
- **Financeiro:** fluxo de caixa, contas a pagar/receber, inadimplência e conciliação, sem dados bancários secretos.
- **Operações e CS:** check-ins, acompanhamento, onboarding, carga de trabalho e saúde da carteira.
- **Marketing:** campanhas, mídia paga, conteúdo, projetos, tarefas e indicadores por canal.
- **RH:** quadro de pessoas, admissões, desligamentos, férias e indicadores agregados, sem documentos pessoais, CPF, salário individual ou dados médicos.
- **Eventos:** agenda, participantes, check-ins, custos e andamento.
- **Produtos e tarefas:** catálogo, contratos por produto e atividades pendentes/concluídas.
- **Auditoria gerencial:** visão segura de movimentações operacionais, sem tokens, credenciais, IPs ou registros técnicos sensíveis.

As cinco ferramentas atuais de pipeline, metas/comissões, telefonia e RoyZapp serão preservadas.

### 2. Segurança e privacidade
- Toda consulta continuará usando a identidade OAuth do usuário conectado.
- As regras atuais do ROY decidirão quais registros e setores esse usuário pode ver.
- Não haverá ferramenta de SQL livre nem possibilidade de criar, editar ou excluir registros.
- Consultas terão período, filtros e limites para evitar varreduras excessivas.
- Financeiro e RH usarão respostas agregadas e campos selecionados, excluindo credenciais, dados bancários, documentos e informações pessoais desnecessárias.

### 3. Experiência de conexão
Atualizar a tela **Configurações → Integrações → Assistente IA no Claude** para:
- mostrar todas as áreas disponíveis;
- reforçar que o acesso segue as permissões da conta conectada;
- deixar claro que o Claude tem acesso somente para consulta e análise;
- manter o link MCP e o passo a passo de conexão.

### 4. Publicação e validação
- Atualizar o catálogo MCP e a documentação interna.
- Gerar novamente o manifesto do conector.
- Publicar a função MCP atualizada.
- Testar conexão, autenticação e chamadas reais das novas ferramentas.
- Validar com um usuário autorizado que dados permitidos aparecem e que áreas sem permissão permanecem bloqueadas.

## Detalhes técnicos
- Novas ferramentas serão arquivos independentes em `src/lib/mcp/tools/` e registradas em `src/lib/mcp/index.ts`.
- Todas usarão `requireUser(ctx)` / `supabaseForUser(ctx)`, preservando as políticas de acesso do banco.
- As respostas terão resumo agregado, lista limitada e indicação quando houver truncamento.
- A função gerada em `supabase/functions/mcp/index.ts` continuará sendo controlada automaticamente pelo plugin MCP e não será editada manualmente.
