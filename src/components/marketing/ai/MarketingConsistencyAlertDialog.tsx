import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { MarketingConsistencyReport } from "@/lib/marketingConsistency";

interface MarketingConsistencyAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  report: MarketingConsistencyReport;
  confirmLabel: string;
  onConfirm: () => void;
}

const severityLabel = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
} as const;

export function MarketingConsistencyAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  report,
  confirmLabel,
  onConfirm,
}: MarketingConsistencyAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description} Encontramos {report.blockingIssues.length} ponto(s) para revisar antes de seguir.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {report.blockingIssues.map((issue) => (
            <div key={issue.id} className="rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{issue.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
                </div>
                <Badge variant="outline">Prioridade {severityLabel[issue.severity]}</Badge>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <p className="font-medium text-foreground">Evidências</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {issue.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground">Sugestões de correção</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {issue.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Revisar agora</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}