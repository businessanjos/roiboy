import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ZapSignSigner {
  name: string;
  email?: string;
  phone_country?: string;
  phone_number?: string;
  auth_mode?: 'assinaturaTela' | 'tokenEmail' | 'tokenSms' | 'assinaturaComCertificadoDigital';
  send_automatic_email?: boolean;
  send_automatic_whatsapp?: boolean;
}

interface ZapSignTemplate {
  token: string;
  template_type: string;
  name: string;
  active: boolean;
  template_file: string;
  created_at: string;
  last_update_at: string;
}

interface ZapSignDocument {
  id: string;
  account_id: string;
  client_id: string | null;
  contract_id: string | null;
  zapsign_doc_token: string;
  zapsign_template_id: string | null;
  name: string;
  status: string;
  original_file_url: string | null;
  signed_file_url: string | null;
  signers: any[];
  external_id: string | null;
  created_at: string;
  updated_at: string;
  signed_at: string | null;
}

export function useZapSign() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ZapSignTemplate[]>([]);
  const [documents, setDocuments] = useState<ZapSignDocument[]>([]);

  const callZapSignAPI = useCallback(async (action: string, payload: any = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Não autenticado');
    }

    const response = await supabase.functions.invoke('zapsign-api', {
      body: { action, ...payload },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Erro na API ZapSign');
    }

    return response.data;
  }, []);

  const listTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callZapSignAPI('list-templates');
      const templateList = result.results || result || [];
      setTemplates(templateList);
      return templateList;
    } catch (error: any) {
      console.error('Error listing templates:', error);
      toast.error('Erro ao listar templates: ' + error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [callZapSignAPI]);

  const createDocumentFromUpload = useCallback(async (params: {
    name: string;
    base64_pdf: string;
    signers: ZapSignSigner[];
    client_id?: string;
    contract_id?: string;
    external_id?: string;
  }) => {
    setLoading(true);
    try {
      const result = await callZapSignAPI('create-document-upload', params);
      
      if (result.token) {
        toast.success('Documento enviado para assinatura!');
        return result;
      } else if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('Error creating document:', error);
      toast.error('Erro ao criar documento: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [callZapSignAPI]);

  const createDocumentFromTemplate = useCallback(async (params: {
    template_id: string;
    signer_name: string;
    signer_email?: string;
    signer_phone?: string;
    data?: Array<{ de: string; para: string }>;
    client_id?: string;
    contract_id?: string;
    external_id?: string;
  }) => {
    setLoading(true);
    try {
      const result = await callZapSignAPI('create-document-template', params);
      
      if (result.token) {
        toast.success('Documento criado via template!');
        return result;
      } else if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('Error creating document from template:', error);
      toast.error('Erro ao criar documento: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [callZapSignAPI]);

  const getDocumentDetails = useCallback(async (docToken: string) => {
    setLoading(true);
    try {
      const result = await callZapSignAPI('get-document', { docToken });
      return result;
    } catch (error: any) {
      console.error('Error getting document:', error);
      toast.error('Erro ao buscar documento: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [callZapSignAPI]);

  const syncDocumentStatus = useCallback(async (docToken: string) => {
    try {
      const result = await callZapSignAPI('sync-document-status', { docToken });
      return result;
    } catch (error: any) {
      console.error('Error syncing document:', error);
      throw error;
    }
  }, [callZapSignAPI]);

  const deleteDocument = useCallback(async (docToken: string) => {
    setLoading(true);
    try {
      const result = await callZapSignAPI('delete-document', { docToken });
      if (result.success) {
        toast.success('Documento excluído!');
      }
      return result;
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error('Erro ao excluir documento: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [callZapSignAPI]);

  const getLocalDocuments = useCallback(async (params: {
    client_id?: string;
    contract_id?: string;
  } = {}) => {
    setLoading(true);
    try {
      const result = await callZapSignAPI('get-local-documents', params);
      setDocuments(result || []);
      return result || [];
    } catch (error: any) {
      console.error('Error getting local documents:', error);
      toast.error('Erro ao buscar documentos: ' + error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [callZapSignAPI]);

  const getSignerLink = useCallback((signers: any[]) => {
    if (!signers || signers.length === 0) return null;
    const firstSigner = signers[0];
    return firstSigner.sign_url || null;
  }, []);

  return {
    loading,
    templates,
    documents,
    listTemplates,
    createDocumentFromUpload,
    createDocumentFromTemplate,
    getDocumentDetails,
    syncDocumentStatus,
    deleteDocument,
    getLocalDocuments,
    getSignerLink,
  };
}
