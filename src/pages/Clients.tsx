import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, ArrowRight } from "lucide-react";
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

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

  const filtered = clients.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_e164.includes(searchQuery)
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Clientes</h1>
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
                    setNewPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }} 
                  placeholder="+5511999999999"
                  className={phoneError ? "border-destructive" : ""}
                />
                {phoneError && (
                  <p className="text-xs text-destructive">{phoneError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Formato: +[código país][número]. Ex: +5511999999999
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
