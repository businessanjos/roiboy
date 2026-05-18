import { useState, useMemo } from "react";
import { useTablePagination } from "@/hooks/useTablePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, FileText, Trash2, Edit, ExternalLink, Copy, Check, Receipt, FileCode, DollarSign, Hash } from "lucide-react";
import { FinancialPageHeader, FinancialKpiCard } from "@/components/financial/_shared";
import { formatBRLCompact } from "@/lib/financial-format";

interface NotaFiscal {
  id: string;
  client_id: string | null;
  invoice_type: string;
  invoice_number: string | null;
  series: string | null;
  access_key: string | null;
  verification_code: string | null;
  total_amount: number;
  services_amount: number | null;
  products_amount: number | null;
  discount_amount: number | null;
  iss_amount: number | null;
  iss_rate: number | null;
  icms_amount: number | null;
  icms_rate: number | null;
  pis_amount: number | null;
  cofins_amount: number | null;
  ir_amount: number | null;
  csll_amount: number | null;
  inss_amount: number | null;
  issue_date: string;
  competence_date: string | null;
  status: string;
  cancellation_reason: string | null;
  service_code: string | null;
  cnae_code: string | null;
  description: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  city_code: string | null;
  city_name: string | null;
  notes: string | null;
  clients?: { full_name: string } | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  issued: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  rejected: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  cancelled: "Cancelada",
  rejected: "Rejeitada",
};

const typeLabels: Record<string, string> = {
  nfse: "NFSe",
  nfe: "NFe",
};

