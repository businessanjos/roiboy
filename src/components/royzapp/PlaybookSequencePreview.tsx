import { useMemo } from "react";
import { applyWhatsAppFormatting } from "@/lib/whatsappFormatting";
import {
  AudioLines, FileText, Image as ImageIcon, LayoutTemplate, Link2,
  ListChecks, Smile, Timer, Video, ChevronLeft, Phone, CheckCheck, Zap, Paperclip, Mic,
  Signal, Wifi, BatteryFull, Camera,
} from "lucide-react";
import type { PlaybookItem } from "@/hooks/usePlaybook";
import type { SequenceStep } from "@/hooks/usePlaybookSequences";

interface Props {
  steps: SequenceStep[];
  items: PlaybookItem[];
  variables?: Record<string, string>;
  replaceVariables?: (text: string, vars: Record<string, string>) => string;
  signText?: (text: string) => string;
}

function MediaBlock({ item }: { item: PlaybookItem }) {
  switch (item.content_type) {
    case "image":
      return item.media_url ? (
        <img src={item.media_url} alt={item.name} className="max-h-36 w-full rounded-md object-cover" loading="lazy" />
      ) : (
        <div className="flex items-center gap-2 text-xs opacity-70"><ImageIcon className="h-4 w-4" /> Imagem</div>
      );
    case "audio":
      return (
        <div className="flex items-center gap-2 text-xs">
          <AudioLines className="h-4 w-4 shrink-0" />
          <span>Áudio{item.media_duration ? ` · ${item.media_duration}s` : ""}</span>
        </div>
      );
    case "video":
      return (
        <div className="flex items-center gap-2 text-xs">
          <Video className="h-4 w-4 shrink-0" />
          <span>Vídeo{item.media_filename ? ` · ${item.media_filename}` : ""}</span>
        </div>
      );
    case "document":
      return (
        <div className="flex items-center gap-2 text-xs">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.media_filename || "Documento"}</span>
        </div>
      );
    case "sticker":
      return <div className="flex items-center gap-2 text-xs opacity-70"><Smile className="h-4 w-4" /> Figurinha</div>;
    case "list":
      return (
        <div className="flex items-center gap-2 text-xs opacity-70">
          <ListChecks className="h-4 w-4" /> Lista{item.list_items?.length ? ` · ${item.list_items.length} opções` : ""}
        </div>
      );
    case "link":
      return (
        <div className="flex items-center gap-2 text-xs">
          <Link2 className="h-4 w-4 shrink-0" />
          <span className="truncate underline">{item.link_title || item.link_url || "Link"}</span>
        </div>
      );
    case "template":
      return <div className="flex items-center gap-2 text-xs opacity-70"><LayoutTemplate className="h-4 w-4" /> Template</div>;
    default:
      return null;
  }
}

