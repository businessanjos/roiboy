# Processos do CS dentro do ROY

Um lugar só onde as consultoras e o CX consultam os 3 processos do documento (Onboarding do Sócio, Encontro Online e Encontro Presencial), veem tudo passo a passo e marcam o que já fizeram.

## O que a consultora vai ver

1. **Nova área "Processos"** no menu do setor CS.
   - Três cartões coloridos: Onboarding (roxo), Encontro Online (verde-água) e Encontro Presencial (azul).
   - Uma busca que encontra qualquer mensagem ou etapa, por exemplo "Toc Toc" ou "NPS".
2. **Tela do processo** com uma linha do tempo vertical por fase. Cada etapa mostra:
   - quando fazer (por exemplo "17h do mesmo dia" ou "10 dias antes") e quem faz;
   - a lista de tarefas;
   - as mensagens prontas com o botão **Copiar**, onde os campos {Nome}, {link} e {data} aparecem destacados;
   - os links (Canva, cadastro, plataforma) como botões que abrem em nova aba;
   - os avisos importantes em amarelo ou vermelho, como "Aguardar ela dar o OK".
3. **Acompanhamento por cliente:** no Onboarding Hub, cada cliente ganha a aba "Processo".
   - A consultora marca as tarefas feitas e vê o % concluído e a data de cada etapa.
   - Os campos da mensagem já vêm preenchidos com o nome da cliente e da consultora.
   - Um botão envia a mensagem pelo RoyZapp, para quem preferir não copiar.
4. **Acompanhamento por encontro:** ao escolher um encontro já cadastrado em Eventos, o sistema calcula as datas dos lembretes (15, 10, 3 e 1 dia antes, no dia e no dia seguinte).
   - Aparece um quadro **"Vence hoje"** com o que falta fazer.
5. **Edição:** gestores e administradores podem editar textos, links e etapas sem programação. Quando um texto muda, o progresso já marcado continua guardado.

## Por fases (sugestão)

- **Fase 1:** a área de consulta com os 3 processos e o botão Copiar. Já resolve o dia a dia.
- **Fase 2:** o checklist por cliente dentro do Onboarding Hub.
- **Fase 3:** os lembretes calculados pela data do encontro, o quadro "Vence hoje" e a edição pelos gestores.

## Pontos para confirmar

- No documento há uma senha ou login fictício e um link de cadastro com o código de uma cliente específica. Nesses lugares vou usar campos como {login}, {senha} e {link_cadastro}.
- Os links de Canva e o rykasystem ficam como estão no documento.

## Detalhes técnicos

- Novas tabelas, todas restritas à própria conta com RLS:
  - `cs_processes`, com fases, etapas e tarefas guardadas em JSON e versão por etapa;
  - `cs_process_client_progress` (cliente, tarefa, quem marcou e quando);
  - `cs_process_event_progress`.
- O conteúdo inicial é carregado a partir do documento.
- As mensagens reaproveitam o renderizador de variáveis do Playbook. O envio pelo RoyZapp segue o fluxo atual, com a assinatura.
- As datas dos lembretes são calculadas por uma função pura no fuso America/Sao_Paulo, com teste.
- Nenhuma regra de contrato, de permissão ou de integração muda.
