import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface ContractTypeOption {
  value: string;
  label: string;
  builtIn?: boolean;
}

/** Tipos padrão do sistema — nunca removidos, para preservar contratos existentes. */
export const BUILT_IN_CONTRACT_TYPES: ContractTypeOption[] = [
  { value: "compra", label: "Compra", builtIn: true },
  { value: "renovacao", label: "Renovação", builtIn: true },
  { value: "migracao", label: "Migração", builtIn: true },
  { value: "confissao_divida", label: "Confissão de Dívida", builtIn: true },
  { value: "termo_congelamento", label: "Termo de Congelamento", builtIn: true },
  { value: "distrato", label: "Distrato", builtIn: true },
];

export interface CustomContractType {
  id: string;
  value: string;
  label: string;
  is_active: boolean;
  display_order: number;
}

export function slugifyContractType(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function useCustomContractTypes() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ["contract-type-options", accountId],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_type_options")
        .select("id, value, label, is_active, display_order")
        .eq("account_id", accountId!)
        .order("display_order")
        .order("label");
      if (error) throw error;
      return (data || []) as CustomContractType[];
    },
  });
}

/** Opções selecionáveis (padrão + personalizados ativos) e mapa de rótulos (inclui inativos). */
export function useContractTypes() {
  const { data: custom = [] } = useCustomContractTypes();
  const options: ContractTypeOption[] = [
    ...BUILT_IN_CONTRACT_TYPES,
    ...custom.filter((c) => c.is_active).map((c) => ({ value: c.value, label: c.label })),
  ];
  const labels: Record<string, string> = {};
  BUILT_IN_CONTRACT_TYPES.forEach((t) => (labels[t.value] = t.label));
  custom.forEach((c) => (labels[c.value] = c.label));
  return { options, labels };
}
