# Área "TVs" no ROY

O ROY vira o painel de controle das TVs da parede. Um agente na rede do escritório consulta o ROY a cada 30 s, executa os comandos nas TVs e devolve status e capturas. Nomes de tabelas, campos, comandos e contrato seguem exatamente o documento enviado.

## 1. Banco
- Tabelas `tv_screens`, `tv_settings` (linha única id=1), `tv_commands`, `tv_status`, `tv_events` com os campos, padrões e checks do documento.
- Acesso: só administração/gestão lê e escreve (função de verificação já existente no projeto); agente nunca acessa direto.
- Gatilho em `tv_commands`: ao virar done/error, `payload.text` do `type_text` vira "***".
- Limpeza: eventos com mais de 30 dias e comandos "taken" há mais de 5 min viram "error / agente não respondeu" (feito a cada sync).
- Bucket privado `tv-shots` (`slot-<n>.jpg`).
- Dados iniciais: 10 TVs (TV-1…TV-9, Box MKT), URLs dos slots 1 e 5, horário seg–sex 07:50–19:30.
- Tempo real ligado em `tv_status`, `tv_commands`, `tv_events`.

## 2. Função "tv-agent"
- Header `x-agent-token` comparado ao segredo `TV_AGENT_TOKEN` (gerado aleatório; você vê/copia em Configurações do backend > Segredos). Errado = 401.
- Ações `sync`, `command_result`, `screenshot` exatamente como o contrato (URL assinada de 1 dia).

## 3. Tela Configurações > TVs (só gestão/admin)
- Topo: status do agente (online se visto < 2 min), Ligar/Desligar/Recarregar todas, Atualizar capturas, bloco Horário (dias, horários, feriados no calendário ROY, "manter ligadas/desligadas até…" com limpar).
- Card por TV: captura ampliável com "há X min", estado colorido, montador de link (painel do Insights, período, zoom 50–120, Foco, Ajustar à TV) ou URL colada, recarga, anti-proteção, modo de horário, volume/mudo, botões de ação, aviso (toast), login na TV (senha mascarada), controle remoto, histórico.
- Atualiza em tempo real com fallback a cada 10 s.

## 4. Insights
- Botão "Enviar para TV" ao lado de "Copiar link": escolhe a TV e grava a URL atual em `tv_screens.url` (só visível para gestão).

## 5. Login
- Após login, volta para a URL completa que a pessoa tentava abrir (com parâmetros) em vez de "Selecione uma área".
- Sessão já renova sozinha; garantir que não há deslogue por inatividade nas rotas do Insights.

## Fora do escopo
Nada além dessas partes é alterado. O agente em si não é construído aqui.
