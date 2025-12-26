import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Package, 
  Edit2, 
  Trash2,
  Loader2,
  DollarSign,
  Award,
  Lock
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { toast } from "sonner";
import { getMlsBadgeClasses, getMlsLevelLabel, MLS_LEVELS } from "@/lib/mls-utils";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: "monthly" | "quarterly" | "semiannual" | "annual" | "one_time";
  is_active: boolean;
  is_mls: boolean;
  mls_level: string | null;
  color: string | null;
  created_at: string;
}

const COLOR_OPTIONS = [
  { value: "#10b981", label: "Verde", class: "bg-emerald-500" },
  { value: "#3b82f6", label: "Azul", class: "bg-blue-500" },
  { value: "#8b5cf6", label: "Roxo", class: "bg-violet-500" },
  { value: "#f59e0b", label: "Laranja", class: "bg-amber-500" },
  { value: "#ef4444", label: "Vermelho", class: "bg-red-500" },
  { value: "#ec4899", label: "Rosa", class: "bg-pink-500" },
  { value: "#06b6d4", label: "Ciano", class: "bg-cyan-500" },
  { value: "#6b7280", label: "Cinza", class: "bg-gray-500" },
];

// Using shared MLS_LEVELS from mls-utils

const billingPeriodLabels = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  one_time: "Único",
};

export default function Products() {
  const { currentUser } = useCurrentUser();
  const { canCreate } = usePlanLimits();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<string>("monthly");
  const [isActive, setIsActive] = useState(true);
  const [isMls, setIsMls] = useState(false);
  const [mlsLevel, setMlsLevel] = useState<string>("");
  const [color, setColor] = useState<string>("#10b981");

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setBillingPeriod("monthly");
    setIsActive(true);
    setIsMls(false);
    setMlsLevel("");
    setColor("#10b981");
    setEditingId(null);
  };

  const openEditDialog = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description || "");
    setPrice(product.price.toString());
    setBillingPeriod(product.billing_period);
    setIsActive(product.is_active);
    setIsMls(product.is_mls);
    setMlsLevel(product.mls_level || "");
    setColor(product.color || "#10b981");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (!currentUser?.account_id) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const productData = {
        account_id: currentUser.account_id,
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        billing_period: billingPeriod as "monthly" | "quarterly" | "semiannual" | "annual" | "one_time",
        is_active: isActive,
        is_mls: isMls,
        mls_level: isMls ? (mlsLevel || null) : null,
        color: color,
      };

      if (editingId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase
          .from("products")
          .insert([productData]);
        if (error) throw error;
        toast.success("Produto criado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Produto excluído!");
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir produto");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  if (loading) {
    return <LoadingScreen message="Carregando produtos..." fullScreen={false} />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie os produtos e planos oferecidos aos seus clientes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => resetForm()}
              disabled={!canCreate("products")}
              title={!canCreate("products") ? "Limite de produtos atingido. Faça upgrade do plano." : undefined}
            >
              {!canCreate("products") ? <Lock className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {!canCreate("products") ? "Limite atingido" : "Novo Produto"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do produto
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mentoria Premium"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição do produto..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select value={billingPeriod} onValueChange={setBillingPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="semiannual">Semestral</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                      <SelectItem value="one_time">Pagamento Único</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is-active">Produto ativo</Label>
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-mls">Produto MLS</Label>
                  <Switch
                    id="is-mls"
                    checked={isMls}
                    onCheckedChange={(checked) => {
                      setIsMls(checked);
                      if (!checked) setMlsLevel("");
                    }}
                  />
                </div>

                {isMls && (
                  <div className="space-y-2">
                    <Label>Nível do Título</Label>
                    <Select value={mlsLevel} onValueChange={setMlsLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                      <SelectContent>
                        {MLS_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${level.dotColor}`} />
                              {level.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Cor da Tag</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setColor(option.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        color === option.value 
                          ? "border-foreground scale-110" 
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: option.value }}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie produtos para vincular aos seus clientes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(product)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.description && (
                  <p className="text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(product.price)}
                  </Badge>
                  <Badge variant="outline">
                    {billingPeriodLabels[product.billing_period]}
                  </Badge>
                  {product.is_mls && (
                    <Badge className={`${getMlsBadgeClasses(product.mls_level)} gap-1`}>
                      <Award className="h-3 w-3" />
                      MLS {product.mls_level ? `- ${getMlsLevelLabel(product.mls_level)}` : ""}
                    </Badge>
                  )}
                  {!product.is_active && (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
