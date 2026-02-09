

# Registrar reunião Zoom no Google Calendar automaticamente

## Problema
Quando um usuário agenda uma reunião via Zoom, ela é criada corretamente no Zoom, mas não aparece no Google Agenda dele. Isso acontece porque o fluxo atual só chama `createZoomMeeting` (API do Zoom) sem criar um evento correspondente no Google Calendar.

Quando a plataforma é "google", o evento já é criado via Google Calendar API (e o Meet link vem de lá), então aparece automaticamente na agenda.

## Solução

Após criar a reunião no Zoom com sucesso, criar também um evento no Google Calendar do usuário contendo:
- Título da reunião
- Data/hora de início e fim
- Link do Zoom como local e na descrição do evento
- Email do participante como convidado (se fornecido)

Se o usuário não tiver o Google conectado, o fluxo continua normalmente sem erro.

## Detalhes Técnicos

**Arquivo modificado:** `supabase/functions/create-meeting/index.ts`

### O que muda

No bloco onde `platform === "zoom"`, após a criação bem-sucedida da reunião no Zoom, será adicionada uma nova etapa:

1. Buscar o token Google OAuth do usuário na tabela `user_integrations` (mesma lógica que `createGoogleMeetMeeting` já usa)
2. Se necessário, fazer refresh do token (reutilizando `refreshGoogleToken` que já existe)
3. Se o usuário tiver Google conectado, criar evento no Calendar com:
   - `summary`: título da reunião
   - `start/end`: horários da reunião
   - `location`: link do Zoom
   - `description`: "Reunião via Zoom" com o link
   - `attendees`: email do participante (se fornecido)
4. Se o usuário NÃO tiver Google conectado, apenas logar um aviso e continuar normalmente

### Fluxo atualizado

```text
Zoom selecionado:
  1. Cria reunião no Zoom (API Zoom) --> obtém link
  2. Tenta criar evento no Google Calendar com o link do Zoom
     - Google conectado: cria evento na agenda
     - Google não conectado: loga aviso, segue normalmente
  3. Atualiza task, registra histórico, envia email (fluxo existente)
```

Nenhuma tabela, migração ou configuração nova será necessária. Apenas uma alteração na Edge Function existente.

