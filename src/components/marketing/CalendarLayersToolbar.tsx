import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarLayerKind, layerConfig } from '@/hooks/useMarketingCalendarLayers';

const STORAGE_KEY = 'marketing-calendar-layers';

const DEFAULT_LAYERS: Record<CalendarLayerKind | 'event', boolean> = {
  event: true,
  pauta: true,
  task: true,
  milestone: true,
};

export type LayerToggles = Record<CalendarLayerKind | 'event', boolean>;

export function useLayerToggles(): [LayerToggles, (k: keyof LayerToggles, v: boolean) => void] {
  const [layers, setLayers] = useState<LayerToggles>(DEFAULT_LAYERS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLayers({ ...DEFAULT_LAYERS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const toggle = (k: keyof LayerToggles, v: boolean) => {
    setLayers((prev) => {
      const next = { ...prev, [k]: v };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return [layers, toggle];
}

interface Props {
  layers: LayerToggles;
  onToggle: (k: keyof LayerToggles, v: boolean) => void;
}

const allItems: { key: keyof LayerToggles; label: string; color: string }[] = [
  { key: 'event', label: 'Eventos', color: '#6366f1' },
  { key: 'pauta', label: layerConfig.pauta.label, color: layerConfig.pauta.color },
  { key: 'task', label: layerConfig.task.label, color: layerConfig.task.color },
  { key: 'milestone', label: layerConfig.milestone.label, color: layerConfig.milestone.color },
];

export function CalendarLayersToolbar({ layers, onToggle }: Props) {
  const activeCount = allItems.filter((i) => layers[i.key]).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="h-4 w-4" />
          Camadas
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
            {activeCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Mostrar no calendário
          </p>
          {allItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Checkbox
                id={`layer-${item.key}`}
                checked={layers[item.key]}
                onCheckedChange={(v) => onToggle(item.key, !!v)}
              />
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <Label
                htmlFor={`layer-${item.key}`}
                className="text-sm cursor-pointer flex-1"
              >
                {item.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
