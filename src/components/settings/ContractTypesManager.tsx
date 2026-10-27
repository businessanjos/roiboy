import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  BUILT_IN_CONTRACT_TYPES,
  slugifyContractType,
  useCustomContractTypes,
} from "@/hooks/useContractTypes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Lock, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ContractTypesManager() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();
  const { data: custom = [], isLoading } = useCustomContractTypes();
  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["contract-type-options"] });

  const add = async () => {
    const label = newLabel.trim();
    if (!label || !accountId) return;
    let value = slugifyContractType(label);
    if (!value) return toast.error("Nome inválido");
    const taken = new Set([...BUILT_IN_CONTRACT_TYPES, ...custom].map((t) => t.value));
    if (BUILT_IN_CONTRACT_TYPES.some((t) => t.label.toLowerCase() === label.toLowerCase()) ||
        custom.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      return toast.error("Esse tipo já existe");
    }
    let i = 2;
    const base = value;
    while (taken.has(value)) value = `${base}_${i++}`;
    setSaving(true);
    const { error } = await supabase.from("contract_type_options").insert({
      account_id: accountId,
      value,
      label,
      display_order: custom.length,
    });
    setSaving(false);
    if (error) return toast.error("Não foi possível adicionar");
    setNewLabel("");
    toast.success("Tipo adicionado");
    refresh();
  };

  const rename = async (id: string) => {
    const label = (editing[id] || "").trim();
    if (!label) return;
    const { error } = await supabase.from("contract_type_options").update({ label }).eq("id", id);
    if (error) return toast.error("Não foi possível renomear");
    setEditing((e) => { const n = { ...e }; delete n[id]; return n; });
    refresh();
  };

  const toggle = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("contract_type_options").update({ is_active }).eq("id", id);
    if (error) return toast.error("Não foi possível atualizar");
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de Contrato</CardTitle>
        <CardDescription>
          Tipos disponíveis ao criar ou editar contratos. Os tipos padrão não podem ser alterados;
          os personalizados podem ser renomeados ou desativados (contratos antigos continuam com o nome).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Novo tipo de contrato"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={!newLabel.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {BUILT_IN_CONTRACT_TYPES.map((t) => (
            <div key={t.value} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm">{t.label}</span>
              <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" />Padrão</Badge>
            </div>
          ))}
          {isLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Carregando…</div>}
          {custom.map((t) => {
            const draft = editing[t.id];
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <Input
                  className="h-8 max-w-xs flex-1"
                  value={draft ?? t.label}
                  onChange={(e) => setEditing((s) => ({ ...s, [t.id]: e.target.value }))}
                  onBlur={() => draft !== undefined && draft !== t.label && rename(t.id)}
                  onKeyDown={(e) => e.key === "Enter" && rename(t.id)}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {t.is_active ? "Ativo" : "Inativo"}
                  <Switch checked={t.is_active} onCheckedChange={(v) => toggle(t.id, v)} />
                </label>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
