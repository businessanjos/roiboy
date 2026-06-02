import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarketingProject, MarketingProjectStatus, PROJECT_STATUS_META } from "@/hooks/useMarketingProjects";
import { useTeamUsers } from "@/hooks/useTeamUsers";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: MarketingProject | null;
  onSubmit: (data: Partial<MarketingProject>) => void;
}

const COLORS = ["#8b5cf6", "#ef4444", "#f97316", "#eab308", "#10b981", "#06b6d4", "#3b82f6", "#ec4899"];

export function ProjectFormDialog({ open, onOpenChange, project, onSubmit }: Props) {
  const { data: users = [] } = useTeamUsers();
  const [form, setForm] = useState<Partial<MarketingProject>>({});

  useEffect(() => {
    if (open) {
      setForm(
        project ?? {
          status: "planning",
          cover_color: "#8b5cf6",
        }
      );
    }
  }, [open, project]);

  const handleChange = (k: keyof MarketingProject, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label>Nome do projeto *</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Lançamento do Livro / Congresso Internacional..."
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="O que é esse projeto, qual o objetivo, contexto importante..."
              rows={3}
            />
          </div>

          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleChange("cover_color", c)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${form.cover_color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "planning"} onValueChange={(v) => handleChange("status", v as MarketingProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_META).map(([v, m]) => (
                    <SelectItem key={v} value={v}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.owner_user_id ?? "none"} onValueChange={(v) => handleChange("owner_user_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem responsável —</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={form.start_date ?? ""} onChange={(e) => handleChange("start_date", e.target.value || null)} />
            </div>
            <div>
              <Label>Data alvo</Label>
              <Input type="date" value={form.target_date ?? ""} onChange={(e) => handleChange("target_date", e.target.value || null)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Orçamento previsto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.budget_planned ?? ""}
                onChange={(e) => handleChange("budget_planned", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div>
              <Label>Orçamento realizado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.budget_actual ?? ""}
                onChange={(e) => handleChange("budget_actual", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSubmit(form)} disabled={!form.name?.trim()}>
            {project ? "Salvar" : "Criar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
