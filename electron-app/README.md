# ROI Boy WhatsApp Capture

App desktop para captura automática de mensagens WhatsApp e envio para o sistema ROI Boy.

## 📋 Requisitos

- Node.js 18 ou superior
- npm ou yarn
- Conta ativa no ROI Boy

## 🚀 Instalação

### 1. Clone ou copie a pasta `electron-app`

```bash
# Se você exportou para GitHub, clone o repo e navegue até a pasta
cd electron-app
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Execute o app

```bash
npm start
```

## 📦 Criar Instalador

### Windows
```bash
npm run build:win
```
O instalador será gerado em `dist/`

### macOS
```bash
npm run build:mac
```

### Linux
```bash
npm run build:linux
```

## 🔧 Como Usar

1. **Login**: Abra o app e faça login com suas credenciais do ROI Boy

2. **Conectar WhatsApp**: Clique em "Conectar" para abrir o WhatsApp Web

3. **Escanear QR Code**: Use seu celular para escanear o QR Code do WhatsApp Web

4. **Captura Automática**: Após conectar, as mensagens serão capturadas automaticamente e enviadas para o ROI Boy

## 🏗️ Arquitetura

```
electron-app/
├── main.js              # Processo principal do Electron
├── preload.js           # Preload para a interface principal
├── whatsapp-preload.js  # Preload para injeção no WhatsApp Web
├── package.json         # Dependências e scripts
├── renderer/
│   ├── index.html       # Interface do usuário
│   ├── styles.css       # Estilos
│   └── renderer.js      # Lógica da interface
└── assets/
    └── icon.png         # Ícone do app
```

## 🔐 Segurança

- Credenciais são armazenadas localmente de forma criptografada
- API Key é gerada no login e usada para autenticar requisições
- Comunicação com o backend é feita via HTTPS
- O app não tem acesso ao conteúdo das mensagens após enviá-las

## ⚙️ Configuração

O app se conecta automaticamente ao backend do ROI Boy. Não é necessária configuração adicional.

### Variáveis de Ambiente (para desenvolvimento)

Se quiser apontar para outro backend durante desenvolvimento, edite `main.js`:

```javascript
const API_BASE_URL = 'https://seu-backend.supabase.co/functions/v1';
```

## 🐛 Solução de Problemas

### WhatsApp não conecta
- Verifique sua conexão com a internet
- Tente fechar e abrir o WhatsApp Web novamente
- Escaneie o QR Code novamente

### Mensagens não estão sendo capturadas
- Verifique se o WhatsApp Web está aberto e conectado
- Verifique se o indicador de captura está "Ativa"
- Reinicie o app

### Erro de login
- Verifique suas credenciais do ROI Boy
- Tente fazer logout e login novamente
- Verifique sua conexão com a internet

## 📝 Logs

Para ver os logs do app durante desenvolvimento:

```bash
# Execute o app com DevTools aberto
npm start -- --dev
```

Ou pressione `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Option+I` (macOS) para abrir o DevTools.

## 🔄 Atualizações

Para atualizar o app:

1. Baixe a nova versão
2. Substitua os arquivos
3. Execute `npm install`
4. Inicie o app

## 📞 Suporte

Em caso de problemas, entre em contato com o suporte do ROI Boy.

---

**ROI Boy © 2024**
