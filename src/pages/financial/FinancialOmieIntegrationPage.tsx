import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFinancialCompany, OmieCompany } from "@/contexts/FinancialCompanyContext";
import { OmieIntegrationTab } from "@/components/integrations/OmieIntegrationTab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  Star,
  Trash2,
  XCircle,
  ArrowDownToLine,
  Pencil,
} from "lucide-react";

function formatCnpj(cnpj?: string | null) {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function FinancialOmieIntegrationPage() {
  const { currentUser } = useCurrentUser();
  const { companies, selected, selectedId, setSelectedId, refresh, loading } = useFinancialCompany();
  const { toast } = useToast();
  const [pulling, setPulling] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSyncEntries = async () => {
    if (!selectedId) {
      toast({ title: "Selecione um CNPJ", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("omie-sync-entries", {
        body: { company_id: selectedId, months_back: 12, months_forward: 12 },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      toast({
        title: "Sincronização Omie concluída",
        description: r
          ? `${r.totalReceber || 0} recebíveis · ${r.totalPagar || 0} a pagar${r.errors?.length ? ` · ${r.errors.length} erros` : ""}`
          : "Sem dados",
      });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handlePullFromOmie = async () => {
    if (!currentUser?.account_id || !selectedId) return;
    setPulling(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-omie", {
        body: {
          account_id: currentUser.account_id,
          company_id: selectedId,
          sync_all: true,
          enrich_data: true,
          use_cpf_cnpj: true,
        },
      });
      if (error) throw error;
      toast({
        title: "Importação concluída",
        description: `${data?.synced || 0} sincronizados · ${data?.enriched || 0} enriquecidos · ${data?.errors || 0} erros`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao importar do Omie", description: err.message, variant: "destructive" });
    } finally {
      setPulling(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    const { error } = await supabase.from("omie_settings").update({ is_default: true }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "CNPJ padrão atualizado" });
    refresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("omie_settings").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "CNPJ removido" });
    if (selectedId === id) setSelectedId(null);
    refresh();
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            Integração Omie ↔ ROY
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte um ou mais CNPJs Omie. Cada CNPJ tem suas próprias credenciais e dados isolados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSyncEntries} disabled={syncing || !selectedId} variant="outline">
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
            Sincronizar lançamentos agora
          </Button>
          <AddCompanyDialog accountId={currentUser?.account_id} onCreated={refresh} />
        </div>
      </div>

      {/* Lista de CNPJs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Empresas conectadas ({companies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-4">Carregando...</div>
          ) : companies.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum CNPJ conectado. Clique em "Adicionar CNPJ" no topo para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {companies.map((c) => (
                <CompanyRow
                  key={c.id}
                  company={c}
                  isSelected={c.id === selectedId}
                  onSelect={() => setSelectedId(c.id)}
                  onSetDefault={() => handleSetDefault(c.id)}
                  onDelete={() => handleDelete(c.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <>
          {/* Sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
                Importar dados do CNPJ selecionado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Busca clientes e títulos no Omie, atualiza cadastros e contas a receber/pagar do ROY.
              </p>
              <Button onClick={handlePullFromOmie} disabled={pulling || !selected.has_credentials}>
                {pulling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Sincronizar agora ({selected.trade_name || formatCnpj(selected.cnpj)})
              </Button>
              {!selected.has_credentials && (
                <p className="text-xs text-destructive">Configure as credenciais Omie abaixo antes de importar.</p>
              )}
            </CardContent>
          </Card>

          <Separator />

          <div>
            <h2 className="text-lg font-semibold mb-1">Configuração & mapeamento</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Editando: <strong>{selected.trade_name || selected.legal_name || formatCnpj(selected.cnpj)}</strong>
            </p>
            <OmieIntegrationTab key={selected.id} settingsId={selected.id} />
          </div>
        </>
      )}
    </div>
  );
}

function CompanyRow({
  company,
  isSelected,
  onSelect,
  onSetDefault,
  onDelete,
}: {
  company: OmieCompany;
  isSelected: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [trade, setTrade] = useState(company.trade_name || "");
  const [legal, setLegal] = useState(company.legal_name || "");
  const [savingName, setSavingName] = useState(false);

  const saveName = async () => {
    setSavingName(true);
    const { error } = await supabase
      .from("omie_settings")
      .update({ trade_name: trade || null, legal_name: legal || null })
      .eq("id", company.id);
    setSavingName(false);
    if (error) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nome atualizado" });
    setEditing(false);
    // refresh handled by parent via realtime/refetch on next interaction; trigger via custom event
    window.dispatchEvent(new CustomEvent("omie-companies-refresh"));
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-muted/50 ${
        isSelected ? "border-primary bg-primary/5" : ""
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: (company.color || "#3b82f6") + "20" }}
        >
          <Building2 className="h-4 w-4" style={{ color: company.color || "#3b82f6" }} />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="Nome fantasia"
                className="h-8 w-40"
              />
              <Input
                value={legal}
                onChange={(e) => setLegal(e.target.value)}
                placeholder="Razão social"
                className="h-8 w-56"
              />
              <Button size="sm" onClick={saveName} disabled={savingName}>
                {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {company.trade_name || company.legal_name || formatCnpj(company.cnpj) || "Sem nome"}
              </span>
              {company.is_default && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  <Star className="h-2.5 w-2.5 mr-0.5 fill-current" /> padrão
                </Badge>
              )}
              {company.has_credentials ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 text-[10px] py-0 px-1.5">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                  <XCircle className="h-2.5 w-2.5 mr-0.5" /> sem credenciais
                </Badge>
              )}
              {company.is_enabled && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  automação ativa
                </Badge>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{formatCnpj(company.cnpj)}</div>
        </div>
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="Renomear">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {!company.is_default && (
          <Button size="sm" variant="ghost" onClick={onSetDefault} title="Definir como padrão">
            <Star className="h-4 w-4" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover este CNPJ?</AlertDialogTitle>
              <AlertDialogDescription>
                As credenciais Omie serão removidas. Lançamentos já importados continuam no sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function AddCompanyDialog({ accountId, onCreated }: { accountId?: string; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cnpj: "",
    legal_name: "",
    trade_name: "",
    app_key: "",
    app_secret: "",
    color: COLORS[0],
  });

  const reset = () =>
    setForm({ cnpj: "", legal_name: "", trade_name: "", app_key: "", app_secret: "", color: COLORS[0] });

  const handleSave = async () => {
    if (!accountId) return;
    if (!form.cnpj.replace(/\D/g, "")) {
      toast({ title: "CNPJ obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("omie_settings").insert({
        account_id: accountId,
        cnpj: form.cnpj.replace(/\D/g, ""),
        legal_name: form.legal_name || null,
        trade_name: form.trade_name || null,
        color: form.color,
        app_key: form.app_key,
        app_secret: form.app_secret,
        is_enabled: false,
        is_default: false,
      });
      if (error) throw error;
      toast({ title: "CNPJ adicionado" });
      reset();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Adicionar CNPJ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar empresa Omie</DialogTitle>
          <DialogDescription>
            Cadastre as credenciais de uma nova empresa/CNPJ Omie. Você pode configurar mapeamentos depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-1 mt-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-6 w-6 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label>Razão social</Label>
            <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} placeholder="Eternum Mentoring Club Ltda" />
          </div>
          <div>
            <Label>Nome fantasia</Label>
            <Input value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} placeholder="Eternum Club" />
          </div>
          <Separator />
          <div>
            <Label>Omie App Key</Label>
            <Input value={form.app_key} onChange={(e) => setForm({ ...form, app_key: e.target.value })} />
          </div>
          <div>
            <Label>Omie App Secret</Label>
            <Input type="password" value={form.app_secret} onChange={(e) => setForm({ ...form, app_secret: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Encontre as credenciais em Omie → Configurações → Aplicativos → Sua aplicação.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
