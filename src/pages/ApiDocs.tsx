import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Globe, Key, Users, MessageSquare, Mic, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const BASE_URL = "https://mtzoavtbtqflufyccern.supabase.co/functions/v1";

interface EndpointDoc {
  name: string;
  method: "GET" | "POST";
  path: string;
  description: string;
  icon: React.ReactNode;
  headers: { name: string; value: string; description: string }[];
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
  bodyParams?: { name: string; type: string; required: boolean; description: string }[];
  requestExample: string;
  responseExample: string;
  errorCodes: { code: number; message: string; description: string }[];
}

const endpoints: EndpointDoc[] = [
  {
    name: "Autenticação",
    method: "POST",
    path: "/extension-auth",
    description: "Autentica o usuário da extensão e retorna tokens de sessão para chamadas subsequentes.",
    icon: <Key className="h-5 w-5" />,
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo da requisição" }
    ],
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email do usuário cadastrado no ROIBOY" },
      { name: "password", type: "string", required: true, description: "Senha do usuário" }
    ],
    requestExample: `{
  "email": "usuario@empresa.com",
  "password": "sua_senha_segura"
}`,
    responseExample: `{
  "success": true,
  "api_key": "a1b2c3d4e5f6...",
  "user": {
    "id": "uuid-do-usuario",
    "name": "Nome do Usuário",
    "email": "usuario@empresa.com",
    "role": "mentor"
  },
  "account": {
    "id": "uuid-da-conta",
    "name": "Nome da Empresa"
  },
  "session_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": 1735689600
}`,
    errorCodes: [
      { code: 400, message: "Missing email or password", description: "Email ou senha não fornecidos" },
      { code: 401, message: "Invalid credentials", description: "Credenciais inválidas" },
      { code: 404, message: "User profile not found", description: "Perfil do usuário não encontrado" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  },
  {
    name: "Buscar Cliente por Telefone",
    method: "GET",
    path: "/get-client-by-phone",
    description: "Busca um cliente pelo número de telefone no formato E.164. Retorna dados completos do cliente incluindo scores e eventos recentes.",
    icon: <Search className="h-5 w-5" />,
    headers: [
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta obtido na autenticação" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão obtido na autenticação" }
    ],
    queryParams: [
      { name: "phone_e164", type: "string", required: true, description: "Telefone no formato E.164 (ex: +5511999998888)" }
    ],
    requestExample: `GET /get-client-by-phone?phone_e164=%2B5511999998888

Headers:
x-account-id: uuid-da-conta
x-session-token: eyJhbGciOiJIUzI1NiIs...`,
    responseExample: `{
  "found": true,
  "client": {
    "id": "uuid-do-cliente",
    "full_name": "João Silva",
    "phone_e164": "+5511999998888",
    "emails": ["joao@email.com"],
    "status": "active",
    "avatar_url": "https://...",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "latest_score": {
    "escore": 75,
    "roizometer": 82,
    "quadrant": "highE_highROI",
    "trend": "up"
  },
  "recent_risks": [
    {
      "id": "uuid",
      "reason": "Demonstrou frustração com prazo",
      "risk_level": "medium",
      "happened_at": "2024-01-20T14:00:00Z"
    }
  ],
  "recent_messages": [
    {
      "id": "uuid",
      "content_text": "Bom dia! Preciso de ajuda...",
      "direction": "client_to_team",
      "sent_at": "2024-01-20T09:00:00Z"
    }
  ],
  "open_recommendations": [
    {
      "id": "uuid",
      "title": "Agendar reunião de alinhamento",
      "priority": "high"
    }
  ]
}`,
    errorCodes: [
      { code: 400, message: "Missing phone_e164 parameter", description: "Parâmetro phone_e164 não fornecido" },
      { code: 400, message: "Invalid phone format", description: "Formato de telefone inválido (deve ser E.164)" },
      { code: 401, message: "Unauthorized", description: "Token de sessão inválido ou expirado" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado (found: false)" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  },
  {
    name: "Criar Cliente",
    method: "POST",
    path: "/create-client",
    description: "Cria um novo cliente no sistema. Usado quando a extensão identifica uma conversa com um número não cadastrado.",
    icon: <Users className="h-5 w-5" />,
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo da requisição" },
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta obtido na autenticação" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão obtido na autenticação" }
    ],
    bodyParams: [
      { name: "account_id", type: "string (uuid)", required: true, description: "ID da conta" },
      { name: "phone_e164", type: "string", required: true, description: "Telefone no formato E.164" },
      { name: "full_name", type: "string", required: true, description: "Nome completo do cliente" },
      { name: "emails", type: "string[]", required: false, description: "Lista de emails do cliente" },
      { name: "cpf", type: "string", required: false, description: "CPF do cliente (apenas números)" },
      { name: "cnpj", type: "string", required: false, description: "CNPJ do cliente (apenas números)" },
      { name: "company_name", type: "string", required: false, description: "Nome da empresa" },
      { name: "tags", type: "string[]", required: false, description: "Tags para categorização" },
      { name: "notes", type: "string", required: false, description: "Observações sobre o cliente" }
    ],
    requestExample: `{
  "account_id": "uuid-da-conta",
  "phone_e164": "+5511999998888",
  "full_name": "Maria Santos",
  "emails": ["maria@empresa.com"],
  "company_name": "Empresa ABC",
  "tags": ["novo", "indicação"]
}`,
    responseExample: `{
  "success": true,
  "client": {
    "id": "uuid-do-novo-cliente",
    "account_id": "uuid-da-conta",
    "full_name": "Maria Santos",
    "phone_e164": "+5511999998888",
    "emails": ["maria@empresa.com"],
    "company_name": "Empresa ABC",
    "status": "active",
    "tags": ["novo", "indicação"],
    "created_at": "2024-01-20T15:30:00Z"
  }
}`,
    errorCodes: [
      { code: 400, message: "Missing required fields", description: "Campos obrigatórios não fornecidos" },
      { code: 400, message: "Invalid phone format", description: "Formato de telefone inválido" },
      { code: 409, message: "Client already exists", description: "Cliente com este telefone já existe" },
      { code: 401, message: "Unauthorized", description: "Token de sessão inválido" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  },
  {
    name: "Listar Clientes",
    method: "GET",
    path: "/list-clients",
    description: "Lista clientes da conta com suporte a paginação e busca. Útil para autocomplete na extensão.",
    icon: <Users className="h-5 w-5" />,
    headers: [
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta obtido na autenticação" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão obtido na autenticação" }
    ],
    queryParams: [
      { name: "search", type: "string", required: false, description: "Termo de busca (nome ou telefone)" },
      { name: "limit", type: "number", required: false, description: "Quantidade de resultados (padrão: 50, máx: 100)" },
      { name: "offset", type: "number", required: false, description: "Offset para paginação (padrão: 0)" }
    ],
    requestExample: `GET /list-clients?search=maria&limit=20&offset=0

Headers:
x-account-id: uuid-da-conta
x-session-token: eyJhbGciOiJIUzI1NiIs...`,
    responseExample: `{
  "clients": [
    {
      "id": "uuid-1",
      "full_name": "Maria Santos",
      "phone_e164": "+5511999998888",
      "status": "active",
      "avatar_url": null,
      "vnps_score": 8.5,
      "vnps_class": "promoter"
    },
    {
      "id": "uuid-2",
      "full_name": "Maria Oliveira",
      "phone_e164": "+5511988887777",
      "status": "active",
      "avatar_url": "https://...",
      "vnps_score": 6.2,
      "vnps_class": "neutral"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}`,
    errorCodes: [
      { code: 401, message: "Unauthorized", description: "Token de sessão inválido ou expirado" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  },
  {
    name: "Ingerir Mensagem de Texto",
    method: "POST",
    path: "/ingest-whatsapp-message",
    description: "Envia uma mensagem de texto capturada do WhatsApp Web. Dispara análise de IA automaticamente para mensagens do cliente.",
    icon: <MessageSquare className="h-5 w-5" />,
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo da requisição" }
    ],
    bodyParams: [
      { name: "api_key", type: "string", required: true, description: "API key obtida na autenticação" },
      { name: "phone_e164", type: "string", required: true, description: "Telefone do cliente no formato E.164" },
      { name: "direction", type: "string", required: true, description: "'client_to_team' ou 'team_to_client'" },
      { name: "content", type: "string", required: true, description: "Conteúdo da mensagem" },
      { name: "timestamp", type: "string (ISO 8601)", required: true, description: "Data/hora da mensagem" },
      { name: "external_thread_id", type: "string", required: false, description: "ID da conversa no WhatsApp (opcional)" }
    ],
    requestExample: `{
  "api_key": "a1b2c3d4e5f6...",
  "phone_e164": "+5511999998888",
  "direction": "client_to_team",
  "content": "Bom dia! Estou muito satisfeito com os resultados...",
  "timestamp": "2024-01-20T09:00:00Z",
  "external_thread_id": "whatsapp-thread-123"
}`,
    responseExample: `{
  "success": true,
  "message_id": "uuid-da-mensagem",
  "client_id": "uuid-do-cliente",
  "conversation_id": "uuid-da-conversa",
  "ai_analysis_triggered": true
}`,
    errorCodes: [
      { code: 400, message: "Missing required fields", description: "Campos obrigatórios não fornecidos" },
      { code: 400, message: "Invalid phone format", description: "Formato de telefone inválido" },
      { code: 400, message: "Invalid direction", description: "Direção deve ser 'client_to_team' ou 'team_to_client'" },
      { code: 401, message: "Invalid API key", description: "API key inválida" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado para este telefone" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  },
  {
    name: "Ingerir Áudio",
    method: "POST",
    path: "/ingest-whatsapp-audio",
    description: "Envia um áudio do WhatsApp para transcrição via IA. O áudio é transcrito e imediatamente descartado (não é armazenado).",
    icon: <Mic className="h-5 w-5" />,
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo da requisição" }
    ],
    bodyParams: [
      { name: "api_key", type: "string", required: true, description: "API key obtida na autenticação" },
      { name: "phone_e164", type: "string", required: true, description: "Telefone do cliente no formato E.164" },
      { name: "direction", type: "string", required: true, description: "'client_to_team' ou 'team_to_client'" },
      { name: "audio_base64", type: "string", required: true, description: "Áudio em base64 (formatos: ogg, mp3, wav, m4a)" },
      { name: "audio_duration_sec", type: "number", required: true, description: "Duração do áudio em segundos" },
      { name: "timestamp", type: "string (ISO 8601)", required: true, description: "Data/hora da mensagem" },
      { name: "external_thread_id", type: "string", required: false, description: "ID da conversa no WhatsApp" }
    ],
    requestExample: `{
  "api_key": "a1b2c3d4e5f6...",
  "phone_e164": "+5511999998888",
  "direction": "client_to_team",
  "audio_base64": "T2dnUwACAAAAAAAAAABY...",
  "audio_duration_sec": 45,
  "timestamp": "2024-01-20T09:05:00Z"
}`,
    responseExample: `{
  "success": true,
  "message_id": "uuid-da-mensagem",
  "client_id": "uuid-do-cliente",
  "transcription": "Olá, estou ligando para falar sobre...",
  "ai_analysis_triggered": true
}`,
    errorCodes: [
      { code: 400, message: "Missing required fields", description: "Campos obrigatórios não fornecidos" },
      { code: 400, message: "Invalid audio format", description: "Formato de áudio não suportado" },
      { code: 400, message: "Audio too long", description: "Áudio excede o limite de duração" },
      { code: 401, message: "Invalid API key", description: "API key inválida" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" },
      { code: 500, message: "Transcription failed", description: "Falha na transcrição do áudio" }
    ]
  },
  {
    name: "Importação em Lote",
    method: "POST",
    path: "/bulk-ingest-messages",
    description: "Importa múltiplas mensagens históricas de uma vez. Máximo de 500 mensagens por requisição. Útil para sincronização inicial de conversas.",
    icon: <FileText className="h-5 w-5" />,
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo da requisição" }
    ],
    bodyParams: [
      { name: "api_key", type: "string", required: true, description: "API key obtida na autenticação" },
      { name: "phone_e164", type: "string", required: true, description: "Telefone do cliente no formato E.164" },
      { name: "messages", type: "array", required: true, description: "Array de mensagens (máx 500)" }
    ],
    requestExample: `{
  "api_key": "a1b2c3d4e5f6...",
  "phone_e164": "+5511999998888",
  "messages": [
    {
      "direction": "client_to_team",
      "content": "Primeira mensagem do histórico",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "direction": "team_to_client",
      "content": "Resposta da equipe",
      "timestamp": "2024-01-01T10:05:00Z"
    },
    {
      "direction": "client_to_team",
      "content": "Obrigado pela resposta!",
      "timestamp": "2024-01-01T10:10:00Z"
    }
  ]
}`,
    responseExample: `{
  "success": true,
  "client_id": "uuid-do-cliente",
  "imported_count": 3,
  "failed_count": 0,
  "errors": []
}`,
    errorCodes: [
      { code: 400, message: "Missing required fields", description: "Campos obrigatórios não fornecidos" },
      { code: 400, message: "Too many messages", description: "Máximo de 500 mensagens por requisição" },
      { code: 400, message: "Invalid message format", description: "Formato de mensagem inválido" },
      { code: 401, message: "Invalid API key", description: "API key inválida" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  }
];

const CodeBlock = ({ code, language = "json" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const EndpointCard = ({ endpoint }: { endpoint: EndpointDoc }) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            {endpoint.icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {endpoint.name}
              <Badge variant={endpoint.method === "GET" ? "secondary" : "default"}>
                {endpoint.method}
              </Badge>
            </CardTitle>
            <CardDescription className="font-mono text-xs mt-1">
              {BASE_URL}{endpoint.path}
            </CardDescription>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{endpoint.description}</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="request" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="params">Parâmetros</TabsTrigger>
            <TabsTrigger value="errors">Erros</TabsTrigger>
          </TabsList>
          
          <TabsContent value="request" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Headers</h4>
            <div className="space-y-1 mb-4">
              {endpoint.headers.map((header) => (
                <div key={header.name} className="flex items-center gap-2 text-sm">
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">{header.name}</code>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-muted-foreground">{header.description}</span>
                </div>
              ))}
            </div>
            <h4 className="text-sm font-medium mb-2">Exemplo de Request</h4>
            <CodeBlock code={endpoint.requestExample} />
          </TabsContent>
          
          <TabsContent value="response" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Exemplo de Response (200 OK)</h4>
            <CodeBlock code={endpoint.responseExample} />
          </TabsContent>
          
          <TabsContent value="params" className="mt-4">
            {endpoint.queryParams && endpoint.queryParams.length > 0 && (
              <>
                <h4 className="text-sm font-medium mb-2">Query Parameters</h4>
                <div className="space-y-2 mb-4">
                  {endpoint.queryParams.map((param) => (
                    <div key={param.name} className="flex items-start gap-2 text-sm border-b pb-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{param.name}</code>
                      <Badge variant="outline" className="text-xs">{param.type}</Badge>
                      {param.required && <Badge variant="destructive" className="text-xs">obrigatório</Badge>}
                      <span className="text-muted-foreground flex-1">{param.description}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
              <>
                <h4 className="text-sm font-medium mb-2">Body Parameters (JSON)</h4>
                <div className="space-y-2">
                  {endpoint.bodyParams.map((param) => (
                    <div key={param.name} className="flex items-start gap-2 text-sm border-b pb-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{param.name}</code>
                      <Badge variant="outline" className="text-xs">{param.type}</Badge>
                      {param.required && <Badge variant="destructive" className="text-xs">obrigatório</Badge>}
                      <span className="text-muted-foreground flex-1">{param.description}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="errors" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Códigos de Erro</h4>
            <div className="space-y-2">
              {endpoint.errorCodes.map((error) => (
                <div key={error.code + error.message} className="flex items-start gap-2 text-sm border-b pb-2">
                  <Badge variant={error.code >= 500 ? "destructive" : error.code >= 400 ? "secondary" : "default"}>
                    {error.code}
                  </Badge>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{error.message}</code>
                  <span className="text-muted-foreground flex-1">{error.description}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const ApiDocs = () => {
  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">API Documentation</h1>
              <p className="text-muted-foreground">Documentação técnica para desenvolvedores da extensão Chrome</p>
            </div>
          </div>
          
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-medium mb-2">Base URL</h3>
                  <code className="text-sm bg-background px-3 py-2 rounded-lg block">{BASE_URL}</code>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Autenticação</h3>
                  <p className="text-sm text-muted-foreground">
                    Todos os endpoints (exceto <code>/extension-auth</code>) requerem headers de autenticação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Start */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Fluxo básico de integração</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">1</Badge>
                <div>
                  <p className="font-medium">Autenticar</p>
                  <p className="text-sm text-muted-foreground">
                    Chame <code>/extension-auth</code> com email/senha e guarde o <code>session_token</code>, <code>account_id</code> e <code>api_key</code>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">2</Badge>
                <div>
                  <p className="font-medium">Identificar conversa</p>
                  <p className="text-sm text-muted-foreground">
                    Use <code>/get-client-by-phone</code> para verificar se o número já está cadastrado
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">3</Badge>
                <div>
                  <p className="font-medium">Criar cliente (se necessário)</p>
                  <p className="text-sm text-muted-foreground">
                    Se não existir, use <code>/create-client</code> para cadastrar
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">4</Badge>
                <div>
                  <p className="font-medium">Capturar mensagens</p>
                  <p className="text-sm text-muted-foreground">
                    Envie mensagens em tempo real via <code>/ingest-whatsapp-message</code> ou <code>/ingest-whatsapp-audio</code>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">5</Badge>
                <div>
                  <p className="font-medium">Sincronizar histórico (opcional)</p>
                  <p className="text-sm text-muted-foreground">
                    Use <code>/bulk-ingest-messages</code> para importar mensagens antigas (até 500 por vez)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Endpoints */}
        <h2 className="text-2xl font-bold mb-6">Endpoints</h2>
        <div>
          {endpoints.map((endpoint) => (
            <EndpointCard key={endpoint.path} endpoint={endpoint} />
          ))}
        </div>

        {/* Notes */}
        <Card className="mt-8 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200">Notas Importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• Todos os telefones devem estar no formato E.164 (ex: +5511999998888)</p>
            <p>• O <code>session_token</code> expira e deve ser renovado periodicamente</p>
            <p>• Áudios são transcritos e <strong>imediatamente descartados</strong> - não são armazenados</p>
            <p>• A análise de IA é disparada automaticamente para mensagens <code>client_to_team</code> com mais de 20 caracteres</p>
            <p>• O limite de mensagens no bulk import é de 500 por requisição</p>
          </CardContent>
        </Card>
      </div>
  );
};

export default ApiDocs;
