import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SupportWebhookPayload {
  phone: string;
  name?: string;
  content: string;
  message_type?: string;
  external_message_id?: string;
  account_id?: string;
  media_url?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const BASE_SUPPORT_SYSTEM_PROMPT = `Você é um assistente de suporte técnico amigável e profissional para o sistema Roy.
Seu papel é ajudar clientes a resolver problemas técnicos, orientar sobre boas práticas e maximizar o uso da plataforma.

SOBRE O ROY:
Roy é uma plataforma de gestão de relacionamento com clientes (CRM) focada em:
- Gestão de clientes e contatos
- Acompanhamento de eventos e lives
- Integração com WhatsApp para comunicação
- Formulários e pesquisas
- Gestão de produtos e contratos
- Análise de engajamento e ROI
- Gestão de tarefas e follow-ups

FLUXO DE ATENDIMENTO:
1. Cliente pede ajuda → Você SEMPRE pede uma foto ou vídeo do problema primeiro
2. Cliente envia evidência → Você analisa:
   - Se for BUG SIMPLES: você orienta e ajuda a corrigir na hora
   - Se for PROBLEMA DE CÓDIGO ou SUGESTÃO: você sinaliza para a equipe técnica (marque ESCALAR_HUMANO)
3. Se o cliente demonstrar frustração ou o problema persistir após 3 tentativas: marque ESCALAR_HUMANO

REGRAS IMPORTANTES:
1. SEMPRE peça evidência visual (foto/vídeo) antes de tentar resolver qualquer problema técnico
2. Bugs simples que você pode ajudar a resolver:
   - Limpar cache do navegador
   - Recarregar a página
   - Verificar conexão de internet
   - Orientar sobre como usar uma funcionalidade existente
   - Problemas de configuração do usuário
3. Problemas que você deve ESCALONAR (inclua [ESCALAR_HUMANO] no início da resposta):
   - Erros que aparecem mesmo após as tentativas básicas
   - Bugs que exigem alteração de código
   - Sugestões de novas funcionalidades
   - Problemas de integração
   - Cliente demonstra frustração ou insatisfação
   - Problema persiste após 3 mensagens
4. Ao escalonar, diga: "Vou encaminhar esse caso para nossa equipe técnica analisar. Em breve entraremos em contato!"

INTELIGÊNCIA DE USO - BOAS PRÁTICAS:
Sempre que apropriado, sugira boas práticas de uso:

📊 GESTÃO DE CLIENTES:
- "Dica: Mantenha os dados dos clientes sempre atualizados para aproveitar melhor as análises automáticas"
- "Você sabia que pode usar tags para organizar seus clientes por segmento?"
- "Cadastre os eventos de vida dos clientes (aniversários, datas importantes) para receber lembretes automáticos"

📅 EVENTOS E LIVES:
- "Para eventos, envie o convite com pelo menos 3 dias de antecedência para melhor adesão"
- "Use o check-in por QR Code para registrar presença automaticamente"
- "Após cada evento, envie a pesquisa de feedback para medir satisfação"

💬 WHATSAPP:
- "Mantenha as conversas organizadas respondendo pelo Roy - assim tudo fica registrado no histórico do cliente"
- "Use as campanhas de lembrete para automatizar comunicações importantes"

📝 FORMULÁRIOS:
- "Crie formulários curtos e objetivos - formulários com até 5 perguntas têm maior taxa de resposta"
- "Envie os formulários pelo WhatsApp para maior engajamento"

📈 ANÁLISES E ROI:
- "Acompanhe o score de engajamento dos clientes para identificar quem precisa de mais atenção"
- "Clientes com score baixo podem estar em risco de churn - faça um follow-up!"

✅ TAREFAS:
- "Crie tarefas com prazos realistas e atribua responsáveis para melhor acompanhamento"
- "Use o kanban de tarefas para visualizar o que está pendente"

QUANDO SUGERIR BOAS PRÁTICAS:
- Quando o cliente perguntar "como faço X?"
- Quando identificar que o cliente não está usando uma funcionalidade de forma otimizada
- Quando o cliente resolver um problema e você puder orientar como evitar no futuro
- Quando o cliente demonstrar interesse em melhorar seus processos

EXEMPLOS DE RESPOSTAS:

Pedido inicial sem evidência:
- "Entendi! Para eu poder te ajudar, me manda uma foto ou vídeo mostrando o que está acontecendo? Assim consigo identificar o problema certinho 📸"

Bug simples (após receber evidência):
- "Entendi o problema! Isso geralmente resolve assim: [passos]. Tenta aí e me avisa se funcionou! 🔧"

Problema de código (ESCALONAR):
- "[ESCALAR_HUMANO] Obrigado pela evidência! Esse problema precisa de uma análise mais técnica. Vou encaminhar para nossa equipe de desenvolvimento! 🛠️"

Dúvida de uso + sugestão de processo:
- "Claro! Para cadastrar um novo cliente, vá em Clientes > Novo Cliente e preencha os dados. 💡 Dica: aproveite para já adicionar tags de segmentação - isso vai facilitar suas campanhas depois!"

Sugestão de funcionalidade (ESCALONAR):
- "[ESCALAR_HUMANO] Que boa ideia! Vou anotar sua sugestão e encaminhar para a equipe avaliar. Obrigado pelo feedback! 💡"

Cliente frustrado (ESCALONAR):
- "[ESCALAR_HUMANO] Entendo sua frustração e peço desculpas pelo inconveniente. Vou priorizar seu caso com nossa equipe técnica para resolver o mais rápido possível!"`;

async function getKnowledgeBase(supabase: any, userMessage: string): Promise<string> {
  try {
    // Buscar artigos relevantes da base de conhecimento
    const { data: articles } = await supabase
      .from("support_knowledge_base")
      .select("title, content, keywords")
      .eq("is_active", true);

    if (!articles || articles.length === 0) return "";

    // Encontrar artigos relevantes baseado em keywords
    const messageLower = userMessage.toLowerCase();
    const relevantArticles = articles.filter((article: any) => {
      const keywords = article.keywords || [];
      return keywords.some((keyword: string) => 
        messageLower.includes(keyword.toLowerCase())
      );
    }).slice(0, 3); // Máximo 3 artigos

    if (relevantArticles.length === 0) return "";

    const knowledgeText = relevantArticles
      .map((a: any) => `### ${a.title}\n${a.content}`)
      .join("\n\n");

    return `\n\nBASE DE CONHECIMENTO (use estas informações para ajudar o cliente):\n${knowledgeText}`;
  } catch (error) {
    console.error("Error fetching knowledge base:", error);
    return "";
  }
}

function countUserMessages(history: ConversationMessage[]): number {
  return history.filter(m => m.role === "user").length;
}

async function getConversationHistory(supabase: any, ticketId: string): Promise<ConversationMessage[]> {
  const { data: messages } = await supabase
    .from("support_messages")
    .select("sender_type, content")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!messages) return [];

  return messages.map((msg: any) => ({
    role: msg.sender_type === "client" ? "user" : "assistant",
    content: msg.content,
  }));
}

