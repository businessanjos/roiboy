import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FilePlus2, Loader2, Pencil, Trash2 } from "lucide-react";
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
    if (!confirm("Excluir este template?")) return;
    try {
      const { error } = await supabase.from("contract_templates" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/sales/contracts">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar para Contratos
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Templates de Contrato</h1>
          <p className="text-sm text-muted-foreground">
            Crie modelos por produto. As cláusulas variáveis são preenchidas automaticamente em cada deal.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <FilePlus2 className="h-4 w-4 mr-1.5" /> Novo template
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum template criado ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Variáveis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.product?.name ?? <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{(r.variables ?? []).length}</Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {r.is_default && <Badge>Padrão</Badge>}
                    {r.is_active ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="opacity-50">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(r);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        title={editing ? "Editar template" : "Novo template"}
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
    </div>
  );
};

export default SalesContractTemplates;