export function PlaybookSequencePreview({ steps, items, variables = {}, replaceVariables, signText }: Props) {
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const resolved = steps
    .map((st, i) => ({ step: st, item: itemById.get(st.playbook_item_id), index: i }))
    .filter((r) => r.item) as { step: SequenceStep; item: PlaybookItem; index: number }[];

  const applyVars = (text: string | null) => {
    if (!text) return null;
    const processed = replaceVariables ? replaceVariables(text, variables) : text;
    return signText ? signText(processed) : processed;
  };

  const wa = (v: string) => `hsl(var(--wa-${v}))`;
  const contactName = variables.nome || variables.name || "Contato";

  return (
    <div
      className="mx-auto w-full max-w-[270px] rounded-[2.75rem] bg-neutral-900 p-[9px] shadow-2xl ring-1 ring-neutral-700"
      data-testid="sequence-preview"
      aria-label="Prévia no WhatsApp"
    >
      <div
        className="relative flex aspect-[9/18.5] min-h-0 flex-col overflow-hidden rounded-[2.1rem]"
        style={{
          background: wa("wallpaper"),
          backgroundImage: `radial-gradient(hsl(var(--wa-meta) / 0.10) 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
        }}
      >
        {/* Ilha dinâmica (câmera) */}
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-[18px] w-[74px] -translate-x-1/2 rounded-full bg-neutral-900" aria-hidden />

        {/* Barra de status + cabeçalho do WhatsApp (um bloco só, como no app) */}
        <div className="relative z-10 shrink-0" style={{ background: wa("header"), color: wa("header-foreground") }}>
          <div className="flex items-center justify-between px-5 pb-0.5 pt-2 text-[10px] font-semibold">
            <span>9:41</span>
            <span className="w-[74px]" aria-hidden />
            <span className="flex items-center gap-1">
              <Signal className="h-3 w-3" />
              <Wifi className="h-3 w-3" />
              <BatteryFull className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 pb-2 pt-0.5">
            <ChevronLeft className="h-5 w-5 shrink-0" />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-semibold">
              {contactName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">{contactName}</p>
              <p className="text-[10px] opacity-80">online</p>
            </div>
            <Video className="h-4 w-4 shrink-0" />
            <Phone className="h-4 w-4 shrink-0" />
          </div>
        </div>

        {/* Conversa */}
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto phone-preview-scroll px-2 py-2.5">
          <div className="mb-1 flex justify-center">
            <span className="rounded-md px-2 py-0.5 text-[10px] shadow-sm" style={{ background: wa("chip"), color: wa("meta") }}>HOJE</span>
          </div>
          {resolved.length === 0 ? (
            <p className="mx-3 mt-8 rounded-md px-3 py-2 text-center text-[11px] shadow-sm" style={{ background: wa("chip"), color: wa("meta") }}>
              Selecione mensagens ao lado para ver como elas vão chegar no celular do cliente.
            </p>
          ) : (
            resolved.map(({ item, step, index }, pos) => {
              const text = applyVars(item.text_content) || applyVars(item.template_body);
              const caption = applyVars(item.media_caption);
              const isMedia = item.content_type !== "text";
              return (
                <div key={`${item.id}-${pos}`}>
                  <div className="my-1.5 flex justify-center">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] shadow-sm" style={{ background: wa("chip"), color: wa("meta") }}>
                      {pos === 0 ? <><Zap className="h-3 w-3" /> instantâneo ao clicar</> : <><Timer className="h-3 w-3" /> aguarda {step.delay_seconds}s</>}
                    </span>
                  </div>
                  <div
                    className="relative ml-auto w-fit min-w-[110px] max-w-[85%] rounded-lg rounded-tr-none px-2 pb-1 pt-1.5 text-[13px] shadow-sm"
                    style={{ background: wa("bubble-out"), color: wa("bubble-out-foreground") }}
                  >
                    <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ color: wa("meta") }}>
                      {index + 1} · {item.name}
                    </p>
                    {isMedia && <div className="mb-1"><MediaBlock item={item} /></div>}
                    {text && <p className="whitespace-pre-wrap break-words leading-snug">{applyWhatsAppFormatting(text, `t-${pos}`)}</p>}
                    {isMedia && caption && <p className="whitespace-pre-wrap break-words leading-snug">{applyWhatsAppFormatting(caption, `c-${pos}`)}</p>}
                    <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px]" style={{ color: wa("meta") }}>
                      <span>9:41</span>
                      <CheckCheck className="h-3 w-3" style={{ color: wa("tick") }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Barra de digitação + indicador de início */}
        <div className="shrink-0 px-2 pb-1 pt-1.5" style={{ background: wa("bar") }}>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <Smile className="h-4 w-4" /> <span className="flex-1">Mensagem</span> <Paperclip className="h-4 w-4" /> <Camera className="h-4 w-4" />
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: wa("header"), color: wa("header-foreground") }}>
              <Mic className="h-4 w-4" />
            </div>
          </div>
          <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-foreground/30" aria-hidden />
        </div>
      </div>
    </div>
  );
}
