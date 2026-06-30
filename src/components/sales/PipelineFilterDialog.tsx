import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Info } from "lucide-react";
import { PipelineFilter, FilterCondition } from "@/hooks/usePipelineFilters";
import { DealStage } from "@/hooks/useDeals";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SalesUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface CustomFieldOption {
  id: string;
  name: string;
  field_type: string;
  options: Array<{ value: string; label: string }> | null;
}

interface PipelineFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, conditions: FilterCondition[], matchType: 'all' | 'any', isPublic: boolean) => void;
  editingFilter: PipelineFilter | null;
  stages: DealStage[];
  salesUsers: SalesUser[];
  availableTags: string[];
  customFields?: CustomFieldOption[];
}

// Field definitions with their available operators
const FILTER_FIELDS = [
  { value: 'title', label: 'Título', type: 'text' },
  { value: 'value', label: 'Valor', type: 'number' },
  { value: 'responsible_user_id', label: 'Vendedor', type: 'user' },
  { value: 'stage_id', label: 'Etapa', type: 'stage' },
  { value: 'tags', label: 'Tags', type: 'tags' },
  { value: 'source', label: 'Fonte', type: 'text' },
  { value: 'created_at', label: 'Data de criação', type: 'date' },
  { value: 'updated_at', label: 'Última atualização', type: 'date' },
  { value: 'expected_close_date', label: 'Data prevista fechamento', type: 'date' },
];

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contém' },
    { value: 'not_contains', label: 'não contém' },
    { value: 'equals', label: 'é igual a' },
    { value: 'not_equals', label: 'não é igual a' },
    { value: 'is_empty', label: 'está vazio' },
    { value: 'is_not_empty', label: 'não está vazio' },
  ],
  number: [
    { value: 'equals', label: 'é igual a' },
    { value: 'not_equals', label: 'não é igual a' },
    { value: 'greater_than', label: 'maior que' },
    { value: 'less_than', label: 'menor que' },
    { value: 'greater_or_equal', label: 'maior ou igual a' },
    { value: 'less_or_equal', label: 'menor ou igual a' },
    { value: 'is_empty', label: 'está vazio' },
    { value: 'is_not_empty', label: 'não está vazio' },
  ],
  user: [
    { value: 'equals', label: 'é' },
    { value: 'not_equals', label: 'não é' },
    { value: 'is_empty', label: 'está vazio' },
    { value: 'is_not_empty', label: 'não está vazio' },
  ],
  stage: [
    { value: 'equals', label: 'é' },
    { value: 'not_equals', label: 'não é' },
  ],
  tags: [
    { value: 'contains', label: 'contém' },
    { value: 'not_contains', label: 'não contém' },
    { value: 'is_empty', label: 'está vazio' },
    { value: 'is_not_empty', label: 'não está vazio' },
  ],
  date: [
    { value: 'this_week', label: 'esta semana' },
    { value: 'this_month', label: 'este mês' },
    { value: 'older_than_days', label: 'há mais de X dias' },
    { value: 'next_days', label: 'nos próximos X dias' },
    { value: 'before', label: 'antes de' },
    { value: 'after', label: 'depois de' },
    { value: 'is_empty', label: 'está vazio' },
    { value: 'is_not_empty', label: 'não está vazio' },
  ],
};

const VALUE_NOT_NEEDED = ['is_empty', 'is_not_empty', 'this_week', 'this_month'];

