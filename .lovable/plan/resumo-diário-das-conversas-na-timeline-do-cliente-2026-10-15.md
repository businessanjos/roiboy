# Resumo diário das conversas na timeline do cliente

## Resultado esperado
Salvar automaticamente um resumo organizado por dia na timeline de cada cliente cadastrado **somente quando houver mensagens naquele dia**, incluindo conversas individuais e grupos de atendimento vinculados ao cadastro.

## O que será feito
1. **Resumo diário automático:** processar o dia anterior após seu encerramento, pelo horário de Brasília. Sem mensagens, não criar registro nem chamar a IA. Mensagens da equipe contam mesmo sem resposta do cliente.
2. **Resumo útil e fiel:** apresentar os assuntos tratados, pedidos do cliente, orientações dadas, decisões e pendências/próximos passos. Exibir apenas informações presentes nas mensagens, sem inventar respostas ou interpretar silêncio como resolução. Aproveitar transcrições de áudio disponíveis; sinalizar conteúdo não analisável quando necessário.
3. **Grupos de clientes:** usar os vínculos entre grupo e cadastros para colocar o resumo no histórico correspondente. Identificar o nome do grupo e os participantes conhecidos; distinguir assuntos compartilhados de assuntos individuais, sem atribuir a uma cliente o que outra disse. Grupos internos e comunitários não devem alimentar esses resumos de atendimento.
4. **Timeline organizada:** um registro diário por cliente, com assuntos separados por conversa/grupo, data de Brasília, identificação de resumo automático e acesso às conversas de origem. Manter registros manuais e histórico existente, sem criar cópias repetidas.
5. **Sincronização segura:** mensagens que chegarem atrasadas pela sincronização poderão complementar o mesmo resumo diário, sem gerar um segundo registro. A data da interação será a das mensagens, nunca a hora em que a IA executou.

## Escopo e estado verificado
- Há uma rotina `cs-whatsapp-daily-summary` que gera resumos em uma frase, limitada a conversas individuais de Customer Success; ela será aproveitada e aprimorada, não duplicada.
- Existem vínculos de grupos com clientes em `zapp_group_clients`, e os registros automáticos usam `source: ai_whatsapp` em `client_checkins`.
- Preservar o escopo de **Customer Success**, sem misturar conversas comerciais. Conferir o agendamento efetivo e a integração com a timeline principal antes da implementação.
- Começar pelos dias de operação após a ativação, sem resumir todo o histórico antigo automaticamente.
- Não alterar permissões, contratos, regras de checkpoint ou envio de WhatsApp. Não publicar o aplicativo.

## Detalhes técnicos
- Organizar coleta e processamento por conta, cliente e dia em `America/Sao_Paulo`, com paginação e deduplicação das mensagens, preservando as fontes.
- Persistir identidade diária, fontes e progresso para atualizações idempotentes; conferir o esquema atual antes de qualquer migração.
- Executar em lotes limitados, com trava persistente contra execuções simultâneas, retomada do progresso e pausa em bloqueios da IA. Exibir falhas sem inserir resumos vazios ou fictícios.
- Preservar o modelo existente da rotina e consumir a Base de Conhecimento IA via `buildKnowledgeBlock`, sem permitir que ela acrescente fatos ausentes na conversa.
- Proteger execução agendada e acesso aos registros por conta e permissões existentes.
- A geração automática utiliza créditos de IA do workspace; não chamar a IA para dias vazios ou conteúdo já processado sem alterações.

## Validação
- Testar: dia sem mensagens não gera resumo; mensagem só da equipe gera; grupo vinculado aparece nos cadastros certos; grupo interno não aparece; fronteira de dia usa Brasília; reexecução não duplica; mensagem tardia atualiza o mesmo registro.
- Conferir uma conversa individual e um grupo de atendimento com dados reais, lendo o resumo pela timeline e abrindo suas fontes, sem enviar mensagens nem apagar registros reais.