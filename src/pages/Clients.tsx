import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ArrowRight, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, Package, ChevronRight, RefreshCw, MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { VNPSBadge } from "@/components/ui/vnps-badge";
import { ClientInfoForm, ClientFormData, getEmptyClientFormData } from "@/components/client/ClientInfoForm";
import { validateCPF, validateCNPJ } from "@/lib/validators";

// E.164 format: + followed by 1-15 digits
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const validateE164 = (phone: string): { valid: boolean; message?: string } => {
  if (!phone) return { valid: false, message: "Telefone é obrigatório" };
  if (!phone.startsWith("+")) return { valid: false, message: "Deve começar com +" };
  if (!E164_REGEX.test(phone)) return { valid: false, message: "Formato inválido. Ex: +5511999999999" };
  return { valid: true };
};

// Mask phone input to E.164 format
const formatPhoneE164 = (value: string): string => {
  let digits = value.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    digits = "+" + digits.replace(/\+/g, "");
  }
  digits = "+" + digits.slice(1).replace(/\+/g, "");
  return digits.slice(0, 16);
};

interface CsvRow {
  full_name: string;
  phone_e164: string;
  valid: boolean;
  error?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

const parseCSV = (content: string): CsvRow[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim().replace(/"/g, ""));
  const nameIndex = header.findIndex(h => h.includes("nome") || h === "name" || h === "full_name");
  const phoneIndex = header.findIndex(h => h.includes("telefone") || h.includes("phone") || h === "phone_e164");

  if (nameIndex === -1 || phoneIndex === -1) {
    return [];
  }

  return lines.slice(1).map(line => {
    const values = line.split(/[,;]/).map(v => v.trim().replace(/^"|"$/g, ""));
    const name = values[nameIndex] || "";
    let phone = values[phoneIndex] || "";
    
    // Auto-format phone
    phone = formatPhoneE164(phone);
    
    const phoneValidation = validateE164(phone);
    
    return {
      full_name: name,
      phone_e164: phone,
      valid: !!name && phoneValidation.valid,
      error: !name ? "Nome vazio" : (!phoneValidation.valid ? phoneValidation.message : undefined),
    };
  });
};

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [vnpsMap, setVnpsMap] = useState<Record<string, any>>({});
  const [whatsappMap, setWhatsappMap] = useState<Record<string, { hasConversation: boolean; messageCount: number; lastMessageAt: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newClientData, setNewClientData] = useState<ClientFormData>(getEmptyClientFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // CSV Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);

  // Bulk Omie Sync state
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select(`
        *,
        client_products (
          product_id,
          products (
            id,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (!error) {
      setClients(data || []);
      
      // Fetch V-NPS and WhatsApp data for all clients
      if (data && data.length > 0) {
        const clientIds = data.map(c => c.id);
        
        // Fetch V-NPS
        const { data: vnpsData } = await supabase
          .from("vnps_snapshots")
          .select("*")
          .in("client_id", clientIds)
          .order("computed_at", { ascending: false });
        
        // Group by client_id and take latest
        const vnpsGrouped: Record<string, any> = {};
        (vnpsData || []).forEach((v: any) => {
          if (!vnpsGrouped[v.client_id]) {
            vnpsGrouped[v.client_id] = v;
          }
        });
        setVnpsMap(vnpsGrouped);
        
        // Fetch WhatsApp conversations and message counts
        const { data: conversationsData } = await supabase
          .from("conversations")
          .select("client_id")
          .in("client_id", clientIds);
        
        // Fetch latest message per client
        const { data: messagesData } = await supabase
          .from("message_events")
          .select("client_id, sent_at")
          .in("client_id", clientIds)
          .order("sent_at", { ascending: false });
        
        // Build WhatsApp status map
        const whatsappGrouped: Record<string, { hasConversation: boolean; messageCount: number; lastMessageAt: string | null }> = {};
        
        // Initialize with conversation data
        (conversationsData || []).forEach((c: any) => {
          if (!whatsappGrouped[c.client_id]) {
            whatsappGrouped[c.client_id] = { hasConversation: true, messageCount: 0, lastMessageAt: null };
          }
        });
        
        // Add message counts and last message date
        const messageCountMap = new Map<string, number>();
        const lastMessageMap = new Map<string, string>();
        
        (messagesData || []).forEach((m: any) => {
          messageCountMap.set(m.client_id, (messageCountMap.get(m.client_id) || 0) + 1);
          if (!lastMessageMap.has(m.client_id)) {
            lastMessageMap.set(m.client_id, m.sent_at);
          }
        });
        
        messageCountMap.forEach((count, clientId) => {
          if (!whatsappGrouped[clientId]) {
            whatsappGrouped[clientId] = { hasConversation: true, messageCount: count, lastMessageAt: lastMessageMap.get(clientId) || null };
          } else {
            whatsappGrouped[clientId].messageCount = count;
            whatsappGrouped[clientId].lastMessageAt = lastMessageMap.get(clientId) || null;
          }
        });
        
        setWhatsappMap(whatsappGrouped);
      }
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error) setProducts(data || []);
  };

  useEffect(() => {
    fetchClients();
    fetchProducts();
  }, []);

  const handleAddClient = async () => {
    const errors: Record<string, string> = {};
    if (!newClientData.full_name.trim()) errors.full_name = "Nome é obrigatório";
    if (!newClientData.phone_e164.trim() || !/^\+[1-9]\d{1,14}$/.test(newClientData.phone_e164)) {
      errors.phone_e164 = "Telefone inválido. Ex: +5511999999999";
    }
    if (newClientData.cpf && !validateCPF(newClientData.cpf)) errors.cpf = "CPF inválido";
    if (newClientData.cnpj && !validateCNPJ(newClientData.cnpj)) errors.cnpj = "CNPJ inválido";
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Corrija os erros no formulário");
      return;
    }
    setFormErrors({});

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("account_id")
        .single();
      
      if (userError || !userData) {
        toast.error("Perfil não encontrado. Faça logout e login novamente.");
        return;
      }

      const { data: newClient, error } = await supabase.from("clients").insert({
        account_id: userData.account_id,
        full_name: newClientData.full_name.trim(),
        phone_e164: newClientData.phone_e164.trim(),
        emails: newClientData.emails,
        additional_phones: newClientData.additional_phones,
        cpf: newClientData.cpf?.replace(/\D/g, '') || null,
        cnpj: newClientData.cnpj?.replace(/\D/g, '') || null,
        birth_date: newClientData.birth_date || null,
        company_name: newClientData.company_name || null,
        notes: newClientData.notes || null,
        street: newClientData.street || null,
        street_number: newClientData.street_number || null,
        complement: newClientData.complement || null,
        neighborhood: newClientData.neighborhood || null,
        city: newClientData.city || null,
        state: newClientData.state || null,
        zip_code: newClientData.zip_code?.replace(/\D/g, '') || null,
      }).select().single();

      if (error) throw error;

      if (selectedProducts.length > 0 && newClient) {
        const clientProducts = selectedProducts.map(productId => ({
          account_id: userData.account_id,
          client_id: newClient.id,
          product_id: productId,
        }));
        await supabase.from("client_products").insert(clientProducts);
      }
      
      toast.success("Cliente adicionado!");
      setDialogOpen(false);
      setNewClientData(getEmptyClientFormData());
      setSelectedProducts([]);
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar cliente");
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      
      if (parsed.length === 0) {
        toast.error("CSV inválido. Certifique-se de ter colunas 'nome' e 'telefone'.");
        return;
      }
      
      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = csvData.filter(row => row.valid);
    if (validRows.length === 0) {
      toast.error("Nenhum registro válido para importar");
      return;
    }

    setImporting(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("account_id")
        .single();
      
      if (userError || !userData) {
        toast.error("Perfil não encontrado. Faça logout e login novamente.");
        return;
      }

      const clientsToInsert = validRows.map(row => ({
        account_id: userData.account_id,
        full_name: row.full_name,
        phone_e164: row.phone_e164,
      }));

      const { error } = await supabase.from("clients").insert(clientsToInsert);

      if (error) throw error;

      toast.success(`${validRows.length} cliente(s) importado(s) com sucesso!`);
      setImportDialogOpen(false);
      setCsvData([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchClients();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Erro ao importar clientes");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = "nome,telefone\nJoão Silva,+5511999999999\nMaria Santos,+5521988888888";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkOmieSync = async () => {
    if (clients.length === 0) {
      toast.error("Nenhum cliente para sincronizar");
      return;
    }

    setBulkSyncing(true);
    setSyncProgress({ current: 0, total: clients.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      setSyncProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const { error } = await supabase.functions.invoke('sync-omie', {
          body: { client_id: client.id }
        });

        if (error) {
          console.error(`Sync failed for ${client.full_name}:`, error);
          failed++;
        } else {
          success++;
        }
      } catch (err) {
        console.error(`Sync error for ${client.full_name}:`, err);
        failed++;
      }
    }

    setSyncProgress(prev => ({ ...prev, success, failed }));
    setBulkSyncing(false);

    if (failed === 0) {
      toast.success(`${success} cliente(s) sincronizado(s) com sucesso!`);
    } else {
      toast.warning(`Sincronização concluída: ${success} sucesso, ${failed} falha(s)`);
    }

    fetchClients();
  };

  const validCount = csvData.filter(r => r.valid).length;
  const invalidCount = csvData.filter(r => !r.valid).length;

  const filtered = clients.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_e164.includes(searchQuery)
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex gap-2 flex-wrap">
          {/* Bulk Omie Sync */}
          <Button 
            variant="outline" 
            onClick={handleBulkOmieSync}
            disabled={bulkSyncing || clients.length === 0}
          >
            {bulkSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {syncProgress.current}/{syncProgress.total}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Omie
              </>
            )}
          </Button>

          {/* Import CSV Dialog */}
          <Dialog open={importDialogOpen} onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) {
              setCsvData([]);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Importar Clientes via CSV
                </DialogTitle>
                <DialogDescription>
                  Faça upload de um arquivo CSV com colunas "nome" e "telefone"
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                </div>

                {csvData.length > 0 && (
                  <>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {validCount} válido(s)
                      </Badge>
                      {invalidCount > 0 && (
                        <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                          <AlertCircle className="h-3 w-3" />
                          {invalidCount} inválido(s)
                        </Badge>
                      )}
                    </div>

                    <ScrollArea className="h-64 border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">Status</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvData.map((row, index) => (
                            <TableRow key={index} className={!row.valid ? "bg-destructive/5" : ""}>
                              <TableCell>
                                {row.valid ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{row.full_name || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{row.phone_e164 || "-"}</TableCell>
                              <TableCell className="text-xs text-destructive">{row.error || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importing || validCount === 0}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar {validCount} Cliente(s)
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Single Client Dialog */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setNewClientData(getEmptyClientFormData());
              setSelectedProducts([]);
              setFormErrors({});
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
                <DialogDescription>Adicione um novo cliente com todos os dados cadastrais.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6">
                  <ClientInfoForm 
                    data={newClientData} 
                    onChange={setNewClientData}
                    errors={formErrors}
                    showBasicFields={true}
                  />
                  
                  {/* Product Selection */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Produtos
                    </Label>
                    {products.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhum produto cadastrado. <Link to="/products" className="text-primary underline">Criar produtos</Link>
                      </p>
                    ) : (
                      <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                        {products.map((product) => (
                          <label
                            key={product.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={() => toggleProduct(product.id)}
                            />
                            <span className="flex-1 text-sm">{product.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddClient}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((client) => {
          const clientProducts = client.client_products?.map((cp: any) => cp.products?.name).filter(Boolean) || [];
          
          return (
            <Card key={client.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{client.full_name}</p>
                  <p className="text-sm text-muted-foreground">{client.phone_e164}</p>
                  {clientProducts.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {clientProducts.map((productName: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {productName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* WhatsApp indicator */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                          whatsappMap[client.id]?.messageCount > 0 
                            ? "bg-emerald-500/10 text-emerald-600" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <MessageCircle className="h-3.5 w-3.5" />
                          {whatsappMap[client.id]?.messageCount > 0 && (
                            <span className="font-medium">{whatsappMap[client.id].messageCount}</span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {whatsappMap[client.id]?.messageCount > 0 ? (
                          <div className="text-xs">
                            <p className="font-medium">WhatsApp conectado</p>
                            <p>{whatsappMap[client.id].messageCount} mensagem(ns)</p>
                            {whatsappMap[client.id].lastMessageAt && (
                              <p className="text-muted-foreground">
                                Última: {new Date(whatsappMap[client.id].lastMessageAt!).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs">Sem mensagens WhatsApp</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {vnpsMap[client.id] && (
                    <VNPSBadge
                      score={vnpsMap[client.id].vnps_score}
                      vnpsClass={vnpsMap[client.id].vnps_class}
                      trend={vnpsMap[client.id].trend}
                      size="sm"
                    />
                  )}
                  <StatusIndicator status={client.status} size="sm" />
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/clients/${client.id}`}>Ver <ArrowRight className="h-4 w-4 ml-1" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</p>
        )}
      </div>
    </div>
  );
}