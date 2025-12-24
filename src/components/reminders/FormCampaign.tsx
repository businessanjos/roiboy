import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppFormattingToolbar } from "@/components/ui/whatsapp-formatting-toolbar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText,
  Send,
  Users,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Filter,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Form {
  id: string;
  title: string;
  description: string | null;
}

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  status: string;
  tags: string[] | null;
}

interface Product {
  id: string;
  name: string;
}

const STEPS = ["form", "filter", "clients", "message", "review"] as const;
type Step = typeof STEPS[number];

const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  churn: "Churned",
  churn_risk: "Risco de Churn",
  lead: "Lead",
};

export default function FormCampaign() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>("form");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sendMode, setSendMode] = useState<"copy" | "whatsapp">("copy");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // UI state
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });

  // Fetch forms
  const { data: forms = [], isLoading: loadingForms } = useQuery({
    queryKey: ["forms-for-campaign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description")
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data as Form[];
    },
  });

  // Fetch clients
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["clients-for-form-campaign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164, status, tags")
        .order("full_name");
      if (error) throw error;
      return data.map(c => ({
        ...c,
        tags: Array.isArray(c.tags) ? c.tags : [],
      })) as Client[];
    },
  });

  // Fetch products for filter
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch client products for filtering
  const { data: clientProducts = [] } = useQuery({
    queryKey: ["client-products-for-filter", productFilter],
    queryFn: async () => {
      if (productFilter === "all") return [];
      const { data, error } = await supabase
        .from("client_products")
        .select("client_id")
        .eq("product_id", productFilter);
      if (error) throw error;
      return data.map(cp => cp.client_id);
    },
    enabled: productFilter !== "all",
  });

  // Generate default message when form is selected
  useEffect(() => {
    const form = forms.find(f => f.id === selectedFormId);
    if (form) {
      setMessage(
        `Olá {nome}! 👋\n\nPedimos que preencha o formulário "${form.title}" para nos ajudar a atender você melhor.\n\nAcesse pelo link:\n{link}\n\nObrigado!`
      );
    }
  }, [selectedFormId, forms]);

  // Filter clients based on filters
  const filteredClients = clients.filter(client => {
    // Status filter
    if (statusFilter !== "all" && client.status !== statusFilter) {
      return false;
    }
    
    // Product filter
    if (productFilter !== "all" && !clientProducts.includes(client.id)) {
      return false;
    }
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!client.full_name.toLowerCase().includes(search) && 
          !client.phone_e164.includes(search)) {
        return false;
      }
    }
    
    return true;
  });

  const toggleClient = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const selectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const selectFiltered = () => {
    setSelectedClients(filteredClients.map(c => c.id));
  };

  const canProceed = () => {
    switch (currentStep) {
      case "form": return !!selectedFormId;
      case "filter": return true; // Filters are optional
      case "clients": return selectedClients.length > 0;
      case "message": return message.trim().length > 0;
      case "review": return true;
      default: return false;
    }
  };

  const goToStep = (step: Step) => {
    const currentIndex = STEPS.indexOf(currentStep);
    const targetIndex = STEPS.indexOf(step);
    if (targetIndex <= currentIndex || canProceed()) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1 && canProceed()) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const getFormLink = (clientId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/f/${selectedFormId}?clientId=${clientId}`;
  };

  const copyAllLinks = () => {
    const selectedClientData = clients.filter(c => selectedClients.includes(c.id));
    const links = selectedClientData.map(client => {
      const link = getFormLink(client.id);
      const personalizedMessage = message
        .replace("{nome}", client.full_name.split(" ")[0])
        .replace("{link}", link);
      return `${client.full_name}:\n${personalizedMessage}`;
    }).join("\n\n---\n\n");
    
    navigator.clipboard.writeText(links);
    toast.success(`Links copiados para ${selectedClientData.length} clientes!`);
  };

  const handleSendViaWhatsApp = async () => {
    if (!currentUser?.account_id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setSending(true);
    const selectedClientData = clients.filter(c => selectedClients.includes(c.id));
    setSendProgress({ sent: 0, total: selectedClientData.length });

    try {
      // Get WhatsApp integration
      const { data: integration, error: integrationError } = await supabase
        .from("integrations")
        .select("id, status, config")
        .eq("type", "whatsapp")
        .single();

      if (integrationError || !integration || integration.status !== "connected") {
        toast.error("Nenhuma integração WhatsApp configurada e conectada. Use a opção 'Copiar links'.");
        setSending(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedClientData.length; i++) {
        const client = selectedClientData[i];
        const link = getFormLink(client.id);
        const personalizedMessage = message
          .replace("{nome}", client.full_name.split(" ")[0])
          .replace("{link}", link);

        try {
          const { error } = await supabase.functions.invoke("uazapi-manager", {
            body: {
              action: "send_text",
              phone: client.phone_e164,
              message: personalizedMessage,
            },
          });

          if (error) throw error;
          
          // Record the form send
          await supabase
            .from("client_form_sends")
            .upsert({
              account_id: currentUser.account_id,
              client_id: client.id,
              form_id: selectedFormId,
              sent_at: new Date().toISOString(),
            }, { onConflict: 'client_id,form_id' });

          successCount++;
        } catch (err) {
          console.error(`Error sending to ${client.full_name}:`, err);
          failCount++;
        }

        setSendProgress({ sent: i + 1, total: selectedClientData.length });
        
        // Small delay between messages
        if (i < selectedClientData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (successCount > 0) {
        toast.success(`Enviado para ${successCount} clientes!`);
      }
      if (failCount > 0) {
        toast.error(`Falha em ${failCount} envios`);
      }

      // Reset wizard
      setCurrentStep("form");
      setSelectedFormId("");
      setSelectedClients([]);
      setMessage("");
      setStatusFilter("all");
      setProductFilter("all");
      setSearchTerm("");

    } catch (error: any) {
      console.error("Send form campaign error:", error);
      toast.error(error.message || "Erro ao enviar formulários");
    } finally {
      setSending(false);
      setSendProgress({ sent: 0, total: 0 });
    }
  };

  const selectedForm = forms.find(f => f.id === selectedFormId);
  const selectedClientData = clients.filter(c => selectedClients.includes(c.id));

  return (
    <div>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {STEPS.map((step, index) => {
            const isActive = step === currentStep;
            const isPast = STEPS.indexOf(currentStep) > index;
            const stepLabels = {
              form: "Formulário",
              filter: "Filtros",
              clients: "Clientes",
              message: "Mensagem",
              review: "Revisão",
            };
            
            return (
              <div 
                key={step} 
                className="flex items-center cursor-pointer"
                onClick={() => goToStep(step)}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                  isActive 
                    ? "border-primary bg-primary text-primary-foreground" 
                    : isPast 
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                }`}>
                  {isPast ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm font-medium hidden sm:inline ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {stepLabels[step]}
                </span>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 sm:mx-4 text-muted-foreground/50" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card className="min-h-[400px]">
        {/* Step 1: Select Form */}
        {currentStep === "form" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Selecione o Formulário
              </CardTitle>
              <CardDescription>
                Escolha o formulário que deseja enviar para os clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um formulário..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingForms ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : forms.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum formulário ativo</SelectItem>
                  ) : (
                    forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        <div>
                          <span>{form.title}</span>
                          {form.description && (
                            <span className="text-muted-foreground text-sm ml-2">
                              - {form.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </>
        )}

        {/* Step 2: Filter Options */}
        {currentStep === "filter" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtrar Clientes
              </CardTitle>
              <CardDescription>
                Opcionalmente, filtre os clientes por status ou produto (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status do Cliente</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Buscar por nome ou telefone</Label>
                <Input 
                  placeholder="Digite para buscar..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  <strong>{filteredClients.length}</strong> clientes correspondem aos filtros
                </p>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Select Clients */}
        {currentStep === "clients" && (
          <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Selecione os Clientes
                  </CardTitle>
                  <CardDescription>
                    {selectedClients.length} de {filteredClients.length} selecionados
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectFiltered}>
                    Selecionar filtrados
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedClients.length === filteredClients.length ? "Desmarcar" : "Marcar todos"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Carregando clientes...
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhum cliente encontrado
                </div>
              ) : (
                <div className="grid gap-2 max-h-80 overflow-y-auto">
                  {filteredClients.map((client) => {
                    const isSelected = selectedClients.includes(client.id);
                    
                    return (
                      <div
                        key={client.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? "bg-accent border-primary/50" : "hover:bg-muted"
                        }`}
                        onClick={() => toggleClient(client.id)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{client.full_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {client.phone_e164}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {CLIENT_STATUS_LABELS[client.status] || client.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Step 4: Message */}
        {currentStep === "message" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Mensagem
              </CardTitle>
              <CardDescription>
                Personalize a mensagem. Use {"{nome}"} para o nome do cliente e {"{link}"} para o link do formulário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <div className="border rounded-lg overflow-hidden">
                  <WhatsAppFormattingToolbar 
                    value={message}
                    onChange={setMessage}
                  />
                  <Textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="border-0 rounded-none focus-visible:ring-0"
                    placeholder="Digite sua mensagem..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Método de Envio</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      sendMode === "copy" ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50"
                    }`}
                    onClick={() => setSendMode("copy")}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Copy className="h-5 w-5" />
                      <span className="font-medium">Copiar Links</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Copia as mensagens personalizadas para você enviar manualmente
                    </p>
                  </div>
                  <div 
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      sendMode === "whatsapp" ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50"
                    }`}
                    onClick={() => setSendMode("whatsapp")}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Send className="h-5 w-5" />
                      <span className="font-medium">Enviar via WhatsApp</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Envia automaticamente via integração WhatsApp
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 5: Review */}
        {currentStep === "review" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Revisar e Enviar
              </CardTitle>
              <CardDescription>
                Confira os detalhes antes de enviar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Formulário</p>
                  <p className="font-medium">{selectedForm?.title}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Clientes</p>
                  <p className="font-medium">{selectedClients.length} selecionados</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Método</p>
                  <p className="font-medium">{sendMode === "copy" ? "Copiar Links" : "WhatsApp Automático"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Preview da mensagem:</p>
                <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {message
                    .replace("{nome}", selectedClientData[0]?.full_name.split(" ")[0] || "Cliente")
                    .replace("{link}", `${window.location.origin}/f/${selectedFormId}?clientId=...`)}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Clientes selecionados:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectedClientData.slice(0, 10).map(client => (
                    <div key={client.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      <span>{client.full_name}</span>
                      <span className="text-muted-foreground">{client.phone_e164}</span>
                    </div>
                  ))}
                  {selectedClientData.length > 10 && (
                    <p className="text-sm text-muted-foreground">
                      ...e mais {selectedClientData.length - 10} clientes
                    </p>
                  )}
                </div>
              </div>

              {sending && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Enviando...</span>
                    <span>{sendProgress.sent} de {sendProgress.total}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(sendProgress.sent / sendProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between p-6 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === "form" || sending}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          {currentStep === "review" ? (
            <div className="flex gap-2">
              {sendMode === "copy" ? (
                <Button onClick={copyAllLinks} disabled={sending}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Todas as Mensagens
                </Button>
              ) : (
                <Button onClick={handleSendViaWhatsApp} disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar via WhatsApp
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={nextStep} disabled={!canProceed()}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
