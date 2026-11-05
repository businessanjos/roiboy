// Sem dependência do cliente do navegador: usado também pelo servidor MCP.
import { buildInternalCoreSet, isInternalClientRecord } from "./zappInternalContacts";

const PAGE_SIZE = 1000;

type ClientPhoneRow = {
  id: string;
  phone_e164: string | null;
  additional_phones?: unknown;
};

/**
 * Dois grupos, ambos "não é cliente":
 *
 * - `all`    : telefone bate com número interno OU com telefone de colaborador.
 *              Fica fora de contagens, métricas e etiquetas de cliente.
 * - `hidden` : bate com número registrado em zapp_internal_contacts. Some da
 *              lista de clientes.
 *
 * O que está em `all` e não está em `hidden` aparece na lista marcado "Interno".
 */
export type InternalClientSplit = { all: string[]; hidden: string[] };

const NO_SPLIT: InternalClientSplit = { all: [], hidden: [] };

function toIds(value: unknown): string[] {
  return Array.isArray(value) ? value.map((id) => String(id)) : [];
}

/**
 * Ids dos cadastros de cliente que são a própria equipe (telefone registrado em
 * zapp_internal_contacts ou telefone de colaborador). A regra é a mesma do
 * RoyZapp e das métricas de produtividade, comparada pelo código DDD + últimos 8.
 *
 * Nunca lança: se alguma consulta falhar, devolve o que já achou (ou vazio) e a
 * listagem segue mostrando tudo — esconder cliente de verdade é pior do que
 * mostrar um cadastro interno.
 */
export async function fetchInternalClientSplit(
  client: any,
  accountId?: string | null,
): Promise<InternalClientSplit> {
  // 1) Fonte única no banco: mesma função usada pela listagem de clientes.
  if (accountId) {
    try {
      const { data, error } = await client.rpc("internal_client_split", {
        p_account_id: accountId,
      });
      if (!error && data && typeof data === "object") {
        const raw = data as { all?: unknown; hidden?: unknown };
        return { all: toIds(raw.all), hidden: toIds(raw.hidden) };
      }
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
    const registeredCores = buildInternalCoreSet(
      (((registered.data as { phone_e164: string }[] | null) ?? []).map(
        (row) => row.phone_e164,
      )),
    );
    const collabCores = buildInternalCoreSet(
      (((collaborators.data as { phone: string | null }[] | null) ?? []).map(
        (row) => row.phone,
      )),
    );
    if (!registeredCores.size && !collabCores.size) return NO_SPLIT;

    const all: string[] = [];
    const hidden: string[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("clients")
        .select("id, phone_e164, additional_phones")
        .range(from, from + PAGE_SIZE - 1);
      const batch = (error ? null : (data as ClientPhoneRow[] | null)) ?? [];
      for (const row of batch) {
        const isRegistered = isInternalClientRecord(row, registeredCores);
        const isCollaborator = isInternalClientRecord(row, collabCores);
        if (isRegistered || isCollaborator) {
          all.push(row.id);
          if (isRegistered) hidden.push(row.id);
        }
      }
      if (batch.length < PAGE_SIZE) break;
    }
    return { all, hidden };
  } catch {
    return NO_SPLIT;
  }
}

/**
 * Todos os cadastros que não são clientes (internos registrados + telefones de
 * colaborador): o conjunto usado por contagens, métricas e etiquetas.
 */
export async function fetchInternalClientIds(
  client: any,
  accountId?: string | null,
): Promise<string[]> {
  return (await fetchInternalClientSplit(client, accountId)).all;
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
