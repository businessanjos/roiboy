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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, FileText, Trash2, Edit, ExternalLink, Copy, Check, Barcode, Clock, CheckCircle2, AlertCircle, DollarSign } from "lucide-react";
import { FinancialPageHeader, FinancialKpiCard } from "@/components/financial/_shared";
import { formatBRLCompact } from "@/lib/financial-format";

interface Boleto {
  id: string;
  client_id: string | null;
  barcode: string | null;
  digitable_line: string | null;
  our_number: string | null;
  document_number: string | null;
  amount: number;
  discount_amount: number | null;
  interest_amount: number | null;
  fine_amount: number | null;
  paid_amount: number | null;
  issue_date: string;
  due_date: string;
  payment_date: string | null;
  status: string;
  bank_code: string | null;
  bank_name: string | null;
  bank_account_id: string | null;
  external_url: string | null;
  pdf_url: string | null;
  description: string | null;
  notes: string | null;
  clients?: { full_name: string } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
  overdue: "Vencido",
};

export default function FinancialBoletosPage() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBoleto, setEditingBoleto] = useState<Boleto | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: "",
    barcode: "",
    digitable_line: "",
    our_number: "",
    document_number: "",
    amount: "",
    discount_amount: "",
    interest_amount: "",
    fine_amount: "",
    paid_amount: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    payment_date: "",
    status: "pending",
    bank_code: "",
    bank_name: "",
    bank_account_id: "",
    external_url: "",
    pdf_url: "",
    description: "",
    notes: "",
  });

  // Fetch boletos
  const { data: boletos, isLoading } = useQuery({
    queryKey: ["boletos", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boletos")
        .select("*, clients(full_name)")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data as Boleto[];
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

  // Fetch bank accounts for select
  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-select", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name")
        .eq("is_active", true)
        .order("name");
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
        barcode: data.barcode || null,
        digitable_line: data.digitable_line || null,
        our_number: data.our_number || null,
        document_number: data.document_number || null,
        amount: parseFloat(data.amount) || 0,
        discount_amount: parseFloat(data.discount_amount) || null,
        interest_amount: parseFloat(data.interest_amount) || null,
        fine_amount: parseFloat(data.fine_amount) || null,
        paid_amount: parseFloat(data.paid_amount) || null,
        issue_date: data.issue_date,
        due_date: data.due_date,
        payment_date: data.payment_date || null,
        status: data.status,
        bank_code: data.bank_code || null,
        bank_name: data.bank_name || null,
        bank_account_id: data.bank_account_id || null,
        external_url: data.external_url || null,
        pdf_url: data.pdf_url || null,
        description: data.description || null,
        notes: data.notes || null,
      };

      if (editingBoleto) {
        const { error } = await supabase
          .from("boletos")
          .update(payload)
          .eq("id", editingBoleto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("boletos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boletos"] });
      toast.success(editingBoleto ? "Boleto atualizado!" : "Boleto cadastrado!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar boleto: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boletos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boletos"] });
      toast.success("Boleto removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover boleto: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBoleto(null);
    setFormData({
      client_id: "",
      barcode: "",
      digitable_line: "",
      our_number: "",
      document_number: "",
      amount: "",
      discount_amount: "",
      interest_amount: "",
      fine_amount: "",
      paid_amount: "",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: "",
      payment_date: "",
      status: "pending",
      bank_code: "",
      bank_name: "",
      bank_account_id: "",
      external_url: "",
      pdf_url: "",
      description: "",
      notes: "",
    });
  };

  const handleEdit = (boleto: Boleto) => {
    setEditingBoleto(boleto);
    setFormData({
      client_id: boleto.client_id || "",
      barcode: boleto.barcode || "",
      digitable_line: boleto.digitable_line || "",
      our_number: boleto.our_number || "",
      document_number: boleto.document_number || "",
      amount: boleto.amount?.toString() || "",
      discount_amount: boleto.discount_amount?.toString() || "",
      interest_amount: boleto.interest_amount?.toString() || "",
      fine_amount: boleto.fine_amount?.toString() || "",
      paid_amount: boleto.paid_amount?.toString() || "",
      issue_date: boleto.issue_date || "",
      due_date: boleto.due_date || "",
      payment_date: boleto.payment_date || "",
      status: boleto.status || "pending",
      bank_code: boleto.bank_code || "",
      bank_name: boleto.bank_name || "",
      bank_account_id: boleto.bank_account_id || "",
      external_url: boleto.external_url || "",
      pdf_url: boleto.pdf_url || "",
      description: boleto.description || "",
      notes: boleto.notes || "",
    });
    setDialogOpen(true);
  };

  const handleCopyDigitableLine = async (line: string, id: string) => {
    await navigator.clipboard.writeText(line);
    setCopiedId(id);
    toast.success("Linha digitável copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredBoletos = useMemo(() => {
    if (!boletos) return [];
    return boletos.filter((boleto) => {
      const matchesSearch =
        !search ||
        boleto.clients?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        boleto.description?.toLowerCase().includes(search.toLowerCase()) ||
        boleto.document_number?.toLowerCase().includes(search.toLowerCase()) ||
        boleto.our_number?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || boleto.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [boletos, search, statusFilter]);

  const {
    paginatedItems: paginatedBoletos,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    handlePageChange,
    handlePageSizeChange,
  } = useTablePagination(filteredBoletos);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Summary stats
  const stats = useMemo(() => {
    if (!boletos) return { pending: 0, paid: 0, overdue: 0, total: 0 };
    return boletos.reduce(
      (acc, b) => {
        if (b.status === "pending") acc.pending += b.amount;
        if (b.status === "paid") acc.paid += b.paid_amount || b.amount;
        if (b.status === "overdue") acc.overdue += b.amount;
        acc.total += b.amount;
        return acc;
      },
      { pending: 0, paid: 0, overdue: 0, total: 0 }
    );
  }, [boletos]);

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={Barcode}
        title="Boletos"
        description="Emita e acompanhe boletos bancários enviados aos seus clientes."
        actions={
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Boleto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBoleto ? "Editar Boleto" : "Novo Boleto"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(formData);
              }}
              className="space-y-4"
            >
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
                  <Label>Valor *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
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
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label>Data de Vencimento *</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Data de Pagamento</Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Valor Pago</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.paid_amount}
                    onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Linha Digitável</Label>
                  <Input
                    value={formData.digitable_line}
                    onChange={(e) => setFormData({ ...formData, digitable_line: e.target.value })}
                    placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Código de Barras</Label>
                  <Input
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Nosso Número</Label>
                  <Input
                    value={formData.our_number}
                    onChange={(e) => setFormData({ ...formData, our_number: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Nº Documento</Label>
                  <Input
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Conta Bancária</Label>
                  <Select
                    value={formData.bank_account_id}
                    onValueChange={(v) => setFormData({ ...formData, bank_account_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts?.map((ba) => (
                        <SelectItem key={ba.id} value={ba.id}>
                          {ba.name} - {ba.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Banco</Label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="Nome do banco"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.pending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.paid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Emitido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, descrição, documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBoletos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum boleto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedBoletos.map((boleto) => (
                    <TableRow key={boleto.id}>
                      <TableCell className="font-medium">
                        {boleto.clients?.full_name || "-"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{boleto.description || "-"}</div>
                          {boleto.digitable_line && (
                            <button
                              onClick={() => handleCopyDigitableLine(boleto.digitable_line!, boleto.id)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                            >
                              {copiedId === boleto.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              <span className="font-mono truncate max-w-[200px]">
                                {boleto.digitable_line}
                              </span>
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(boleto.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(boleto.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[boleto.status] || ""}>
                          {statusLabels[boleto.status] || boleto.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {boleto.pdf_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={boleto.pdf_url} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {boleto.external_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={boleto.external_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(boleto)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remover este boleto?")) {
                                deleteMutation.mutate(boleto.id);
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
