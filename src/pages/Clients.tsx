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
import { Plus, Search, ArrowRight, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { StatusIndicator } from "@/components/ui/status-indicator";

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // CSV Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setClients(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAddClient = async () => {
    if (!newName.trim()) {
      toast.error("Preencha o nome do cliente");
      return;
    }

    const phoneValidation = validateE164(newPhone.trim());
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.message || "Telefone inválido");
      return;
    }
    setPhoneError(null);

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("account_id")
        .single();
      
      if (userError || !userData) {
        console.error("User profile error:", userError);
        toast.error("Perfil não encontrado. Faça logout e login novamente.");
        return;
      }

      const { error } = await supabase.from("clients").insert({
        account_id: userData.account_id,
        full_name: newName.trim(),
        phone_e164: newPhone.trim(),
      });

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }
      
      toast.success("Cliente adicionado!");
      setDialogOpen(false);
      setNewName("");
      setNewPhone("");
      fetchClients();
    } catch (error: any) {
      console.error("Add client error:", error);
      toast.error(error.message || "Erro ao adicionar cliente");
    }
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
        <div className="flex gap-2">
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
                <DialogDescription>Adicione um novo cliente para monitorar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João Silva" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone (E.164)</Label>
                  <Input 
                    value={newPhone} 
                    onChange={(e) => {
                      const formatted = formatPhoneE164(e.target.value);
                      setNewPhone(formatted);
                      if (phoneError) setPhoneError(null);
                    }} 
                    placeholder="+5511999999999"
                    className={phoneError ? "border-destructive" : ""}
                    maxLength={16}
                  />
                  {phoneError && (
                    <p className="text-xs text-destructive">{phoneError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Digite apenas números. O + é adicionado automaticamente.
                  </p>
                </div>
              </div>
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
        {filtered.map((client) => (
          <Card key={client.id} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{client.full_name}</p>
                <p className="text-sm text-muted-foreground">{client.phone_e164}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusIndicator status={client.status} size="sm" />
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/clients/${client.id}`}>Ver <ArrowRight className="h-4 w-4 ml-1" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</p>
        )}
      </div>
    </div>
  );
}