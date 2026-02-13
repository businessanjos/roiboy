import { useState, useMemo, useEffect } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lead } from "@/hooks/useLeads";
import { supabase } from "@/integrations/supabase/client";
import { Search, GitMerge, ArrowRight, User, Phone, Mail, Calendar, Tag, FileText, Instagram, Briefcase, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MergeLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceLead: Lead;
  leads: Lead[];
  onMerge: (sourceLeadId: string, targetLeadId: string, mergedData: MergedLeadData, sourceLeadName: string) => Promise<void>;
}

export interface MergedLeadData {
  full_name: string;
  phone: string | null;
  email: string | null;
  emails: string[] | null;
  additional_phones: string[] | null;
  instagram: string | null;
  instagrams: string[] | null;
  source: string | null;
  notes: string | null;
  status: string;
  tags: string[];
  
  responsible_user_id: string | null;
}

type MergeChoice = "source" | "target" | "both";

interface FieldChoice {
  full_name: MergeChoice;
  phone: MergeChoice;
  email: MergeChoice;
  instagram: MergeChoice;
  source: MergeChoice;
  status: MergeChoice;
  
  responsible_user_id: MergeChoice;
}

const getInitials = (name: string) => {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
};

export function MergeLeadDialog({
  open,
  onOpenChange,
  sourceLead,
  leads,
  onMerge,
}: MergeLeadDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [targetLead, setTargetLead] = useState<Lead | null>(null);
  const [merging, setMerging] = useState(false);
  const [dealsCount, setDealsCount] = useState(0);
  const [timelineCount, setTimelineCount] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [choices, setChoices] = useState<FieldChoice>({
    full_name: "target",
    phone: "target",
    email: "target",
    instagram: "target",
    source: "target",
    status: "target",
    responsible_user_id: "target",
  });

  const fetchMergeCounts = async (sourceId: string) => {
    setLoadingCounts(true);
    try {
      const [dealsResult, timelineResult] = await Promise.all([
        supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .eq("lead_id", sourceId),
        supabase
          .from("lead_timeline")
          .select("*", { count: "exact", head: true })
          .eq("lead_id", sourceId),
      ]);
      
      setDealsCount(dealsResult.count || 0);
      setTimelineCount(timelineResult.count || 0);
    } catch (error) {
      console.error("Error fetching merge counts:", error);
    } finally {
      setLoadingCounts(false);
    }
  };

  // Filter leads for search (exclude source lead)
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return leads
      .filter(l => l.id !== sourceLead.id)
      .filter(l => 
        l.full_name.toLowerCase().includes(query) ||
        l.phone?.toLowerCase().includes(query) ||
        l.email?.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [leads, searchQuery, sourceLead.id]);

  const handleSelectTarget = (lead: Lead) => {
    setTargetLead(lead);
    setSearchQuery("");
    fetchMergeCounts(sourceLead.id);
  };

  const handleChoiceChange = (field: keyof FieldChoice, value: MergeChoice) => {
    setChoices(prev => ({ ...prev, [field]: value }));
  };

  const handleMerge = async () => {
    if (!targetLead) return;

    setMerging(true);
    try {
      // Build merged data based on choices
      const mergedData: MergedLeadData = {
        full_name: choices.full_name === "source" ? sourceLead.full_name : targetLead.full_name,
        phone: choices.phone === "source" ? sourceLead.phone : targetLead.phone,
        email: choices.email === "source" ? sourceLead.email : targetLead.email,
        instagram: choices.instagram === "source" ? sourceLead.instagram : targetLead.instagram,
        source: choices.source === "source" ? sourceLead.source : targetLead.source,
        status: choices.status === "source" ? sourceLead.status : targetLead.status,
        
        responsible_user_id: choices.responsible_user_id === "source" ? sourceLead.responsible_user_id : targetLead.responsible_user_id,
        // Merge arrays
        emails: mergeArrays(sourceLead.emails, targetLead.emails),
        additional_phones: mergeArrays(sourceLead.additional_phones, targetLead.additional_phones),
        instagrams: mergeArrays(sourceLead.instagrams, targetLead.instagrams),
        // Merge tags
        tags: [...new Set([...sourceLead.tags, ...targetLead.tags])],
        // Concatenate notes
        notes: mergeNotes(sourceLead.notes, targetLead.notes),
      };

      await onMerge(sourceLead.id, targetLead.id, mergedData, sourceLead.full_name);
      onOpenChange(false);
    } finally {
      setMerging(false);
    }
  };

  const mergeArrays = (arr1: string[] | null, arr2: string[] | null): string[] | null => {
    const combined = [...(arr1 || []), ...(arr2 || [])];
    const unique = [...new Set(combined)];
    return unique.length > 0 ? unique : null;
  };

  const mergeNotes = (notes1: string | null, notes2: string | null): string | null => {
    if (!notes1 && !notes2) return null;
    if (!notes1) return notes2;
    if (!notes2) return notes1;
    return `${notes1}\n\n---\n\n${notes2}`;
  };

  const resetDialog = () => {
    setSearchQuery("");
    setTargetLead(null);
    setDealsCount(0);
    setTimelineCount(0);
    setChoices({
      full_name: "target",
      phone: "target",
      email: "target",
      instagram: "target",
      source: "target",
      status: "target",
      
      responsible_user_id: "target",
    });
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
            Mesclar Leads
          </DialogTitle>
        </DialogHeader>

        {/* Search bar for target lead */}
        {!targetLead && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar lead para mesclar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Source lead preview */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">Lead a ser mesclado:</p>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(sourceLead.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{sourceLead.full_name}</p>
                  <p className="text-sm text-muted-foreground">{sourceLead.phone || sourceLead.email}</p>
                </div>
              </div>
            </div>

            {/* Search results */}
            {filteredLeads.length > 0 && (
              <div className="border rounded-lg divide-y max-h-[300px] overflow-auto">
                {filteredLeads.map(lead => (
                  <div
                    key={lead.id}
                    className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                    onClick={() => handleSelectTarget(lead)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-secondary">
                        {getInitials(lead.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{lead.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.phone || lead.email || "Sem contato"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}

            {searchQuery && filteredLeads.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum lead encontrado</p>
            )}
          </div>
        )}

        {/* Comparison view */}
        {targetLead && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Lead headers */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <div className="p-3 border rounded-lg bg-destructive/5">
                  <p className="text-xs text-muted-foreground mb-1">Será excluído</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-destructive/10 text-destructive">
                        {getInitials(sourceLead.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm truncate">{sourceLead.full_name}</span>
                  </div>
                </div>
                
                <GitMerge className="h-5 w-5 text-muted-foreground" />
                
                <div className="p-3 border rounded-lg bg-primary/5">
                  <p className="text-xs text-muted-foreground mb-1">Será mantido</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(targetLead.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm truncate">{targetLead.full_name}</span>
                  </div>
                </div>
              </div>

              {/* Field comparisons */}
              <div className="space-y-3">
                <FieldComparison
                  icon={<User className="h-4 w-4" />}
                  label="Nome"
                  sourceValue={sourceLead.full_name}
                  targetValue={targetLead.full_name}
                  choice={choices.full_name}
                  onChoiceChange={(v) => handleChoiceChange("full_name", v)}
                  showBoth={false}
                />

                <FieldComparison
                  icon={<Phone className="h-4 w-4" />}
                  label="Telefone"
                  sourceValue={sourceLead.phone}
                  targetValue={targetLead.phone}
                  choice={choices.phone}
                  onChoiceChange={(v) => handleChoiceChange("phone", v)}
                  showBoth={false}
                />

                <FieldComparison
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  sourceValue={sourceLead.email}
                  targetValue={targetLead.email}
                  choice={choices.email}
                  onChoiceChange={(v) => handleChoiceChange("email", v)}
                  showBoth={false}
                />

                <FieldComparison
                  icon={<Instagram className="h-4 w-4" />}
                  label="Instagram"
                  sourceValue={sourceLead.instagram}
                  targetValue={targetLead.instagram}
                  choice={choices.instagram}
                  onChoiceChange={(v) => handleChoiceChange("instagram", v)}
                  showBoth={false}
                />

                <FieldComparison
                  icon={<Tag className="h-4 w-4" />}
                  label="Origem"
                  sourceValue={sourceLead.source}
                  targetValue={targetLead.source}
                  choice={choices.source}
                  onChoiceChange={(v) => handleChoiceChange("source", v)}
                  showBoth={false}
                />


                {/* Auto-merged fields info */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Mesclagem automática:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• <strong>Tags:</strong> Serão unificadas ({[...new Set([...sourceLead.tags, ...targetLead.tags])].length} tags)</li>
                    <li>• <strong>Notas:</strong> Serão concatenadas</li>
                    <li>• <strong>Telefones adicionais:</strong> Serão mesclados</li>
                    <li>• <strong>Emails adicionais:</strong> Serão mesclados</li>
                  </ul>
                  
                  {/* Transfer counts */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium mb-2">Será transferido para o lead destino:</p>
                    {loadingCounts ? (
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : (
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-xs">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary">{dealsCount}</Badge>
                          <span className="text-muted-foreground">Negócio{dealsCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary">{timelineCount}</Badge>
                          <span className="text-muted-foreground">Atividade{timelineCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="link"
                size="sm"
                onClick={() => setTargetLead(null)}
                className="text-muted-foreground"
              >
                ← Escolher outro lead
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
            disabled={!targetLead || merging}
            className="bg-primary"
          >
            {merging ? "Mesclando..." : "Mesclar Leads"}
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
  showBoth?: boolean;
}

function FieldComparison({
  icon,
  label,
  sourceValue,
  targetValue,
  choice,
  onChoiceChange,
  showBoth = true,
}: FieldComparisonProps) {
  const sourceDisplay = sourceValue || "-";
  const targetDisplay = targetValue || "-";
  
  // If both are the same or one is empty, auto-select
  const isSame = sourceValue === targetValue;
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
