import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS, JOB_BENEFITS } from "@/constants/jobOptions";
import type { WorkModel, JobContractType, JobSeniority, HRJob } from "@/types/job";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobs: HRJob[];
  selectedIds: string[];
}

export function JobsBulkEditDialog({ open, onOpenChange, jobs, selectedIds }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [editWorkModel, setEditWorkModel] = useState(false);
  const [workModel, setWorkModel] = useState<WorkModel>("onsite");

  const [editContract, setEditContract] = useState(false);
  const [contractType, setContractType] = useState<JobContractType>("clt");

  const [editUnit, setEditUnit] = useState(false);
  const [unit, setUnit] = useState("");

  const [editSeniority, setEditSeniority] = useState(false);
  const [seniority, setSeniority] = useState<JobSeniority>("pleno");

  const [editBenefits, setEditBenefits] = useState(false);
  const [benefitsMode, setBenefitsMode] = useState<"replace" | "add">("add");
  const [benefits, setBenefits] = useState<string[]>([]);

  const toggleBenefit = (b: string) =>
    setBenefits(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const reset = () => {
    setEditWorkModel(false); setEditContract(false); setEditUnit(false);
    setEditSeniority(false); setEditBenefits(false); setBenefits([]); setUnit("");
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) { toast.error("Selecione ao menos uma vaga."); return; }
    const baseUpdate: Record<string, any> = {};
    if (editWorkModel) baseUpdate.work_model = workModel;
    if (editContract) baseUpdate.contract_type = contractType;
    if (editUnit) baseUpdate.unit = unit || null;
    if (editSeniority) baseUpdate.seniority = seniority;

    const hasBase = Object.keys(baseUpdate).length > 0;
    if (!hasBase && !editBenefits) {
      toast.error("Marque pelo menos um campo para alterar.");
      return;
    }

    setSaving(true);
    try {
      if (hasBase) {
        const { error } = await supabase.from("hr_jobs").update(baseUpdate).in("id", selectedIds);
        if (error) throw error;
      }
      if (editBenefits) {
        if (benefitsMode === "replace") {
          const { error } = await supabase.from("hr_jobs").update({ benefits }).in("id", selectedIds);
          if (error) throw error;
        } else {
          // additive: precisa mesclar por linha
          const targets = jobs.filter(j => selectedIds.includes(j.id));
          for (const j of targets) {
            const merged = Array.from(new Set([...(j.benefits || []), ...benefits]));
            const { error } = await supabase.from("hr_jobs").update({ benefits: merged }).eq("id", j.id);
            if (error) throw error;
          }
        }
      }
      toast.success(`${selectedIds.length} vaga(s) atualizada(s)`);
      qc.invalidateQueries({ queryKey: ["hr-jobs"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar {selectedIds.length} vaga(s) em lote</DialogTitle>
          <DialogDescription>
            Marque os campos que deseja sobrescrever. Campos não marcados permanecem como estão em cada vaga.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5">
            {/* Modelo */}
            <FieldRow checked={editWorkModel} onChange={setEditWorkModel} label="Modelo de trabalho">
              <Select value={workModel} onValueChange={v => setWorkModel(v as WorkModel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(WORK_MODEL_LABELS) as [WorkModel, string][]).map(([v, l]) =>
                    <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>

            {/* Contrato */}
            <FieldRow checked={editContract} onChange={setEditContract} label="Regime de contratação">
              <Select value={contractType} onValueChange={v => setContractType(v as JobContractType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CONTRACT_TYPE_LABELS) as [JobContractType, string][]).map(([v, l]) =>
                    <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>

            {/* Localização */}
            <FieldRow checked={editUnit} onChange={setEditUnit} label="Localização">
              <Input placeholder="Ex: São Paulo - SP" value={unit} onChange={e => setUnit(e.target.value)} />
            </FieldRow>

            {/* Senioridade */}
            <FieldRow checked={editSeniority} onChange={setEditSeniority} label="Senioridade">
              <Select value={seniority} onValueChange={v => setSeniority(v as JobSeniority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(JOB_SENIORITY_LABELS) as [JobSeniority, string][]).map(([v, l]) =>
                    <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>

            <Separator />

            {/* Benefícios */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="editBenefits" checked={editBenefits} onCheckedChange={v => setEditBenefits(!!v)} />
                <Label htmlFor="editBenefits" className="font-medium">O que oferecemos (benefícios)</Label>
              </div>
              {editBenefits && (
                <div className="pl-6 space-y-3">
                  <RadioGroup value={benefitsMode} onValueChange={v => setBenefitsMode(v as "replace" | "add")} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="add" id="bm-add" />
                      <Label htmlFor="bm-add" className="font-normal">Adicionar aos existentes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="replace" id="bm-replace" />
                      <Label htmlFor="bm-replace" className="font-normal">Substituir lista inteira</Label>
                    </div>
                  </RadioGroup>
                  <div className="flex flex-wrap gap-2">
                    {JOB_BENEFITS.map(b => {
                      const active = benefits.includes(b);
                      return (
                        <Badge key={b} variant={active ? "default" : "outline"}
                          className="cursor-pointer" onClick={() => toggleBenefit(b)}>
                          {b}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Aplicando..." : `Aplicar em ${selectedIds.length} vaga(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ checked, onChange, label, children }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id={label} checked={checked} onCheckedChange={v => onChange(!!v)} />
        <Label htmlFor={label} className="font-medium">{label}</Label>
      </div>
      {checked && <div className="pl-6">{children}</div>}
    </div>
  );
}
