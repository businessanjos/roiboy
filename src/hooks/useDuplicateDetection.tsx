import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DuplicateMatch {
  id: string;
  full_name: string;
  phone_e164: string;
  emails: string[];
  cpf: string | null;
  cnpj: string | null;
  avatar_url: string | null;
  matchType: "phone" | "cpf" | "cnpj" | "email";
  matchValue: string;
}

interface DuplicateCheckParams {
  phone?: string;
  cpf?: string;
  cnpj?: string;
  emails?: string[];
  excludeId?: string; // Exclude this client ID from results (for editing)
}

export function useDuplicateDetection() {
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  const checkDuplicates = useCallback(async (params: DuplicateCheckParams): Promise<DuplicateMatch[]> => {
    const { phone, cpf, cnpj, emails, excludeId } = params;
    
    // Clean values for comparison
    const cleanPhone = phone?.replace(/\D/g, "") || "";
    const cleanCpf = cpf?.replace(/\D/g, "") || "";
    const cleanCnpj = cnpj?.replace(/\D/g, "") || "";
    const cleanEmails = (emails || []).map(e => e.toLowerCase().trim()).filter(Boolean);

    // Don't check if no values provided
    if (!cleanPhone && !cleanCpf && !cleanCnpj && cleanEmails.length === 0) {
      setDuplicates([]);
      return [];
    }

    setLoading(true);
    const matches: DuplicateMatch[] = [];

    try {
      // Check phone - search both legacy format (string array) and new format (object array)
      if (cleanPhone.length >= 10) {
        const { data: phoneMatches } = await supabase
          .from("clients")
          .select("id, full_name, phone_e164, emails, cpf, cnpj, avatar_url")
          .or(`phone_e164.ilike.%${cleanPhone}%,additional_phones.cs.["${phone}"],additional_phones.cs.[{"number":"${phone}"}]`)
          .limit(5);

        phoneMatches?.forEach(client => {
          if (excludeId && client.id === excludeId) return;
          if (!matches.find(m => m.id === client.id)) {
            matches.push({
              ...client,
              emails: Array.isArray(client.emails) ? client.emails as string[] : [],
              matchType: "phone",
              matchValue: phone || "",
            });
          }
        });
      }

      // Check CPF
      if (cleanCpf.length === 11) {
        const { data: cpfMatches } = await supabase
          .from("clients")
          .select("id, full_name, phone_e164, emails, cpf, cnpj, avatar_url")
          .ilike("cpf", `%${cleanCpf}%`)
          .limit(5);

        cpfMatches?.forEach(client => {
          if (excludeId && client.id === excludeId) return;
          if (!matches.find(m => m.id === client.id)) {
            matches.push({
              ...client,
              emails: Array.isArray(client.emails) ? client.emails as string[] : [],
              matchType: "cpf",
              matchValue: cpf || "",
            });
          }
        });
      }

      // Check CNPJ
      if (cleanCnpj.length === 14) {
        const { data: cnpjMatches } = await supabase
          .from("clients")
          .select("id, full_name, phone_e164, emails, cpf, cnpj, avatar_url")
          .or(`cnpj.ilike.%${cleanCnpj}%,companies.cs.[{"cnpj":"${cnpj}"}]`)
          .limit(5);

        cnpjMatches?.forEach(client => {
          if (excludeId && client.id === excludeId) return;
          if (!matches.find(m => m.id === client.id)) {
            matches.push({
              ...client,
              emails: Array.isArray(client.emails) ? client.emails as string[] : [],
              matchType: "cnpj",
              matchValue: cnpj || "",
            });
          }
        });
      }

      // Check emails
      for (const email of cleanEmails) {
        const { data: emailMatches } = await supabase
          .from("clients")
          .select("id, full_name, phone_e164, emails, cpf, cnpj, avatar_url")
          .contains("emails", [email])
          .limit(5);

        emailMatches?.forEach(client => {
          if (excludeId && client.id === excludeId) return;
          if (!matches.find(m => m.id === client.id)) {
            matches.push({
              ...client,
              emails: Array.isArray(client.emails) ? client.emails as string[] : [],
              matchType: "email",
              matchValue: email,
            });
          }
        });
      }

      setDuplicates(matches);
      return matches;
    } catch (error) {
      console.error("Error checking duplicates:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

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