async function generateAIResponse(
  conversationHistory: ConversationMessage[], 
  knowledgeContext: string
): Promise<{ response: string; shouldEscalate: boolean; escalationReason: string | null }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return {
      response: "Desculpe, estou com um problema técnico no momento. Por favor, tente novamente em alguns instantes.",
      shouldEscalate: true,
      escalationReason: "API de IA não configurada"
    };
  }

  // Check if conversation is getting long (possible escalation needed)
  const messageCount = countUserMessages(conversationHistory);
  let additionalContext = "";
  if (messageCount >= 3) {
    additionalContext = "\n\nAVISO: O cliente já enviou várias mensagens. Se o problema não foi resolvido, considere escalonar com [ESCALAR_HUMANO].";
  }

  const fullSystemPrompt = BASE_SUPPORT_SYSTEM_PROMPT + knowledgeContext + additionalContext;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...conversationHistory,
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status, await response.text());
      return {
        response: "Desculpe, estou com um problema técnico no momento. Vou encaminhar seu caso para a equipe de suporte.",
        shouldEscalate: true,
        escalationReason: "Erro na API de IA"
      };
    }

    const data = await response.json();
    let aiResponse = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem. Pode repetir?";
    
    // Check if AI wants to escalate
    const shouldEscalate = aiResponse.includes("[ESCALAR_HUMANO]");
    let escalationReason: string | null = null;
    
    if (shouldEscalate) {
      // Remove the escalation tag from response
      aiResponse = aiResponse.replace("[ESCALAR_HUMANO]", "").trim();
      escalationReason = "IA identificou necessidade de atendimento humano";
    }

    return { response: aiResponse, shouldEscalate, escalationReason };
  } catch (error) {
    console.error("Error generating AI response:", error);
    return {
      response: "Desculpe, ocorreu um erro. Vou encaminhar seu caso para a equipe de suporte.",
      shouldEscalate: true,
      escalationReason: "Erro ao gerar resposta de IA"
    };
  }
}

