import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, FileText, RefreshCw, ExternalLink, Trash2, Copy, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useZapSign } from '@/hooks/useZapSign';
import { toast } from 'sonner';

interface ZapSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  contractId?: string;
  onDocumentCreated?: () => void;
}

export function ZapSignDialog({
  open,
  onOpenChange,
  clientId,
  clientName = '',
  clientEmail = '',
  clientPhone = '',
  contractId,
  onDocumentCreated,
}: ZapSignDialogProps) {
  const {
    loading,
    templates,
    documents,
    listTemplates,
    createDocumentFromUpload,
    createDocumentFromTemplate,
    syncDocumentStatus,
    deleteDocument,
    getLocalDocuments,
    getSignerLink,
  } = useZapSign();

  const [tab, setTab] = useState<'upload' | 'template' | 'list'>('list');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [signerName, setSignerName] = useState(clientName);
  const [signerEmail, setSignerEmail] = useState(clientEmail);
  const [signerPhone, setSignerPhone] = useState(clientPhone);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateVariables, setTemplateVariables] = useState<Array<{ de: string; para: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      getLocalDocuments({ client_id: clientId, contract_id: contractId });
      listTemplates();
    }
  }, [open, clientId, contractId]);

  useEffect(() => {
    setSignerName(clientName);
    setSignerEmail(clientEmail);
    setSignerPhone(clientPhone);
  }, [clientName, clientEmail, clientPhone]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.docx')) {
        toast.error('Apenas arquivos PDF ou DOCX são aceitos');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo deve ter no máximo 10MB');
        return;
      }
      setSelectedFile(file);
      if (!docName) {
        setDocName(file.name.replace(/\.(pdf|docx)$/i, ''));
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !docName || !signerName) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      
      await createDocumentFromUpload({
        name: docName,
        base64_pdf: base64,
        signers: [{
          name: signerName,
          email: signerEmail || undefined,
          phone_number: signerPhone?.replace(/\D/g, '') || undefined,
          phone_country: signerPhone ? '55' : undefined,
          auth_mode: 'assinaturaTela',
          send_automatic_email: !!signerEmail,
          send_automatic_whatsapp: !!signerPhone,
        }],
        client_id: clientId,
        contract_id: contractId,
      });

      setSelectedFile(null);
      setDocName('');
      setTab('list');
      getLocalDocuments({ client_id: clientId, contract_id: contractId });
      onDocumentCreated?.();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateSubmit = async () => {
    if (!selectedTemplateId || !signerName) {
      toast.error('Selecione um template e preencha o nome do signatário');
      return;
    }

    setIsSubmitting(true);
    try {
      await createDocumentFromTemplate({
        template_id: selectedTemplateId,
        signer_name: signerName,
        signer_email: signerEmail || undefined,
        signer_phone: signerPhone?.replace(/\D/g, '') || undefined,
        data: templateVariables.length > 0 ? templateVariables : undefined,
        client_id: clientId,
        contract_id: contractId,
      });

      setSelectedTemplateId('');
      setTemplateVariables([]);
      setTab('list');
      getLocalDocuments({ client_id: clientId, contract_id: contractId });
      onDocumentCreated?.();
    } catch (error) {
      console.error('Template error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (docToken: string) => {
    try {
      await syncDocumentStatus(docToken);
      await getLocalDocuments({ client_id: clientId, contract_id: contractId });
      toast.success('Status atualizado');
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const handleDelete = async (docToken: string) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    try {
      await deleteDocument(docToken);
      await getLocalDocuments({ client_id: clientId, contract_id: contractId });
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const copySignLink = (signers: any[]) => {
    const link = getSignerLink(signers);
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success('Link copiado!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Assinado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      case 'expired':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ZapSign - Assinatura Digital
          </DialogTitle>
          <DialogDescription>
            Envie documentos para assinatura digital via ZapSign
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">Documentos</TabsTrigger>
            <TabsTrigger value="upload">Upload PDF</TabsTrigger>
            <TabsTrigger value="template">Via Template</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => getLocalDocuments({ client_id: clientId, contract_id: contractId })}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              {loading && documents.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum documento encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="border rounded-lg p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(doc.status)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {doc.status === 'pending' && doc.signers && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copySignLink(doc.signers)}
                            title="Copiar link de assinatura"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {doc.original_file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(doc.original_file_url!, '_blank')}
                            title="Ver documento original"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}

                        {doc.signed_file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(doc.signed_file_url!, '_blank')}
                            title="Ver documento assinado"
                            className="text-green-600"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSync(doc.zapsign_doc_token)}
                          title="Sincronizar status"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>

                        {doc.status !== 'signed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(doc.zapsign_doc_token)}
                            className="text-destructive"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Arquivo (PDF ou DOCX) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileSelect}
                  className="flex-1"
                />
                {selectedFile && (
                  <Badge variant="secondary">{selectedFile.name}</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome do documento *</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Ex: Contrato de Serviços"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nome do signatário *</Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={signerPhone}
                  onChange={(e) => setSignerPhone(e.target.value)}
                  placeholder="11999999999"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUploadSubmit} disabled={isSubmitting || !selectedFile}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar para Assinatura
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="template" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Template *</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.token} value={template.token}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">
                  Nenhum template encontrado. Crie templates no painel da ZapSign.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nome do signatário *</Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={signerPhone}
                  onChange={(e) => setSignerPhone(e.target.value)}
                  placeholder="11999999999"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleTemplateSubmit} disabled={isSubmitting || !selectedTemplateId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Criar Documento
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
