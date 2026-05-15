import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  TrendingUp,
  Building2,
  Users,
  Calendar,
  Sparkles,
  Plus,
  Award,
  Gift,
  Camera,
  Heart,
  Crown,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
  Bot,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MilestoneType =
  | "first_million"
  | "record_month"
  | "expansion"
  | "hundred_patients_month"
  | "two_years"
  | "custom";

interface Milestone {
  id: string;
  milestone_type: MilestoneType;
  title: string;
  achieved_at: string;
  value: number | null;
  value_label: string | null;
  notes: string | null;
  cover_url: string | null;
  done_recognition: boolean;
  done_symbol: boolean;
  done_prize: boolean;
  done_experience: boolean;
  done_post: boolean;
  done_status: boolean;
  auto_detected: boolean;
}

const MILESTONE_META: Record<
  MilestoneType,
  { label: string; icon: typeof Trophy; gradient: string; ring: string; accent: string }
> = {
  first_million: {
    label: "Primeiro milhão",
    icon: Trophy,
    gradient: "from-amber-500/20 via-amber-400/10 to-yellow-300/5",
    ring: "ring-amber-500/40",
    accent: "text-amber-500",
  },
  record_month: {
    label: "Mês recorde",
    icon: TrendingUp,
    gradient: "from-emerald-500/20 via-emerald-400/10 to-teal-300/5",
    ring: "ring-emerald-500/40",
    accent: "text-emerald-500",
  },
  expansion: {
    label: "Expansão",
    icon: Building2,
    gradient: "from-violet-500/20 via-purple-400/10 to-fuchsia-300/5",
    ring: "ring-violet-500/40",
    accent: "text-violet-500",
  },
  hundred_patients_month: {
    label: "100 pacientes/mês",
    icon: Users,
    gradient: "from-sky-500/20 via-blue-400/10 to-cyan-300/5",
    ring: "ring-sky-500/40",
    accent: "text-sky-500",
  },
  two_years: {
    label: "Permanência",
    icon: Calendar,
    gradient: "from-rose-500/20 via-pink-400/10 to-orange-300/5",
    ring: "ring-rose-500/40",
    accent: "text-rose-500",
  },
  custom: {
    label: "Conquista",
    icon: Sparkles,
    gradient: "from-primary/20 via-primary/10 to-primary/5",
    ring: "ring-primary/40",
    accent: "text-primary",
  },
};

const CHECKLIST_ITEMS: { key: keyof Milestone; label: string; icon: typeof Award }[] = [
  { key: "done_recognition", label: "Reconhecimento", icon: Award },
  { key: "done_symbol", label: "Símbolo", icon: Crown },
  { key: "done_prize", label: "Prêmio", icon: Gift },
  { key: "done_experience", label: "Experiência", icon: Heart },
  { key: "done_post", label: "Postagem", icon: Camera },
  { key: "done_status", label: "Status", icon: Sparkles },
];

interface Props {
  clientId: string;
}

export function ClientMilestones({ clientId }: Props) {
  const { currentUser } = useCurrentUser();
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_milestones")
      .select("*")
      .eq("client_id", clientId)
      .order("achieved_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar marcos");
    } else {
      setItems((data || []) as Milestone[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const completion = (m: Milestone) => {
    const total = CHECKLIST_ITEMS.length;
    const done = CHECKLIST_ITEMS.filter((c) => m[c.key]).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  };

  const stats = useMemo(() => {
    const total = items.length;
    const fullyCelebrated = items.filter((m) => completion(m).pct === 100).length;
    return { total, fullyCelebrated };
  }, [items]);

  const toggleCheck = async (m: Milestone, key: keyof Milestone) => {
    const newVal = !m[key];
    setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, [key]: newVal } : x)));
    const { error } = await supabase
      .from("client_milestones")
      .update({ [key]: newVal } as any)
      .eq("id", m.id);
    if (error) {
      toast.error("Erro ao salvar");
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este marco?")) return;
    const { error } = await supabase.from("client_milestones").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
    else {
      toast.success("Marco removido");
      load();
    }
  };

  // bento sizes — alterna pra dar dinamismo
  const bentoSize = (i: number, total: number) => {
    if (total === 1) return "md:col-span-3 md:row-span-2";
    if (i === 0) return "md:col-span-2 md:row-span-2";
    if (i === 3) return "md:col-span-2";
    return "";
  };

  return (
    <div className="space-y-4">
      {/* Header com stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Hall da Fama</h3>
            <p className="text-xs text-muted-foreground">
              {stats.total} {stats.total === 1 ? "marco conquistado" : "marcos conquistados"}
              {stats.fullyCelebrated > 0 &&
                ` · ${stats.fullyCelebrated} totalmente celebrado${stats.fullyCelebrated > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar marco
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Trophy className="h-7 w-7 text-muted-foreground" />
          </div>
          <h4 className="font-semibold mb-1">Nenhum marco ainda</h4>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Marcos vindos da Clínica Ryka aparecerão aqui automaticamente. Você também pode
            registrar conquistas manualmente.
          </p>
          <Button onClick={() => setCreating(true)} variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Registrar primeiro marco
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 auto-rows-[180px]">
          {items.map((m, i) => {
            const meta = MILESTONE_META[m.milestone_type];
            const Icon = meta.icon;
            const c = completion(m);
            const isHero = i === 0 && items.length > 1;

            return (
              <Card
                key={m.id}
                className={cn(
                  "group relative overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5",
                  "bg-gradient-to-br border-2",
                  meta.gradient,
                  c.pct === 100 ? `ring-2 ${meta.ring}` : "ring-1 ring-border",
                  bentoSize(i, items.length)
                )}
                onClick={() => setEditing(m)}
              >
                {/* shimmer */}
                {c.pct === 100 && (
                  <div className="absolute -top-1/2 -right-1/2 h-full w-full bg-gradient-to-br from-white/10 to-transparent rotate-12 pointer-events-none" />
                )}

                <div className="relative h-full p-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center",
                        meta.accent
                      )}
                    >
                      <Icon className={cn(isHero ? "h-6 w-6" : "h-5 w-5")} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {m.auto_detected && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] gap-1 bg-background/60 backdrop-blur"
                        >
                          <Bot className="h-3 w-3" />
                          Auto
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {format(new Date(m.achieved_at + "T00:00:00"), "MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {meta.label}
                    </p>
                    <h4 className={cn("font-bold leading-tight", isHero ? "text-2xl" : "text-base")}>
                      {m.title}
                    </h4>
                    {m.value_label && (
                      <p className={cn("font-semibold", meta.accent, isHero ? "text-xl" : "text-sm")}>
                        {m.value_label}
                      </p>
                    )}
                  </div>

                  {/* progress de celebração */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground font-medium">
                        Celebração {c.done}/{c.total}
                      </span>
                      {c.pct === 100 && (
                        <span className={cn("flex items-center gap-1 font-semibold", meta.accent)}>
                          <CheckCircle2 className="h-3 w-3" />
                          Completo
                        </span>
                      )}
                    </div>
                    <div className="h-1 bg-background/40 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all bg-gradient-to-r",
                          meta.gradient.replace(/\/\d+/g, "").replace("from-", "from-").replace("via-", "via-").replace("to-", "to-")
                        )}
                        style={{
                          width: `${c.pct}%`,
                          backgroundImage: `linear-gradient(to right, currentColor, currentColor)`,
                        }}
                      >
                        <div className={cn("h-full w-full", meta.accent.replace("text-", "bg-"))} />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor / Detail dialog */}
      <MilestoneEditor
        open={!!editing || creating}
        milestone={editing}
        clientId={clientId}
        accountId={currentUser?.account_id || null}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={load}
        onDelete={handleDelete}
        onToggle={toggleCheck}
      />
    </div>
  );
}

