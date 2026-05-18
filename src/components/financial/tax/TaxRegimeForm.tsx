import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "@/hooks/use-toast";
import { Save, Search, Loader2 } from "lucide-react";

const REGIMES = [
  { value: "mei", label: "MEI" },
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
];

const ANEXOS = ["I", "II", "III", "IV", "V"];

interface Form {
  regime: string;
  simples_annex: string;
  cnae_principal: string;
  cnaes_secundarios: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  atividade: string;
  opcao_regime_em: string;
  observacoes: string;
}

const empty: Form = {
  regime: "",
  simples_annex: "",
  cnae_principal: "",
  cnaes_secundarios: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  atividade: "",
  opcao_regime_em: "",
  observacoes: "",
};

export function TaxRegimeForm({ omieSettingsId }: { omieSettingsId: string }) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["tax-profile-full", omieSettingsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_tax_profile")
        .select("*")
        .eq("omie_settings_id", omieSettingsId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        regime: data.regime ?? "",
        simples_annex: data.simples_annex ?? "",
        cnae_principal: data.cnae_principal ?? "",
        cnaes_secundarios: (data.cnaes_secundarios ?? []).join(", "),
        inscricao_estadual: data.inscricao_estadual ?? "",
        inscricao_municipal: data.inscricao_municipal ?? "",
        atividade: data.atividade ?? "",
        opcao_regime_em: data.opcao_regime_em ?? "",
        observacoes: data.observacoes ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [data, omieSettingsId]);

  const save = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);
    try {
      const payload = {
        account_id: currentUser.account_id,
        omie_settings_id: omieSettingsId,
        regime: form.regime || null,
        simples_annex: form.regime === "simples_nacional" ? (form.simples_annex || null) : null,
        cnae_principal: form.cnae_principal || null,
        cnaes_secundarios: form.cnaes_secundarios
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        inscricao_estadual: form.inscricao_estadual || null,
        inscricao_municipal: form.inscricao_municipal || null,
        atividade: form.atividade || null,
        opcao_regime_em: form.opcao_regime_em || null,
        observacoes: form.observacoes || null,
      };
      const { error } = await supabase
        .from("financial_tax_profile")
        .upsert([payload as any], { onConflict: "omie_settings_id" });
      if (error) throw error;
      toast({ title: "Perfil tributário salvo." });
      qc.invalidateQueries({ queryKey: ["tax-profile", omieSettingsId] });
      qc.invalidateQueries({ queryKey: ["tax-profile-full", omieSettingsId] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regime tributário & dados da empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Regime</Label>
            <Select value={form.regime} onValueChange={set("regime")}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {REGIMES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.regime === "simples_nacional" && (
            <div className="space-y-1.5">
              <Label>Anexo do Simples</Label>
              <Select value={form.simples_annex} onValueChange={set("simples_annex")}>
                <SelectTrigger><SelectValue placeholder="Anexo" /></SelectTrigger>
                <SelectContent>
                  {ANEXOS.map((a) => <SelectItem key={a} value={a}>Anexo {a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>CNAE principal</Label>
            <Input value={form.cnae_principal} onChange={(e) => set("cnae_principal")(e.target.value)} placeholder="Ex: 8650-0/04" />
          </div>
          <div className="space-y-1.5">
            <Label>CNAEs secundários</Label>
            <Input value={form.cnaes_secundarios} onChange={(e) => set("cnaes_secundarios")(e.target.value)} placeholder="separe por vírgula" />
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição estadual</Label>
            <Input value={form.inscricao_estadual} onChange={(e) => set("inscricao_estadual")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição municipal</Label>
            <Input value={form.inscricao_municipal} onChange={(e) => set("inscricao_municipal")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Atividade preponderante</Label>
            <Input value={form.atividade} onChange={(e) => set("atividade")(e.target.value)} placeholder="Serviços, comércio, indústria, misto" />
          </div>
          <div className="space-y-1.5">
            <Label>Data da opção/troca de regime</Label>
            <Input type="date" value={form.opcao_regime_em} onChange={(e) => set("opcao_regime_em")(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes")(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
