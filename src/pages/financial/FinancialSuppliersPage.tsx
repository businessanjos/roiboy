import { useState } from "react";
import { useTablePagination } from "@/hooks/useTablePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Truck, Building2, Download, Upload, FileSpreadsheet, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { FinancialClientsTab } from "@/components/financial/FinancialClientsTab";

interface Supplier {
  id: string;
  name: string;
  trade_name: string | null;
  document: string | null;
  document_type: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
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
  trade_name: "",
  document: "",
  document_type: "cpf",
  inscricao_estadual: "",
  inscricao_municipal: "",
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

export default function FinancialSuppliersPage() {
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
    enabled: !!accountId,
  });

  // Count clients for the tab badge
  const { data: clientsCount = 0 } = useQuery({
    queryKey: ["clients-count", accountId],
    queryFn: async () => {
      if (!accountId) return 0;
      const { count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("account_id", accountId)
        .neq("status", "churned");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!accountId,
  });

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.document?.includes(searchTerm) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const {
    paginatedItems: paginatedSuppliers,
    currentPage: supplierPage,
    pageSize: supplierPageSize,
    totalPages: supplierTotalPages,
    totalItems: supplierTotalItems,
    handlePageChange: handleSupplierPageChange,
    handlePageSizeChange: handleSupplierPageSizeChange,
  } = useTablePagination(filteredSuppliers);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        trade_name: data.trade_name || null,
        document: data.document || null,
        document_type: data.document_type || "cpf",
        inscricao_estadual: data.inscricao_estadual || null,
        inscricao_municipal: data.inscricao_municipal || null,
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
      "Inscrição Estadual",
      "Inscrição Municipal",
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
      s.inscricao_estadual || "",
      s.inscricao_municipal || "",
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
        setIsImporting(false);
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
          inscricao_estadual: cols[3] || null,
          inscricao_municipal: cols[4] || null,
          email: cols[5] || null,
          phone: cols[6] || null,
          contact_name: cols[7] || null,
          street: cols[8] || null,
          street_number: cols[9] || null,
          complement: cols[10] || null,
          neighborhood: cols[11] || null,
          city: cols[12] || null,
          state: cols[13] || null,
          zip_code: cols[14] || null,
          bank_name: cols[15] || null,
          bank_agency: cols[16] || null,
          bank_account: cols[17] || null,
          pix_key: cols[18] || null,
          notes: cols[19] || null,
          is_active: cols[20]?.toLowerCase() !== "não",
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

  const handleDownloadTemplate = () => {
    const headers = [
      "Nome",
      "Tipo Doc",
      "Documento",
      "Inscrição Estadual",
      "Inscrição Municipal",
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

    // Exemplo com dados fictícios para facilitar o entendimento
    const exampleRows = [
      [
        "Fornecedor Exemplo LTDA",
        "cnpj",
        "12.345.678/0001-99",
        "123.456.789.001",
        "12345678",
        "contato@fornecedor.com.br",
        "(11) 99999-9999",
        "João Silva",
        "Rua das Flores",
        "123",
        "Sala 45",
        "Centro",
        "São Paulo",
        "SP",
        "01234-567",
        "Banco do Brasil",
        "1234-5",
        "12345-6",
        "12345678901234",
        "Fornecedor de materiais de escritório",
        "Sim",
      ],
      [
        "Maria Prestadora de Serviços",
        "cpf",
        "123.456.789-00",
        "",
        "",
        "maria@email.com",
        "(21) 98888-7777",
        "",
        "Av. Principal",
        "456",
        "",
        "Jardins",
        "Rio de Janeiro",
        "RJ",
        "22222-000",
        "Itaú",
        "0001",
        "98765-4",
        "maria@email.com",
        "Consultoria e treinamentos",
        "Sim",
      ],
      [
        "", // Linha em branco para o usuário preencher
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ];

    const csvContent =
      "\uFEFF" +
      [
        headers.join(";"),
        ...exampleRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")),
      ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_importacao_fornecedores.csv";
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Modelo baixado!", description: "Preencha e importe o arquivo." });
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      trade_name: supplier.trade_name || "",
      document: supplier.document || "",
      document_type: supplier.document_type || "cpf",
      inscricao_estadual: supplier.inscricao_estadual || "",
      inscricao_municipal: supplier.inscricao_municipal || "",
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

  const handleOpenForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    resetForm();
  };

  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Main Tabs for Suppliers and Clients */}
      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Fornecedores
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {suppliers.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {clientsCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  <div>
                    <CardTitle>Fornecedores</CardTitle>
                    <CardDescription>
                      Cadastre e gerencie seus fornecedores para vincular às despesas
                    </CardDescription>
                  </div>
                </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                title="Baixar modelo de importação"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Modelo
              </Button>
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
              <Button onClick={handleOpenForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

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
            <div className="space-y-2">
              {paginatedSuppliers.map((supplier) => (
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
                        <span className="font-medium truncate">
                          {supplier.trade_name || supplier.name}
                        </span>
                        {supplier.document_type && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {supplier.document_type.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      {supplier.trade_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {supplier.name}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {supplier.document && (
                          <span className="font-mono">{supplier.document}</span>
                        )}
                        {supplier.email && <span>{supplier.email}</span>}
                        {supplier.phone && <span>{supplier.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(supplier)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(supplier.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <TablePagination
              currentPage={supplierPage}
              totalPages={supplierTotalPages}
              totalItems={supplierTotalItems}
              pageSize={supplierPageSize}
              onPageChange={handleSupplierPageChange}
              onPageSizeChange={handleSupplierPageSizeChange}
            />
          )}
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <FinancialClientsTab />
        </TabsContent>
      </Tabs>
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do fornecedor
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Dados</TabsTrigger>
                <TabsTrigger value="address">Endereço</TabsTrigger>
                <TabsTrigger value="bank">Bancário</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Razão Social / Nome *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Razão Social ou Nome Completo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={formData.trade_name}
                      onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                      placeholder="Nome Fantasia (opcional)"
                    />
                  </div>
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
                    <Label>Inscrição Estadual</Label>
                    <Input
                      value={formData.inscricao_estadual}
                      onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                      placeholder="123.456.789.001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inscrição Municipal</Label>
                    <Input
                      value={formData.inscricao_municipal}
                      onChange={(e) => setFormData({ ...formData, inscricao_municipal: e.target.value })}
                      placeholder="12345678"
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
                onClick={handleCloseForm}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingSupplier ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
