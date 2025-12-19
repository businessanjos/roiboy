# ROI Boy - Extensão Chrome

Extensão Chrome para captura automática de engajamento em WhatsApp Web, Zoom e Google Meet.

## 📋 Funcionalidades

### WhatsApp Web
- Captura automática de mensagens recebidas
- Identificação de remetente e grupo
- Detecção de mensagens de áudio
- Sincronização em tempo real

### Zoom
- Detecção de participantes em reuniões
- Registro de horário de entrada
- Identificação de reunião

### Google Meet
- Detecção de participantes em reuniões
- Registro de horário de entrada
- Identificação de reunião

## 🚀 Instalação

### Passo 1: Preparar os arquivos

1. Copie a pasta `extension/` para seu computador
2. Crie os ícones (ou use placeholders):
   - `assets/icon16.png` (16x16 pixels)
   - `assets/icon48.png` (48x48 pixels)
   - `assets/icon128.png` (128x128 pixels)

### Passo 2: Carregar no Chrome

1. Abra o Chrome e acesse `chrome://extensions/`
2. Ative o **Modo de desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension/`

### Passo 3: Fazer login

1. Clique no ícone da extensão na barra de ferramentas
2. Entre com suas credenciais do ROI Boy
3. Pronto! A captura começará automaticamente

## 🔧 Como Usar

### WhatsApp Web
1. Abra [web.whatsapp.com](https://web.whatsapp.com)
2. A extensão detecta automaticamente e começa a capturar
3. O indicador ficará verde quando ativo

### Zoom
1. Entre em uma reunião pelo navegador
2. A extensão detecta participantes automaticamente
3. Dados são enviados para o ROI Boy

### Google Meet
1. Entre em uma reunião do Google Meet
2. A extensão detecta participantes automaticamente
3. Dados são enviados para o ROI Boy

## 📊 Estatísticas

A extensão mostra no popup:
- Mensagens WhatsApp capturadas
- Participantes Zoom detectados
- Participantes Google Meet detectados
- Última sincronização

## 🔐 Segurança

- Credenciais armazenadas localmente de forma segura
- Comunicação via HTTPS
- API Key renovada a cada login
- Sem acesso a mensagens após envio

## 🐛 Solução de Problemas

### Extensão não captura mensagens
1. Verifique se está logado na extensão
2. Recarregue a página do WhatsApp/Zoom/Meet
3. Verifique se o indicador está verde

### Erro de login
1. Verifique suas credenciais
2. Verifique sua conexão com internet
3. Tente novamente após alguns segundos

### Participantes não detectados
1. Aguarde alguns segundos após entrar na reunião
2. Abra o painel de participantes da reunião
3. A extensão escaneia periodicamente

## 📝 Logs

Para ver os logs:
1. Clique com botão direito no ícone da extensão
2. Selecione "Gerenciar extensão"
3. Clique em "Service worker" para ver logs do background
4. Use F12 nas páginas para ver logs dos content scripts

## 🔄 Atualizações

Para atualizar a extensão:
1. Substitua os arquivos na pasta
2. Acesse `chrome://extensions/`
3. Clique no botão de atualizar da extensão

---

**ROI Boy © 2024**
