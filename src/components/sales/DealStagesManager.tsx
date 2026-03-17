import { useState } from "react";
import { DealStage, Deal } from "@/hooks/useDeals";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, GripVertical, Pencil, Trash2, Loader2 } from "lucide-react";

interface DealStagesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: DealStage[];
  deals: Deal[];
  pipelineName?: string;
  onCreateStage: (data: { name: string; color: string; probability?: number }) => Promise<DealStage | null>;
  onUpdateStage: (stageId: string, data: { name?: string; color?: string; probability?: number }) => Promise<boolean>;
  onDeleteStage: (stageId: string) => Promise<boolean>;
  onReorderStages: (orderedStageIds: string[]) => Promise<boolean>;
}

const STAGE_COLORS = [
  '#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#ef4444', '#14b8a6', '#f97316', '#6366f1',
];

export function DealStagesManager({
  open,
  onOpenChange,
  stages,
  deals,
  onCreateStage,
  onUpdateStage,
  onDeleteStage,
  onReorderStages,
}: DealStagesManagerProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<DealStage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState(STAGE_COLORS[0]);
  const [stageProbability, setStageProbability] = useState(0);
  const [saving, setSaving] = useState(false);

  const openCreateDialog = () => {
    setSelectedStage(null);
    setStageName("");
    setStageColor(STAGE_COLORS[0]);
    setStageProbability(0);
    setEditDialogOpen(true);
  };

  const openEditDialog = (stage: DealStage) => {
    setSelectedStage(stage);
    setStageName(stage.name);
    setStageColor(stage.color);
    setStageProbability(stage.probability);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (stage: DealStage) => {
    setSelectedStage(stage);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!stageName.trim()) return;
    
    setSaving(true);
    try {
      if (selectedStage) {
        await onUpdateStage(selectedStage.id, {
          name: stageName,
          color: stageColor,
          probability: stageProbability,
        });
      } else {
        await onCreateStage({
          name: stageName,
          color: stageColor,
          probability: stageProbability,
        });
      }
      setEditDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedStage) {
      await onDeleteStage(selectedStage.id);
      setDeleteDialogOpen(false);
      setSelectedStage(null);
    }
  };

  const getDealsCount = (stageId: string) => {
    return deals.filter(d => d.stage_id === stageId && d.status === 'open').length;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Gerenciar Etapas</SheetTitle>
            <SheetDescription>
              Configure as etapas do seu pipeline de vendas
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Button onClick={openCreateDialog} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Nova Etapa
            </Button>

            <div className="space-y-2">
              {stages.map((stage, index) => {
                const dealsCount = getDealsCount(stage.id);
                return (
                  <Card key={stage.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{stage.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {dealsCount}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {stage.probability}% probabilidade
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(stage)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(stage)}
                            disabled={dealsCount > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {stages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma etapa configurada
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStage ? "Editar Etapa" : "Nova Etapa"}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes da etapa do pipeline
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Etapa</Label>
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Ex: Qualificação"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {STAGE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-all ${
                      stageColor === color 
                        ? "ring-2 ring-offset-2 ring-primary scale-110" 
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setStageColor(color)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Probabilidade de Fechamento (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={stageProbability}
                onChange={(e) => setStageProbability(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Usado para calcular o valor ponderado do pipeline
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !stageName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedStage ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etapa "{selectedStage?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
