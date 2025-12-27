import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Loader2, Save, User, Phone, Mail, Building2, MapPin, Calendar, FileText, Instagram } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  formatCPF, 
  formatCNPJ, 
  formatCEP,
  formatBrazilianPhone,
  formatDateBR,
  parseDateBRToISO,
  parseISOToDateBR,
} from "@/lib/validators";

interface ClientQuickEditSheetProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientUpdated?: () => void;
}

interface ClientData {
  id: string;
  full_name: string;
  phone_e164: string;
  emails: string[] | null;
  cpf: string | null;
  cnpj: string | null;
  birth_date: string | null;
  company_name: string | null;
  notes: string | null;
  instagram: string | null;
  bio: string | null;
  avatar_url: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

export function ClientQuickEditSheet({ 
  clientId, 
  open, 
  onOpenChange,
  onClientUpdated 
}: ClientQuickEditSheetProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone_e164: "",
    email: "",
    cpf: "",
    cnpj: "",
    birth_date: "",
    company_name: "",
    notes: "",
    instagram: "",
    bio: "",
    street: "",
    street_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });

  useEffect(() => {
    if (clientId && open) {
      fetchClient();
    }
  }, [clientId, open]);

  const fetchClient = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) throw error;

      const clientData: ClientData = {
        id: data.id,
        full_name: data.full_name,
        phone_e164: data.phone_e164,
        emails: Array.isArray(data.emails) ? data.emails as string[] : null,
        cpf: data.cpf,
        cnpj: data.cnpj,
        birth_date: data.birth_date,
        company_name: data.company_name,
        notes: data.notes,
        instagram: data.instagram,
        bio: data.bio,
        avatar_url: data.avatar_url,
        street: data.street,
        street_number: data.street_number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
      };

      setClient(clientData);
      const emails = clientData.emails;
      setFormData({
        full_name: clientData.full_name || "",
        phone_e164: formatBrazilianPhone(clientData.phone_e164) || clientData.phone_e164 || "",
        email: emails && emails.length > 0 ? emails[0] : "",
        cpf: formatCPF(clientData.cpf || "") || "",
        cnpj: formatCNPJ(clientData.cnpj || "") || "",
        birth_date: clientData.birth_date ? parseISOToDateBR(clientData.birth_date) : "",
        company_name: clientData.company_name || "",
        notes: clientData.notes || "",
        instagram: clientData.instagram || "",
        bio: clientData.bio || "",
        street: clientData.street || "",
        street_number: clientData.street_number || "",
        complement: clientData.complement || "",
        neighborhood: clientData.neighborhood || "",
        city: clientData.city || "",
        state: clientData.state || "",
        zip_code: formatCEP(clientData.zip_code || "") || "",
      });
    } catch (error) {
      console.error("Error fetching client:", error);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId) return;

    setSaving(true);
    try {
      const updateData: any = {
        full_name: formData.full_name.trim(),
        company_name: formData.company_name.trim() || null,
        notes: formData.notes.trim() || null,
        instagram: formData.instagram.trim() || null,
        bio: formData.bio.trim() || null,
        cpf: formData.cpf.replace(/\D/g, "") || null,
        cnpj: formData.cnpj.replace(/\D/g, "") || null,
        birth_date: formData.birth_date ? parseDateBRToISO(formData.birth_date) : null,
        street: formData.street.trim() || null,
        street_number: formData.street_number.trim() || null,
        complement: formData.complement.trim() || null,
        neighborhood: formData.neighborhood.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        zip_code: formData.zip_code.replace(/\D/g, "") || null,
      };

      // Handle email array
      if (formData.email.trim()) {
        updateData.emails = [formData.email.trim()];
      }

      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", clientId);

      if (error) throw error;

      toast.success("Cliente atualizado com sucesso!");
      onClientUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Erro ao atualizar cliente");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[340px] sm:w-[420px] bg-zapp-bg border-zapp-border p-0">
        <SheetHeader className="px-6 py-4 border-b border-zapp-border bg-zapp-panel">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-zapp-text flex items-center gap-3">
              {client && (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={client.avatar_url || undefined} />
                  <AvatarFallback className="bg-zapp-accent text-white">
                    {getInitials(client.full_name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span>Editar Cliente</span>
            </SheetTitle>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-zapp-accent" />
          </div>
        ) : client ? (
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zapp-text font-medium">
                  <User className="h-4 w-4" />
                  <span>Informações Básicas</span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-zapp-text-muted text-xs">Nome completo</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="bg-zapp-panel border-zapp-border text-zapp-text"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">Telefone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
                        <Input
                          value={formData.phone_e164}
                          disabled
                          className="bg-zapp-panel border-zapp-border text-zapp-text-muted pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
                        <Input
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="bg-zapp-panel border-zapp-border text-zapp-text pl-9"
                          type="email"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">CPF</Label>
                      <Input
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                        maxLength={14}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">Data de Nascimento</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
                        <Input
                          value={formData.birth_date}
                          onChange={(e) => setFormData({ ...formData, birth_date: formatDateBR(e.target.value) })}
                          className="bg-zapp-panel border-zapp-border text-zapp-text pl-9"
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-zapp-text-muted text-xs">Instagram</Label>
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
                      <Input
                        value={formData.instagram}
                        onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text pl-9"
                        placeholder="@usuario"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-zapp-border" />

              {/* Company Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zapp-text font-medium">
                  <Building2 className="h-4 w-4" />
                  <span>Empresa</span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-zapp-text-muted text-xs">Nome da Empresa</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="bg-zapp-panel border-zapp-border text-zapp-text"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zapp-text-muted text-xs">CNPJ</Label>
                    <Input
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                      className="bg-zapp-panel border-zapp-border text-zapp-text"
                      maxLength={18}
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-zapp-border" />

              {/* Address */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zapp-text font-medium">
                  <MapPin className="h-4 w-4" />
                  <span>Endereço</span>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">Rua</Label>
                      <Input
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">Número</Label>
                      <Input
                        value={formData.street_number}
                        onChange={(e) => setFormData({ ...formData, street_number: e.target.value })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">Complemento</Label>
                      <Input
                        value={formData.complement}
                        onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">Bairro</Label>
                      <Input
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">Cidade</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">UF</Label>
                      <Input
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                        maxLength={2}
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-zapp-text-muted text-xs">CEP</Label>
                      <Input
                        value={formData.zip_code}
                        onChange={(e) => setFormData({ ...formData, zip_code: formatCEP(e.target.value) })}
                        className="bg-zapp-panel border-zapp-border text-zapp-text"
                        maxLength={9}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-zapp-border" />

              {/* Notes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zapp-text font-medium">
                  <FileText className="h-4 w-4" />
                  <span>Observações</span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-zapp-text-muted text-xs">Bio</Label>
                    <Textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      className="bg-zapp-panel border-zapp-border text-zapp-text resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zapp-text-muted text-xs">Notas internas</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="bg-zapp-panel border-zapp-border text-zapp-text resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-zapp-text-muted">Cliente não encontrado</p>
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zapp-border bg-zapp-panel">
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.full_name.trim()}
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
