import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  FilePlus2,
  Loader2,
  Pencil,
  Trash2,
  FileText,
  Search,
  Sparkles,
  Copy,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { TemplateDialog } from "@/components/sales/contracts/TemplateBuilder";
import type { TemplateVariableDef } from "@/lib/contractTemplates";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  product_id: string | null;
  content_html: string;
  variables: TemplateVariableDef[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  product?: { id: string; name: string } | null;
}

const SalesContractTemplates = () => {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [tpls, prods] = await Promise.all([
        supabase
          .from("contract_templates" as any)
          .select("*, product:products(id,name)")
          .eq("account_id", accountId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id,name")
          .eq("account_id", accountId)
          .eq("is_active", true)
          .order("name"),
      ]);
      if (tpls.error) throw tpls.error;
      if (prods.error) throw prods.error;
      setRows((tpls.data ?? []) as any);
      setProducts((prods.data ?? []) as any);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleSave = async (payload: any) => {
    if (!accountId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("contract_templates" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Template atualizado");
      } else {
        const { error } = await supabase
          .from("contract_templates" as any)
          .insert({
            ...payload,
            account_id: accountId,
            created_by: currentUser?.auth_user_id ?? null,
          });
        if (error) throw error;
        toast.success("Template criado");
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("contract_templates" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Template excluído");
      setConfirmDeleteId(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir");
    }
  };

  const handleDuplicate = async (row: TemplateRow) => {
    if (!accountId) return;
    try {
      const { error } = await supabase.from("contract_templates" as any).insert({
        account_id: accountId,
        product_id: row.product_id,
        name: `${row.name} (cópia)`,
        description: row.description,
        content_html: row.content_html,
        variables: row.variables,
        is_default: false,
        is_active: true,
        created_by: currentUser?.auth_user_id ?? null,
      });
      if (error) throw error;
      toast.success("Template duplicado");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao duplicar");
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        (r.description ?? "").toLowerCase().includes(s) ||
        (r.product?.name ?? "").toLowerCase().includes(s),
    );
  }, [rows, search]);

  return (
    <div className="container mx-auto py-6 space-y-5 max-w-[1200px]">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 h-7">
          <Link to="/sales/contracts">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Contratos
          </Link>
        </Button>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Templates de Contrato</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Modelos reutilizáveis com variáveis dinâmicas. Vincule a um produto para aplicar
              automaticamente nos deals.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            size="lg"
            className="shadow-sm"
          >
            <FilePlus2 className="h-4 w-4 mr-2" />
            Novo template
          </Button>
        </div>
      </div>

      {/* Search */}
      {rows.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, descrição ou produto..."
            className="pl-9"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 py-16 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold">Nenhum template ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Crie modelos reutilizáveis com placeholders dinâmicos e vincule a produtos para
            agilizar a geração de contratos.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" /> Criar primeiro template
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Nenhum template encontrado para "{search}".
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="group rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1">
                  {r.is_default && (
                    <Badge className="h-5 px-1.5 text-[10px]">Padrão</Badge>
                  )}
                  {!r.is_active && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] opacity-60">
                      Inativo
                    </Badge>
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-sm leading-snug line-clamp-2">{r.name}</h3>
              {r.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
              )}

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span className="truncate">{r.product?.name ?? "Sem produto vinculado"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{(r.variables ?? []).length} variável(eis)</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleDuplicate(r)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmDeleteId(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => {
                    setEditing(r);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        title={editing ? `Editar: ${editing.name}` : "Novo template"}
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? "",
                product_id: editing.product_id,
                content_html: editing.content_html,
                variables: editing.variables ?? [],
                is_default: editing.is_default,
                is_active: editing.is_active,
              }
            : undefined
        }
        products={products}
        onSave={handleSave}
        saving={saving}
      />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Contratos já gerados a partir deste template não
              serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesContractTemplates;
