import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface PostOption {
  id?: string;
  value: string;
  isDefault?: boolean;
}

interface OptionSelectWithAddProps {
  label: string;
  placeholder?: string;
  options: PostOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onAddOption: (value: string) => void;
  isMultiple?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function OptionSelectWithAdd({
  label,
  placeholder = 'Selecione...',
  options,
  value,
  onChange,
  onAddOption,
  isMultiple = false,
  isLoading = false,
  className,
}: OptionSelectWithAddProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newOption, setNewOption] = useState('');

  const handleAdd = () => {
    if (newOption.trim()) {
      onAddOption(newOption.trim());
      setNewOption('');
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setNewOption('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Multi-select with checkboxes
  if (isMultiple) {
    const selectedValues = Array.isArray(value) ? value : [];

    const toggleOption = (optionValue: string) => {
      if (selectedValues.includes(optionValue)) {
        onChange(selectedValues.filter((v) => v !== optionValue));
      } else {
        onChange([...selectedValues, optionValue]);
      }
    };

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          {!isAdding && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          )}
        </div>

        {isAdding && (
          <div className="flex gap-2">
            <Input
              placeholder="Nova opção..."
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-8 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={handleAdd}
              disabled={!newOption.trim() || isLoading}
            >
              <Check className="h-4 w-4 text-green-500" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={handleCancel}
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}

        <ScrollArea className="h-[140px] rounded-md border p-2">
          <div className="space-y-1">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                Nenhuma opção disponível
              </p>
            ) : (
              options.map((option, index) => (
                <div
                  key={option.id || `${option.value}-${index}`}
                  className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-muted/50"
                >
                  <Checkbox
                    id={`opt-${option.id || index}`}
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={() => toggleOption(option.value)}
                  />
                  <label
                    htmlFor={`opt-${option.id || index}`}
                    className="text-sm cursor-pointer flex-1 leading-tight"
                  >
                    {option.value}
                  </label>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {selectedValues.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedValues.length} selecionado(s)
          </p>
        )}
      </div>
    );
  }

  // Single select
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {!isAdding && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        )}
      </div>

      {isAdding ? (
        <div className="flex gap-2">
          <Input
            placeholder="Nova opção..."
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2"
            onClick={handleAdd}
            disabled={!newOption.trim() || isLoading}
          >
            <Check className="h-4 w-4 text-green-500" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2"
            onClick={handleCancel}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <Select value={stringValue} onValueChange={(v) => onChange(v)}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                Clique em "Adicionar" para criar opções
              </div>
            ) : (
              options.map((option, index) => (
                <SelectItem
                  key={option.id || `${option.value}-${index}`}
                  value={option.value}
                >
                  {option.value}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
