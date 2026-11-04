import { supabase } from "@/integrations/supabase/client";
import { buildInternalCoreSet, isInternalClientRecord } from "./zappInternalContacts";

const PAGE_SIZE = 1000;

type ClientPhoneRow = {
  id: string;
  phone_e164: string | null;
  additional_phones?: unknown;
};

/**
 * Ids dos cadastros de cliente que são a própria equipe (telefone registrado em
 * zapp_internal_contacts ou telefone de colaborador). A regra é a mesma do
 * RoyZapp e das métricas de produtividade, comparada pelo código DDD + últimos 8.
 *
 * Nunca lança: se alguma consulta falhar, devolve o que já achou (ou vazio) e a
 * listagem segue mostrando tudo — esconder cliente de verdade é pior do que
 * mostrar um cadastro interno.
 */
export async function fetchInternalClientIds(
  client: any = supabase,
  accountId?: string | null,
): Promise<string[]> {
  // 1) Fonte única no banco: mesma função usada pela listagem de clientes.
  if (accountId) {
    try {
      const { data, error } = await client.rpc("internal_client_ids", {
        p_account_id: accountId,
      });
      if (!error && Array.isArray(data)) return data as string[];
    } catch {
      /* cai para a varredura abaixo */
    }
  }

  // 2) Fallback: varre os telefones quando a função não está disponível.
  try {
    const [registered, collaborators] = await Promise.all([
      client.from("zapp_internal_contacts").select("phone_e164"),
      client.from("hr_collaborators").select("phone"),
    ]);
    const cores = buildInternalCoreSet([
      ...(((registered.data as { phone_e164: string }[] | null) ?? []).map(
        (row) => row.phone_e164,
      )),
      ...(((collaborators.data as { phone: string | null }[] | null) ?? []).map(
        (row) => row.phone,
      )),
    ]);
    if (!cores.size) return [];

    const ids: string[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("clients")
        .select("id, phone_e164, additional_phones")
        .range(from, from + PAGE_SIZE - 1);
      const batch = (error ? null : (data as ClientPhoneRow[] | null)) ?? [];
      for (const row of batch) {
        if (isInternalClientRecord(row, cores)) ids.push(row.id);
      }
      if (batch.length < PAGE_SIZE) break;
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Tira os cadastros internos de uma consulta ao PostgREST. Sem ids, a consulta
 * segue igual.
 */
export function applyInternalClientExclusion<T>(query: T, ids: string[]): T {
  if (!ids.length) return query;
  return (query as any).not(
    "id",
    "in",
    `(${ids.map((id) => `"${id}"`).join(",")})`,
  ) as T;
}
