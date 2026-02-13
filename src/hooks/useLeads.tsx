import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";

export interface Lead {
  id: string;
  account_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  emails: string[] | null;
  additional_phones: string[] | null;
  instagram: string | null;
  instagrams: string[] | null;
  source: string | null;
  notes: string | null;
  status: string;
  mql: string | null;
  canal: string | null;
  revenue_range: string | null;
  responsible_user_id: string | null;
  converted_to_client_id: string | null;
  converted_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Joined
  responsible_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

export interface CreateLeadData {
  full_name: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  responsible_user_id?: string;
  tags?: string[];
  external_id?: string;
  external_source?: string;
  instagram?: string;
  cpf?: string;
  rg?: string;
  cnpj?: string;
  company_name?: string;
  birth_date?: string;
  // Residential address
  zip_code?: string;
  street?: string;
  street_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  // Business address
  business_zip_code?: string;
  business_street?: string;
  business_street_number?: string;
  business_complement?: string;
  business_neighborhood?: string;
  business_city?: string;
  business_state?: string;
  business_segment?: string;
  business_niche?: string;
  // Banking
  bank_name?: string;
  bank_code?: string;
  bank_agency?: string;
  bank_account?: string;
  bank_account_type?: string;
  pix_key?: string;
  pix_key_type?: string;
  // Additional arrays (JSONB)
  emails?: string[];
  instagrams?: string[];
  additional_phones?: { label?: string; number: string }[];
}

interface UpdateLeadData extends Partial<CreateLeadData> {
  status?: string;
  converted_to_deal_id?: string;
  converted_at?: string;
}

export function useLeads() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    if (!currentUser?.account_id) return;
    
    setLoading(true);
    try {
      // Fetch all leads with pagination to avoid 1000 row limit
      const allLeads: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select(`
            *,
            responsible_user:users!leads_responsible_user_id_fkey(id, name, avatar_url)
          `)
          .eq('account_id', currentUser.account_id)
          .is('converted_to_client_id', null)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allLeads.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      const formattedLeads: Lead[] = allLeads.map(lead => ({
        ...lead,
        tags: Array.isArray(lead.tags) ? lead.tags as string[] : [],
        emails: Array.isArray(lead.emails) ? lead.emails as string[] : null,
        additional_phones: Array.isArray(lead.additional_phones) ? lead.additional_phones as string[] : null,
        instagrams: Array.isArray(lead.instagrams) ? lead.instagrams as string[] : null,
      }));

      setLeads(formattedLeads);
    } catch (error: any) {
      console.error('Error fetching leads:', error);
      toast({
        title: "Erro ao carregar leads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const createLead = async (data: CreateLeadData): Promise<Lead | null> => {
    if (!currentUser?.account_id) return null;

    try {
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          ...data,
          account_id: currentUser.account_id,
          tags: data.tags || [],
        })
        .select(`
          *,
          responsible_user:users!leads_responsible_user_id_fkey(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;

      const formattedLead: Lead = {
        ...newLead,
        tags: Array.isArray(newLead.tags) ? newLead.tags as string[] : [],
        emails: Array.isArray(newLead.emails) ? newLead.emails as string[] : null,
        additional_phones: Array.isArray(newLead.additional_phones) ? newLead.additional_phones as string[] : null,
        instagrams: Array.isArray(newLead.instagrams) ? newLead.instagrams as string[] : null,
      };

      setLeads(prev => [formattedLead, ...prev]);

      toast({
        title: "Lead criado",
        description: `"${data.full_name}" foi adicionado`,
      });

      return formattedLead;
    } catch (error: any) {
      console.error('Error creating lead:', error);
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateLead = async (leadId: string, data: UpdateLeadData): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    // Optimistic update - atualizar estado local imediatamente
    const previousLeads = leads;
    if (data.responsible_user_id !== undefined) {
      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, responsible_user_id: data.responsible_user_id ?? null }
          : lead
      ));
    }

    try {
      const { error } = await supabase
        .from('leads')
        .update(data)
        .eq('id', leadId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      // Refetch para sincronizar dados completos (incluindo responsible_user join)
      await fetchLeads();
      return true;
    } catch (error: any) {
      // Rollback em caso de erro
      setLeads(previousLeads);
      console.error('Error updating lead:', error);
      toast({
        title: "Erro ao atualizar lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const checkLeadDeals = async (leadId: string) => {
    if (!currentUser?.account_id) return [];
    const { data } = await supabase
      .from('deals')
      .select('id, title, value')
      .eq('lead_id', leadId)
      .eq('account_id', currentUser.account_id);
    return data || [];
  };

  const deleteLeadWithDeals = async (leadId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    try {
      // 1. Delete lead field values
      await supabase
        .from('lead_field_values')
        .delete()
        .eq('lead_id', leadId)
        .eq('account_id', currentUser.account_id);

      // 2. Delete lead timeline
      await supabase
        .from('lead_timeline')
        .delete()
        .eq('lead_id', leadId)
        .eq('account_id', currentUser.account_id);

      // 3. Delete associated deals
      await supabase
        .from('deals')
        .delete()
        .eq('lead_id', leadId)
        .eq('account_id', currentUser.account_id);

      // 4. Delete the lead
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      setLeads(prev => prev.filter(l => l.id !== leadId));

      toast({
        title: "Lead excluído",
        description: "O lead e seus negócios vinculados foram removidos",
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      toast({
        title: "Erro ao excluir lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const markAsConvertedToDeal = async (leadId: string, dealId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      // Remove from leads list
      setLeads(prev => prev.filter(l => l.id !== leadId));

      return true;
    } catch (error: any) {
      console.error('Error marking lead as converted:', error);
      toast({
        title: "Erro ao converter lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  // Stats
  const newLeads = leads.filter(l => l.status === 'new');
  const contactedLeads = leads.filter(l => l.status === 'contacted');
  const qualifiedLeads = leads.filter(l => l.status === 'qualified');

  return {
    leads,
    loading,
    newLeads,
    contactedLeads,
    qualifiedLeads,
    createLead,
    updateLead,
    checkLeadDeals,
    deleteLeadWithDeals,
    markAsConvertedToDeal,
    refetch: fetchLeads,
  };
}
