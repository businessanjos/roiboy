/** Troca os links de exemplo dos processos pelos links da cliente selecionada. */
export interface ProcessClient {
  id: string;
  full_name: string;
  instagram?: string | null;
  ryka_url?: string | null;
  platform_login?: string | null;
  phone_e164?: string | null;
  responsible_user_id?: string | null;
}

export type ClientField = "instagram" | "ryka_url" | "platform_login" | "phone_e164" | "responsible_user_id";
export const FIELD_LABEL: Record<ClientField, string> = {
  instagram: "o @ do Instagram",
  ryka_url: "o link da Clínica Ryka",
  platform_login: "o login da plataforma",
  phone_e164: "o telefone/WhatsApp",
  responsible_user_id: "a consultora responsável",
};

export const CADASTRO_FORM_ID = "f53653f9-85b3-4f42-8b86-57cecb553330";
const ROY = "https://iamroy.app";

export type ResolvedLink =
  | { kind: "static"; url: string }
  | { kind: "client"; url: string; label: string }
  | { kind: "missing"; field: ClientField; label: string }
  | { kind: "needsClient"; label: string };

const firstName = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] || "cliente";
const igHandle = (v?: string | null) => (v ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");

/** Classifica um link do texto do processo. Links que não dependem da cliente voltam como "static". */
export function resolveProcessLink(url: string, client: ProcessClient | null): ResolvedLink {
  const who = firstName(client?.full_name);
  let type: "cadastro" | "ficha" | "instagram" | "ryka" | "plano" | null = null;
  if (/iamroy\.app\/f\//.test(url) && url.includes(CADASTRO_FORM_ID)) type = "cadastro";
  else if (/iamroy\.app\/clients\/[0-9a-f-]{36}/i.test(url)) type = "ficha";
  else if (/^https?:\/\/(www\.)?instagram\.com\/?$/i.test(url)) type = "instagram";
  else if (/^https?:\/\/ryka\.app\/dashboard\/?$/i.test(url)) type = "ryka";
  else if (/^https?:\/\/ryka\.app\/plano-de-acao\/?$/i.test(url)) type = "plano";
  if (!type) return { kind: "static", url };
  const labels = {
    cadastro: `Abrir cadastro empresarial da ${who}`,
    ficha: `Abrir ficha da ${who}`,
    instagram: `Abrir Instagram da ${who}`,
    ryka: `Abrir Clínica Ryka da ${who}`,
    plano: `Abrir plano de ação da ${who}`,
  };
  if (!client) return { kind: "needsClient", label: labels[type].replace(` da ${who}`, " da cliente") };
  if (type === "cadastro") return { kind: "client", url: `${ROY}/f/${CADASTRO_FORM_ID}?clientId=${client.id}`, label: labels.cadastro };
  if (type === "ficha") return { kind: "client", url: `${ROY}/clients/${client.id}?tab=fichas`, label: labels.ficha };
  if (type === "instagram") {
    const h = igHandle(client.instagram);
    return h ? { kind: "client", url: `https://www.instagram.com/${h}`, label: labels.instagram } : { kind: "missing", field: "instagram", label: labels.instagram };
  }
  const r = (client.ryka_url ?? "").trim();
  if (type === "plano") {
    if (!r) return { kind: "missing", field: "ryka_url", label: labels.plano };
    try {
      const u = new URL(/^https?:\/\//.test(r) ? r : `https://${r}`);
      return { kind: "client", url: `${u.origin}/plano-de-acao`, label: labels.plano };
    } catch { return { kind: "missing", field: "ryka_url", label: labels.plano }; }
  }
  return r ? { kind: "client", url: /^https?:\/\//.test(r) ? r : `https://${r}`, label: labels.ryka } : { kind: "missing", field: "ryka_url", label: labels.ryka };
}

/** Troca, num texto a copiar, os links de exemplo pelos da cliente (deixa como está quando falta dado). */
export function replaceClientLinks(text: string, client: ProcessClient | null) {
  return text.replace(/https?:\/\/[^\s)]+/g, (u) => { const r = resolveProcessLink(u, client); return r.kind === "client" ? r.url : u; });
}

export function processVars(client: ProcessClient | null, loginFallback: string | null | undefined, consultantName: string | null | undefined) {
  return {
    nome: client ? firstName(client.full_name) : undefined,
    cliente: client ? firstName(client.full_name) : undefined,
    login: client ? (client.platform_login?.trim() || loginFallback || undefined) : undefined,
    "nome da consultora": consultantName ? consultantName.trim().split(/\s+/)[0] : undefined,
  } as Record<string, string | undefined>;
}
