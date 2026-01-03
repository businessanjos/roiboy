import { useState } from "react";
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
import { Plus, Edit2, Trash2, Users, Building2, Download, Upload, FileSpreadsheet, Link2, FileCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface Client {
  id: string;
  full_name: string;
  company_name: string | null;
  cpf: string | null;
  cnpj: string | null;
  phone_e164: string;
  emails: string[] | null;
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
  status: string;
}

const initialFormData = {
  full_name: "",
  company_name: "",
  document: "",
  document_type: "cpf" as "cpf" | "cnpj",
  inscricao_estadual: "",
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

export function FinancialClientsTab() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showActiveContractsOnly, setShowActiveContractsOnly] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["financial-clients", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("account_id", accountId)
        .order("full_name");
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!accountId,
  });

  // Fetch contracts to check which clients have active contracts
  const { data: activeContracts = [] } = useQuery({
    queryKey: ["client-contracts-active", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("client_contracts")
        .select("client_id")
        .eq("account_id", accountId)
        .in("status", ["active", "pending"]);
      if (error) throw error;
      return data.map(c => c.client_id);
    },
    enabled: !!accountId,
  });

  const clientsWithActiveContract = new Set(activeContracts);

  const filteredClients = clients.filter((c) => {
    // First apply active contract filter if enabled
    if (showActiveContractsOnly && !clientsWithActiveContract.has(c.id)) {
      return false;
    }
    
    // Then apply search filter
    return (
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpf?.includes(searchTerm) ||
      c.cnpj?.includes(searchTerm) ||
      (c.emails as string[] | null)?.some((e) => e.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update({
            full_name: data.full_name,
            company_name: data.company_name || null,
            cpf: data.document_type === "cpf" ? data.document : null,
            cnpj: data.document_type === "cnpj" ? data.document : null,
            phone_e164: data.phone || "+5500000000000",
            emails: data.email ? [data.email] : [],
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
          })
          .eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({
          account_id: accountId!,
          full_name: data.full_name,
          company_name: data.company_name || null,
          cpf: data.document_type === "cpf" ? data.document : null,
          cnpj: data.document_type === "cnpj" ? data.document : null,
          phone_e164: data.phone || "+5500000000000",
          emails: data.email ? [data.email] : [],
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
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setIsFormOpen(false);
      resetForm();
      toast({ title: editingClient ? "Cliente atualizado" : "Cliente cadastrado" });
    },
    onError: (error) => {
      console.error("Error saving client:", error);
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente excluído" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingClient(null);
  };

  const handleExport = () => {
    if (clients.length === 0) {
      toast({ title: "Nenhum cliente para exportar", variant: "destructive" });
      return;
    }

    const headers = [
      "Tags",
      "CNPJ/CPF",
      "Inscrição Estadual",
      "Razão Social",
      "Nome Fantasia",
      "Endereço",
      "Nº",
      "Bairro",
      "Complemento",
      "Cidade",
      "Estado",
      "CEP",
      "Telefone",
      "E-mail",
      "Contato",
    ];

    const rows = clients.map((c) => [
      "Cliente",
      c.cnpj || c.cpf || "",
      "",
      c.full_name,
      c.company_name || "",
      c.street || "",
      c.street_number || "",
      c.neighborhood || "",
      c.complement || "",
      c.city || "",
      c.state || "",
      c.zip_code || "",
      c.phone_e164 || "",
      (c.emails as string[] | null)?.[0] || "",
      "",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clientes_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: `${clients.length} cliente(s) exportado(s)` });
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

      const dataLines = lines.slice(1);
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const line of dataLines) {
        const cols = line.split(/[;,]/).map((c) => c.replace(/^"|"$/g, "").trim());
        if (!cols[3]) continue; // Razão Social is required

        const document = cols[1] || "";
        const isCompany = document.includes("/");
        const email = cols[13] || "";
        const phone = cols[12] || "";

        // Prepare update data (without account_id for updates)
        const updateData = {
          full_name: cols[3],
          company_name: cols[4] || null,
          cpf: !isCompany && document ? document : null,
          cnpj: isCompany && document ? document : null,
          phone_e164: phone || "+5500000000000",
          emails: email ? [email] : [],
          street: cols[5] || null,
          street_number: cols[6] || null,
          neighborhood: cols[7] || null,
          complement: cols[8] || null,
          city: cols[9] || null,
          state: cols[10] || null,
          zip_code: cols[11] || null,
        };

        try {
          // Try to find existing client by CPF/CNPJ, email, or phone
          let existingClient = null;

          // Search by document (CPF or CNPJ)
          if (document) {
            const { data: byDoc } = await supabase
              .from("clients")
              .select("id, status")
              .eq("account_id", accountId)
              .or(`cpf.eq.${document},cnpj.eq.${document}`)
              .maybeSingle();
            if (byDoc) existingClient = byDoc;
          }

          // If not found, search by email
          if (!existingClient && email) {
            const { data: byEmail } = await supabase
              .from("clients")
              .select("id, status")
              .eq("account_id", accountId)
              .contains("emails", [email])
              .maybeSingle();
            if (byEmail) existingClient = byEmail;
          }

          // If not found, search by phone
          if (!existingClient && phone) {
            const { data: byPhone } = await supabase
              .from("clients")
              .select("id, status")
              .eq("account_id", accountId)
              .eq("phone_e164", phone)
              .maybeSingle();
            if (byPhone) existingClient = byPhone;
          }

          if (existingClient && existingClient.status === "active") {
            // Update existing active client
            const { error } = await supabase
              .from("clients")
              .update(updateData)
              .eq("id", existingClient.id);
            if (error) throw error;
            updated++;
          } else {
            // Insert new client
            const { error } = await supabase.from("clients").insert({
              account_id: accountId,
              ...updateData,
            });
            if (error) throw error;
            created++;
          }
        } catch (err) {
          console.error("Import error for line:", cols[3], err);
          errors++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["financial-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      
      const messages = [];
      if (created > 0) messages.push(`${created} criado(s)`);
      if (updated > 0) messages.push(`${updated} atualizado(s)`);
      if (errors > 0) messages.push(`${errors} erro(s)`);
      
      toast({
        title: `Importação concluída`,
        description: messages.join(", "),
      });
    } catch (err) {
      console.error("Import error:", err);
      toast({ title: "Erro ao processar arquivo", variant: "destructive" });
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Tags",
      "CNPJ/CPF",
      "Inscrição Estadual",
      "Razão Social",
      "Nome Fantasia",
      "Endereço",
      "Nº",
      "Bairro",
      "Complemento",
      "Cidade",
      "Estado",
      "CEP",
      "Telefone",
      "E-mail",
      "Contato",
    ];

    const exampleRows = [
      [
        "Cliente",
        "12.345.678/0001-99",
        "123456789",
        "Empresa Exemplo LTDA",
        "Exemplo Corp",
        "Rua das Flores",
        "123",
        "Centro",
        "Sala 45",
        "São Paulo",
        "SP",
        "01234-567",
        "(11) 99999-9999",
        "contato@exemplo.com.br",
        "João Silva",
      ],
      [
        "Cliente",
        "123.456.789-00",
        "N/D",
        "Maria da Silva",
        "Maria da Silva",
        "Av. Principal",
        "456",
        "Jardins",
        "",
        "Rio de Janeiro",
        "RJ",
        "22222-000",
        "(21) 98888-7777",
        "maria@email.com",
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
    link.download = "modelo_importacao_clientes.csv";
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Modelo baixado!", description: "Preencha e importe o arquivo." });
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    const hasDocument = client.cnpj || client.cpf;
    setFormData({
      full_name: client.full_name,
      company_name: client.company_name || "",
      document: client.cnpj || client.cpf || "",
      document_type: client.cnpj ? "cnpj" : "cpf",
      inscricao_estadual: "",
      email: (client.emails as string[] | null)?.[0] || "",
      phone: client.phone_e164 || "",
      contact_name: "",
      street: client.street || "",
      street_number: client.street_number || "",
      complement: client.complement || "",
      neighborhood: client.neighborhood || "",
      city: client.city || "",
      state: client.state || "",
      zip_code: client.zip_code || "",
      bank_name: client.bank_name || "",
      bank_agency: client.bank_agency || "",
      bank_account: client.bank_account || "",
      pix_key: client.pix_key || "",
      notes: client.notes || "",
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

  const getDocumentDisplay = (client: Client) => {
    if (client.cnpj) return { type: "CNPJ", value: client.cnpj };
    if (client.cpf) return { type: "CPF", value: client.cpf };
    return null;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>Clientes</CardTitle>
                <CardDescription>
                  Cadastre e gerencie seus clientes (integrado com a operação)
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
                disabled={clients.length === 0}
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
              <Button variant="outline" onClick={() => navigate("/clients")}>
                <Link2 className="h-4 w-4 mr-2" />
                Ver Operação
              </Button>
              <Button onClick={handleOpenForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button
              variant={showActiveContractsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowActiveContractsOnly(!showActiveContractsOnly)}
              className="shrink-0"
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Contrato Ativo
              {showActiveContractsOnly && (
                <Badge variant="secondary" className="ml-2">
                  {clientsWithActiveContract.size}
                </Badge>
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredClients.map((client) => {
                const doc = getDocumentDisplay(client);
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {client.company_name || client.full_name}
                          </span>
                          {doc && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {doc.type}
                            </Badge>
                          )}
                        </div>
                        {client.company_name && (
                          <div className="text-xs text-muted-foreground truncate">
                            {client.full_name}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {doc && (
                            <span className="font-mono">{doc.value}</span>
                          )}
                          {(client.emails as string[] | null)?.[0] && (
                            <span>{(client.emails as string[])[0]}</span>
                          )}
                          {client.phone_e164 && client.phone_e164 !== "+5500000000000" && (
                            <span>{client.phone_e164}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/clients/${client.id}`)}
                        title="Ver detalhes na operação"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(client.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do cliente (integrado com a operação)
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
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Razão Social ou Nome Completo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Nome Fantasia (opcional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(v: "cpf" | "cnpj") => setFormData({ ...formData, document_type: v })}
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
                      placeholder="contato@cliente.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+55 (11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Anotações sobre o cliente..."
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
                {saveMutation.isPending ? "Salvando..." : editingClient ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
