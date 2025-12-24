import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Package } from "lucide-react";
import { Link } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
  currentProductIds?: string[];
  onSuccess?: () => void;
}

export function ProductDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  currentProductIds = [],
  onSuccess,
}: ProductDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProducts();
      setSelectedProducts(currentProductIds);
    }
  }, [open, currentProductIds]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: userProfile } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!userProfile) throw new Error("Perfil não encontrado");

      // Remove all current products
      await supabase
        .from("client_products")
        .delete()
        .eq("client_id", clientId);

      // Add selected products
      if (selectedProducts.length > 0) {
        const productInserts = selectedProducts.map((productId) => ({
          client_id: clientId,
          product_id: productId,
          account_id: userProfile.account_id,
        }));

        const { error } = await supabase
          .from("client_products")
          .insert(productInserts);

        if (error) throw error;
      }

      toast.success("Produtos atualizados");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving products:", error);
      toast.error("Erro ao salvar produtos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos do Cliente
          </DialogTitle>
          {clientName && (
            <p className="text-sm text-muted-foreground">
              {clientName}
            </p>
          )}
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum produto cadastrado.</p>
              <Link to="/products" className="text-primary hover:underline text-sm">
                Criar produtos
              </Link>
            </div>
          ) : (
            <div className="border rounded-lg p-2 space-y-0.5 max-h-64 overflow-y-auto bg-muted/20">
              {products.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-2.5 p-2 rounded-md hover:bg-background cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleProduct(product.id)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 text-sm truncate">{product.name}</span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
