import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Pencil, Plus, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TemplateDialog } from "@/components/sales/contracts/TemplateBuilder";
import type { TemplateVariableDef } from "@/lib/contractTemplates";

interface ProductContractTabProps {
  productId: string | null;
  productName: string;
  accountId: string;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  product_id: string | null;
  content_html: string;
  variables: TemplateVariableDef[];
  is_default: boolean;
  is_active: boolean;
}

export const ProductContractTab = ({ productId, productName, accountId }: ProductContractTabProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    if (!productId || !accountId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contract_templates" as any)
        .select("*")
        .eq("account_id", accountId)
        .eq("product_id", productId)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      setRows((data ?? []) as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, accountId]);

  const handleSave = async (payload: any) => {
    if (!accountId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("contract_templates" as any)
          .update({ ...payload, product_id: productId })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Template atualizado");
      } else {
        const { error } = await supabase
          .from("contract_templates" as any)
          .insert({ ...payload, product_id: productId, account_id: accountId });
        if (error) throw error;
        toast.success("Template criado");
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (!productId) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Salve o produto antes de cadastrar templates de contrato.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Templates vinculados a <span className="font-medium text-foreground">{productName}</span>.
            O template padrão é aplicado automaticamente quando este produto é selecionado em um deal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/sales/contracts/templates" target="_blank">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Todos os templates
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Novo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          Nenhum template ainda. Crie o primeiro modelo do contrato deste produto.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  {r.is_default && <Badge>Padrão</Badge>}
                  {!r.is_active && (
                    <Badge variant="outline" className="opacity-60">
                      Inativo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(r.variables ?? []).length} variável(eis)
                  {r.description ? ` • ${r.description}` : ""}
                </p>
              </div>
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
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        title={editing ? "Editar template" : `Novo template para ${productName}`}
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
            : { product_id: productId }
        }
        products={[{ id: productId, name: productName }]}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
};
