import { useState, useMemo, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Deal } from "@/hooks/useDeals";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  GitMerge, 
  ArrowRight, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Tag, 
  User,
  ListTodo,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { MergedDealData } from "@/hooks/useDealMerge";

interface MergeDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceDeal: Deal;
  deals: Deal[];
  onMerge: (sourceDealId: string, targetDealId: string, mergedData: MergedDealData, sourceDealTitle: string) => Promise<boolean>;
}

type MergeChoice = "source" | "target";

interface FieldChoice {
  title: MergeChoice;
  value: MergeChoice;
  probability: MergeChoice;
  expected_close_date: MergeChoice;
  source: MergeChoice;
  responsible_user_id: MergeChoice;
}

const getInitials = (name: string) => {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function MergeDealDialog({
  open,
  onOpenChange,
  sourceDeal,
  deals,
  onMerge,
}: MergeDealDialogProps) {
  const { currentUser } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [targetDeal, setTargetDeal] = useState<Deal | null>(null);
  const [merging, setMerging] = useState(false);
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [remoteDeals, setRemoteDeals] = useState<Deal[]>([]);
  const [searching, setSearching] = useState(false);
  const [choices, setChoices] = useState<FieldChoice>({
    title: "target",
    value: "target",
    probability: "target",
    expected_close_date: "target",
    source: "target",
    responsible_user_id: "target",
  });

  // Remote search across ALL pipelines (not just the currently loaded funnel).
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !currentUser?.account_id) {
      setRemoteDeals([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const like = `%${q}%`;
        const { data, error } = await supabase
          .from("deals")
          .select(`
            id, account_id, title, value, currency, probability, expected_close_date,
            source, responsible_user_id, notes, tags, status, contact_name,
            stage_id, pipeline_id, client_id, lead_id, created_at, updated_at,
            client:clients(id, full_name, phone_e164, avatar_url),
            lead:leads(id, full_name, phone, email, avatar_url),
            responsible_user:users!deals_responsible_user_id_fkey(id, name, avatar_url)
          `)
          .eq("account_id", currentUser.account_id)
          .is("deleted_at", null)
          .neq("id", sourceDeal.id)
          .or(`title.ilike.${like},contact_name.ilike.${like}`)
          .limit(20);
        if (cancelled) return;
        if (error) {
          console.error("merge search error:", error);
          setRemoteDeals([]);
        } else {
          setRemoteDeals((data || []) as unknown as Deal[]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, currentUser?.account_id, sourceDeal.id]);


  const fetchMergeCounts = async (sourceId: string) => {
    setLoadingCounts(true);
    try {
      const [activitiesResult, tasksResult] = await Promise.all([
        supabase
          .from("deal_activities")
          .select("*", { count: "exact", head: true })
          .eq("deal_id", sourceId),
        supabase
          .from("internal_tasks")
          .select("*", { count: "exact", head: true })
          .eq("deal_id", sourceId),
      ]);
      
      setActivitiesCount(activitiesResult.count || 0);
      setTasksCount(tasksResult.count || 0);
    } catch (error) {
      console.error("Error fetching merge counts:", error);
    } finally {
      setLoadingCounts(false);
    }
  };

  // Combine local (current pipeline) and remote (all pipelines) search results.
  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const local = deals
      .filter(d => d.id !== sourceDeal.id)
      .filter(d =>
        d.title.toLowerCase().includes(query) ||
        d.contact_name?.toLowerCase().includes(query) ||
        d.client?.full_name?.toLowerCase().includes(query) ||
        d.lead?.full_name?.toLowerCase().includes(query)
      );
    const merged = [...local];
    for (const r of remoteDeals) {
      if (!merged.find(m => m.id === r.id)) merged.push(r);
    }
    return merged.slice(0, 20);
  }, [deals, remoteDeals, searchQuery, sourceDeal.id]);


  const handleSelectTarget = (deal: Deal) => {
    setTargetDeal(deal);
    setSearchQuery("");
    fetchMergeCounts(sourceDeal.id);
  };

  const handleChoiceChange = (field: keyof FieldChoice, value: MergeChoice) => {
    setChoices(prev => ({ ...prev, [field]: value }));
  };

  const handleMerge = async () => {
    if (!targetDeal) return;

    setMerging(true);
    try {
      // Build merged data based on choices
      const mergedData: MergedDealData = {
        title: choices.title === "source" ? sourceDeal.title : targetDeal.title,
        value: choices.value === "source" ? sourceDeal.value : targetDeal.value,
        probability: choices.probability === "source" ? sourceDeal.probability : targetDeal.probability,
        expected_close_date: choices.expected_close_date === "source" ? sourceDeal.expected_close_date : targetDeal.expected_close_date,
        source: choices.source === "source" ? sourceDeal.source : targetDeal.source,
        responsible_user_id: choices.responsible_user_id === "source" ? sourceDeal.responsible_user_id : targetDeal.responsible_user_id,
        // Merge tags
        tags: [...new Set([...sourceDeal.tags, ...targetDeal.tags])],
        // Concatenate notes
        notes: mergeNotes(sourceDeal.notes, targetDeal.notes),
      };

      const success = await onMerge(sourceDeal.id, targetDeal.id, mergedData, sourceDeal.title);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setMerging(false);
    }
  };

  const mergeNotes = (notes1: string | null, notes2: string | null): string | null => {
    if (!notes1 && !notes2) return null;
    if (!notes1) return notes2;
    if (!notes2) return notes1;
    return `${notes1}\n\n---\n\n${notes2}`;
  };

  const resetDialog = () => {
    setSearchQuery("");
    setTargetDeal(null);
    setActivitiesCount(0);
    setTasksCount(0);
    setChoices({
      title: "target",
      value: "target",
      probability: "target",
      expected_close_date: "target",
      source: "target",
      responsible_user_id: "target",
    });
  };

  const getContactName = (deal: Deal) => {
    return deal.client?.full_name || deal.lead?.full_name || deal.contact_name || "Sem contato";
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) resetDialog();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Mesclar Negócios
          </DialogTitle>
        </DialogHeader>

        {/* Search bar for target deal */}
        {!targetDeal && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar negócio para mesclar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Source deal preview */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">Negócio a ser mesclado:</p>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(sourceDeal.title)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{sourceDeal.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {getContactName(sourceDeal)} · {formatCurrency(sourceDeal.value)}
                  </p>
                </div>
              </div>
            </div>

            {/* Search results */}
            {filteredDeals.length > 0 && (
              <div className="border rounded-lg divide-y max-h-[300px] overflow-auto">
                {filteredDeals.map(deal => (
                  <div
                    key={deal.id}
                    className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                    onClick={() => handleSelectTarget(deal)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-secondary">
                        {getInitials(deal.title)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{deal.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getContactName(deal)} · {formatCurrency(deal.value)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}

            {searchQuery && filteredDeals.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum negócio encontrado</p>
            )}
          </div>
        )}

        {/* Comparison view */}
        {targetDeal && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Deal headers */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <div className="p-3 border rounded-lg bg-destructive/5">
                  <p className="text-xs text-muted-foreground mb-1">Será excluído</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-destructive/10 text-destructive">
                        {getInitials(sourceDeal.title)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="font-medium text-sm truncate block">{sourceDeal.title}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(sourceDeal.value)}</span>
                    </div>
                  </div>
                </div>
                
                <GitMerge className="h-5 w-5 text-muted-foreground" />
                
                <div className="p-3 border rounded-lg bg-primary/5">
                  <p className="text-xs text-muted-foreground mb-1">Será mantido</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(targetDeal.title)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="font-medium text-sm truncate block">{targetDeal.title}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(targetDeal.value)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Field comparisons */}
              <div className="space-y-3">
                <FieldComparison
                  icon={<FileText className="h-4 w-4" />}
                  label="Título"
                  sourceValue={sourceDeal.title}
                  targetValue={targetDeal.title}
                  choice={choices.title}
                  onChoiceChange={(v) => handleChoiceChange("title", v)}
                />

                <FieldComparison
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Valor"
                  sourceValue={formatCurrency(sourceDeal.value)}
                  targetValue={formatCurrency(targetDeal.value)}
                  choice={choices.value}
                  onChoiceChange={(v) => handleChoiceChange("value", v)}
                  sourceRaw={sourceDeal.value}
                  targetRaw={targetDeal.value}
                />

                <FieldComparison
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Probabilidade"
                  sourceValue={`${sourceDeal.probability}%`}
                  targetValue={`${targetDeal.probability}%`}
                  choice={choices.probability}
                  onChoiceChange={(v) => handleChoiceChange("probability", v)}
                  sourceRaw={sourceDeal.probability}
                  targetRaw={targetDeal.probability}
                />

                <FieldComparison
                  icon={<Calendar className="h-4 w-4" />}
                  label="Previsão de Fechamento"
                  sourceValue={sourceDeal.expected_close_date ? format(new Date(sourceDeal.expected_close_date), "dd/MM/yyyy") : null}
                  targetValue={targetDeal.expected_close_date ? format(new Date(targetDeal.expected_close_date), "dd/MM/yyyy") : null}
                  choice={choices.expected_close_date}
                  onChoiceChange={(v) => handleChoiceChange("expected_close_date", v)}
                />

                <FieldComparison
                  icon={<Tag className="h-4 w-4" />}
                  label="Origem"
                  sourceValue={sourceDeal.source}
                  targetValue={targetDeal.source}
                  choice={choices.source}
                  onChoiceChange={(v) => handleChoiceChange("source", v)}
                />

                <FieldComparison
                  icon={<User className="h-4 w-4" />}
                  label="Responsável"
                  sourceValue={sourceDeal.responsible_user?.name}
                  targetValue={targetDeal.responsible_user?.name}
                  choice={choices.responsible_user_id}
                  onChoiceChange={(v) => handleChoiceChange("responsible_user_id", v)}
                />

                {/* Auto-merged fields info */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Mesclagem automática:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• <strong>Tags:</strong> Serão unificadas ({[...new Set([...sourceDeal.tags, ...targetDeal.tags])].length} tags)</li>
                    <li>• <strong>Notas:</strong> Serão concatenadas</li>
                    <li>• <strong>Campos personalizados:</strong> Valores não existentes no destino serão transferidos</li>
                  </ul>
                  
                  {/* Transfer counts */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium mb-2">Será transferido para o negócio destino:</p>
                    {loadingCounts ? (
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : (
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary">{activitiesCount}</Badge>
                          <span className="text-muted-foreground">Atividade{activitiesCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary">{tasksCount}</Badge>
                          <span className="text-muted-foreground">Tarefa{tasksCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="link"
                size="sm"
                onClick={() => setTargetDeal(null)}
                className="text-muted-foreground"
              >
                ← Escolher outro negócio
              </Button>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!targetDeal || merging}
            className="bg-primary"
          >
            {merging ? "Mesclando..." : "Mesclar Negócios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldComparisonProps {
  icon: React.ReactNode;
  label: string;
  sourceValue: string | null | undefined;
  targetValue: string | null | undefined;
  choice: MergeChoice;
  onChoiceChange: (value: MergeChoice) => void;
  sourceRaw?: any;
  targetRaw?: any;
}

function FieldComparison({
  icon,
  label,
  sourceValue,
  targetValue,
  choice,
  onChoiceChange,
  sourceRaw,
  targetRaw,
}: FieldComparisonProps) {
  const sourceDisplay = sourceValue || "-";
  const targetDisplay = targetValue || "-";
  
  // Compare using raw values if available, otherwise use display values
  const sourceCompare = sourceRaw !== undefined ? sourceRaw : sourceValue;
  const targetCompare = targetRaw !== undefined ? targetRaw : targetValue;
  
  // If both are the same or one is empty, auto-select
  const isSame = sourceCompare === targetCompare;
  const onlySource = sourceValue && !targetValue;
  const onlyTarget = !sourceValue && targetValue;

  if (isSame || onlySource || onlyTarget) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center p-2 rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm truncate">{sourceDisplay}</span>
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-center gap-2 justify-end">
          <span className="text-sm truncate">{targetDisplay}</span>
          {(isSame || onlyTarget) && <Badge variant="outline" className="text-xs">Auto</Badge>}
          {onlySource && <Badge variant="secondary" className="text-xs">Manter</Badge>}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <RadioGroup
        value={choice}
        onValueChange={(v) => onChoiceChange(v as MergeChoice)}
        className="grid grid-cols-2 gap-2"
      >
        <Label
          htmlFor={`${label}-source`}
          className={cn(
            "flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors",
            choice === "source" ? "border-primary bg-primary/5" : "hover:bg-muted"
          )}
        >
          <RadioGroupItem value="source" id={`${label}-source`} />
          <span className="text-sm truncate">{sourceDisplay}</span>
        </Label>
        <Label
          htmlFor={`${label}-target`}
          className={cn(
            "flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors",
            choice === "target" ? "border-primary bg-primary/5" : "hover:bg-muted"
          )}
        >
          <RadioGroupItem value="target" id={`${label}-target`} />
          <span className="text-sm truncate">{targetDisplay}</span>
        </Label>
      </RadioGroup>
    </div>
  );
}
