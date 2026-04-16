import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Save, Package, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

const SALES_TEAM_NAMES = ["everton", "jonathan", "maikol", "darlan", "vanessa", "george"];
const MONTH_NAMES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Product {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface ProductGoal {
  product_id: string;
  user_id: string;
  year_month: string;
  target_quantity: number;
}

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

export function ProductGoalsSection() {
  const { currentUser } = useCurrentUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const yearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const loadData = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    const [productsRes, usersRes, goalsRes] = await Promise.all([
      supabase.from("products").select("id, name").eq("account_id", currentUser.account_id).eq("is_active", true).order("name"),
      supabase.from("users").select("id, name").eq("account_id", currentUser.account_id).order("name"),
      supabase.from("sales_product_goals").select("*").eq("account_id", currentUser.account_id).eq("year_month", yearMonth),
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    if (usersRes.data) {
      const filtered = usersRes.data.filter((u: any) =>
        SALES_TEAM_NAMES.some((name) => u.name.toLowerCase().includes(name))
      );
      filtered.sort((a: any, b: any) => {
        const idxA = SALES_TEAM_NAMES.findIndex((n) => a.name.toLowerCase().includes(n));
        const idxB = SALES_TEAM_NAMES.findIndex((n) => b.name.toLowerCase().includes(n));
        return idxA - idxB;
      });
      setMembers(filtered as TeamMember[]);
    }

    const goalsMap: Record<string, number> = {};
    const usedProducts = new Set<string>();
    if (goalsRes.data) {
      for (const g of goalsRes.data as any[]) {
        goalsMap[`${g.product_id}_${g.user_id}`] = g.target_quantity;
        usedProducts.add(g.product_id);
      }
    }
    setGoals(goalsMap);
    setSelectedProducts(Array.from(usedProducts));
    setLoading(false);
  }, [currentUser?.account_id, yearMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const navigateMonth = (dir: -1 | 1) => {
    let newMonth = selectedMonth + dir;
    let newYear = selectedYear;
    if (newMonth < 0) { newMonth = 11; newYear--; setSelectedYear(newYear); }
    else if (newMonth > 11) { newMonth = 0; newYear++; setSelectedYear(newYear); }
    setSelectedMonth(newMonth);
  };

  const setGoalValue = (productId: string, userId: string, value: number) => {
    setGoals((prev) => ({ ...prev, [`${productId}_${userId}`]: value }));
  };

  const getGoalValue = (productId: string, userId: string) => {
    return goals[`${productId}_${userId}`] ?? 0;
  };

  const getProductTotal = (productId: string) => {
    return members.reduce((sum, m) => sum + getGoalValue(productId, m.id), 0);
  };

  const getUserTotal = (userId: string) => {
    return selectedProducts.reduce((sum, pid) => sum + getGoalValue(pid, userId), 0);
  };

  const handleAddProduct = () => {
    if (!addProductId || selectedProducts.includes(addProductId)) return;
    setSelectedProducts((prev) => [...prev, addProductId]);
    setAddProductId("");
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((id) => id !== productId));
    setGoals((prev) => {
      const next = { ...prev };
      members.forEach((m) => delete next[`${productId}_${m.id}`]);
      return next;
    });
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);

    // Delete existing goals for this month, then insert
    await supabase.from("sales_product_goals")
      .delete()
      .eq("account_id", currentUser.account_id)
      .eq("year_month", yearMonth);

    const inserts: any[] = [];
    for (const productId of selectedProducts) {
      for (const member of members) {
        const qty = getGoalValue(productId, member.id);
        if (qty > 0) {
          inserts.push({
            account_id: currentUser.account_id,
            product_id: productId,
            user_id: member.id,
            year_month: yearMonth,
            target_quantity: qty,
          });
        }
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("sales_product_goals").insert(inserts);
      if (error) {
        toast.error("Erro ao salvar metas por produto");
        setSaving(false);
        return;
      }
    }

    toast.success("Metas por produto salvas!");
    setSaving(false);
  };

  const availableProducts = products.filter((p) => !selectedProducts.includes(p.id));
  const grandTotal = selectedProducts.reduce((sum, pid) => sum + getProductTotal(pid), 0);

  if (loading) {
    return <div className="h-24 bg-muted/50 animate-pulse rounded-xl" />;
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Meta por Produto</span>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 shadow-sm">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 min-w-[180px] justify-center">
            <span className="text-sm font-semibold text-foreground">{MONTH_NAMES_FULL[selectedMonth]}</span>
            <span className="text-sm text-muted-foreground">{selectedYear}</span>
            {isCurrentMonth && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">Atual</Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Add product */}
        {availableProducts.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={addProductId} onValueChange={setAddProductId}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Selecionar produto..." />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleAddProduct} disabled={!addProductId}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
        )}

        {/* Product x Member matrix */}
        {selectedProducts.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Adicione produtos para definir as metas por vendedor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-semibold text-muted-foreground min-w-[140px]">Produto</th>
                  {members.map((m) => (
                    <th key={m.id} className="text-center py-2 px-1 min-w-[70px]">
                      <div className="flex flex-col items-center gap-1">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[8px] font-semibold bg-muted text-muted-foreground">
                            {getInitials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] font-medium text-foreground leading-tight">
                          {m.name.split(" ")[0]}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center py-2 px-2 font-semibold text-muted-foreground min-w-[60px]">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {selectedProducts.map((productId) => {
                  const product = products.find((p) => p.id === productId);
                  if (!product) return null;
                  const total = getProductTotal(productId);
                  return (
                    <tr key={productId} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-foreground text-xs">{product.name}</span>
                      </td>
                      {members.map((m) => (
                        <td key={m.id} className="py-1.5 px-1">
                          <Input
                            type="number"
                            min={0}
                            value={getGoalValue(productId, m.id) || ""}
                            onChange={(e) => setGoalValue(productId, m.id, parseInt(e.target.value) || 0)}
                            className="h-8 w-[60px] text-center text-xs mx-auto bg-muted/40 border-0 focus-visible:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-2 text-center">
                        <Badge variant={total > 0 ? "default" : "secondary"} className="text-[10px] font-bold">
                          {total}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveProduct(productId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="py-2 pr-3 font-semibold text-foreground">Total / Vendedor</td>
                  {members.map((m) => (
                    <td key={m.id} className="py-2 px-1 text-center">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {getUserTotal(m.id)}
                      </Badge>
                    </td>
                  ))}
                  <td className="py-2 px-2 text-center">
                    <Badge className="text-[10px] font-bold bg-primary">
                      {grandTotal}
                    </Badge>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
