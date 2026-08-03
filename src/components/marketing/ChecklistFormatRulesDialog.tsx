import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChecklistFormatRules } from '@/hooks/useChecklistFormatRules';
import {
  ALL_SECTIONS,
  CHECKLIST_FORMATS,
  FormatRuleMap,
  isSectionDefaultForFormat,
  ruleKey,
} from './contentChecklistSchema';

interface Props {
  rules: FormatRuleMap;
}

export function ChecklistFormatRulesDialog({ rules }: Props) {
  const [open, setOpen] = useState(false);
  const { saveRules, resetRules } = useChecklistFormatRules();
  const [draft, setDraft] = useState<FormatRuleMap>({});

  const effective = useMemo(() => {
    const map: FormatRuleMap = {};
    for (const { section } of ALL_SECTIONS) {
      for (const format of CHECKLIST_FORMATS) {
        const key = ruleKey(format, section.id);
        map[key] = rules[key] ?? isSectionDefaultForFormat(section, format);
      }
    }
    return map;
  }, [rules]);

  useEffect(() => {
    if (open) setDraft(effective);
  }, [open, effective]);

  const toggle = (key: string) => setDraft((d) => ({ ...d, [key]: !d[key] }));

  const handleSave = async () => {
    const entries = Object.entries(draft).map(([key, enabled]) => {
      const [format, sectionId] = key.split('::');
      return { format, sectionId, enabled };
    });
    await saveRules.mutateAsync(entries);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="mr-2 h-4 w-4" />
        Etapas por formato
      </Button>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Etapas do checklist por formato</DialogTitle>
          <DialogDescription>
            Marque quais etapas devem aparecer para cada formato de conteúdo. As etapas desmarcadas
            somem do checklist e não contam no progresso.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr>
                <th className="border-b p-2 text-left font-medium">Etapa</th>
                {CHECKLIST_FORMATS.map((f) => (
                  <th key={f} className="border-b p-2 text-center text-xs font-medium">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_SECTIONS.map(({ stage, section }, idx, arr) => {
                const isNewStage = idx === 0 || arr[idx - 1].stage.id !== stage.id;
                return (
                  <>
                    {isNewStage && (
                      <tr key={`${stage.id}-head`}>
                        <td
                          colSpan={CHECKLIST_FORMATS.length + 1}
                          className="border-b bg-muted/50 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {stage.title}
                        </td>
                      </tr>
                    )}
                    <tr key={section.id} className="hover:bg-muted/30">
                      <td className="border-b p-2 align-middle">
                        <span className="mr-2">{section.title}</span>
                        {section.items.some((i) => i.negative) && (
                          <Badge variant="outline" className="border-destructive/30 text-[10px] text-destructive">
                            reprova
                          </Badge>
                        )}
                      </td>
                      {CHECKLIST_FORMATS.map((format) => {
                        const key = ruleKey(format, section.id);
                        const checked = !!draft[key];
                        const isDefault =
                          checked === isSectionDefaultForFormat(section, format);
                        return (
                          <td key={format} className="border-b p-2 text-center">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggle(key)}
                              className={cn(!isDefault && 'border-primary data-[state=unchecked]:border-primary')}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => resetRules.mutate(undefined, { onSuccess: () => setOpen(false) })}
            disabled={resetRules.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveRules.isPending}>
              Salvar configuração
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
