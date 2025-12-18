import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Globe, Key, Users, MessageSquare, Mic, FileText, Search, Code, Zap, Shield, AlertTriangle, CheckCircle, BookOpen, Workflow, Database, Bell, Calendar, FileCheck, Heart, ClipboardList, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const BASE_URL = "https://mtzoavtbtqflufyccern.supabase.co/functions/v1";

interface EndpointDoc {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  icon: React.ReactNode;
  category: "auth" | "clients" | "messages" | "data" | "actions";
  headers: { name: string; value: string; description: string }[];
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
  bodyParams?: { name: string; type: string; required: boolean; description: string }[];
  requestExample: string;
  responseExample: string;
  errorCodes: { code: number; message: string; description: string }[];
}

const endpoints: EndpointDoc[] = [
  // === AUTH ===
  {
    name: "Autenticação",
    method: "POST",
    path: "/extension-auth",
    description: "Autentica o usuário da extensão e retorna tokens de sessão para chamadas subsequentes.",
    icon: <Key className="h-5 w-5" />,
    category: "auth",
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
  // === CLIENTS ===
  {
    name: "Buscar Cliente por Telefone",
    method: "GET",
    path: "/get-client-by-phone",
    description: "Busca um cliente pelo número de telefone no formato E.164. Retorna dados completos do cliente incluindo scores e eventos recentes.",
    icon: <Search className="h-5 w-5" />,
    category: "clients",
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
    "is_mls": true,
    "mls_level": "ouro",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "latest_score": {
    "escore": 75,
    "roizometer": 82,
    "quadrant": "highE_highROI",
    "trend": "up"
  },
  "vnps": {
    "vnps_score": 8.5,
    "vnps_class": "promoter",
    "risk_index": 12
  },
  "recent_risks": [...],
  "recent_messages": [...],
  "open_recommendations": [...]
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
    category: "clients",
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
      { name: "is_mls", type: "boolean", required: false, description: "Se é cliente MLS" },
      { name: "mls_level", type: "string", required: false, description: "Nível MLS (bronze, prata, ouro, diamond, platinum)" },
      { name: "tags", type: "string[]", required: false, description: "Tags para categorização" },
      { name: "notes", type: "string", required: false, description: "Observações sobre o cliente" }
    ],
    requestExample: `{
  "account_id": "uuid-da-conta",
  "phone_e164": "+5511999998888",
  "full_name": "Maria Santos",
  "emails": ["maria@empresa.com"],
  "company_name": "Empresa ABC",
  "is_mls": true,
  "mls_level": "ouro",
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
    category: "clients",
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
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}`,
    errorCodes: [
      { code: 401, message: "Unauthorized", description: "Token de sessão inválido ou expirado" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  },
  // === MESSAGES ===
  {
    name: "Ingerir Mensagem de Texto",
    method: "POST",
    path: "/ingest-whatsapp-message",
    description: "Envia uma mensagem de texto capturada do WhatsApp Web. Dispara análise de IA automaticamente para mensagens do cliente.",
    icon: <MessageSquare className="h-5 w-5" />,
    category: "messages",
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
    category: "messages",
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
    description: "Importa múltiplas mensagens históricas de uma vez. Máximo de 500 mensagens por requisição.",
    icon: <FileText className="h-5 w-5" />,
    category: "messages",
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
      "content": "Primeira mensagem",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "direction": "team_to_client",
      "content": "Resposta da equipe",
      "timestamp": "2024-01-01T10:05:00Z"
    }
  ]
}`,
    responseExample: `{
  "success": true,
  "client_id": "uuid-do-cliente",
  "imported_count": 2,
  "failed_count": 0,
  "errors": []
}`,
    errorCodes: [
      { code: 400, message: "Too many messages", description: "Máximo de 500 mensagens por requisição" },
      { code: 401, message: "Invalid API key", description: "API key inválida" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" },
      { code: 500, message: "Internal server error", description: "Erro interno do servidor" }
    ]
  },
  // === DATA (Custom Fields, Tasks, Followups, Life Events) ===
  {
    name: "Listar Campos Personalizados",
    method: "GET",
    path: "/extension-get-custom-fields",
    description: "Retorna todos os campos personalizados configurados para a conta, incluindo opções de select/multi-select.",
    icon: <Settings className="h-5 w-5" />,
    category: "data",
    headers: [
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    requestExample: `GET /extension-get-custom-fields

Headers:
x-account-id: uuid-da-conta
x-session-token: eyJhbGciOiJIUzI1NiIs...`,
    responseExample: `{
  "fields": [
    {
      "id": "uuid-campo",
      "name": "Fase do Cliente",
      "field_type": "select",
      "is_required": true,
      "options": [
        { "label": "Onboarding", "color": "#3b82f6" },
        { "label": "Ativo", "color": "#22c55e" },
        { "label": "Em risco", "color": "#ef4444" }
      ]
    },
    {
      "id": "uuid-campo-2",
      "name": "Responsável",
      "field_type": "user",
      "is_required": false
    }
  ]
}`,
    errorCodes: [
      { code: 401, message: "Unauthorized", description: "Token inválido" },
      { code: 500, message: "Internal server error", description: "Erro interno" }
    ]
  },
  {
    name: "Obter Valores de Campos do Cliente",
    method: "GET",
    path: "/extension-get-client-fields",
    description: "Retorna os valores dos campos personalizados de um cliente específico.",
    icon: <Database className="h-5 w-5" />,
    category: "data",
    headers: [
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    queryParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" }
    ],
    requestExample: `GET /extension-get-client-fields?client_id=uuid-cliente

Headers:
x-account-id: uuid-da-conta
x-session-token: eyJhbGciOiJIUzI1NiIs...`,
    responseExample: `{
  "field_values": [
    {
      "field_id": "uuid-campo",
      "field_name": "Fase do Cliente",
      "field_type": "select",
      "value_text": "Ativo"
    },
    {
      "field_id": "uuid-campo-2",
      "field_name": "Responsável",
      "field_type": "user",
      "value_json": ["uuid-user-1", "uuid-user-2"]
    }
  ]
}`,
    errorCodes: [
      { code: 400, message: "Missing client_id", description: "ID do cliente não fornecido" },
      { code: 401, message: "Unauthorized", description: "Token inválido" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" }
    ]
  },
  {
    name: "Atualizar Campo do Cliente",
    method: "POST",
    path: "/extension-update-client-field",
    description: "Atualiza o valor de um campo personalizado para um cliente.",
    icon: <Database className="h-5 w-5" />,
    category: "data",
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo" },
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    bodyParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" },
      { name: "field_id", type: "string (uuid)", required: true, description: "ID do campo" },
      { name: "value", type: "any", required: true, description: "Novo valor (tipo depende do campo)" }
    ],
    requestExample: `{
  "client_id": "uuid-cliente",
  "field_id": "uuid-campo",
  "value": "Ativo"
}`,
    responseExample: `{
  "success": true,
  "field_value": {
    "id": "uuid-valor",
    "field_id": "uuid-campo",
    "value_text": "Ativo",
    "updated_at": "2024-01-20T15:30:00Z"
  }
}`,
    errorCodes: [
      { code: 400, message: "Invalid value type", description: "Tipo de valor incompatível com o campo" },
      { code: 401, message: "Unauthorized", description: "Token inválido" },
      { code: 404, message: "Field not found", description: "Campo não encontrado" }
    ]
  },
  {
    name: "Listar Tarefas do Cliente",
    method: "GET",
    path: "/extension-get-client-tasks",
    description: "Retorna as tarefas associadas a um cliente específico.",
    icon: <ClipboardList className="h-5 w-5" />,
    category: "data",
    headers: [
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    queryParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" },
      { name: "status", type: "string", required: false, description: "Filtro por status (pending, in_progress, done)" }
    ],
    requestExample: `GET /extension-get-client-tasks?client_id=uuid-cliente&status=pending

Headers:
x-account-id: uuid-da-conta
x-session-token: eyJhbGciOiJIUzI1NiIs...`,
    responseExample: `{
  "tasks": [
    {
      "id": "uuid-task",
      "title": "Reunião de alinhamento",
      "description": "Agendar call para revisar resultados",
      "status": "pending",
      "priority": "high",
      "due_date": "2024-01-25",
      "assigned_to": {
        "id": "uuid-user",
        "name": "João Silva"
      },
      "created_at": "2024-01-20T10:00:00Z"
    }
  ]
}`,
    errorCodes: [
      { code: 401, message: "Unauthorized", description: "Token inválido" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" }
    ]
  },
  {
    name: "Criar Tarefa",
    method: "POST",
    path: "/extension-create-task",
    description: "Cria uma nova tarefa associada a um cliente.",
    icon: <ClipboardList className="h-5 w-5" />,
    category: "actions",
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo" },
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    bodyParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" },
      { name: "title", type: "string", required: true, description: "Título da tarefa" },
      { name: "description", type: "string", required: false, description: "Descrição detalhada" },
      { name: "priority", type: "string", required: false, description: "low, medium, high, urgent" },
      { name: "due_date", type: "string (ISO date)", required: false, description: "Data de vencimento" },
      { name: "assigned_to", type: "string (uuid)", required: false, description: "ID do usuário responsável" }
    ],
    requestExample: `{
  "client_id": "uuid-cliente",
  "title": "Ligar para cliente",
  "description": "Verificar satisfação após entrega",
  "priority": "high",
  "due_date": "2024-01-25",
  "assigned_to": "uuid-user"
}`,
    responseExample: `{
  "success": true,
  "task": {
    "id": "uuid-nova-task",
    "title": "Ligar para cliente",
    "status": "pending",
    "created_at": "2024-01-20T15:30:00Z"
  }
}`,
    errorCodes: [
      { code: 400, message: "Missing title", description: "Título não fornecido" },
      { code: 401, message: "Unauthorized", description: "Token inválido" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" }
    ]
  },
  {
    name: "Atualizar Status da Tarefa",
    method: "PATCH",
    path: "/extension-update-task",
    description: "Atualiza o status ou outros campos de uma tarefa existente.",
    icon: <CheckCircle className="h-5 w-5" />,
    category: "actions",
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo" },
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    bodyParams: [
      { name: "task_id", type: "string (uuid)", required: true, description: "ID da tarefa" },
      { name: "status", type: "string", required: false, description: "pending, in_progress, done, cancelled" },
      { name: "title", type: "string", required: false, description: "Novo título" },
      { name: "priority", type: "string", required: false, description: "Nova prioridade" }
    ],
    requestExample: `{
  "task_id": "uuid-task",
  "status": "done"
}`,
    responseExample: `{
  "success": true,
  "task": {
    "id": "uuid-task",
    "status": "done",
    "completed_at": "2024-01-20T16:00:00Z"
  }
}`,
    errorCodes: [
      { code: 400, message: "Invalid status", description: "Status inválido" },
      { code: 404, message: "Task not found", description: "Tarefa não encontrada" }
    ]
  },
  {
    name: "Criar Acompanhamento",
    method: "POST",
    path: "/extension-create-followup",
    description: "Adiciona uma nota de acompanhamento ao cliente.",
    icon: <FileCheck className="h-5 w-5" />,
    category: "actions",
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo" },
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    bodyParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" },
      { name: "content", type: "string", required: true, description: "Conteúdo da nota" },
      { name: "title", type: "string", required: false, description: "Título opcional" },
      { name: "type", type: "string", required: false, description: "Tipo: text, note, file, image" }
    ],
    requestExample: `{
  "client_id": "uuid-cliente",
  "content": "Cliente mencionou interesse em upgrade",
  "title": "Oportunidade de upsell"
}`,
    responseExample: `{
  "success": true,
  "followup": {
    "id": "uuid-followup",
    "content": "Cliente mencionou interesse em upgrade",
    "created_at": "2024-01-20T15:30:00Z"
  }
}`,
    errorCodes: [
      { code: 400, message: "Missing content", description: "Conteúdo não fornecido" },
      { code: 401, message: "Unauthorized", description: "Token inválido" }
    ]
  },
  {
    name: "Listar Momentos CX",
    method: "GET",
    path: "/extension-get-life-events",
    description: "Retorna os eventos de vida (momentos CX) de um cliente.",
    icon: <Heart className="h-5 w-5" />,
    category: "data",
    headers: [
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    queryParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" }
    ],
    requestExample: `GET /extension-get-life-events?client_id=uuid-cliente`,
    responseExample: `{
  "life_events": [
    {
      "id": "uuid-event",
      "event_type": "birthday",
      "title": "Aniversário",
      "event_date": "1985-03-15",
      "is_recurring": true,
      "source": "manual"
    },
    {
      "id": "uuid-event-2",
      "event_type": "wedding",
      "title": "Casamento",
      "event_date": "2024-06-20",
      "source": "ai_detected"
    }
  ]
}`,
    errorCodes: [
      { code: 401, message: "Unauthorized", description: "Token inválido" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" }
    ]
  },
  {
    name: "Criar Momento CX",
    method: "POST",
    path: "/extension-create-life-event",
    description: "Registra um novo evento de vida/momento CX para o cliente.",
    icon: <Calendar className="h-5 w-5" />,
    category: "actions",
    headers: [
      { name: "Content-Type", value: "application/json", description: "Tipo de conteúdo" },
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    bodyParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" },
      { name: "event_type", type: "string", required: true, description: "birthday, wedding, pregnancy, new_job, etc." },
      { name: "title", type: "string", required: true, description: "Título do evento" },
      { name: "event_date", type: "string (date)", required: false, description: "Data do evento" },
      { name: "description", type: "string", required: false, description: "Descrição adicional" },
      { name: "is_recurring", type: "boolean", required: false, description: "Se é evento recorrente (ex: aniversário)" }
    ],
    requestExample: `{
  "client_id": "uuid-cliente",
  "event_type": "birthday",
  "title": "Aniversário",
  "event_date": "1985-03-15",
  "is_recurring": true
}`,
    responseExample: `{
  "success": true,
  "life_event": {
    "id": "uuid-novo-event",
    "event_type": "birthday",
    "title": "Aniversário",
    "created_at": "2024-01-20T15:30:00Z"
  }
}`,
    errorCodes: [
      { code: 400, message: "Invalid event_type", description: "Tipo de evento inválido" },
      { code: 401, message: "Unauthorized", description: "Token inválido" }
    ]
  },
  {
    name: "Listar Contratos",
    method: "GET",
    path: "/extension-get-contracts",
    description: "Retorna os contratos de um cliente.",
    icon: <FileText className="h-5 w-5" />,
    category: "data",
    headers: [
      { name: "x-account-id", value: "uuid-da-conta", description: "ID da conta" },
      { name: "x-session-token", value: "token-de-sessao", description: "Token de sessão" }
    ],
    queryParams: [
      { name: "client_id", type: "string (uuid)", required: true, description: "ID do cliente" }
    ],
    requestExample: `GET /extension-get-contracts?client_id=uuid-cliente`,
    responseExample: `{
  "contracts": [
    {
      "id": "uuid-contrato",
      "contract_type": "Contrato de compra",
      "status": "active",
      "value": 5000,
      "currency": "BRL",
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "payment_option": "monthly"
    }
  ]
}`,
    errorCodes: [
      { code: 401, message: "Unauthorized", description: "Token inválido" },
      { code: 404, message: "Client not found", description: "Cliente não encontrado" }
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
  const methodColors = {
    GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    PATCH: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            {endpoint.icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {endpoint.name}
              <span className={`px-2 py-0.5 rounded text-xs font-mono ${methodColors[endpoint.method]}`}>
                {endpoint.method}
              </span>
            </CardTitle>
            <CardDescription className="font-mono text-xs mt-1">
              {endpoint.path}
            </CardDescription>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{endpoint.description}</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="request" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="request" className="text-xs">Request</TabsTrigger>
            <TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
            <TabsTrigger value="params" className="text-xs">Params</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs">Erros</TabsTrigger>
          </TabsList>
          
          <TabsContent value="request" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Headers</h4>
            <div className="space-y-1 mb-4">
              {endpoint.headers.map((header) => (
                <div key={header.name} className="flex items-center gap-2 text-sm">
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">{header.name}</code>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-muted-foreground text-xs">{header.description}</span>
                </div>
              ))}
            </div>
            <h4 className="text-sm font-medium mb-2">Exemplo</h4>
            <CodeBlock code={endpoint.requestExample} />
          </TabsContent>
          
          <TabsContent value="response" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Response (200 OK)</h4>
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
                      <span className="text-muted-foreground flex-1 text-xs">{param.description}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
              <>
                <h4 className="text-sm font-medium mb-2">Body (JSON)</h4>
                <div className="space-y-2">
                  {endpoint.bodyParams.map((param) => (
                    <div key={param.name} className="flex items-start gap-2 text-sm border-b pb-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{param.name}</code>
                      <Badge variant="outline" className="text-xs">{param.type}</Badge>
                      {param.required && <Badge variant="destructive" className="text-xs">obrigatório</Badge>}
                      <span className="text-muted-foreground flex-1 text-xs">{param.description}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="errors" className="mt-4">
            <div className="space-y-2">
              {endpoint.errorCodes.map((error) => (
                <div key={error.code + error.message} className="flex items-start gap-2 text-sm border-b pb-2">
                  <Badge variant={error.code >= 500 ? "destructive" : error.code >= 400 ? "secondary" : "default"}>
                    {error.code}
                  </Badge>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{error.message}</code>
                  <span className="text-muted-foreground flex-1 text-xs">{error.description}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const sdkExample = `// roiboy-extension-sdk.ts
// SDK para integração com a API do ROIBOY

const BASE_URL = "${BASE_URL}";

interface AuthResponse {
  success: boolean;
  api_key: string;
  session_token: string;
  expires_at: number;
  user: { id: string; name: string; email: string; role: string };
  account: { id: string; name: string };
}

interface ClientData {
  id: string;
  full_name: string;
  phone_e164: string;
  status: string;
  // ... outros campos
}

class ROIBOYClient {
  private apiKey: string = "";
  private sessionToken: string = "";
  private accountId: string = "";

  async authenticate(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(\`\${BASE_URL}/extension-auth\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.success) {
      this.apiKey = data.api_key;
      this.sessionToken = data.session_token;
      this.accountId = data.account.id;
    }
    return data;
  }

  private getHeaders() {
    return {
      "Content-Type": "application/json",
      "x-account-id": this.accountId,
      "x-session-token": this.sessionToken
    };
  }

  async getClientByPhone(phone: string): Promise<ClientData | null> {
    const encoded = encodeURIComponent(phone);
    const response = await fetch(
      \`\${BASE_URL}/get-client-by-phone?phone_e164=\${encoded}\`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.found ? data.client : null;
  }

  async createClient(clientData: Partial<ClientData>): Promise<ClientData> {
    const response = await fetch(\`\${BASE_URL}/create-client\`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ account_id: this.accountId, ...clientData })
    });
    return response.json();
  }

  async ingestMessage(
    phone: string,
    direction: "client_to_team" | "team_to_client",
    content: string,
    timestamp?: string
  ) {
    const response = await fetch(\`\${BASE_URL}/ingest-whatsapp-message\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        phone_e164: phone,
        direction,
        content,
        timestamp: timestamp || new Date().toISOString()
      })
    });
    return response.json();
  }

  async ingestAudio(
    phone: string,
    direction: "client_to_team" | "team_to_client",
    audioBase64: string,
    durationSec: number
  ) {
    const response = await fetch(\`\${BASE_URL}/ingest-whatsapp-audio\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        phone_e164: phone,
        direction,
        audio_base64: audioBase64,
        audio_duration_sec: durationSec,
        timestamp: new Date().toISOString()
      })
    });
    return response.json();
  }

  async createTask(clientId: string, title: string, options?: {
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    due_date?: string;
  }) {
    const response = await fetch(\`\${BASE_URL}/extension-create-task\`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ client_id: clientId, title, ...options })
    });
    return response.json();
  }

  async createFollowup(clientId: string, content: string, title?: string) {
    const response = await fetch(\`\${BASE_URL}/extension-create-followup\`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ client_id: clientId, content, title })
    });
    return response.json();
  }
}

// Uso:
const client = new ROIBOYClient();
await client.authenticate("user@email.com", "password");
const clientData = await client.getClientByPhone("+5511999998888");`;

const contentScriptExample = `// content-script.ts
// Exemplo de content script para captura de mensagens do WhatsApp Web

class WhatsAppCapture {
  private observer: MutationObserver | null = null;
  private sdk: ROIBOYClient;
  private currentPhone: string = "";

  constructor(sdk: ROIBOYClient) {
    this.sdk = sdk;
  }

  start() {
    // Observar mudanças no DOM para detectar novas mensagens
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          this.processNewMessages(mutation.addedNodes);
        }
      });
    });

    // Observar container de mensagens
    const chatContainer = document.querySelector('[data-testid="conversation-panel-messages"]');
    if (chatContainer) {
      this.observer.observe(chatContainer, { childList: true, subtree: true });
    }
  }

  private processNewMessages(nodes: NodeList) {
    nodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        const messageEl = node.querySelector('[data-testid="msg-container"]');
        if (messageEl) {
          this.captureMessage(messageEl);
        }
      }
    });
  }

  private async captureMessage(messageEl: HTMLElement) {
    const isOutgoing = messageEl.classList.contains("message-out");
    const textEl = messageEl.querySelector('[data-testid="conversation-text"]');
    
    if (textEl?.textContent) {
      await this.sdk.ingestMessage(
        this.currentPhone,
        isOutgoing ? "team_to_client" : "client_to_team",
        textEl.textContent
      );
    }
  }

  setCurrentPhone(phone: string) {
    this.currentPhone = phone;
  }

  stop() {
    this.observer?.disconnect();
  }
}`;

const ApiDocs = () => {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "Todos", icon: <Globe className="h-4 w-4" /> },
    { id: "auth", label: "Autenticação", icon: <Key className="h-4 w-4" /> },
    { id: "clients", label: "Clientes", icon: <Users className="h-4 w-4" /> },
    { id: "messages", label: "Mensagens", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "data", label: "Dados", icon: <Database className="h-4 w-4" /> },
    { id: "actions", label: "Ações", icon: <Zap className="h-4 w-4" /> },
  ];

  const filteredEndpoints = activeCategory === "all" 
    ? endpoints 
    : endpoints.filter(e => e.category === activeCategory);

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Globe className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">ROIBOY API</h1>
            <p className="text-muted-foreground">Documentação da API para extensão Chrome</p>
          </div>
        </div>
        
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Base URL
                </h3>
                <code className="text-xs bg-background px-3 py-2 rounded-lg block break-all">{BASE_URL}</code>
              </div>
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Autenticação
                </h3>
                <p className="text-sm text-muted-foreground">
                  Headers <code className="text-xs">x-account-id</code> e <code className="text-xs">x-session-token</code>
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Rate Limit
                </h3>
                <p className="text-sm text-muted-foreground">
                  100 req/min por conta
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="endpoints" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Endpoints</span>
          </TabsTrigger>
          <TabsTrigger value="quickstart" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Start</span>
          </TabsTrigger>
          <TabsTrigger value="sdk" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">SDK</span>
          </TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Guia</span>
          </TabsTrigger>
        </TabsList>

        {/* ENDPOINTS TAB */}
        <TabsContent value="endpoints" className="space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className="gap-2"
              >
                {cat.icon}
                {cat.label}
                {cat.id !== "all" && (
                  <Badge variant="secondary" className="ml-1">
                    {endpoints.filter(e => e.category === cat.id).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          <div className="grid gap-4">
            {filteredEndpoints.map((endpoint) => (
              <EndpointCard key={endpoint.path + endpoint.method} endpoint={endpoint} />
            ))}
          </div>
        </TabsContent>

        {/* QUICKSTART TAB */}
        <TabsContent value="quickstart" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Fluxo de Integração
              </CardTitle>
              <CardDescription>Passo a passo para integrar a extensão Chrome com o ROIBOY</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                  <div className="flex-1">
                    <h4 className="font-medium">Autenticar Usuário</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Chame <code>/extension-auth</code> com email e senha do usuário ROIBOY.
                      Armazene <code>session_token</code>, <code>account_id</code> e <code>api_key</code> no storage da extensão.
                    </p>
                    <CodeBlock code={`POST /extension-auth
{ "email": "user@email.com", "password": "***" }

// Resposta → guardar:
// session_token, account_id, api_key`} />
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                  <div className="flex-1">
                    <h4 className="font-medium">Detectar Conversa Ativa</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Quando o usuário abre uma conversa no WhatsApp Web, extraia o número do telefone
                      e busque o cliente na base.
                    </p>
                    <CodeBlock code={`// Extrair telefone do DOM do WhatsApp Web
const phone = extractPhoneFromChat(); // "+5511999998888"

// Buscar cliente
GET /get-client-by-phone?phone_e164=+5511999998888`} />
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                  <div className="flex-1">
                    <h4 className="font-medium">Exibir Painel do Cliente</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Se encontrado, exiba o painel lateral com scores, timeline e ações.
                      Se não encontrado, ofereça opção de cadastrar.
                    </p>
                    <CodeBlock code={`if (response.found) {
  showClientPanel(response.client, response.latest_score);
} else {
  showCreateClientForm(phone);
}`} />
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                  <div className="flex-1">
                    <h4 className="font-medium">Capturar Mensagens em Tempo Real</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Use MutationObserver para detectar novas mensagens e enviá-las para análise.
                    </p>
                    <CodeBlock code={`// Para cada mensagem detectada:
POST /ingest-whatsapp-message
{
  "api_key": "...",
  "phone_e164": "+5511999998888",
  "direction": "client_to_team",
  "content": "Texto da mensagem",
  "timestamp": "2024-01-20T10:00:00Z"
}`} />
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">5</div>
                  <div className="flex-1">
                    <h4 className="font-medium">Sincronizar Histórico (Opcional)</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Na primeira vez que um cliente é identificado, importe mensagens anteriores.
                    </p>
                    <CodeBlock code={`// Scroll no chat para carregar histórico
// Coletar até 500 mensagens
POST /bulk-ingest-messages
{
  "api_key": "...",
  "phone_e164": "+5511999998888",
  "messages": [ ... ]
}`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Architecture Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Arquitetura</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-6">
                <pre className="text-xs overflow-x-auto">
{`┌─────────────────────────────────────────────────────────────────────┐
│                        CHROME EXTENSION                              │
├──────────────────┬──────────────────┬───────────────────────────────┤
│   Content Script │   Background     │        Popup/Sidebar          │
│   (WhatsApp DOM) │   (API Client)   │     (Client Panel UI)         │
│                  │                  │                               │
│  ┌───────────┐   │  ┌───────────┐   │  ┌───────────────────────┐    │
│  │ Message   │──►│  │ ROIBOY    │──►│  │ Scores / Timeline     │    │
│  │ Observer  │   │  │ SDK       │   │  │ Campos / Tarefas      │    │
│  └───────────┘   │  └───────────┘   │  │ Momentos CX           │    │
│                  │       │          │  └───────────────────────┘    │
└──────────────────┴───────┼──────────┴───────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ROIBOY BACKEND (Supabase)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │ extension-  │   │ get-client- │   │ ingest-     │               │
│  │ auth        │   │ by-phone    │   │ whatsapp-*  │               │
│  └─────────────┘   └─────────────┘   └─────────────┘               │
│                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │ create-     │   │ list-       │   │ bulk-       │               │
│  │ client      │   │ clients     │   │ ingest      │               │
│  └─────────────┘   └─────────────┘   └─────────────┘               │
│                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │ extension-  │   │ extension-  │   │ analyze-    │               │
│  │ *-task      │   │ *-followup  │   │ message(AI) │               │
│  └─────────────┘   └─────────────┘   └─────────────┘               │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL Database                       │   │
│  │  clients | messages | tasks | followups | scores | events   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SDK TAB */}
        <TabsContent value="sdk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                TypeScript SDK
              </CardTitle>
              <CardDescription>Classe cliente para facilitar integração</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={sdkExample} language="typescript" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Content Script Example
              </CardTitle>
              <CardDescription>Exemplo de captura de mensagens do WhatsApp Web</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={contentScriptExample} language="typescript" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* GUIDE TAB */}
        <TabsContent value="guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Guia de Desenvolvimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="structure">
                  <AccordionTrigger>Estrutura da Extensão</AccordionTrigger>
                  <AccordionContent>
                    <CodeBlock code={`roiboy-extension/
├── manifest.json        # Configuração da extensão
├── src/
│   ├── background/
│   │   └── index.ts     # Service worker (API client)
│   ├── content/
│   │   └── whatsapp.ts  # Content script para WhatsApp Web
│   ├── popup/
│   │   └── index.tsx    # UI do popup/sidebar
│   ├── lib/
│   │   ├── sdk.ts       # ROIBOY SDK
│   │   └── storage.ts   # Chrome storage helpers
│   └── components/      # Componentes React
├── public/
│   └── icons/           # Ícones da extensão
└── package.json`} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="manifest">
                  <AccordionTrigger>Configuração do Manifest</AccordionTrigger>
                  <AccordionContent>
                    <CodeBlock code={`{
  "manifest_version": 3,
  "name": "ROIBOY - WhatsApp Integration",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://web.whatsapp.com/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://web.whatsapp.com/*"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}`} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="auth-flow">
                  <AccordionTrigger>Fluxo de Autenticação</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      A autenticação usa as mesmas credenciais do ROIBOY web. O token de sessão expira após
                      algumas horas e deve ser renovado.
                    </p>
                    <CodeBlock code={`// Verificar se já está autenticado
const stored = await chrome.storage.local.get(['session_token', 'expires_at']);

if (stored.expires_at && Date.now() < stored.expires_at * 1000) {
  // Token válido, usar normalmente
  sdk.setCredentials(stored);
} else {
  // Token expirado, mostrar tela de login
  showLoginScreen();
}`} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="phone-extraction">
                  <AccordionTrigger>Extração de Telefone</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      O telefone pode ser extraído do header da conversa ou da URL do WhatsApp Web.
                    </p>
                    <CodeBlock code={`function extractPhoneFromChat(): string | null {
  // Método 1: Do título da conversa
  const header = document.querySelector('[data-testid="conversation-info-header"]');
  const phoneEl = header?.querySelector('[data-testid="phone-number"]');
  
  // Método 2: Da URL
  const match = window.location.href.match(/\\/send\\/?(\\d+)/);
  
  // Método 3: Do painel de info do contato
  const infoPanel = document.querySelector('[data-testid="contact-info"]');
  
  // Normalizar para E.164
  return normalizePhone(rawPhone); // +5511999998888
}`} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="error-handling">
                  <AccordionTrigger>Tratamento de Erros</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">401</Badge>
                        <span className="text-sm">Sessão expirada - redirecionar para login</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">404</Badge>
                        <span className="text-sm">Cliente não encontrado - oferecer cadastro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">429</Badge>
                        <span className="text-sm">Rate limit - aguardar e retry</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">500</Badge>
                        <span className="text-sm">Erro interno - notificar usuário, retry com backoff</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="best-practices">
                  <AccordionTrigger>Boas Práticas</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Debounce mensagens para evitar duplicatas (500ms)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Cache local de dados do cliente para UX rápida</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Batch histórico em chunks de 100 mensagens</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Retry automático com exponential backoff</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                        <span>Não enviar mensagens em branco ou duplicadas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                        <span>Validar formato E.164 antes de enviar</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Notas Importantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• Todos os telefones devem estar no formato E.164 (ex: +5511999998888)</p>
              <p>• O <code>session_token</code> expira e deve ser renovado periodicamente</p>
              <p>• Áudios são transcritos e <strong>imediatamente descartados</strong> - nunca armazenados</p>
              <p>• A análise de IA é disparada automaticamente para mensagens <code>client_to_team</code> com mais de 20 caracteres</p>
              <p>• O limite de mensagens no bulk import é de 500 por requisição</p>
              <p>• Rate limit: 100 requisições por minuto por conta</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiDocs;
