import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConciliationValidation {
  canConciliate: boolean;
  missingItems: string[];
  hasFinancialEntries: boolean;
  hasDocument: boolean; // CPF ou CNPJ
  hasAddress: boolean;
  hasProduct: boolean;
  isLoading: boolean;
}

interface UseConciliationValidationProps {
  clientId: string | undefined;
  contractId: string | undefined;
  productId: string | null | undefined;
  enabled?: boolean;
}

export function useConciliationValidation({
  clientId,
  contractId,
  productId,
  enabled = true,
}: UseConciliationValidationProps): ConciliationValidation {
  const [validation, setValidation] = useState<ConciliationValidation>({
    canConciliate: false,
    missingItems: [],
    hasFinancialEntries: false,
    hasDocument: false,
    hasAddress: false,
    hasProduct: false,
    isLoading: true,
  });

  const validate = useCallback(async () => {
    if (!clientId || !contractId || !enabled) {
      setValidation((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    setValidation((prev) => ({ ...prev, isLoading: true }));

    try {
      // Fetch in parallel: financial entries and client data
      const [entriesResult, clientResult] = await Promise.all([
        supabase
          .from("financial_entries")
          .select("id")
          .eq("client_id", clientId)
          .eq("entry_type", "receivable")
          .limit(1),
        supabase
          .from("clients")
          .select("cpf, cnpj, city, state, zip_code, street")
          .eq("id", clientId)
          .single(),
      ]);

      const hasFinancialEntries = (entriesResult.data?.length || 0) > 0;
      
      const client = clientResult.data;
      const hasDocument = !!(client?.cpf || client?.cnpj);
      const hasAddress = !!(
        client?.city &&
        client?.state &&
        client?.zip_code &&
        client?.street
      );
      const hasProduct = !!productId;

      const missingItems: string[] = [];

      if (!hasFinancialEntries) {
        missingItems.push("Lançamentos financeiros");
      }
      if (!hasDocument) {
        missingItems.push("CPF ou CNPJ");
      }
      if (!hasAddress) {
        missingItems.push("Endereço completo");
      }
      if (!hasProduct) {
        missingItems.push("Produto vinculado");
      }

      setValidation({
        canConciliate: missingItems.length === 0,
        missingItems,
        hasFinancialEntries,
        hasDocument,
        hasAddress,
        hasProduct,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error validating conciliation:", error);
      setValidation({
        canConciliate: false,
        missingItems: ["Erro ao verificar dados"],
        hasFinancialEntries: false,
        hasDocument: false,
        hasAddress: false,
        hasProduct: false,
        isLoading: false,
      });
    }
  }, [clientId, contractId, productId, enabled]);

  useEffect(() => {
    validate();
  }, [validate]);

  return validation;
}

// Hook for batch validation of multiple contracts
export function useBatchConciliationValidation(
  contracts: Array<{
    id: string;
    client_id: string;
    product?: { id: string } | null;
  }>
) {
  const [validations, setValidations] = useState<
    Map<string, ConciliationValidation>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateAll = async () => {
      if (contracts.length === 0) {
        setValidations(new Map());
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const clientIds = [...new Set(contracts.map((c) => c.client_id))];

        // Fetch all data in parallel
        const [entriesResult, clientsResult] = await Promise.all([
          supabase
            .from("financial_entries")
            .select("id, client_id")
            .in("client_id", clientIds)
            .eq("entry_type", "receivable"),
          supabase
            .from("clients")
            .select("id, cpf, cnpj, city, state, zip_code, street")
            .in("id", clientIds),
        ]);

        // Create lookup maps
        const clientsWithEntries = new Set(
          entriesResult.data?.map((e) => e.client_id) || []
        );
        
        const clientDataMap = new Map(
          clientsResult.data?.map((c) => [c.id, c]) || []
        );

        // Build validations for each contract
        const newValidations = new Map<string, ConciliationValidation>();

        for (const contract of contracts) {
          const clientData = clientDataMap.get(contract.client_id);
          const hasFinancialEntries = clientsWithEntries.has(contract.client_id);
          const hasDocument = !!(clientData?.cpf || clientData?.cnpj);
          const hasAddress = !!(
            clientData?.city &&
            clientData?.state &&
            clientData?.zip_code &&
            clientData?.street
          );
          const hasProduct = !!contract.product?.id;

          const missingItems: string[] = [];
          if (!hasFinancialEntries) missingItems.push("Lançamentos financeiros");
          if (!hasDocument) missingItems.push("CPF ou CNPJ");
          if (!hasAddress) missingItems.push("Endereço completo");
          if (!hasProduct) missingItems.push("Produto vinculado");

          newValidations.set(contract.id, {
            canConciliate: missingItems.length === 0,
            missingItems,
            hasFinancialEntries,
            hasDocument,
            hasAddress,
            hasProduct,
            isLoading: false,
          });
        }

        setValidations(newValidations);
      } catch (error) {
        console.error("Error in batch validation:", error);
      } finally {
        setIsLoading(false);
      }
    };

    validateAll();
  }, [contracts]);

  return { validations, isLoading };
}
