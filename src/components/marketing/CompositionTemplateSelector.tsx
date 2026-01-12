import { useState } from 'react';
import {
  Zap,
  Heart,
  Crown,
  TrendingUp,
  ShoppingCart,
  Camera,
  Users,
  BookOpen,
  Star,
  Trash2,
  Bookmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { CompositionTemplate, CompositionPreset } from '@/hooks/useCompositionTemplates';

interface CompositionTemplateSelectorProps {
  templates: CompositionTemplate[];
  presets: CompositionPreset[];
  postType?: string;
  objective?: string;
  onApply: (items: string[], specialistVersion?: string) => void;
  onDeletePreset: (presetId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap className="h-4 w-4" />,
  Heart: <Heart className="h-4 w-4" />,
  Crown: <Crown className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  ShoppingCart: <ShoppingCart className="h-4 w-4" />,
  Camera: <Camera className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  BookOpen: <BookOpen className="h-4 w-4" />,
  Star: <Star className="h-4 w-4" />,
};

const objectiveColors: Record<string, string> = {
  growth: 'bg-green-500/10 text-green-600 border-green-500/20',
  connection: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  authority: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  sales: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

const formatColors: Record<string, string> = {
  reels: 'bg-pink-500/10 text-pink-600',
  carousel: 'bg-blue-500/10 text-blue-600',
  static: 'bg-purple-500/10 text-purple-600',
};

export function CompositionTemplateSelector({
  templates,
  presets,
  postType,
  objective,
  onApply,
  onDeletePreset,
  isLoading,
  className,
}: CompositionTemplateSelectorProps) {
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);

  // Filter templates by current post type and objective
  const filteredTemplates = templates.filter((t) => {
    const matchType = !postType || !t.post_type || t.post_type === postType;
    const matchObjective = !objective || !t.objective || t.objective === objective;
    return matchType && matchObjective;
  });

  const handleDeletePreset = () => {
    if (presetToDelete) {
      onDeletePreset(presetToDelete);
      setPresetToDelete(null);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="templates" className="text-xs">
            Templates ({filteredTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="presets" className="text-xs">
            <Bookmark className="h-3 w-3 mr-1" />
            Meus Presets ({presets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-3">
          <ScrollArea className="h-[160px]">
            <div className="grid grid-cols-2 gap-2 pr-3">
              {filteredTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  className={cn(
                    'h-auto py-2 px-3 flex flex-col items-start gap-1 text-left hover:bg-primary/5',
                    template.objective && objectiveColors[template.objective]
                  )}
                  onClick={() => onApply(template.composition_items)}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    {template.icon && iconMap[template.icon]}
                    <span className="text-xs font-medium truncate">
                      {template.name}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {template.post_type && (
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] px-1 py-0', formatColors[template.post_type])}
                      >
                        {template.post_type}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {template.composition_items.length} itens
                    </Badge>
                  </div>
                </Button>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="col-span-2 text-center py-6 text-sm text-muted-foreground">
                  Nenhum template disponível para este formato/objetivo
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="presets" className="mt-3">
          <ScrollArea className="h-[160px]">
            <div className="space-y-2 pr-3">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 group"
                >
                  <Button
                    variant="ghost"
                    className="flex-1 h-auto py-1 px-2 justify-start text-left"
                    onClick={() =>
                      onApply(preset.composition_items, preset.specialist_version || undefined)
                    }
                    disabled={isLoading}
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-medium">{preset.name}</span>
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {preset.composition_items.length} itens
                        </Badge>
                        {preset.specialist_version && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {preset.specialist_version}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setPresetToDelete(preset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {presets.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Você ainda não tem presets salvos.
                  <br />
                  <span className="text-xs">
                    Selecione composições e clique em "Salvar Preset"
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!presetToDelete} onOpenChange={() => setPresetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Preset?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O preset será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePreset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
