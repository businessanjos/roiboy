import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, PencilLine, ThumbsDown, ThumbsUp } from "lucide-react";

export interface AiSuggestionReviewField {
  key: string;
  label: string;
  multiline?: boolean;
  rows?: number;
}

interface AiSuggestionReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: AiSuggestionReviewField[];
  initialValue: Record<string, string>;
  acceptLabel?: string;
  editLabel?: string;
  rejectLabel?: string;
  notesLabel?: string;
  onAcceptOriginal: (notes: string) => Promise<void> | void;
  onSaveEdits: (value: Record<string, string>, notes: string) => Promise<void> | void;
  onReject: (value: Record<string, string>, notes: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function AiSuggestionReviewDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialValue,
  acceptLabel = "Aceitar original",
  editLabel = "Salvar edição",
  rejectLabel = "Descartar sugestão",
  notesLabel = "Observações para a IA",
  onAcceptOriginal,
  onSaveEdits,
  onReject,
  isSubmitting,
}: AiSuggestionReviewDialogProps) {
  const normalizedInitialValue = useMemo(() => {
    const next: Record<string, string> = {};
    fields.forEach((field) => {
      next[field.key] = initialValue[field.key] ?? "";
    });
    return next;
  }, [fields, initialValue]);

  const [draft, setDraft] = useState<Record<string, string>>(normalizedInitialValue);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(normalizedInitialValue);
    setNotes("");
  }, [normalizedInitialValue, open]);

  const hasEdits = fields.some((field) => (draft[field.key] ?? "") !== (normalizedInitialValue[field.key] ?? ""));

  const submit = async (action: "accept" | "edit" | "reject") => {
    if (action === "accept") {
      await onAcceptOriginal(notes);
      return;
    }
    if (action === "edit") {
      await onSaveEdits(draft, notes);
      return;
    }
    await onReject(draft, notes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                {field.multiline ? (
                  <Textarea
                    value={draft[field.key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                    rows={field.rows ?? 4}
                  />
                ) : (
                  <Input
                    value={draft[field.key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                )}
              </div>
            ))}

            <div className="space-y-2">
              <Label>{notesLabel}</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Ex.: encurtar, deixar mais direto, focar em prova social..."
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="destructive" onClick={() => submit("reject")} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsDown className="h-4 w-4 mr-2" />}
            {rejectLabel}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => submit("accept")} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
              {acceptLabel}
            </Button>
            <Button type="button" onClick={() => submit("edit")} disabled={isSubmitting || !hasEdits}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PencilLine className="h-4 w-4 mr-2" />}
              {editLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}