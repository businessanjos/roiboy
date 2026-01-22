import { useState } from "react";
import { GripVertical, Trash2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useInsightsPanels } from "@/hooks/useInsightsPanels";
import { DynamicWidget } from "./DynamicWidget";
import { WidgetConfig, METRIC_OPTIONS, GROUP_BY_OPTIONS } from "./types";

interface WidgetCardProps {
  widget: WidgetConfig;
}

export function WidgetCard({ widget }: WidgetCardProps) {
  const { removeWidget } = useInsightsPanels();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const metricInfo = METRIC_OPTIONS.find((m) => m.value === widget.metric);
  const groupByInfo = GROUP_BY_OPTIONS.find((g) => g.value === widget.groupBy);

  const handleDelete = async () => {
    await removeWidget(widget.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Card
        className="h-full flex flex-col overflow-hidden"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 space-y-0">
          <div className="widget-drag-handle cursor-move flex items-center gap-2 flex-1 min-w-0">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-sm font-medium truncate">
              {widget.title}
            </CardTitle>
          </div>

          <div
            className={`flex items-center gap-1 transition-opacity ${
              showActions ? "opacity-100" : "opacity-0"
            }`}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">{metricInfo?.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {metricInfo?.description}
                  </p>
                  <p className="text-xs mt-1">
                    Agrupado: {groupByInfo?.label}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-4 pt-0">
          <DynamicWidget config={widget} />
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visual?</AlertDialogTitle>
            <AlertDialogDescription>
              O visual "{widget.title}" será removido permanentemente deste
              painel. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
