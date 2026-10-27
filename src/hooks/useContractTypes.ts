import { useContractCatalog } from "@/hooks/useContractCatalog";
import { BUILT_IN_CATALOG, slugifyCatalogValue } from "@/lib/contracts/contractCatalog";

export interface ContractTypeOption {
  value: string;
  label: string;
  builtIn?: boolean;
}

export const BUILT_IN_CONTRACT_TYPES: ContractTypeOption[] = BUILT_IN_CATALOG.contract_type.map((t) => ({
  value: t.value, label: t.label, builtIn: true,
}));

export const slugifyContractType = slugifyCatalogValue;

/** Opções selecionáveis (ativas) e mapa de rótulos (inclui inativos). */
export function useContractTypes() {
  const { options, labels } = useContractCatalog("contract_type");
  return { options: options.map((o) => ({ value: o.value, label: o.label })), labels };
}
