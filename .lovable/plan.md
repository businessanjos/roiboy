

# Plano: Exibir Link da Reunião + Correção de Credenciais Zoom

## Diagnóstico do Erro

O usuário tentou criar uma reunião e recebeu o erro:

```
Error: Zoom credentials not configured. 
Please add ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID.
```

### Status das Credenciais

| Secret | Status |
|--------|--------|
| `ZOOM_CLIENT_ID` | ✅ Configurado |
| `ZOOM_CLIENT_SECRET` | ✅ Configurado |
| `ZOOM_ACCOUNT_ID` | ❌ **FALTANDO** |

**Solução**: Adicionar o secret `ZOOM_ACCOUNT_ID` nas configurações.

---

## Nova Funcionalidade: Campo do Link Gerado

Após a reunião ser criada, exibir um campo com o link da reunião para que o usuário possa copiar e compartilhar manualmente.

### Estado Atual
- A reunião é criada → dialog fecha → link aparece apenas como botão "Abrir"
- Não há como visualizar/copiar o link completo facilmente

### Proposta
Adicionar um campo de texto readonly com o link da reunião e botão de copiar:

```text
┌─────────────────────────────────────────────────────────────┐
│ 🟢 Google Meet configurado            [↻] [📋] [Abrir ↗]   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ https://meet.google.com/abc-defg-hij              [📋] │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Modificações Técnicas

### 1. Arquivo: `src/components/tasks/TaskDialog.tsx`

**Adicionar imports (~linha 28):**
```typescript
import { Loader2, Video, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
```

**Adicionar estado para copiar (~linha 100):**
```typescript
const [copied, setCopied] = useState(false);
```

**Adicionar função de copiar:**
```typescript
const copyMeetingUrl = async () => {
  if (meetingUrl) {
    await navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  }
};
```

**Modificar seção do meeting (~linha 592-616):**
```typescript
{meetingUrl ? (
  <div className="space-y-2">
    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
      <Video className="h-4 w-4 text-primary" />
      <span className="text-sm flex-1">
        {meetingPlatform === "zoom" ? "🔵 Zoom" : "🟢 Google Meet"} configurado
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMeetingDialogOpen(true)}
        title="Recriar reunião"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => window.open(meetingUrl, "_blank")}
      >
        <ExternalLink className="h-4 w-4 mr-1" />
        Abrir
      </Button>
    </div>
    
    {/* NOVO: Campo com link para copiar */}
    <div className="flex items-center gap-2">
      <Input
        value={meetingUrl}
        readOnly
        className="text-xs font-mono bg-muted/50"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={copyMeetingUrl}
        title="Copiar link"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  </div>
) : (
  // ... botão existente
)}
```

---

## Resultado Visual

### Antes
```text
┌───────────────────────────────────────────────┐
│ 🟢 Google Meet configurado    [↻]  [Abrir ↗] │
└───────────────────────────────────────────────┘
```

### Depois
```text
┌───────────────────────────────────────────────────────────┐
│ 🟢 Google Meet configurado           [↻]      [Abrir ↗]  │
│ ┌───────────────────────────────────────────────────┬───┐│
│ │ https://meet.google.com/abc-defg-hij              │📋││
│ └───────────────────────────────────────────────────┴───┘│
└───────────────────────────────────────────────────────────┘
```

---

## Ação Necessária para Zoom

Para que a integração com Zoom funcione, é necessário adicionar o secret:

**Secret a adicionar:**
- Nome: `ZOOM_ACCOUNT_ID`
- Valor: ID da conta Zoom (encontrado no painel de desenvolvedor Zoom: [marketplace.zoom.us](https://marketplace.zoom.us))

Após adicionar este secret, as reuniões Zoom serão criadas corretamente.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/tasks/TaskDialog.tsx` | Adicionar campo do link com botão copiar |

## Dependência

| Item | Status |
|------|--------|
| Secret `ZOOM_ACCOUNT_ID` | ⚠️ Precisa ser adicionado pelo usuário |

---

## Resultado Esperado

1. ✅ Campo visível mostrando o link completo da reunião
2. ✅ Botão para copiar link para área de transferência
3. ✅ Feedback visual ao copiar (ícone muda para check)
4. ✅ Toast confirmando que o link foi copiado
5. ⚠️ Zoom funcionará após adicionar `ZOOM_ACCOUNT_ID`

