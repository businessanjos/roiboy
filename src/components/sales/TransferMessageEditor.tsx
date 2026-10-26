import { useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaybookSequencePreview } from "@/components/royzapp/PlaybookSequencePreview";
import type { PlaybookItem } from "@/hooks/usePlaybook";
import { DEFAULT_TRANSFER_TEMPLATES, TRANSFER_MESSAGE_VARIABLES, renderTransferMessage, validateTransferTemplate, type TransferMessageChannel } from "@/lib/transferMessageTemplate";

interface Props {
  templates: Record<TransferMessageChannel, string>;
  onChange: (channel: TransferMessageChannel, text: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
}

export function TransferMessageEditor({ templates, onChange, onSave, saving, dirty }: Props) {
  const [channel, setChannel] = useState<TransferMessageChannel>("private");
  const [example, setExample] = useState("negocio");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const text = templates[channel];
  const error = validateTransferTemplate(text);
  const isDeal = example === "negocio";
  const previewText = renderTransferMessage(channel, text, {
    tipo: isDeal ? "negócio" : "lead", vendedor: "Ana", lead: "Cliente Exemplo",
    negocio: isDeal ? "[EXEMPLO] Cliente Exemplo" : undefined,
    funil: isDeal ? "Closer" : undefined, etapa: isDeal ? "Em Qualificação" : undefined,
    valor: isDeal ? "R$ 10.000,00" : undefined, origem: "Tráfego pago",
    transferido_por: "Lucas", link: `https://iamroy.app/${isDeal ? "sales/pipeline?deal" : "leads?lead"}=exemplo`,
  });
  const item: PlaybookItem = {
    id: "transfer-preview", account_id: "", folder_id: null, name: "Aviso de transferência", content_type: "text",
    text_content: previewText, media_url: null, media_filename: null, media_size: null, media_duration: null,
    media_caption: null, list_items: null, link_url: null, link_title: null, link_description: null,
    template_header: null, template_body: null, template_footer: null, template_buttons: null,
    position: 0, is_favorite: false, usage_count: 0, last_used_at: null, visibility: "sector",
    created_by: null, created_at: "", updated_at: "",
  };
  const insertVariable = (key: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    const variable = `{{${key}}}`;
    onChange(channel, text.slice(0, start) + variable + text.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + variable.length, start + variable.length); });
  };

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_270px]">
      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-channel">Texto enviado para</Label>
          <Select value={channel} onValueChange={(value) => setChannel(value as TransferMessageChannel)}>
            <SelectTrigger id="transfer-channel"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="private">WhatsApp do vendedor</SelectItem><SelectItem value="group">Grupo do time</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer-message">Mensagem</Label>
          <Textarea ref={inputRef} id="transfer-message" value={text} onChange={(e) => onChange(channel, e.target.value)} rows={12} maxLength={4000} className="resize-y font-mono text-xs" aria-invalid={!!error} />
          <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>*negrito* · _itálico_ · ~riscado~</span><span>{text.length}/4.000</span></div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="space-y-2">
          <Label>Dados automáticos</Label>
          <div className="flex flex-wrap gap-1">
            {TRANSFER_MESSAGE_VARIABLES.map((key) => <Button key={key} type="button" variant="outline" size="sm" className="h-7 px-2 font-mono text-[11px]" onClick={() => insertVariable(key)}>{`{{${key}}}`}</Button>)}
          </div>
          <p className="text-xs text-muted-foreground">Os dados são preenchidos em cada transferência. Linhas com dados ausentes não são enviadas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !dirty || !!validateTransferTemplate(templates.private) || !!validateTransferTemplate(templates.group)}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar textos"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(channel, DEFAULT_TRANSFER_TEMPLATES[channel])}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button>
        </div>
        <p className="text-xs text-muted-foreground">Salvar altera os próximos avisos da equipe. A prévia usa dados fictícios e não envia mensagens.</p>
      </div>
      <div className="min-w-0 space-y-3">
        <div className="mx-auto max-w-[270px] space-y-2">
          <Label htmlFor="transfer-example">Prévia com exemplo de</Label>
          <Select value={example} onValueChange={setExample}>
            <SelectTrigger id="transfer-example"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="negocio">Negócio</SelectItem><SelectItem value="lead">Lead</SelectItem></SelectContent>
          </Select>
        </div>
        <PlaybookSequencePreview messageOnly items={[item]} steps={[{ playbook_item_id: item.id, delay_seconds: 0 }]} variables={{ nome: channel === "private" ? "Comercial ROY" : "Grupo do time" }} />
      </div>
    </div>
  );
}