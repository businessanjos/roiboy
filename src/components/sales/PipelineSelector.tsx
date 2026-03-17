import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pipeline } from "@/hooks/usePipelines";
import { Plus, ChevronDown, Pencil, Trash2, GitBranch } from "lucide-react";

interface PipelineSelectorProps {
  pipelines: Pipeline[];
  activePipelineId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description?: string, color?: string) => Promise<Pipeline | null>;
  onUpdate: (id: string, updates: { name?: string; description?: string; color?: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const PIPELINE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316',
];

export function PipelineSelector({
  pipelines,
  activePipelineId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
}: PipelineSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PIPELINE_COLORS[0]);

  const activePipeline = pipelines.find(p => p.id === activePipelineId);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const result = await onCreate(name.trim(), description.trim() || undefined, color);
    if (result) {
      onSelect(result.id);
      setIsCreateOpen(false);
      resetForm();
    }
  };

  const handleEdit = async () => {
    if (!editingPipeline || !name.trim()) return;
    const success = await onUpdate(editingPipeline.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });
    if (success) {
      setIsEditOpen(false);
      resetForm();
    }
  };

  const openEdit = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    setName(pipeline.name);
    setDescription(pipeline.description || "");
    setColor(pipeline.color);
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor(PIPELINE_COLORS[0]);
    setEditingPipeline(null);
  };

  // If only 1 pipeline, show a simpler UI
  if (pipelines.length <= 1 && activePipeline) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: activePipeline.color }}
          />
          <span className="font-semibold text-sm">{activePipeline.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Novo funil
        </Button>

        <PipelineFormDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          title="Criar novo funil"
          description="Crie um funil separado para organizar diferentes tipos de negociação."
          name={name}
          setName={setName}
          description_={description}
          setDescription={setDescription}
          color={color}
          setColor={setColor}
          onSave={handleCreate}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: activePipeline?.color || '#3b82f6' }}
            />
            <span className="max-w-[160px] truncate font-medium">
              {activePipeline?.name || 'Selecionar funil'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          {pipelines.map((pipeline) => (
            <DropdownMenuItem
              key={pipeline.id}
              className="flex items-center justify-between gap-2 group"
              onClick={() => onSelect(pipeline.id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: pipeline.color }}
                />
                <span className={`truncate text-sm ${pipeline.id === activePipelineId ? 'font-semibold' : ''}`}>
                  {pipeline.name}
                </span>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1 hover:bg-accent rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(pipeline);
                  }}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                {pipelines.length > 1 && (
                  <button
                    className="p-1 hover:bg-accent rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(pipeline.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar novo funil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PipelineFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Criar novo funil"
        description="Crie um funil separado para organizar diferentes tipos de negociação."
        name={name}
        setName={setName}
        description_={description}
        setDescription={setDescription}
        color={color}
        setColor={setColor}
        onSave={handleCreate}
      />

      <PipelineFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Editar funil"
        description="Altere o nome, descrição ou cor do funil."
        name={name}
        setName={setName}
        description_={description}
        setDescription={setDescription}
        color={color}
        setColor={setColor}
        onSave={handleEdit}
        saveLabel="Salvar"
      />
    </div>
  );
}

function PipelineFormDialog({
  open,
  onOpenChange,
  title,
  description,
  name,
  setName,
  description_,
  setDescription,
  color,
  setColor,
  onSave,
  saveLabel = "Criar funil",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  name: string;
  setName: (v: string) => void;
  description_: string;
  setDescription: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input
              placeholder="Ex: Vendas B2B, Pós-venda..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição (opcional)</label>
            <Input
              placeholder="Breve descrição do funil"
              value={description_}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {PIPELINE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={!name.trim()}>
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