interface EditorProps {
  open: boolean;
  milestone: Milestone | null;
  clientId: string;
  accountId: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => void;
  onToggle: (m: Milestone, key: keyof Milestone) => void;
}

function MilestoneEditor({
  open,
  milestone,
  clientId,
  accountId,
  onClose,
  onSaved,
  onDelete,
  onToggle,
}: EditorProps) {
  const [type, setType] = useState<MilestoneType>("custom");
  const [title, setTitle] = useState("");
  const [achievedAt, setAchievedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [valueLabel, setValueLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (milestone) {
      setType(milestone.milestone_type);
      setTitle(milestone.title);
      setAchievedAt(milestone.achieved_at);
      setValueLabel(milestone.value_label || "");
      setNotes(milestone.notes || "");
    } else {
      setType("custom");
      setTitle("");
      setAchievedAt(format(new Date(), "yyyy-MM-dd"));
      setValueLabel("");
      setNotes("");
    }
  }, [milestone, open]);

  const handleSave = async () => {
    if (!accountId) {
      toast.error("Conta não identificada");
      return;
    }
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      milestone_type: type,
      achieved_at: achievedAt,
      value_label: valueLabel.trim() || null,
      notes: notes.trim() || null,
    };

    if (milestone) {
      const { error } = await supabase
        .from("client_milestones")
        .update(payload)
        .eq("id", milestone.id);
      if (error) toast.error("Erro ao atualizar");
      else {
        toast.success("Marco atualizado");
        onSaved();
        onClose();
      }
    } else {
      const { error } = await supabase.from("client_milestones").insert({
        ...payload,
        client_id: clientId,
        account_id: accountId,
        auto_detected: false,
      });
      if (error) toast.error("Erro ao criar marco");
      else {
        toast.success("Marco registrado!");
        onSaved();
        onClose();
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {milestone ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {milestone ? "Editar marco" : "Registrar marco"}
          </DialogTitle>
          <DialogDescription>
            {milestone
              ? "Atualize informações e marque o que já foi feito para celebrar."
              : "Registre uma conquista importante deste cliente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as MilestoneType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MILESTONE_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <meta.icon className={cn("h-3.5 w-3.5", meta.accent)} />
                        {meta.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={achievedAt}
                onChange={(e) => setAchievedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Primeiro milhão faturado"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor / Indicador (opcional)</Label>
            <Input
              value={valueLabel}
              onChange={(e) => setValueLabel(e.target.value)}
              placeholder="Ex: R$ 1.230.000 ou 100 pacientes"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Detalhes da conquista..."
            />
          </div>

          {milestone && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Checklist de celebração
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {CHECKLIST_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const checked = milestone[item.key] as boolean;
                  return (
                    <label
                      key={String(item.key)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm",
                        checked
                          ? "bg-primary/5 border-primary/30"
                          : "hover:bg-muted/50 border-border"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => onToggle(milestone, item.key)}
                      />
                      <Icon className={cn("h-3.5 w-3.5", checked ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn(checked && "font-medium")}>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {milestone ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onDelete(milestone.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remover
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
