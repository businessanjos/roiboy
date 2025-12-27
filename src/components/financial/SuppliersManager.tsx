import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, Truck, Phone, Mail, Building2, Download, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SuppliersManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Supplier {
  id: string;
  name: string;
  document: string | null;
  document_type: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  notes: string | null;
  is_active: boolean;
}

const initialFormData = {
  name: "",
  document: "",
  document_type: "cpf",
  email: "",
  phone: "",
  contact_name: "",
  street: "",
  street_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  bank_name: "",
  bank_agency: "",
  bank_account: "",
  pix_key: "",
  notes: "",
};

export function SuppliersManager({ open, onOpenChange }: SuppliersManagerProps) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!accountId && open,
  });

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.document?.includes(searchTerm) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        document: data.document || null,
        document_type: data.document_type || "cpf",
        email: data.email || null,
        phone: data.phone || null,
        contact_name: data.contact_name || null,
        street: data.street || null,
        street_number: data.street_number || null,
        complement: data.complement || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        bank_name: data.bank_name || null,
        bank_agency: data.bank_agency || null,
        bank_account: data.bank_account || null,
        pix_key: data.pix_key || null,
        notes: data.notes || null,
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setIsFormOpen(false);
      resetForm();
      toast({ title: editingSupplier ? "Fornecedor atualizado" : "Fornecedor cadastrado" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Fornecedor excluído" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingSupplier(null);
  };

  const handleExport = () => {
    if (suppliers.length === 0) {
      toast({ title: "Nenhum fornecedor para exportar", variant: "destructive" });
      return;
    }

    const headers = [
      "Nome",
      "Tipo Doc",
      "Documento",
      "E-mail",
      "Telefone",
      "Contato",
      "Rua",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "Estado",
      "CEP",
      "Banco",
      "Agência",
      "Conta",
      "PIX",
      "Observações",
      "Ativo",
    ];

    const rows = suppliers.map((s) => [
      s.name,
      s.document_type || "",
      s.document || "",
      s.email || "",
      s.phone || "",
      s.contact_name || "",
      s.street || "",
      s.street_number || "",
      s.complement || "",
      s.neighborhood || "",
      s.city || "",
      s.state || "",
      s.zip_code || "",
      s.bank_name || "",
      s.bank_agency || "",
      s.bank_account || "",
      s.pix_key || "",
      s.notes || "",
      s.is_active ? "Sim" : "Não",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fornecedores_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: `${suppliers.length} fornecedor(es) exportado(s)` });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accountId) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {
        toast({ title: "Arquivo vazio ou sem dados", variant: "destructive" });
        return;
      }

      // Skip header
      const dataLines = lines.slice(1);
      let imported = 0;
      let errors = 0;

      for (const line of dataLines) {
        const cols = line.split(/[;,]/).map((c) => c.replace(/^"|"$/g, "").trim());
        if (!cols[0]) continue;

        const supplierData = {
          account_id: accountId,
          name: cols[0],
          document_type: cols[1]?.toLowerCase() || "cpf",
          document: cols[2] || null,
          email: cols[3] || null,
          phone: cols[4] || null,
          contact_name: cols[5] || null,
          street: cols[6] || null,
          street_number: cols[7] || null,
          complement: cols[8] || null,
          neighborhood: cols[9] || null,
          city: cols[10] || null,
          state: cols[11] || null,
          zip_code: cols[12] || null,
          bank_name: cols[13] || null,
          bank_agency: cols[14] || null,
          bank_account: cols[15] || null,
          pix_key: cols[16] || null,
          notes: cols[17] || null,
          is_active: cols[18]?.toLowerCase() !== "não",
        };

        const { error } = await supabase.from("suppliers").insert(supplierData);
        if (error) {
          errors++;
        } else {
          imported++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({
        title: `Importação concluída`,
        description: `${imported} importado(s)${errors > 0 ? `, ${errors} erro(s)` : ""}`,
      });
    } catch (err) {
      toast({ title: "Erro ao processar arquivo", variant: "destructive" });
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      document: supplier.document || "",
      document_type: supplier.document_type || "cpf",
      email: supplier.email || "",
      phone: supplier.phone || "",
      contact_name: supplier.contact_name || "",
      street: supplier.street || "",
      street_number: supplier.street_number || "",
      complement: supplier.complement || "",
      neighborhood: supplier.neighborhood || "",
      city: supplier.city || "",
      state: supplier.state || "",
      zip_code: supplier.zip_code || "",
      bank_name: supplier.bank_name || "",
      bank_agency: supplier.bank_agency || "",
      bank_account: supplier.bank_account || "",
      pix_key: supplier.pix_key || "",
      notes: supplier.notes || "",
    });
    setIsFormOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fornecedores
          </DialogTitle>
          <DialogDescription>
            Cadastre e gerencie seus fornecedores para vincular às despesas
          </DialogDescription>
        </DialogHeader>

        {isFormOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4 border rounded-lg p-4"
          >
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Dados</TabsTrigger>
                <TabsTrigger value="address">Endereço</TabsTrigger>
                <TabsTrigger value="bank">Bancário</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome / Razão Social *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do fornecedor"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(v) => setFormData({ ...formData, document_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>{formData.document_type === "cnpj" ? "CNPJ" : "CPF"}</Label>
                    <Input
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      placeholder={formData.document_type === "cnpj" ? "00.000.000/0001-00" : "000.000.000-00"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contato@fornecedor.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contato</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Nome do responsável"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Anotações sobre o fornecedor..."
                    rows={2}
                  />
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Rua</Label>
                    <Input
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="Rua, Avenida..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={formData.street_number}
                      onChange={(e) => setFormData({ ...formData, street_number: e.target.value })}
                      placeholder="123"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={formData.complement}
                      onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                      placeholder="Sala, Bloco..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      placeholder="Bairro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bank" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="Nome do banco"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input
                      value={formData.bank_agency}
                      onChange={(e) => setFormData({ ...formData, bank_agency: e.target.value })}
                      placeholder="0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                      placeholder="00000-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={formData.pix_key}
                    onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingSupplier ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Buscar fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleExport}
                  disabled={suppliers.length === 0}
                  title="Exportar CSV"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isImporting}
                  title="Importar CSV"
                  asChild
                >
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </Button>
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchTerm ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{supplier.name}</span>
                          {supplier.document && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {supplier.document_type?.toUpperCase()}
                            </Badge>
                          )}
                          {!supplier.is_active && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {supplier.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {supplier.email}
                            </span>
                          )}
                          {supplier.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {supplier.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(supplier)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Deseja excluir este fornecedor?")) {
                            deleteMutation.mutate(supplier.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
