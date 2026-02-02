import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Pencil, Copy, Link, RefreshCw, Upload, FileText, X, Loader2, Image as ImageIcon, CalendarOff } from "lucide-react";
import { toast } from "sonner";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  modality: "online" | "presencial";
  address: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  budget: number | null;
  expected_attendees: number | null;
  status: string | null;
  public_registration_code: string | null;
  invitation_file_url: string | null;
  rsvp_closed?: boolean;
  rsvp_deadline?: string | null;
  rsvp_closure_message?: string | null;
}

interface Props {
  event: Event;
  accountId: string | null;
  onUpdate: () => void;
}

export default function EventOverviewTab({ event, accountId, onUpdate }: Props) {
  const { toast: hookToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // RSVP closure states
  const [rsvpClosed, setRsvpClosed] = useState(event.rsvp_closed ?? false);
  const [rsvpDeadline, setRsvpDeadline] = useState(event.rsvp_deadline || "");
  const [rsvpClosureMessage, setRsvpClosureMessage] = useState(event.rsvp_closure_message || "");
  const [savingRsvpSettings, setSavingRsvpSettings] = useState(false);

  // Sync RSVP states when event prop changes
  useEffect(() => {
    setRsvpClosed(event.rsvp_closed ?? false);
    setRsvpDeadline(event.rsvp_deadline || "");
    setRsvpClosureMessage(event.rsvp_closure_message || "");
  }, [event.rsvp_closed, event.rsvp_deadline, event.rsvp_closure_message]);

  const isRsvpCurrentlyClosed = rsvpClosed || (rsvpDeadline && new Date(rsvpDeadline) < new Date());
  
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description || "",
    status: event.status || "draft",
    budget: event.budget?.toString() || "",
    expected_attendees: event.expected_attendees?.toString() || "",
    meeting_url: event.meeting_url || "",
    material_url: event.material_url || "",
    address: event.address || "",
  });

  const generateRegistrationCode = async () => {
    setGeneratingCode(true);
    
    try {
      const { data: newCode, error: codeError } = await supabase.rpc("generate_registration_code");
      
      if (codeError) throw codeError;
      
      const { error } = await supabase
        .from("events")
        .update({ public_registration_code: newCode })
        .eq("id", event.id);
      
      if (error) throw error;
      
      toast.success("Código de inscrição gerado com sucesso!");
      onUpdate();
    } catch (error) {
      console.error("Error generating code:", error);
      toast.error("Erro ao gerar código de inscrição");
    } finally {
      setGeneratingCode(false);
    }
  };

  const saveRsvpSettings = async () => {
    setSavingRsvpSettings(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          rsvp_closed: rsvpClosed,
          rsvp_deadline: rsvpDeadline || null,
          rsvp_closure_message: rsvpClosureMessage || null,
        })
        .eq("id", event.id);
      
      if (error) throw error;
      toast.success("Configurações de RSVP salvas!");
      onUpdate();
    } catch (error) {
      console.error("Error saving RSVP settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingRsvpSettings(false);
    }
  };

  const copyRegistrationLink = () => {
    const link = `${window.location.origin}/inscricao/${event.public_registration_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link de inscrição copiado!");
  };

  const handleFileUpload = async (file: File) => {
    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WEBP, GIF ou PDF.");
      return;
    }

    setUploadingFile(true);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
      const filePath = `${event.id}/invitation-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('event-media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-media')
        .getPublicUrl(filePath);

      // Update event with file URL
      const { error: updateError } = await supabase
        .from('events')
        .update({ invitation_file_url: publicUrl })
        .eq('id', event.id);

      if (updateError) throw updateError;

      toast.success("Arquivo do convite salvo com sucesso!");
      onUpdate();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = async () => {
    try {
      // Extract file path from URL
      if (event.invitation_file_url) {
        const urlParts = event.invitation_file_url.split('/event-media/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('event-media').remove([filePath]);
        }
      }

      // Clear URL in database
      const { error } = await supabase
        .from('events')
        .update({ invitation_file_url: null })
        .eq('id', event.id);

      if (error) throw error;

      toast.success("Arquivo removido com sucesso!");
      onUpdate();
    } catch (error) {
      console.error("Error removing file:", error);
      toast.error("Erro ao remover arquivo");
    }
  };

  const isImageFile = (url: string | null) => {
    if (!url) return false;
    const extension = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '');
  };

  const getFileName = (url: string | null) => {
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  const handleSave = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from("events")
      .update({
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        expected_attendees: formData.expected_attendees ? parseInt(formData.expected_attendees) : null,
        meeting_url: formData.meeting_url || null,
        material_url: formData.material_url || null,
        address: formData.address || null,
      })
      .eq("id", event.id);

    if (error) {
      hookToast({
        title: "Erro",
        description: "Não foi possível atualizar o evento",
        variant: "destructive",
      });
    } else {
      hookToast({
        title: "Sucesso",
        description: "Evento atualizado com sucesso",
      });
      setEditing(false);
      onUpdate();
    }
    
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Informações do Evento</CardTitle>
            <CardDescription>Dados gerais e configurações</CardDescription>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={!editing}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={!editing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="planned">Planejado</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!editing}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Orçamento (R$)</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                disabled={!editing}
                placeholder="0,00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expected_attendees">Participantes Esperados</Label>
              <Input
                id="expected_attendees"
                type="number"
                value={formData.expected_attendees}
                onChange={(e) => setFormData({ ...formData, expected_attendees: e.target.value })}
                disabled={!editing}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meeting_url">Link da Reunião</Label>
              <Input
                id="meeting_url"
                type="url"
                value={formData.meeting_url}
                onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                disabled={!editing}
                placeholder="https://..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="material_url">Link do Material</Label>
              <Input
                id="material_url"
                type="url"
                value={formData.material_url}
                onChange={(e) => setFormData({ ...formData, material_url: e.target.value })}
                disabled={!editing}
                placeholder="https://..."
              />
            </div>
          </div>

          {event.modality === "presencial" && (
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!editing}
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Public Registration Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            RSVP
          </CardTitle>
          <CardDescription>
            Compartilhe este link para que as pessoas possam se inscrever no evento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {event.public_registration_code ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={`${window.location.origin}/inscricao/${event.public_registration_code}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyRegistrationLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Código: <code className="bg-muted px-2 py-1 rounded">{event.public_registration_code}</code>
                </span>
                <Button variant="ghost" size="sm" onClick={generateRegistrationCode} disabled={generatingCode}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${generatingCode ? "animate-spin" : ""}`} />
                  Gerar novo código
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Gere um código para criar um link de RSVP para este evento.
              </p>
              <Button onClick={generateRegistrationCode} disabled={generatingCode}>
                {generatingCode ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Gerar Link de Inscrição
                  </>
                )}
              </Button>
            </div>
          )}

          {/* RSVP Closure Controls */}
          {event.public_registration_code && (
            <div className="mt-6 pt-6 border-t space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Controle de Confirmações</Label>
                {isRsvpCurrentlyClosed && (
                  <Badge variant="destructive">Encerrado</Badge>
                )}
              </div>
              
              {/* Toggle encerrar manualmente */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Encerrar confirmações</Label>
                  <p className="text-xs text-muted-foreground">
                    {rsvpClosed 
                      ? "Link bloqueado - ninguém pode confirmar" 
                      : "Link ativo - confirmações abertas"}
                  </p>
                </div>
                <Switch
                  checked={rsvpClosed}
                  onCheckedChange={setRsvpClosed}
                />
              </div>

              {/* Data limite automática */}
              {!rsvpClosed && (
                <div className="space-y-2">
                  <Label className="text-sm">Encerrar automaticamente em:</Label>
                  <Input
                    type="datetime-local"
                    value={rsvpDeadline}
                    onChange={(e) => setRsvpDeadline(e.target.value)}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Após esta data, novas confirmações serão bloqueadas
                  </p>
                </div>
              )}

              {/* Mensagem de encerramento */}
              <div className="space-y-2">
                <Label className="text-sm">Mensagem quando encerrado (opcional)</Label>
                <Textarea
                  value={rsvpClosureMessage}
                  onChange={(e) => setRsvpClosureMessage(e.target.value)}
                  placeholder="Ex: As confirmações foram encerradas. Agradecemos o interesse!"
                  rows={2}
                />
              </div>

              {/* Botão salvar */}
              <Button 
                onClick={saveRsvpSettings} 
                disabled={savingRsvpSettings}
                size="sm"
              >
                {savingRsvpSettings ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Invitation File Upload Section */}
          <div className="mt-6 pt-6 border-t">
            <Label className="text-sm font-medium">Arquivo do Convite (opcional)</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Adicione uma imagem ou PDF para enviar junto com o link de inscrição
            </p>

            {event.invitation_file_url ? (
              <div className="space-y-3">
                {isImageFile(event.invitation_file_url) ? (
                  <div className="relative rounded-lg border overflow-hidden max-w-xs">
                    <img 
                      src={event.invitation_file_url} 
                      alt="Convite do evento" 
                      className="w-full h-auto max-h-48 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={handleRemoveFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="p-2 rounded bg-red-100 dark:bg-red-900/30">
                      <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getFileName(event.invitation_file_url)}</p>
                      <a 
                        href={event.invitation_file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Abrir arquivo
                      </a>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={handleRemoveFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                >
                  {uploadingFile ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Substituir arquivo
                </Button>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Enviando...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Clique para adicionar uma imagem ou PDF
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WEBP, GIF ou PDF (máx. 50MB)
                    </p>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
