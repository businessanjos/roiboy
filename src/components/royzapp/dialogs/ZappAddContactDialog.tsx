import { memo, useState } from "react";
import { UserPlus, TrendingUp, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ZappAddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  contactName: string;
  showLeadOption: boolean;
  onSaveClient: (data: { full_name: string; phone_e164: string }) => Promise<void>;
  onSaveLead: (data: { full_name: string; phone: string; email?: string; source?: string; notes?: string }) => Promise<void>;
  savingClient: boolean;
  savingLead: boolean;
}

const LEAD_SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

export const ZappAddContactDialog = memo(function ZappAddContactDialog({
  open,
  onOpenChange,
  phone,
  contactName,
  showLeadOption,
  onSaveClient,
  onSaveLead,
  savingClient,
  savingLead,
}: ZappAddContactDialogProps) {
  const [activeTab, setActiveTab] = useState<"client" | "lead">("client");
  
  // Client form
  const [clientForm, setClientForm] = useState({
    full_name: contactName || "",
    phone_e164: phone || "",
  });
  
  // Lead form
  const [leadForm, setLeadForm] = useState({
    full_name: contactName || "",
    phone: phone || "",
    email: "",
    source: "whatsapp",
    notes: "",
  });

  // Reset forms when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setClientForm({ full_name: contactName || "", phone_e164: phone || "" });
      setLeadForm({ full_name: contactName || "", phone: phone || "", email: "", source: "whatsapp", notes: "" });
      setActiveTab("client");
    }
    onOpenChange(isOpen);
  };

  const handleSaveClient = async () => {
    await onSaveClient(clientForm);
  };

  const handleSaveLead = async () => {
    await onSaveLead(leadForm);
  };

  const saving = savingClient || savingLead;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zapp-panel border-zapp-border text-zapp-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-zapp-accent" />
            Cadastrar Contato
          </DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Cadastre este contato no sistema
          </DialogDescription>
        </DialogHeader>

        {showLeadOption ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "client" | "lead")}>
            <TabsList className="w-full grid grid-cols-2 bg-zapp-bg-dark">
              <TabsTrigger 
                value="client" 
                className="text-zapp-text data-[state=active]:bg-zapp-accent data-[state=active]:text-white"
              >
                <Users className="h-4 w-4 mr-1.5" />
                Cliente
              </TabsTrigger>
              <TabsTrigger 
                value="lead" 
                className="text-zapp-text data-[state=active]:bg-blue-500 data-[state=active]:text-white"
              >
                <TrendingUp className="h-4 w-4 mr-1.5" />
                Lead
              </TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name" className="text-zapp-text-muted">Nome completo</Label>
                <Input
                  id="client-name"
                  value={clientForm.full_name}
                  onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                  placeholder="Nome do cliente"
                  className="bg-zapp-bg border-zapp-border text-zapp-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone" className="text-zapp-text-muted">Telefone</Label>
                <Input
                  id="client-phone"
                  value={clientForm.phone_e164}
                  className="bg-zapp-bg border-zapp-border text-zapp-text-muted"
                  readOnly
                />
                <p className="text-xs text-zapp-text-muted">
                  Preenchido automaticamente com o número da conversa
                </p>
              </div>
            </TabsContent>

            <TabsContent value="lead" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lead-name" className="text-zapp-text-muted">Nome completo *</Label>
                <Input
                  id="lead-name"
                  value={leadForm.full_name}
                  onChange={(e) => setLeadForm({ ...leadForm, full_name: e.target.value })}
                  placeholder="Nome do lead"
                  className="bg-zapp-bg border-zapp-border text-zapp-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="lead-phone" className="text-zapp-text-muted">Telefone</Label>
                  <Input
                    id="lead-phone"
                    value={leadForm.phone}
                    className="bg-zapp-bg border-zapp-border text-zapp-text-muted"
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-source" className="text-zapp-text-muted">Origem</Label>
                  <Select
                    value={leadForm.source}
                    onValueChange={(v) => setLeadForm({ ...leadForm, source: v })}
                  >
                    <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zapp-panel border-zapp-border">
                      {LEAD_SOURCES.map((source) => (
                        <SelectItem 
                          key={source.value} 
                          value={source.value}
                          className="text-zapp-text hover:bg-zapp-hover"
                        >
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-email" className="text-zapp-text-muted">E-mail (opcional)</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="bg-zapp-bg border-zapp-border text-zapp-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-notes" className="text-zapp-text-muted">Observações (opcional)</Label>
                <Textarea
                  id="lead-notes"
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  placeholder="Anotações sobre o lead..."
                  className="bg-zapp-bg border-zapp-border text-zapp-text resize-none"
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="client-name-simple" className="text-zapp-text-muted">Nome completo</Label>
              <Input
                id="client-name-simple"
                value={clientForm.full_name}
                onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                placeholder="Nome do cliente"
                className="bg-zapp-bg border-zapp-border text-zapp-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone-simple" className="text-zapp-text-muted">Telefone</Label>
              <Input
                id="client-phone-simple"
                value={clientForm.phone_e164}
                className="bg-zapp-bg border-zapp-border text-zapp-text-muted"
                readOnly
              />
              <p className="text-xs text-zapp-text-muted">
                Preenchido automaticamente com o número da conversa
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)} 
            className="border-zapp-border text-zapp-text-muted hover:bg-zapp-hover"
            disabled={saving}
          >
            Cancelar
          </Button>
          {showLeadOption && activeTab === "lead" ? (
            <Button
              onClick={handleSaveLead}
              disabled={saving || !leadForm.full_name.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {savingLead ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-1.5" />
                  Cadastrar Lead
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSaveClient}
              disabled={saving || !clientForm.full_name.trim()}
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
            >
              {savingClient ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-1.5" />
                  Cadastrar Cliente
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
