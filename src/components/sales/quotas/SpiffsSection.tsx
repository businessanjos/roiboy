import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Zap, Save } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function SpiffsSection() {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { spiffs, activePlan, saveSpiff, deleteSpiff } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState<string>("all");
  const [bonusAmount, setBonusAmount] = useState(0);
  const [bonusType, setBonusType] = useState("fixed");
  const [targetQty, setTargetQty] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");

  const productsQuery = useQuery({
    queryKey: ["active-products", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const products = productsQuery.data ?? [];

  const handleSave = async () => {
    await saveSpiff.mutateAsync({
      name,
      description: description || null,
      product_id: productId === "all" ? null : productId,
      bonus_amount: bonusAmount,
      bonus_type: bonusType,
      target_quantity: targetQty,
      start_date: startDate,
      end_date: endDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      is_active: true,
      plan_id: activePlan?.id || null,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setProductId("all");
    setBonusAmount(0);
    setBonusType("fixed");
    setTargetQty(1);
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
  };

  const activeSpiffs = spiffs.filter((s) => s.is_active);
  const inactiveSpiffs = spiffs.filter((s) => !s.is_active);

  const isExpired = (endDate: string) => new Date(endDate) < new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              SPIFFs — Incentivos Temporários
            </CardTitle>
            <CardDescription>Campanhas de curto prazo com bônus extra para metas específicas</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo SPIFF
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Campanha SPIFF</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nome da Campanha</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Blitz Eternum Club" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Regras e detalhes..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Produto Alvo</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Produtos</SelectItem>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={bonusType} onValueChange={setBonusType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        <SelectItem value="percent">Percentual (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Bônus ({bonusType === "fixed" ? "R$" : "%"})</Label>
                    <Input type="number" value={bonusAmount || ""} onChange={(e) => setBonusAmount(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Meta de Qtd</Label>
                    <Input type="number" min={1} value={targetQty} onChange={(e) => setTargetQty(parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleSave} disabled={!name || saveSpiff.isPending} className="w-full gap-1.5">
                  <Save className="h-4 w-4" />
                  Criar SPIFF
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {spiffs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum SPIFF criado. Crie campanhas temporárias para impulsionar vendas específicas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Bônus</TableHead>
                <TableHead className="text-center">Meta Qtd</TableHead>
                <TableHead className="text-center">Período</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spiffs.map((spiff) => {
                const product = products.find((p) => p.id === spiff.product_id);
                const expired = isExpired(spiff.end_date);
                return (
                  <TableRow key={spiff.id} className={expired ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{spiff.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product?.name || "Todos"}</TableCell>
                    <TableCell className="text-center font-medium">
                      {spiff.bonus_type === "fixed"
                        ? `R$ ${Number(spiff.bonus_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : `${spiff.bonus_amount}%`}
                    </TableCell>
                    <TableCell className="text-center">{spiff.target_quantity}</TableCell>
                    <TableCell className="text-center text-xs">
                      {new Date(spiff.start_date).toLocaleDateString("pt-BR")} — {new Date(spiff.end_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center">
                      {expired
                        ? <Badge variant="outline" className="text-muted-foreground">Encerrado</Badge>
                        : spiff.is_active
                          ? <Badge variant="default">Ativo</Badge>
                          : <Badge variant="secondary">Inativo</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteSpiff.mutate(spiff.id)} className="h-8 w-8">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