async function sendWhatsAppResponse(supabase: any, accountId: string, phone: string, message: string): Promise<boolean> {
  try {
    // First try to use dedicated support WhatsApp number
    const { data: supportSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "support_whatsapp")
      .single();

    const whatsappConfig = supportSettings?.value as {
      instance_name?: string;
      status?: string;
    } | null;

    let instanceName: string | null = null;

    if (whatsappConfig?.instance_name && whatsappConfig?.status === "connected") {
      instanceName = whatsappConfig.instance_name;
      console.log("Using dedicated support WhatsApp instance:", instanceName);
    } else {
      // Fallback to account's WhatsApp integration
      const { data: integration } = await supabase
        .from("whatsapp_integrations")
        .select("instance_name, provider")
        .eq("account_id", accountId)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      if (integration) {
        instanceName = integration.instance_name;
        console.log("Using account WhatsApp instance:", instanceName);
      }
    }

    if (!instanceName) {
      console.log("No WhatsApp integration found");
      return false;
    }

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");

    if (!UAZAPI_URL || !UAZAPI_ADMIN_TOKEN) {
      console.error("UAZAPI credentials not configured");
      return false;
    }

    // Format phone for WhatsApp (remove + if present)
    const formattedPhone = phone.replace(/^\+/, "");

    const sendResponse = await fetch(`${UAZAPI_URL}/message/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UAZAPI_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        instance: instanceName,
        phone: formattedPhone,
        message: message,
      }),
    });

    if (!sendResponse.ok) {
      console.error("Failed to send WhatsApp message:", await sendResponse.text());
      return false;
    }

    console.log("WhatsApp message sent successfully");
    return true;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: SupportWebhookPayload = await req.json();
    console.log("Support webhook payload:", JSON.stringify(payload));

    const { phone, name, content, message_type = "text", external_message_id, account_id, media_url } = payload;

    if (!phone || !content) {
      return new Response(
        JSON.stringify({ error: "phone and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;

    // Find account_id from phone if not provided
    let ticketAccountId = account_id;
    
    if (!ticketAccountId) {
      const { data: client } = await supabase
        .from("clients")
        .select("account_id, full_name")
        .eq("phone_e164", normalizedPhone)
        .maybeSingle();

      if (client) {
        ticketAccountId = client.account_id;
      }
    }

    if (!ticketAccountId) {
      console.log("Could not determine account_id for support ticket");
      return new Response(
        JSON.stringify({ error: "Could not determine account for this phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create ticket for this phone
    const { data: existingTicket } = await supabase
      .from("support_tickets")
      .select("id, status")
      .eq("account_id", ticketAccountId)
      .eq("client_phone", normalizedPhone)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticketId: string;
    let isNewTicket = false;

    if (existingTicket) {
      ticketId = existingTicket.id;
      console.log(`Found existing ticket: ${ticketId}`);

      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId);
    } else {
      isNewTicket = true;
      const { data: newTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          account_id: ticketAccountId,
          client_phone: normalizedPhone,
          client_name: name || null,
          status: "open",
          priority: "normal",
          subject: content.substring(0, 100),
        })
        .select("id")
        .single();

      if (ticketError) {
        console.error("Error creating ticket:", ticketError);
        return new Response(
          JSON.stringify({ error: ticketError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      ticketId = newTicket.id;
      console.log(`Created new ticket: ${ticketId}`);
    }

    // Build message content with media if present
    let fullContent = content;
    if (media_url) {
      fullContent = `${content}\n\n[Mídia anexada: ${media_url}]`;
    }

    // Insert client message
    const { error: messageError } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "client",
        content: fullContent,
        message_type,
        external_message_id,
      });

    if (messageError) {
      console.error("Error inserting message:", messageError);
      return new Response(
        JSON.stringify({ error: messageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Client message saved successfully");

    // Get conversation history, knowledge base, and generate AI response
    const conversationHistory = await getConversationHistory(supabase, ticketId);
    const lastUserMessage = content || "";
    const knowledgeContext = await getKnowledgeBase(supabase, lastUserMessage);
    const aiResult = await generateAIResponse(conversationHistory, knowledgeContext);

    // Save AI response to database
    await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "agent",
        content: aiResult.response,
        message_type: "text",
      });

    console.log("AI response saved:", aiResult.response.substring(0, 100));

    // Handle escalation if needed
    if (aiResult.shouldEscalate) {
      await supabase
        .from("support_tickets")
        .update({ 
          needs_human_attention: true,
          escalated_at: new Date().toISOString(),
          escalation_reason: aiResult.escalationReason
        })
        .eq("id", ticketId);
      console.log("Ticket escalated for human attention");
    }

    // Send AI response via WhatsApp using support number
    const messageSent = await sendWhatsAppResponse(supabase, ticketAccountId, normalizedPhone, aiResult.response);

    // Update ticket status to in_progress if it was open
    if (isNewTicket) {
      await supabase
        .from("support_tickets")
        .update({ 
          status: "in_progress",
          first_response_at: new Date().toISOString()
        })
        .eq("id", ticketId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_id: ticketId,
        ai_response: aiResult.response,
        escalated: aiResult.shouldEscalate,
        message_sent: messageSent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Support webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
