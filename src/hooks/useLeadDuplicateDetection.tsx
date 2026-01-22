import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface LeadDuplicateMatch {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  emails: string[];
  cpf: string | null;
  cnpj: string | null;
  status: string;
  source: string | null;
  created_at: string;
  matchType: "phone" | "cpf" | "cnpj" | "email";
  matchValue: string;
}

interface DuplicateCheckParams {
  phone?: string;
  cpf?: string;
  cnpj?: string;
  email?: string;
  emails?: string[];
  excludeId?: string; // Exclude this lead ID from results (for editing)
}

export function useLeadDuplicateDetection() {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<LeadDuplicateMatch[]>([]);

  const checkDuplicates = useCallback(async (params: DuplicateCheckParams): Promise<LeadDuplicateMatch[]> => {
    if (!currentUser?.account_id) {
      setDuplicates([]);
      return [];
    }

    const { phone, cpf, cnpj, email, emails, excludeId } = params;
    
    // Clean values for comparison
    const cleanPhone = phone?.replace(/\D/g, "") || "";
    const cleanCpf = cpf?.replace(/\D/g, "") || "";
    const cleanCnpj = cnpj?.replace(/\D/g, "") || "";
    const cleanEmail = email?.toLowerCase().trim() || "";
    const cleanEmails = (emails || []).map(e => e.toLowerCase().trim()).filter(Boolean);
    
    // Add single email to array if provided
    if (cleanEmail && !cleanEmails.includes(cleanEmail)) {
      cleanEmails.push(cleanEmail);
    }

    // Don't check if no values provided
    if (!cleanPhone && !cleanCpf && !cleanCnpj && cleanEmails.length === 0) {
      setDuplicates([]);
      return [];
    }

    setLoading(true);
    const matches: LeadDuplicateMatch[] = [];

    try {
      // Check phone (primary phone) - filter directly in database
      if (cleanPhone.length >= 8) {
        const { data: phoneMatches } = await supabase
          .from("leads")
          .select("id, full_name, phone, email, emails, cpf, cnpj, status, source, created_at, additional_phones")
          .eq("account_id", currentUser.account_id)
          .is("converted_to_client_id", null)
          .ilike("phone", `%${cleanPhone}%`)
          .limit(10);

        phoneMatches?.forEach(lead => {
          if (excludeId && lead.id === excludeId) return;
          if (matches.find(m => m.id === lead.id)) return;
          
          matches.push({
            id: lead.id,
            full_name: lead.full_name,
            phone: lead.phone,
            email: lead.email,
            emails: Array.isArray(lead.emails) ? lead.emails as string[] : [],
            cpf: lead.cpf,
            cnpj: lead.cnpj,
            status: lead.status,
            source: lead.source,
            created_at: lead.created_at,
            matchType: "phone",
            matchValue: phone || "",
          });
        });

        // Also check additional_phones if no matches found yet
        if (matches.length === 0) {
          const { data: additionalPhoneLeads } = await supabase
            .from("leads")
            .select("id, full_name, phone, email, emails, cpf, cnpj, status, source, created_at, additional_phones")
            .eq("account_id", currentUser.account_id)
            .is("converted_to_client_id", null)
            .not("additional_phones", "is", null)
            .limit(100);

          additionalPhoneLeads?.forEach(lead => {
            if (excludeId && lead.id === excludeId) return;
            if (matches.find(m => m.id === lead.id)) return;
            
            const additionalPhones = Array.isArray(lead.additional_phones) ? lead.additional_phones : [];
            for (const ap of additionalPhones) {
              const apPhone = typeof ap === 'object' && ap !== null 
                ? (ap as { number?: string }).number?.replace(/\D/g, "") 
                : String(ap).replace(/\D/g, "");
              if (apPhone && (apPhone.includes(cleanPhone) || cleanPhone.includes(apPhone))) {
                matches.push({
                  id: lead.id,
                  full_name: lead.full_name,
                  phone: lead.phone,
                  email: lead.email,
                  emails: Array.isArray(lead.emails) ? lead.emails as string[] : [],
                  cpf: lead.cpf,
                  cnpj: lead.cnpj,
                  status: lead.status,
                  source: lead.source,
                  created_at: lead.created_at,
                  matchType: "phone",
                  matchValue: phone || "",
                });
                break;
              }
            }
          });
        }
      }

      // Check CPF
      if (cleanCpf.length === 11) {
        const { data: cpfMatches } = await supabase
          .from("leads")
          .select("id, full_name, phone, email, emails, cpf, cnpj, status, source, created_at")
          .eq("account_id", currentUser.account_id)
          .is("converted_to_client_id", null)
          .ilike("cpf", `%${cleanCpf}%`)
          .limit(5);

        cpfMatches?.forEach(lead => {
          if (excludeId && lead.id === excludeId) return;
          if (!matches.find(m => m.id === lead.id)) {
            matches.push({
              id: lead.id,
              full_name: lead.full_name,
              phone: lead.phone,
              email: lead.email,
              emails: Array.isArray(lead.emails) ? lead.emails as string[] : [],
              cpf: lead.cpf,
              cnpj: lead.cnpj,
              status: lead.status,
              source: lead.source,
              created_at: lead.created_at,
              matchType: "cpf",
              matchValue: cpf || "",
            });
          }
        });
      }

      // Check CNPJ
      if (cleanCnpj.length === 14) {
        const { data: cnpjMatches } = await supabase
          .from("leads")
          .select("id, full_name, phone, email, emails, cpf, cnpj, status, source, created_at")
          .eq("account_id", currentUser.account_id)
          .is("converted_to_client_id", null)
          .ilike("cnpj", `%${cleanCnpj}%`)
          .limit(5);

        cnpjMatches?.forEach(lead => {
          if (excludeId && lead.id === excludeId) return;
          if (!matches.find(m => m.id === lead.id)) {
            matches.push({
              id: lead.id,
              full_name: lead.full_name,
              phone: lead.phone,
              email: lead.email,
              emails: Array.isArray(lead.emails) ? lead.emails as string[] : [],
              cpf: lead.cpf,
              cnpj: lead.cnpj,
              status: lead.status,
              source: lead.source,
              created_at: lead.created_at,
              matchType: "cnpj",
              matchValue: cnpj || "",
            });
          }
        });
      }

      // Check emails (primary email or emails array)
      for (const emailToCheck of cleanEmails) {
        if (emailToCheck.length < 5) continue;
        
        // Check primary email
        const { data: primaryEmailMatches } = await supabase
          .from("leads")
          .select("id, full_name, phone, email, emails, cpf, cnpj, status, source, created_at")
          .eq("account_id", currentUser.account_id)
          .is("converted_to_client_id", null)
          .ilike("email", emailToCheck)
          .limit(5);

        primaryEmailMatches?.forEach(lead => {
          if (excludeId && lead.id === excludeId) return;
          if (!matches.find(m => m.id === lead.id)) {
            matches.push({
              id: lead.id,
              full_name: lead.full_name,
              phone: lead.phone,
              email: lead.email,
              emails: Array.isArray(lead.emails) ? lead.emails as string[] : [],
              cpf: lead.cpf,
              cnpj: lead.cnpj,
              status: lead.status,
              source: lead.source,
              created_at: lead.created_at,
              matchType: "email",
              matchValue: emailToCheck,
            });
          }
        });

        // Check emails array
        const { data: emailsArrayMatches } = await supabase
          .from("leads")
          .select("id, full_name, phone, email, emails, cpf, cnpj, status, source, created_at")
          .eq("account_id", currentUser.account_id)
          .is("converted_to_client_id", null)
          .contains("emails", [emailToCheck])
          .limit(5);

        emailsArrayMatches?.forEach(lead => {
          if (excludeId && lead.id === excludeId) return;
          if (!matches.find(m => m.id === lead.id)) {
            matches.push({
              id: lead.id,
              full_name: lead.full_name,
              phone: lead.phone,
              email: lead.email,
              emails: Array.isArray(lead.emails) ? lead.emails as string[] : [],
              cpf: lead.cpf,
              cnpj: lead.cnpj,
              status: lead.status,
              source: lead.source,
              created_at: lead.created_at,
              matchType: "email",
              matchValue: emailToCheck,
            });
          }
        });
      }

      setDuplicates(matches);
      return matches;
    } catch (error) {
      console.error("Error checking lead duplicates:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id]);

  const clearDuplicates = useCallback(() => {
    setDuplicates([]);
  }, []);

  return {
    loading,
    duplicates,
    checkDuplicates,
    clearDuplicates,
  };
}
