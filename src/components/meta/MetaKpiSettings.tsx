import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Settings2, RotateCcw } from 'lucide-react';
import { ALL_META_KPIS, useMetaKpiPreferences } from '@/hooks/useMetaKpiPreferences';

const categoryLabels: Record<string, string> = { performance: 'Performance', engagement: 'Engajamento', cost: 'Custos', conversion: 'Conversão' };
const categoryColors: Record<string, string> = { performance: 'text-blue-500', engagement: 'text-emerald-500', cost: 'text-amber-500', conversion: 'text-purple-500' };

export function MetaKpiSettings() {
  const { visibleKpis, toggleKpi, resetToDefaults } = useMetaKpiPreferences();
  const grouped = ALL_META_KPIS.reduce((acc, kpi) => {
    if (!acc[kpi.category]) acc[kpi.category] = [];
    acc[kpi.category].push(kpi);
    return acc;
  }, {} as Record<string, typeof ALL_META_KPIS>);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" title="Personalizar KPIs">
          <Settings2 className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5" />Personalizar Métricas</SheetTitle>
          <SheetDescription>Escolha quais KPIs deseja visualizar.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{visibleKpis.length} métricas selecionadas</span>
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="gap-2 text-muted-foreground">
            <RotateCcw className="w-4 h-4" />Restaurar
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-200px)] mt-4 pr-4">
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, kpis]) => (
              <motion.div key={cat} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold text-sm ${categoryColors[cat]}`}>{categoryLabels[cat]}</h3>
                  <Separator className="flex-1" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {kpis.map(kpi => (
                    <label key={kpi.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer">
                      <Checkbox checked={visibleKpis.includes(kpi.id)} onCheckedChange={() => toggleKpi(kpi.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{kpi.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{kpi.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
