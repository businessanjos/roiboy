import { useMemo } from "react";
import {
  AudioLines, FileText, Image as ImageIcon, LayoutTemplate, Link2,
  ListChecks, MessageSquareText, Smile, Timer, Video,
} from "lucide-react";
import type { PlaybookItem } from "@/hooks/usePlaybook";
import type { SequenceStep } from "@/hooks/usePlaybookSequences";

interface Props {
  steps: SequenceStep[];
  items: PlaybookItem[];
  variables?: Record<string, string>;
  replaceVariables?: (text: string, vars: Record<string, string>) => string;
}

function MediaBlock({ item }: { item: PlaybookItem }) {
  switch (item.content_type) {
    case "image":
      return item.media_url ? (
        <img src={item.media_url} alt={item.name} className="max-h-36 w-full rounded-md object-cover" loading="lazy" />
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><ImageIcon className="h-4 w-4" /> Imagem</div>
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
      return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Smile className="h-4 w-4" /> Figurinha</div>;
    case "list":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
      return <div className="flex items-center gap-2 text-xs text-muted-foreground"><LayoutTemplate className="h-4 w-4" /> Template</div>;
    default:
      return null;
  }
}

export function PlaybookSequencePreview({ steps, items, variables = {}, replaceVariables }: Props) {
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const resolved = steps
    .map((st, i) => ({ step: st, item: itemById.get(st.playbook_item_id), index: i }))
    .filter((r) => r.item) as { step: SequenceStep; item: PlaybookItem; index: number }[];

  const applyVars = (text: string | null) =>
    text ? (replaceVariables ? replaceVariables(text, variables) : text) : null;

  return (
    <div className="overflow-hidden rounded-lg border" data-testid="sequence-preview">
      <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium">Prévia no WhatsApp</p>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto bg-muted/40 p-3">
        {resolved.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Selecione mensagens ao lado para ver como elas vão sair na conversa.
          </p>
        ) : (
          resolved.map(({ step, item, index }, pos) => {
            const text = applyVars(item.text_content) || applyVars(item.template_body);
            const caption = applyVars(item.media_caption);
            const isMedia = item.content_type !== "text";
            return (
              <div key={`${item.id}-${pos}`}>
                {pos > 0 && (
                  <div className="my-2 flex justify-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                      <Timer className="h-3 w-3" /> aguarda {resolved[pos - 1].step.delay_seconds}s
                    </span>
                  </div>
                )}
                <div className="ml-auto w-fit max-w-[90%] rounded-lg rounded-tr-none border border-primary/20 bg-primary/10 px-3 py-2 text-sm shadow-sm">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {index + 1} · {item.name}
                  </p>
                  {isMedia && <div className="mb-1"><MediaBlock item={item} /></div>}
                  {text && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{text}</p>}
                  {isMedia && caption && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{caption}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
