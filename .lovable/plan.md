

## Campos personalizaveis no formulario de confirmacao de presenca (RSVP)

### Contexto atual

O formulario de inscricao publica (`/inscricao/:code`) possui 4 campos fixos: **Nome**, **Telefone**, **E-mail** e **RG**. Todos sao obrigatorios e nao podem ser alterados por evento. Cada evento pode precisar de informacoes diferentes, entao e necessario permitir que o administrador configure quais campos solicitar.

### Solucao proposta

Criar um sistema de configuracao de campos do formulario RSVP por evento, permitindo ativar/desativar campos padrao e adicionar campos customizados.

---

### 1. Migracao no banco de dados

Adicionar uma coluna `rsvp_form_fields` (JSONB) na tabela `events` para armazenar a configuracao dos campos do formulario de cada evento.

```sql
ALTER TABLE public.events 
ADD COLUMN rsvp_form_fields jsonb DEFAULT null;
```

Estrutura do JSON:

```text
[
  { "key": "name",    "label": "Nome completo",   "type": "text",  "required": true,  "enabled": true  },
  { "key": "phone",   "label": "Telefone",        "type": "tel",   "required": true,  "enabled": true  },
  { "key": "email",   "label": "E-mail",          "type": "email", "required": true,  "enabled": true  },
  { "key": "rg",      "label": "RG",              "type": "text",  "required": true,  "enabled": true  },
  { "key": "custom1", "label": "Empresa",         "type": "text",  "required": false, "enabled": true  }
]
```

Quando `rsvp_form_fields` for `null`, o formulario usara os 4 campos padrao atuais (retrocompatibilidade total).

---

### 2. Novo componente: RsvpFieldsEditor

**Arquivo: `src/components/events/RsvpFieldsEditor.tsx`**

Um dialog/sheet acessivel a partir da aba "Visao Geral" do evento (ao lado do bloco de RSVP) com:

- Lista dos 4 campos padrao (Nome, Telefone, E-mail, RG) com toggle de ativado/desativado e toggle de obrigatorio/opcional
- "Nome" e "Telefone" sempre ativados e obrigatorios (necessarios para identificar o cliente no sistema)
- Botao "Adicionar campo" para criar campos customizados com label e tipo (texto, numero, select/lista)
- Arrastar para reordenar campos
- Botao Salvar que persiste o JSON na coluna `rsvp_form_fields` do evento

---

### 3. Integrar editor na aba Visao Geral do evento

**Arquivo: `src/components/events/EventOverviewTab.tsx`**

Adicionar um botao "Editar campos do formulario" dentro do card de RSVP (ao lado do link), que abre o `RsvpFieldsEditor`.

---

### 4. Expor campos na RPC `get_event_by_registration_code`

A funcao RPC sera recriada para incluir `rsvp_form_fields` no retorno, assim o formulario publico sabe quais campos renderizar.

---

### 5. Atualizar formulario publico de inscricao

**Arquivo: `src/pages/PublicEventRegistration.tsx`**

- Ao receber os dados do evento, verificar se `rsvp_form_fields` existe
- Se existir, renderizar dinamicamente apenas os campos configurados
- Se nao existir (null), renderizar os 4 campos padrao atuais (retrocompatibilidade)
- Campos customizados serao enviados como JSON na RPC `register_for_event` em um parametro adicional `p_custom_fields`

---

### 6. Atualizar RPC `register_for_event`

Adicionar parametro opcional `p_custom_fields jsonb DEFAULT '{}'` para receber campos extras. Os dados customizados serao armazenados no campo `metadata` (ou nova coluna `custom_data`) da tabela `event_participants`.

---

### 7. Adicionar coluna para dados customizados nos participantes

```sql
ALTER TABLE public.event_participants
ADD COLUMN custom_data jsonb DEFAULT null;
```

Isso permite armazenar as respostas dos campos customizados junto ao registro do participante.

---

### Resumo dos arquivos afetados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Adicionar `rsvp_form_fields` em `events` e `custom_data` em `event_participants` |
| `src/components/events/RsvpFieldsEditor.tsx` | Novo componente para editar campos |
| `src/components/events/EventOverviewTab.tsx` | Botao para abrir o editor de campos |
| `src/pages/PublicEventRegistration.tsx` | Renderizar campos dinamicamente |
| RPC `get_event_by_registration_code` | Retornar `rsvp_form_fields` |
| RPC `register_for_event` | Aceitar e salvar `p_custom_fields` |

### Retrocompatibilidade

Eventos existentes sem `rsvp_form_fields` continuarao funcionando exatamente como antes com os 4 campos fixos. Nenhum dado existente sera perdido.
