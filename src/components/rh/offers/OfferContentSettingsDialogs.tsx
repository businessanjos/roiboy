import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getDefaultKpiPacks, type EditableKpiPack } from "@/constants/kpiSuggestions";
import type { OfferContentSettings } from "@/hooks/useOfferContentSettings";

function ConfirmReset({ open, onOpenChange, onConfirm, what }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; what: string }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Redefinir para o padrão?</AlertDialogTitle>
          <AlertDialogDescription>
            {what} voltam ao padrão original do sistema para toda a equipe. Cartas já criadas não mudam.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Redefinir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function KpiPacksEditorDialog({
  open, onOpenChange, current, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: EditableKpiPack[] | null;
  onSave: (packs: EditableKpiPack[] | null) => Promise<void>;
}) {
  const { toast } = useToast();
  const [packs, setPacks] = useState<EditableKpiPack[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open) setPacks(JSON.parse(JSON.stringify(current ?? getDefaultKpiPacks())));
  }, [open, current]);

  const upd = (i: number, fn: (p: EditableKpiPack) => EditableKpiPack) => setPacks((ps) => ps.map((p, idx) => (idx === i ? fn(p) : p)));

  const persist = async (value: EditableKpiPack[] | null) => {
    setSaving(true);
    try {
      await onSave(value);
      toast({ title: value ? "Sugestões salvas" : "Sugestões redefinidas para o padrão" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const clean = () =>
    packs
      .map((p) => ({ ...p, name: p.name.trim() || "Sem nome", metrics: p.metrics.filter((m) => m.label.trim()) }))
      .filter((p) => p.metrics.length || p.name !== "Sem nome");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar sugestões de métricas</DialogTitle>
          <DialogDescription>Valem para toda a equipe. Ao personalizar, todos os grupos aparecem em todas as cartas.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {packs.map((p, i) => (
            <div key={p.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={p.name} onChange={(e) => upd(i, (x) => ({ ...x, name: e.target.value }))} placeholder="Nome do grupo" className="font-medium" />
                <Button type="button" size="icon" variant="ghost" className="text-danger shrink-0" title="Excluir grupo"
                  onClick={() => setPacks((ps) => ps.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {p.metrics.map((m, j) => (
                <div key={j} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-2">
                  <Input value={m.label} placeholder="Métrica" onChange={(e) => upd(i, (x) => ({ ...x, metrics: x.metrics.map((mm, k) => (k === j ? { ...mm, label: e.target.value } : mm)) }))} />
                  <Input value={m.target} placeholder="Meta" onChange={(e) => upd(i, (x) => ({ ...x, metrics: x.metrics.map((mm, k) => (k === j ? { ...mm, target: e.target.value } : mm)) }))} />
                  <Input value={m.horizon} placeholder="Prazo" onChange={(e) => upd(i, (x) => ({ ...x, metrics: x.metrics.map((mm, k) => (k === j ? { ...mm, horizon: e.target.value } : mm)) }))} />
                  <Button type="button" size="icon" variant="ghost" className="text-danger" onClick={() => upd(i, (x) => ({ ...x, metrics: x.metrics.filter((_, k) => k !== j) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" className="gap-1 h-7 text-xs"
                onClick={() => upd(i, (x) => ({ ...x, metrics: [...x.metrics, { label: "", target: "", horizon: "" }] }))}>
                <Plus className="h-3.5 w-3.5" /> Adicionar sugestão
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="gap-1 w-full"
            onClick={() => setPacks((ps) => [...ps, { id: crypto.randomUUID(), name: "", metrics: [{ label: "", target: "", horizon: "" }] }])}>
            <Plus className="h-4 w-4" /> Novo grupo
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" className="gap-1" disabled={saving} onClick={() => setConfirm(true)}>
            <RotateCcw className="h-4 w-4" /> Redefinir para o padrão
          </Button>
          <Button type="button" disabled={saving} onClick={() => persist(clean())}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar sugestões
          </Button>
        </DialogFooter>
        <ConfirmReset open={confirm} onOpenChange={setConfirm} what="Todas as sugestões de métricas" onConfirm={() => persist(null)} />
      </DialogContent>
    </Dialog>
  );
}

type TextDefaults = Pick<OfferContentSettings, "company_intro" | "next_steps" | "signer_name" | "signer_role">;

export function OfferDefaultsDialog({
  open, onOpenChange, current, systemDefaults, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: TextDefaults;
  systemDefaults: { company_intro: string; next_steps: string };
  onSave: (v: TextDefaults) => Promise<void>;
}) {
  const { toast } = useToast();
  const [v, setV] = useState<Record<keyof TextDefaults, string>>({ company_intro: "", next_steps: "", signer_name: "", signer_role: "" });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open)
      setV({
        company_intro: current.company_intro ?? systemDefaults.company_intro,
        next_steps: current.next_steps ?? systemDefaults.next_steps,
        signer_name: current.signer_name ?? "",
        signer_role: current.signer_role ?? "",
      });
  }, [open, current, systemDefaults]);

  const persist = async (val: TextDefaults, msg: string) => {
    setSaving(true);
    try {
      await onSave(val);
      toast({ title: msg });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const nz = (s: string, sys?: string) => (s.trim() && s !== sys ? s : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Textos padrão da carta</DialogTitle>
          <DialogDescription>Vêm preenchidos em toda carta nova. Cada carta continua editável.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div><Label>Sobre a Eternum</Label><Textarea rows={6} value={v.company_intro} onChange={(e) => setV({ ...v, company_intro: e.target.value })} /></div>
          <div><Label>Próximos passos</Label><Textarea rows={5} value={v.next_steps} onChange={(e) => setV({ ...v, next_steps: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Quem assina</Label><Input value={v.signer_name} onChange={(e) => setV({ ...v, signer_name: e.target.value })} /></div>
            <div><Label>Cargo de quem assina</Label><Input value={v.signer_role} onChange={(e) => setV({ ...v, signer_role: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" className="gap-1" disabled={saving} onClick={() => setConfirm(true)}>
            <RotateCcw className="h-4 w-4" /> Redefinir para o padrão original
          </Button>
          <Button type="button" disabled={saving} onClick={() => persist({
            company_intro: nz(v.company_intro, systemDefaults.company_intro),
            next_steps: nz(v.next_steps, systemDefaults.next_steps),
            signer_name: nz(v.signer_name),
            signer_role: nz(v.signer_role),
          }, "Padrões salvos")}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar padrões
          </Button>
        </DialogFooter>
        <ConfirmReset open={confirm} onOpenChange={setConfirm} what="Os textos padrão"
          onConfirm={() => persist({ company_intro: null, next_steps: null, signer_name: null, signer_role: null }, "Textos redefinidos para o padrão")} />
      </DialogContent>
    </Dialog>
  );
}