export default function FinancialNotasFiscaisPage() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaFiscal | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: "",
    invoice_type: "nfse",
    invoice_number: "",
    series: "",
    access_key: "",
    verification_code: "",
    total_amount: "",
    services_amount: "",
    products_amount: "",
    discount_amount: "",
    iss_amount: "",
    iss_rate: "",
    icms_amount: "",
    icms_rate: "",
    pis_amount: "",
    cofins_amount: "",
    ir_amount: "",
    csll_amount: "",
    inss_amount: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    competence_date: "",
    status: "issued",
    cancellation_reason: "",
    service_code: "",
    cnae_code: "",
    description: "",
    xml_url: "",
    pdf_url: "",
    city_code: "",
    city_name: "",
    notes: "",
  });

  // Fetch notas fiscais
  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas-fiscais", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, clients(full_name)")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as NotaFiscal[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Fetch clients for select
  const { data: clients } = useQuery({
    queryKey: ["clients-select", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.account_id,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: currentUser?.account_id,
        client_id: data.client_id || null,
        invoice_type: data.invoice_type,
        invoice_number: data.invoice_number || null,
        series: data.series || null,
        access_key: data.access_key || null,
        verification_code: data.verification_code || null,
        total_amount: parseFloat(data.total_amount) || 0,
        services_amount: parseFloat(data.services_amount) || null,
        products_amount: parseFloat(data.products_amount) || null,
        discount_amount: parseFloat(data.discount_amount) || null,
        iss_amount: parseFloat(data.iss_amount) || null,
        iss_rate: parseFloat(data.iss_rate) || null,
        icms_amount: parseFloat(data.icms_amount) || null,
        icms_rate: parseFloat(data.icms_rate) || null,
        pis_amount: parseFloat(data.pis_amount) || null,
        cofins_amount: parseFloat(data.cofins_amount) || null,
        ir_amount: parseFloat(data.ir_amount) || null,
        csll_amount: parseFloat(data.csll_amount) || null,
        inss_amount: parseFloat(data.inss_amount) || null,
        issue_date: data.issue_date,
        competence_date: data.competence_date || null,
        status: data.status,
        cancellation_reason: data.cancellation_reason || null,
        service_code: data.service_code || null,
        cnae_code: data.cnae_code || null,
        description: data.description || null,
        xml_url: data.xml_url || null,
        pdf_url: data.pdf_url || null,
        city_code: data.city_code || null,
        city_name: data.city_name || null,
        notes: data.notes || null,
      };

      if (editingNota) {
        const { error } = await supabase
          .from("notas_fiscais")
          .update(payload)
          .eq("id", editingNota.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notas_fiscais").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais"] });
      toast.success(editingNota ? "Nota fiscal atualizada!" : "Nota fiscal cadastrada!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar nota fiscal: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais"] });
      toast.success("Nota fiscal removida!");
    },
    onError: (error) => {
      toast.error("Erro ao remover nota fiscal: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingNota(null);
    setFormData({
      client_id: "",
      invoice_type: "nfse",
      invoice_number: "",
      series: "",
      access_key: "",
      verification_code: "",
      total_amount: "",
      services_amount: "",
      products_amount: "",
      discount_amount: "",
      iss_amount: "",
      iss_rate: "",
      icms_amount: "",
      icms_rate: "",
      pis_amount: "",
      cofins_amount: "",
      ir_amount: "",
      csll_amount: "",
      inss_amount: "",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      competence_date: "",
      status: "issued",
      cancellation_reason: "",
      service_code: "",
      cnae_code: "",
      description: "",
      xml_url: "",
      pdf_url: "",
      city_code: "",
      city_name: "",
      notes: "",
    });
  };

  const handleEdit = (nota: NotaFiscal) => {
    setEditingNota(nota);
    setFormData({
      client_id: nota.client_id || "",
      invoice_type: nota.invoice_type || "nfse",
      invoice_number: nota.invoice_number || "",
      series: nota.series || "",
      access_key: nota.access_key || "",
      verification_code: nota.verification_code || "",
      total_amount: nota.total_amount?.toString() || "",
      services_amount: nota.services_amount?.toString() || "",
      products_amount: nota.products_amount?.toString() || "",
      discount_amount: nota.discount_amount?.toString() || "",
      iss_amount: nota.iss_amount?.toString() || "",
      iss_rate: nota.iss_rate?.toString() || "",
      icms_amount: nota.icms_amount?.toString() || "",
      icms_rate: nota.icms_rate?.toString() || "",
      pis_amount: nota.pis_amount?.toString() || "",
      cofins_amount: nota.cofins_amount?.toString() || "",
      ir_amount: nota.ir_amount?.toString() || "",
      csll_amount: nota.csll_amount?.toString() || "",
      inss_amount: nota.inss_amount?.toString() || "",
      issue_date: nota.issue_date || "",
      competence_date: nota.competence_date || "",
      status: nota.status || "issued",
      cancellation_reason: nota.cancellation_reason || "",
      service_code: nota.service_code || "",
      cnae_code: nota.cnae_code || "",
      description: nota.description || "",
      xml_url: nota.xml_url || "",
      pdf_url: nota.pdf_url || "",
      city_code: nota.city_code || "",
      city_name: nota.city_name || "",
      notes: nota.notes || "",
    });
    setDialogOpen(true);
  };

  const handleCopyAccessKey = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast.success("Chave de acesso copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredNotas = useMemo(() => {
    if (!notas) return [];
    return notas.filter((nota) => {
      const matchesSearch =
        !search ||
        nota.clients?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        nota.description?.toLowerCase().includes(search.toLowerCase()) ||
        nota.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        nota.access_key?.includes(search);
      const matchesStatus = statusFilter === "all" || nota.status === statusFilter;
      const matchesType = typeFilter === "all" || nota.invoice_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [notas, search, statusFilter, typeFilter]);

  const {
    paginatedItems: paginatedNotas,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    handlePageChange,
    handlePageSizeChange,
  } = useTablePagination(filteredNotas);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Summary stats
  const stats = useMemo(() => {
    if (!notas) return { nfse: 0, nfe: 0, total: 0, count: 0 };
    return notas.reduce(
      (acc, n) => {
        if (n.status !== "cancelled") {
          if (n.invoice_type === "nfse") acc.nfse += n.total_amount;
          if (n.invoice_type === "nfe") acc.nfe += n.total_amount;
          acc.total += n.total_amount;
          acc.count++;
        }
        return acc;
      },
      { nfse: 0, nfe: 0, total: 0, count: 0 }
    );
  }, [notas]);

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={Receipt}
        title="Notas Fiscais"
        description="Emita e acompanhe NFSe (serviços) e NFe (produtos) enviadas aos seus clientes."
        actions={
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova nota fiscal
          </Button>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingNota ? "Editar Nota Fiscal" : "Nova Nota Fiscal"}</DialogTitle>
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
                  <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                  <TabsTrigger value="taxes">Impostos</TabsTrigger>
                  <TabsTrigger value="extra">Informações Extras</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Cliente</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={(v) => setFormData({ ...formData, client_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Tipo *</Label>
                      <Select
                        value={formData.invoice_type}
                        onValueChange={(v) => setFormData({ ...formData, invoice_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nfse">NFSe (Serviços)</SelectItem>
                          <SelectItem value="nfe">NFe (Produtos)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(v) => setFormData({ ...formData, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="issued">Emitida</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                          <SelectItem value="rejected">Rejeitada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Número da Nota</Label>
                      <Input
                        value={formData.invoice_number}
                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Série</Label>
                      <Input
                        value={formData.series}
                        onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Valor Total *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.total_amount}
                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Desconto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.discount_amount}
                        onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Data de Emissão *</Label>
                      <Input
                        type="date"
                        value={formData.issue_date}
                        onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Competência</Label>
                      <Input
                        type="date"
                        value={formData.competence_date}
                        onChange={(e) => setFormData({ ...formData, competence_date: e.target.value })}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Descrição / Discriminação do Serviço</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>

                    {formData.invoice_type === "nfe" && (
                      <div className="col-span-2">
                        <Label>Chave de Acesso (44 dígitos)</Label>
                        <Input
                          value={formData.access_key}
                          onChange={(e) => setFormData({ ...formData, access_key: e.target.value })}
                          placeholder="00000000000000000000000000000000000000000000"
                          maxLength={44}
                        />
                      </div>
                    )}

                    {formData.invoice_type === "nfse" && (
                      <div className="col-span-2">
                        <Label>Código de Verificação</Label>
                        <Input
                          value={formData.verification_code}
                          onChange={(e) => setFormData({ ...formData, verification_code: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="taxes" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {formData.invoice_type === "nfse" && (
                      <>
                        <div>
                          <Label>Valor Serviços</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.services_amount}
                            onChange={(e) => setFormData({ ...formData, services_amount: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Código do Serviço</Label>
                          <Input
                            value={formData.service_code}
                            onChange={(e) => setFormData({ ...formData, service_code: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>ISS (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.iss_rate}
                            onChange={(e) => setFormData({ ...formData, iss_rate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>ISS (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.iss_amount}
                            onChange={(e) => setFormData({ ...formData, iss_amount: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {formData.invoice_type === "nfe" && (
                      <>
                        <div>
                          <Label>Valor Produtos</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.products_amount}
                            onChange={(e) => setFormData({ ...formData, products_amount: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>ICMS (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.icms_rate}
                            onChange={(e) => setFormData({ ...formData, icms_rate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>ICMS (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.icms_amount}
                            onChange={(e) => setFormData({ ...formData, icms_amount: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label>PIS (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.pis_amount}
                        onChange={(e) => setFormData({ ...formData, pis_amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>COFINS (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.cofins_amount}
                        onChange={(e) => setFormData({ ...formData, cofins_amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>IR (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.ir_amount}
                        onChange={(e) => setFormData({ ...formData, ir_amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>CSLL (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.csll_amount}
                        onChange={(e) => setFormData({ ...formData, csll_amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>INSS (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.inss_amount}
                        onChange={(e) => setFormData({ ...formData, inss_amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>CNAE</Label>
                      <Input
                        value={formData.cnae_code}
                        onChange={(e) => setFormData({ ...formData, cnae_code: e.target.value })}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="extra" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Município (Código IBGE)</Label>
                      <Input
                        value={formData.city_code}
                        onChange={(e) => setFormData({ ...formData, city_code: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Município (Nome)</Label>
                      <Input
                        value={formData.city_name}
                        onChange={(e) => setFormData({ ...formData, city_name: e.target.value })}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>URL do PDF</Label>
                      <Input
                        value={formData.pdf_url}
                        onChange={(e) => setFormData({ ...formData, pdf_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>URL do XML</Label>
                      <Input
                        value={formData.xml_url}
                        onChange={(e) => setFormData({ ...formData, xml_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>

                    {formData.status === "cancelled" && (
                      <div className="col-span-2">
                        <Label>Motivo do Cancelamento</Label>
                        <Textarea
                          value={formData.cancellation_reason}
                          onChange={(e) => setFormData({ ...formData, cancellation_reason: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="col-span-2">
                      <Label>Observações Internas</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">NFSe Emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.nfse)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">NFe Emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.nfe)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Faturado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notas Emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, descrição, número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="nfse">NFSe</SelectItem>
            <SelectItem value="nfe">NFe</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="issued">Emitidas</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma nota fiscal encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedNotas.map((nota) => (
                    <TableRow key={nota.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {typeLabels[nota.invoice_type] || nota.invoice_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        <div>
                          <div>{nota.invoice_number || "-"}</div>
                          {nota.access_key && (
                            <button
                              onClick={() => handleCopyAccessKey(nota.access_key!, nota.id)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                            >
                              {copiedId === nota.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              <span className="truncate max-w-[120px]">{nota.access_key}</span>
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {nota.clients?.full_name || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(nota.issue_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(nota.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[nota.status] || ""}>
                          {statusLabels[nota.status] || nota.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {nota.pdf_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={nota.pdf_url} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {nota.xml_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={nota.xml_url} target="_blank" rel="noopener noreferrer">
                                <FileCode className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(nota)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remover esta nota fiscal?")) {
                                deleteMutation.mutate(nota.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
