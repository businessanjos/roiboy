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
import { Save, Plus, Paperclip } from "lucide-react";
import { FinancialEmptyState } from "@/components/financial/_shared/FinancialEmptyState";

interface Form {
  nome: string;
  escritorio: string;
  crc: string;
  telefone: string;
  email: string;
  whatsapp: string;
  honorario_brl: string;
  frequencia: string;
  observacoes: string;
}
const empty: Form = {
  nome: "", escritorio: "", crc: "", telefone: "", email: "", whatsapp: "",
  honorario_brl: "", frequencia: "", observacoes: "",
};

export function AccountantTab({ omieSettingsId }: { omieSettingsId: string }) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteAnexo, setNoteAnexo] = useState("");

  const { data: accountant } = useQuery({
    queryKey: ["accountant", omieSettingsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_accountant")
        .select("*")
        .eq("omie_settings_id", omieSettingsId)
        .maybeSingle();
      return data;
    },
  });

  const { data: interactions } = useQuery({
    enabled: !!accountant?.id,
    queryKey: ["accountant-interactions", accountant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_accountant_interactions")
        .select("id, ocorrido_em, nota, anexo_url")
        .eq("accountant_id", accountant!.id)
        .order("ocorrido_em", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (accountant) {
      setForm({
        nome: accountant.nome ?? "",
        escritorio: accountant.escritorio ?? "",
        crc: accountant.crc ?? "",
        telefone: accountant.telefone ?? "",
        email: accountant.email ?? "",
        whatsapp: accountant.whatsapp ?? "",
        honorario_brl: accountant.honorario_brl != null ? String(accountant.honorario_brl) : "",
        frequencia: accountant.frequencia ?? "",
        observacoes: accountant.observacoes ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [accountant, omieSettingsId]);

  const save = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);
    try {
      const payload = {
        account_id: currentUser.account_id,
        omie_settings_id: omieSettingsId,
        nome: form.nome || null,
        escritorio: form.escritorio || null,
        crc: form.crc || null,
        telefone: form.telefone || null,
        email: form.email || null,
        whatsapp: form.whatsapp || null,
        honorario_brl: form.honorario_brl ? Number(form.honorario_brl.replace(",", ".")) : null,
        frequencia: form.frequencia || null,
        observacoes: form.observacoes || null,
      };
      const { error } = await supabase
        .from("financial_accountant")
        .upsert([payload as any], { onConflict: "omie_settings_id" });
      if (error) throw error;
      toast({ title: "Contador salvo." });
      qc.invalidateQueries({ queryKey: ["accountant", omieSettingsId] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addInteraction = async () => {
    if (!accountant?.id || !currentUser?.account_id || !newNote.trim()) return;
    const { error } = await supabase.from("financial_accountant_interactions").insert([{
      account_id: currentUser.account_id,
      accountant_id: accountant.id,
      nota: newNote.trim(),
      anexo_url: noteAnexo.trim() || null,
      created_by: currentUser.id,
    } as any]);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setNewNote("");
    setNoteAnexo("");
    qc.invalidateQueries({ queryKey: ["accountant-interactions", accountant.id] });
  };

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contador da empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome"><Input value={form.nome} onChange={(e) => set("nome")(e.target.value)} /></Field>
            <Field label="Escritório"><Input value={form.escritorio} onChange={(e) => set("escritorio")(e.target.value)} /></Field>
            <Field label="CRC"><Input value={form.crc} onChange={(e) => set("crc")(e.target.value)} /></Field>
            <Field label="Honorário mensal (R$)"><Input value={form.honorario_brl} onChange={(e) => set("honorario_brl")(e.target.value)} placeholder="0,00" /></Field>
            <Field label="Telefone"><Input value={form.telefone} onChange={(e) => set("telefone")(e.target.value)} /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => set("whatsapp")(e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} /></Field>
            <Field label="Frequência esperada">
              <Select value={form.frequencia} onValueChange={set("frequencia")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="sob_demanda">Sob demanda</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Observações">
            <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes")(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de interações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {accountant?.id ? (
            <>
              <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                <Textarea
                  rows={2}
                  placeholder="Anotação sobre a última conversa, pendência, dúvida enviada…"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="URL do anexo (opcional)"
                    value={noteAnexo}
                    onChange={(e) => setNoteAnexo(e.target.value)}
                  />
                  <Button onClick={addInteraction} disabled={!newNote.trim()} size="sm">
                    <Plus className="h-4 w-4 mr-1" />Adicionar
                  </Button>
                </div>
              </div>
              {(interactions ?? []).length === 0 ? (
                <FinancialEmptyState compact title="Nenhuma interação registrada" description="Use este espaço para timeline simples com o contador." />
              ) : (
                <ul className="space-y-2">
                  {interactions!.map((i) => (
                    <li key={i.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{new Date(i.ocorrido_em).toLocaleString("pt-BR")}</span>
                        {i.anexo_url && (
                          <a className="inline-flex items-center gap-1 hover:underline" href={i.anexo_url} target="_blank" rel="noreferrer">
                            <Paperclip className="h-3 w-3" />anexo
                          </a>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{i.nota}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <FinancialEmptyState compact title="Salve os dados do contador primeiro" description="Após salvar, o histórico de interações ficará disponível." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
