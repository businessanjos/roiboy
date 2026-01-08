import type { ConversationAssignment } from '@/components/royzapp/types';

interface PlaybookVariableContext {
  conversation?: ConversationAssignment | null;
  currentUser?: { name: string; email?: string } | null;
  deal?: { name?: string; value?: number; stage?: string } | null;
}

export function extractPlaybookVariables(context: PlaybookVariableContext): Record<string, string> {
  const { conversation, currentUser, deal } = context;
  
  // Extrair dados do cliente/lead
  const zapp = conversation?.zapp_conversation;
  const client = zapp?.client;
  const lead = zapp?.lead;
  const oldClient = conversation?.conversation?.client;
  
  // Nome completo (com fallback hierárquico)
  const nomeCompleto = client?.full_name || lead?.full_name || zapp?.contact_name || oldClient?.full_name || '';
  
  // Primeiro nome (extrai apenas a primeira palavra, fallback para "Olá")
  const primeiroNome = nomeCompleto.split(' ')[0] || 'Olá';
  
  // Telefone
  const telefone = zapp?.phone_e164 || client?.phone_e164 || oldClient?.phone_e164 || '';
  
  // Email
  const email = lead?.email || '';
  
  // Empresa (se disponível no cliente antigo)
  const empresa = (oldClient as Record<string, unknown>)?.company_name as string || '';
  
  // Vendedor/Atendente
  const nomeVendedor = currentUser?.name?.split(' ')[0] || '';
  const nomeAtendenteCompleto = currentUser?.name || '';
  const emailAtendente = currentUser?.email || '';
  
  // Deal (se disponível)
  const nomeDeal = deal?.name || '';
  const valorDeal = deal?.value 
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value) 
    : '';
  const etapaDeal = deal?.stage || '';

  // Datas automáticas
  const now = new Date();
  const dataHoje = now.toLocaleDateString('pt-BR');
  const horaAtual = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const diaSemana = diasSemana[now.getDay()];

  return {
    // Cliente/Lead
    nome_cliente: nomeCompleto,
    primeiro_nome: primeiroNome,
    email_cliente: email,
    telefone_cliente: telefone,
    empresa_cliente: empresa,
    
    // Negócio
    nome_deal: nomeDeal,
    valor_deal: valorDeal,
    etapa_deal: etapaDeal,
    
    // Atendente/Vendedor
    nome_vendedor: nomeVendedor,
    nome_atendente: nomeAtendenteCompleto,
    email_atendente: emailAtendente,
    
    // Datas
    data_hoje: dataHoje,
    hora_atual: horaAtual,
    dia_semana: diaSemana,
  };
}
