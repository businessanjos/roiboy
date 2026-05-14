## Objetivo
Unificar a gestão de conexões WhatsApp dentro do painel de Configurações do RoyZapp (engrenagem do chat), substituindo a navegação para `/integrations/whatsapp`. O usuário cria/gerencia conexões via um **wizard em etapas** direto no painel lateral.

## O que muda

### 1. Novo componente: `ZappConnectionsSection`
Arquivo: `src/components/royzapp/settings/ZappConnectionsSection.tsx`

Renderiza, dentro do `ZappSettingsPanel`, uma seção "Conexões WhatsApp" com:
- Lista das instâncias do setor atual (reaproveitando `SectorInstanceCard` com tema escuro do zApp)
- Status de cada uma (conectada/desconectada, tipo: UAZAPI ou Meta Cloud)
- Botão "+ Nova conexão" que abre o wizard
- Filtro por setor (admins veem todos os setores num accordion compacto; usuários comuns veem só o seu)

### 2. Novo wizard: `ZappConnectionWizard`
Arquivo: `src/components/royzapp/settings/ZappConnectionWizard.tsx`

Dialog com 3 etapas usando `Stepper` visual:

```text
Etapa 1: Tipo         Etapa 2: Dados        Etapa 3: Conectar
┌──────────┐         ┌──────────────┐     ┌────────────────┐
│ UAZAPI   │   →     │ Nome instância│  →  │ QR Code (UAZAPI)│
│ (QR Code)│         │ Setor         │     │   ou           │
├──────────┤         │ ...           │     │ Webhook URL +   │
│ Meta API │         │               │     │ verificação Meta│
│ (Oficial)│         │               │     │                 │
└──────────┘         └──────────────┘     └────────────────┘
```

**Etapa 1 — Escolha do tipo**: dois cards grandes lado a lado:
- **UAZAPI (QR Code)**: rápido, ideal para números pessoais/operacionais
- **Meta Cloud API (Oficial)**: oficial, requer verificação Meta, sem ban risk

**Etapa 2 — Dados**: form que muda conforme o tipo:
- UAZAPI: reaproveita campos do `AddInstanceDialog` (nome, setor, PIN opcional)
- Meta: reaproveita campos do `AddMetaInstanceDialog` (Phone Number ID, Business Account ID, Access Token, App Secret, Verify Token)

**Etapa 3 — Conectar**:
- UAZAPI: chama `uazapi-manager` action `create_instance`, exibe QR code com polling de status
- Meta: salva integração, mostra Webhook URL e Verify Token pra colar no Meta Developer Console, com botão "Testar webhook"

Botões: `Voltar` / `Próximo` / `Concluir`. Cada etapa valida antes de avançar.

### 3. Integração no `ZappSettingsPanel`
- Adicionar nova seção "Conexões" no topo do painel (acima de "Conexão WhatsApp" atual)
- Manter o toggle de ligar/desligar conexão **ativa** do usuário separado, mas remover duplicação visual
- Adicionar link discreto "Configuração avançada por setor" que continua levando à página `/integrations/whatsapp` (preserva backup)

### 4. Reaproveitamento
- `AddInstanceDialog` e `AddMetaInstanceDialog` viram **componentes internos** do wizard (extrai-se a lógica de submit e os formulários ficam em `ZappConnectionWizard`).
- `SectorInstanceCard` ganha variante `theme="zapp"` (cores escuras `bg-zapp-panel`).

### 5. RBAC
- Não-admin: vê apenas conexões do próprio setor, não pode criar/excluir (botões ocultos), pode reconectar QR
- Admin: tudo liberado, pode trocar setor via filtro

## Detalhes técnicos
- Reusa edge function `uazapi-manager` (actions: `list_sector_instances`, `create_instance`, `unlink_instance`)
- Reusa `meta-whatsapp-manager` para Meta Cloud
- Estado do wizard via `useState` local; ao completar, faz `onRefresh()` e fecha
- Tema escuro: classes `bg-zapp-panel`, `border-zapp-border`, `text-zapp-text`, `text-zapp-accent`
- Sem mudanças de schema (DB intacto)

## Arquivos
**Novos:**
- `src/components/royzapp/settings/ZappConnectionsSection.tsx`
- `src/components/royzapp/settings/ZappConnectionWizard.tsx`
- `src/components/royzapp/settings/ZappConnectionTypeStep.tsx`
- `src/components/royzapp/settings/ZappConnectionDataStep.tsx`
- `src/components/royzapp/settings/ZappConnectionConnectStep.tsx`

**Editados:**
- `src/components/royzapp/ZappSettingsPanel.tsx` — adiciona nova seção
- `src/components/royzapp/index.ts` — exporta novo componente
- `src/components/integrations/whatsapp/SectorInstanceCard.tsx` — variante de tema (opcional, se UI escura precisar)

## Fora do escopo
- Mudanças no roteamento WhatsApp (`whatsappRouting.ts`) — não tocar
- Reescrita das edge functions
- Mudanças no schema do banco
- Remoção da página `/integrations/whatsapp` (mantida como backup admin)