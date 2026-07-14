import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Plus,
  Trash2,
  Target,
  Loader2,
  Star,
  StarOff,
  Pencil,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Clinic {
  id: string;
  client_id: string;
  account_id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_primary: boolean;
  notes: string | null;
}

interface ClinicGoal {
  id: string;
  clinic_id: string;
  month: string;
  goal_amount: number;
  actual_amount: number | null;
}

const currency = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

const parseCurrencyInput = (raw: string): number | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

export function ClientClinicsManager({
  clientId,
  accountId,
}: {
  clientId: string;
  accountId: string;
}) {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [goals, setGoals] = useState<ClinicGoal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Clinic | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    city: "",
    state: "",
    is_primary: false,
  });

  const currentMonth = format(new Date(), "yyyy-MM");
  const monthLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: c }, { data: g }] = await Promise.all([
      supabase
        .from("client_clinics")
        .select("*")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("client_clinic_goals")
        .select("*")
        .eq("client_id", clientId)
        .eq("month", currentMonth),
    ]);
    setClinics((c || []) as any);
    setGoals((g || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const goalByClinic = useMemo(() => {
    const m = new Map<string, ClinicGoal>();
    goals.forEach((g) => m.set(g.clinic_id, g));
    return m;
  }, [goals]);

  const openNew = () => {
    setEditing(null);
    setDraft({
      name: "",
      city: "",
      state: "",
      is_primary: clinics.length === 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Clinic) => {
    setEditing(c);
    setDraft({
      name: c.name,
      city: c.city || "",
      state: c.state || "",
      is_primary: c.is_primary,
    });
    setDialogOpen(true);
  };

  const saveClinic = async () => {
    if (!draft.name.trim()) {
      toast.error("Informe o nome da clínica");
      return;
    }
    setSaving(true);

    // If marking as primary, unset others
    if (draft.is_primary) {
      await supabase
        .from("client_clinics")
        .update({ is_primary: false })
        .eq("client_id", clientId);
    }

    if (editing) {
      const { error } = await supabase
        .from("client_clinics")
        .update({
          name: draft.name.trim(),
          city: draft.city.trim() || null,
          state: draft.state.trim() || null,
          is_primary: draft.is_primary,
        })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar clínica");
        return;
      }
    } else {
      const { error } = await supabase.from("client_clinics").insert({
        client_id: clientId,
        account_id: accountId,
        name: draft.name.trim(),
        city: draft.city.trim() || null,
        state: draft.state.trim() || null,
        is_primary: draft.is_primary,
        created_by: currentUser?.id,
      });
      setSaving(false);
      if (error) {
        toast.error("Erro ao criar clínica");
        return;
      }
    }
    toast.success("Clínica salva");
    setDialogOpen(false);
    fetchAll();
  };

  const deleteClinic = async (id: string) => {
    if (!confirm("Remover esta clínica e suas metas?")) return;
    const { error } = await supabase.from("client_clinics").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Removida");
    fetchAll();
  };

  const togglePrimary = async (c: Clinic) => {
    await supabase
      .from("client_clinics")
      .update({ is_primary: false })
      .eq("client_id", clientId);
    if (!c.is_primary) {
      await supabase
        .from("client_clinics")
        .update({ is_primary: true })
        .eq("id", c.id);
    }
    fetchAll();
  };

  const upsertGoal = async (
    clinic: Clinic,
    field: "goal_amount" | "actual_amount",
    raw: string
  ) => {
    const value = parseCurrencyInput(raw);
    const existing = goalByClinic.get(clinic.id);
    if (existing) {
      const { error } = await supabase
        .from("client_clinic_goals")
        .update({ [field]: value ?? 0 } as any)
        .eq("id", existing.id);
      if (error) {
        toast.error("Erro ao atualizar meta");
        return;
      }
    } else {
      const { error } = await supabase.from("client_clinic_goals").insert({
        clinic_id: clinic.id,
        client_id: clientId,
        account_id: accountId,
        month: currentMonth,
        goal_amount: field === "goal_amount" ? value ?? 0 : 0,
        actual_amount: field === "actual_amount" ? value : null,
        created_by: currentUser?.id,
      });
      if (error) {
        toast.error("Erro ao criar meta");
        return;
      }
    }
    fetchAll();
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">
                Clínicas ({clinics.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Meta e realizado de{" "}
                <span className="capitalize">{monthLabel}</span>
              </CardDescription>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar clínica
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {clinics.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Nenhuma clínica cadastrada. Adicione a primeira para acompanhar meta
            e realizado por unidade.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clinics.map((c) => {
              const goal = goalByClinic.get(c.id);
              const pct =
                goal && goal.goal_amount > 0 && goal.actual_amount != null
                  ? (Number(goal.actual_amount) / Number(goal.goal_amount)) * 100
                  : null;
              return (
                <div
                  key={c.id}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">
                          {c.name}
                        </span>
                        {c.is_primary && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Principal
                          </Badge>
                        )}
                      </div>
                      {(c.city || c.state) && (
                        <div className="text-[11px] text-muted-foreground">
                          {[c.city, c.state].filter(Boolean).join(" / ")}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={c.is_primary ? "Remover principal" : "Marcar principal"}
                        onClick={() => togglePrimary(c)}
                      >
                        {c.is_primary ? (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        ) : (
                          <StarOff className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteClinic(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" /> Meta
                      </Label>
                      <Input
                        inputMode="decimal"
                        defaultValue={goal?.goal_amount ? String(goal.goal_amount) : ""}
                        placeholder="0"
                        onBlur={(e) => {
                          const cur = goal?.goal_amount ?? 0;
                          const next = parseCurrencyInput(e.target.value) ?? 0;
                          if (cur !== next) upsertGoal(c, "goal_amount", e.target.value);
                        }}
                        className="h-8 mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Realizado
                      </Label>
                      <Input
                        inputMode="decimal"
                        defaultValue={
                          goal?.actual_amount != null ? String(goal.actual_amount) : ""
                        }
                        placeholder="0"
                        onBlur={(e) => {
                          const cur = goal?.actual_amount ?? null;
                          const next = parseCurrencyInput(e.target.value);
                          if (cur !== next) upsertGoal(c, "actual_amount", e.target.value);
                        }}
                        className="h-8 mt-0.5"
                      />
                    </div>
                  </div>

                  {pct != null && (
                    <div className="pt-1">
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={
                            "h-full " +
                            (pct >= 100
                              ? "bg-emerald-500"
                              : pct >= 70
                              ? "bg-amber-500"
                              : "bg-primary")
                          }
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {pct.toFixed(0)}% • {currency(Number(goal!.actual_amount))} /{" "}
                        {currency(Number(goal!.goal_amount))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar clínica" : "Nova clínica"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Ex: Clínica Centro"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={draft.city}
                  onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  maxLength={2}
                  value={draft.state}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, state: e.target.value.toUpperCase() }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft.is_primary}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, is_primary: e.target.checked }))
                }
              />
              Marcar como clínica principal
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveClinic} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
