import { ImageOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TASK_LABEL_COLORS, labelColor } from "@/lib/marketing/taskDetails";
import { attachmentKey, readTaskCover, type TaskCover } from "@/lib/marketing/taskPresentation";
import { useMarketingTaskAttachment } from "@/hooks/useMarketingTaskAttachments";
import type { MarketingTask, MediaAttachment } from "@/hooks/useMarketingTasks";

function CoverImage({ attachment, className }: { attachment: MediaAttachment; className?: string }) {
  const { data: url, isLoading, error } = useMarketingTaskAttachment(attachment);
  return <div className={cn("flex items-center justify-center overflow-hidden bg-muted", className)}>
    {isLoading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin text-muted-foreground" /> : error || !url ? <ImageOff className="h-5 w-5 text-muted-foreground" />
      : <img src={url} alt={`Capa: ${attachment.name}`} draggable={false} className="h-full w-full object-cover" />}
  </div>;
}
export function TaskCardCover({ task, compact = false }: { task: MarketingTask; compact?: boolean }) {
  const cover = readTaskCover(task);
  if (!cover) return null;
  if (cover.kind === "color") return <div aria-label={`Capa ${labelColor(cover.color).name}`} className={cn(labelColor(cover.color).swatch, compact ? "h-8 w-10 shrink-0 rounded" : "mb-3 h-2 rounded-sm")} />;
  const attachment = task.media_attachments?.find((a) => attachmentKey(a) === cover.attachment);
  return attachment ? <CoverImage attachment={attachment} className={compact ? "h-8 w-10 shrink-0 rounded" : "mb-3 h-28 w-full rounded-md"} /> : null;
}
export function TaskCoverEditor({ value, onChange, attachments, disabled }: {
  value: TaskCover; onChange: (cover: TaskCover) => void; attachments: MediaAttachment[]; disabled?: boolean;
}) {
  return <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label>Capa</Label>
      {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}><X className="h-4 w-4" />Remover capa</Button>}
    </div>
    <div className="flex flex-wrap gap-2">
      {TASK_LABEL_COLORS.map((color) => <Button key={color.value} type="button" variant="outline" size="icon" aria-label={`Capa ${color.name}`} title={`Capa ${color.name}`}
        aria-pressed={value?.kind === "color" && value.color === color.value} disabled={disabled}
        className={cn("h-10 w-10 p-1.5", value?.kind === "color" && value.color === color.value && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
        onClick={() => onChange({ kind: "color", color: color.value })}><span className={cn("h-full w-full rounded-sm", color.swatch)} /></Button>)}
    </div>
    {attachments.some((a) => a.type === "image") && <div className="flex flex-wrap gap-2">
      {attachments.filter((a) => a.type === "image").map((attachment) => <Button key={attachmentKey(attachment)} type="button" variant="outline"
        aria-label={`Usar ${attachment.name} como capa`} title={`Usar ${attachment.name} como capa`} disabled={disabled}
        aria-pressed={value?.kind === "image" && value.attachment === attachmentKey(attachment)}
        className={cn("h-16 w-24 overflow-hidden p-0", value?.kind === "image" && value.attachment === attachmentKey(attachment) && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
        onClick={() => onChange({ kind: "image", attachment: attachmentKey(attachment) })}><CoverImage attachment={attachment} className="h-full w-full" /></Button>)}
    </div>}
  </div>;
}