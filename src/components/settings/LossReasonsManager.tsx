import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Reason {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  account_id: string;
}

interface SubReason {
  id: string;
  loss_reason_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  account_id: string;
}

export function LossReasonsManager() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;
  const canDelete = currentUser?.is_also_admin || currentUser?.id === "1232ec15-5f66-4b5f-9e74-f40d436f9d0f";

  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [newReasonName, setNewReasonName] = useState("");
  const [newSubReasonNames, setNewSubReasonNames] = useState<Record<string, string>>({});
  const [editingReason, setEditingReason] = useState<Record<string, string>>({});
  const [editingSub, setEditingSub] = useState<Record<string, string>>({});

  const { data: reasons = [], isLoading: loadingReasons } = useQuery({
    queryKey: ["loss-reasons-admin", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_loss_reasons")
        .select("*")
        .eq("account_id", accountId!)
        .order("display_order");
      if (error) throw error;
      return data as Reason[];
    },
    enabled: !!accountId,
  });

  const { data: subReasons = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["loss-sub-reasons-admin", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_loss_sub_reasons")
        .select("*")
        .eq("account_id", accountId!)
        .order("display_order");
      if (error) throw error;
      return data as SubReason[];
    },
    enabled: !!accountId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["loss-reasons-admin"] });
    queryClient.invalidateQueries({ queryKey: ["loss-sub-reasons-admin"] });
    queryClient.invalidateQueries({ queryKey: ["deal-loss-reasons"] });
    queryClient.invalidateQueries({ queryKey: ["deal-loss-sub-reasons"] });
  };

  const addReason = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = reasons.length > 0 ? Math.max(...reasons.map(r => r.display_order)) + 1 : 1;
      const { error } = await supabase.from("deal_loss_reasons").insert({
        account_id: accountId!,
        name,
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setNewReasonName(""); toast.success("Motivo adicionado"); },
    onError: () => toast.error("Erro ao adicionar motivo"),
  });

  const updateReason = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Reason> }) => {
      const { error } = await supabase.from("deal_loss_reasons").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Motivo atualizado"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const addSubReason = useMutation({
    mutationFn: async ({ reasonId, name }: { reasonId: string; name: string }) => {
      const subs = subReasons.filter(s => s.loss_reason_id === reasonId);
      const maxOrder = subs.length > 0 ? Math.max(...subs.map(s => s.display_order)) + 1 : 1;
      const { error } = await supabase.from("deal_loss_sub_reasons").insert({
        account_id: accountId!,
        loss_reason_id: reasonId,
        name,
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidateAll();
      setNewSubReasonNames(prev => ({ ...prev, [vars.reasonId]: "" }));
      toast.success("Subcategoria adicionada");
    },
    onError: () => toast.error("Erro ao adicionar subcategoria"),
  });

  const updateSubReason = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SubReason> }) => {
      const { error } = await supabase.from("deal_loss_sub_reasons").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Subcategoria atualizada"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteReason = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("deal_loss_sub_reasons").delete().eq("loss_reason_id", id);
      const { error } = await supabase.from("deal_loss_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Motivo excluído"); },
    onError: () => toast.error("Erro ao excluir motivo"),
  });

  const deleteSubReason = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_loss_sub_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Subcategoria excluída"); },
    onError: () => toast.error("Erro ao excluir subcategoria"),
  });

  const toggleExpand = (id: string) => {
    setExpandedReasons(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleReasonBlur = (id: string, originalName: string) => {
    const newName = editingReason[id];
    if (newName && newName.trim() !== originalName) {
      updateReason.mutate({ id, updates: { name: newName.trim() } });
    }
    setEditingReason(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSubBlur = (id: string, originalName: string) => {
    const newName = editingSub[id];
    if (newName && newName.trim() !== originalName) {
      updateSubReason.mutate({ id, updates: { name: newName.trim() } });
    }
    setEditingSub(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  if (loadingReasons || loadingSubs) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Motivos de Perda</CardTitle>
        <CardDescription>
          Gerencie os motivos exibidos ao marcar uma negociação como perdida.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {reasons.map((reason) => {
          const isExpanded = expandedReasons.has(reason.id);
          const subs = subReasons.filter(s => s.loss_reason_id === reason.id);

          return (
            <Collapsible key={reason.id} open={isExpanded} onOpenChange={() => toggleExpand(reason.id)}>
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>

                {editingReason[reason.id] !== undefined ? (
                  <Input
                    autoFocus
                    className="h-8 text-sm flex-1"
                    value={editingReason[reason.id]}
                    onChange={e => setEditingReason(prev => ({ ...prev, [reason.id]: e.target.value }))}
                    onBlur={() => handleReasonBlur(reason.id, reason.name)}
                    onKeyDown={e => e.key === "Enter" && handleReasonBlur(reason.id, reason.name)}
                  />
                ) : (
                  <span
                    className="text-sm font-medium flex-1 cursor-pointer hover:underline"
                    onClick={() => setEditingReason(prev => ({ ...prev, [reason.id]: reason.name }))}
                  >
                    {reason.name}
                  </span>
                )}

                <span className="text-xs text-muted-foreground shrink-0">
                  {subs.filter(s => s.is_active).length} sub
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteReason.mutate(reason.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Switch
                    checked={reason.is_active}
                    onCheckedChange={checked => updateReason.mutate({ id: reason.id, updates: { is_active: checked } })}
                  />
                </div>
              </div>

              <CollapsibleContent className="ml-9 mt-1 space-y-1">
                {subs.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 p-1.5 rounded border bg-background">
                    {editingSub[sub.id] !== undefined ? (
                      <Input
                        autoFocus
                        className="h-7 text-xs flex-1"
                        value={editingSub[sub.id]}
                        onChange={e => setEditingSub(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        onBlur={() => handleSubBlur(sub.id, sub.name)}
                        onKeyDown={e => e.key === "Enter" && handleSubBlur(sub.id, sub.name)}
                      />
                    ) : (
                      <span
                        className="text-xs flex-1 cursor-pointer hover:underline"
                        onClick={() => setEditingSub(prev => ({ ...prev, [sub.id]: sub.name }))}
                      >
                        {sub.name}
                      </span>
                    )}
                    <Switch
                      checked={sub.is_active}
                      onCheckedChange={checked => updateSubReason.mutate({ id: sub.id, updates: { is_active: checked } })}
                    />
                  </div>
                ))}

                {/* Add sub-reason */}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Nova subcategoria..."
                    value={newSubReasonNames[reason.id] || ""}
                    onChange={e => setNewSubReasonNames(prev => ({ ...prev, [reason.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (newSubReasonNames[reason.id] || "").trim()) {
                        addSubReason.mutate({ reasonId: reason.id, name: newSubReasonNames[reason.id].trim() });
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!(newSubReasonNames[reason.id] || "").trim()}
                    onClick={() => addSubReason.mutate({ reasonId: reason.id, name: (newSubReasonNames[reason.id] || "").trim() })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Add new reason */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            className="h-8 text-sm flex-1"
            placeholder="Novo motivo de perda..."
            value={newReasonName}
            onChange={e => setNewReasonName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && newReasonName.trim()) addReason.mutate(newReasonName.trim());
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!newReasonName.trim() || addReason.isPending}
            onClick={() => addReason.mutate(newReasonName.trim())}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
