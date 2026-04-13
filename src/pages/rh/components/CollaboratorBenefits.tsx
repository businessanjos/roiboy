import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Gift, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BENEFIT_TYPES: Record<string, string> = {
  meal_voucher: "Vale Refeição",
  food_voucher: "Vale Alimentação",
  transport: "Vale Transporte",
  health_plan: "Plano de Saúde",
  dental_plan: "Plano Odontológico",
  life_insurance: "Seguro de Vida",
  gym: "Academia/Wellhub",
  education: "Auxílio Educação",
  daycare: "Auxílio Creche",
  fuel: "Auxílio Combustível",
  home_office: "Auxílio Home Office",
  other: "Outro",
};

interface Benefit {
  id: string;
  benefit_type: string;
  provider: string | null;
  plan_name: string | null;
  value: number;
  employee_contribution: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  card_number: string | null;
  notes: string | null;
}

interface Props {
  collaboratorId: string;
  accountId: string;
}

export default function CollaboratorBenefits({ collaboratorId, accountId }: Props) {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    benefit_type: "meal_voucher", provider: "", plan_name: "",
    value: "", employee_contribution: "", start_date: "", card_number: "",
  });

  const fetchBenefits = useCallback(async () => {
    const { data } = await supabase
      .from("hr_benefits")
      .select("*")
      .eq("collaborator_id", collaboratorId)
      .order("benefit_type");
    setBenefits((data || []) as Benefit[]);
    setLoading(false);
  }, [collaboratorId]);

  useEffect(() => { fetchBenefits(); }, [fetchBenefits]);

  const handleSubmit = async () => {
    const { error } = await supabase.from("hr_benefits").insert({
      account_id: accountId,
      collaborator_id: collaboratorId,
      benefit_type: form.benefit_type,
      provider: form.provider || null,
      plan_name: form.plan_name || null,
      value: form.value ? parseFloat(form.value) : 0,
      employee_contribution: form.employee_contribution ? parseFloat(form.employee_contribution) : 0,
      start_date: form.start_date || null,
      card_number: form.card_number || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Benefício adicionado!");
    setDialogOpen(false);
    setForm({ benefit_type: "meal_voucher", provider: "", plan_name: "", value: "", employee_contribution: "", start_date: "", card_number: "" });
    fetchBenefits();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("hr_benefits").delete().eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Benefício removido");
    fetchBenefits();
  };

  const totalCost = benefits.filter(b => b.status === "active").reduce((s, b) => s + b.value, 0);
  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">{benefits.length} benefício{benefits.length !== 1 ? "s" : ""}</h3>
          {totalCost > 0 && <Badge variant="outline" className="text-xs">Custo total: {fmtCurrency(totalCost)}/mês</Badge>}
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Benefício
        </Button>
      </div>

      {benefits.length === 0 ? (
        <div className="text-center py-12">
          <Gift className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum benefício cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {benefits.map(b => (
            <div key={b.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <Gift className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{BENEFIT_TYPES[b.benefit_type] || b.benefit_type}</p>
                <p className="text-xs text-muted-foreground">
                  {b.provider && `${b.provider} • `}
                  {fmtCurrency(b.value)}/mês
                  {b.employee_contribution > 0 && ` (desconto: ${fmtCurrency(b.employee_contribution)})`}
                </p>
              </div>
              <Badge variant={b.status === "active" ? "default" : "secondary"} className="text-xs">
                {b.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover benefício?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(b.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Benefício</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.benefit_type} onValueChange={v => setForm(f => ({ ...f, benefit_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BENEFIT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fornecedor/Operadora</Label>
                <Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="Ex: Alelo" />
              </div>
              <div>
                <Label>Nome do Plano</Label>
                <Input value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor empresa (R$/mês)</Label>
                <Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
              <div>
                <Label>Desconto colaborador</Label>
                <Input type="number" value={form.employee_contribution} onChange={e => setForm(f => ({ ...f, employee_contribution: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de início</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Nº do cartão</Label>
                <Input value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