export function PipelineFilterDialog({
  isOpen,
  onClose,
  onSave,
  editingFilter,
  stages,
  salesUsers,
  availableTags,
}: PipelineFilterDialogProps) {
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [matchType, setMatchType] = useState<'all' | 'any'>('all');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (editingFilter) {
      setName(editingFilter.name);
      setConditions(editingFilter.conditions);
      setMatchType(editingFilter.match_type);
      setIsPublic(editingFilter.is_public);
    } else {
      setName("");
      setConditions([{ field: 'title', operator: 'contains', value: '' }]);
      setMatchType('all');
      setIsPublic(false);
    }
  }, [editingFilter, isOpen]);

  const addCondition = () => {
    setConditions([...conditions, { field: 'title', operator: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    
    // Reset value if operator doesn't need it
    if (updates.operator && VALUE_NOT_NEEDED.includes(updates.operator)) {
      newConditions[index].value = null;
    }
    
    // Reset operator if field type changes
    if (updates.field) {
      const fieldDef = FILTER_FIELDS.find(f => f.value === updates.field);
      if (fieldDef) {
        const operators = OPERATORS_BY_TYPE[fieldDef.type] || [];
        newConditions[index].operator = operators[0]?.value || 'equals';
        newConditions[index].value = '';
      }
    }
    
    setConditions(newConditions);
  };

  const getFieldType = (fieldValue: string): string => {
    return FILTER_FIELDS.find(f => f.value === fieldValue)?.type || 'text';
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name, conditions, matchType, isPublic);
  };

  const renderValueInput = (condition: FilterCondition, index: number) => {
    const fieldType = getFieldType(condition.field);
    
    if (VALUE_NOT_NEEDED.includes(condition.operator)) {
      return null;
    }

    // User select
    if (fieldType === 'user') {
      return (
        <Select
          value={condition.value || ''}
          onValueChange={(v) => updateCondition(index, { value: v })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {salesUsers.map(user => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Stage select
    if (fieldType === 'stage') {
      return (
        <Select
          value={condition.value || ''}
          onValueChange={(v) => updateCondition(index, { value: v })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {stages.map(stage => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Tags select
    if (fieldType === 'tags') {
      return (
        <Select
          value={condition.value || ''}
          onValueChange={(v) => updateCondition(index, { value: v })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {availableTags.map(tag => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Number input
    if (fieldType === 'number' || ['older_than_days', 'next_days'].includes(condition.operator)) {
      return (
        <Input
          type="number"
          value={condition.value || ''}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          placeholder={['older_than_days', 'next_days'].includes(condition.operator) ? 'dias' : 'valor'}
          className="w-[100px]"
        />
      );
    }

    // Date input
    if (['before', 'after'].includes(condition.operator)) {
      return (
        <Input
          type="date"
          value={condition.value || ''}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          className="w-[140px]"
        />
      );
    }

    // Default text input
    return (
      <Input
        value={condition.value || ''}
        onChange={(e) => updateCondition(index, { value: e.target.value })}
        placeholder="valor"
        className="w-[140px]"
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editingFilter ? `Editar filtro "${editingFilter.name}"` : 'Criar novo filtro'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Match Type */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Atender a</span>
            <Select value={matchType} onValueChange={(v: 'all' | 'any') => setMatchType(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">TODAS</SelectItem>
                <SelectItem value="any">QUALQUER</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm">estas condições</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    TODAS: o negócio deve atender a todas as condições (AND)<br/>
                    QUALQUER: o negócio deve atender a pelo menos uma condição (OR)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Conditions */}
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground shrink-0">
                    {index === 0 ? 'EM QUE' : matchType === 'all' ? 'E' : 'OU'}
                  </span>
                  
                  {/* Field */}
                  <Select
                    value={condition.field}
                    onValueChange={(v) => updateCondition(index, { field: v })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_FIELDS.map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator */}
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(OPERATORS_BY_TYPE[getFieldType(condition.field)] || []).map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value */}
                  {renderValueInput(condition, index)}

                  {/* Delete */}
                  {conditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Add Condition */}
          <Button variant="ghost" size="sm" onClick={addCondition} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar condição
          </Button>

          <div className="border-t pt-4 space-y-4">
            {/* Filter Name */}
            <div className="space-y-2">
              <Label htmlFor="filterName">Nome do filtro</Label>
              <Input
                id="filterName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Negócios com alto valor"
              />
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Visibilidade</Label>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? 'Visível para todos da equipe' : 'Apenas você pode ver'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Privado</span>
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
                <span className="text-sm text-muted-foreground">Público</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || conditions.length === 0}>
            {editingFilter ? 'Salvar' : 'Criar filtro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
