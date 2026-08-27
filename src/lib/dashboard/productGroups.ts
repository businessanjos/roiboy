// Agrupa produtos equivalentes no Dashboard de Customer Success.
// Renovações (REN.) e nomes legados (Rykas -> Eternum) contam como o mesmo produto.

export interface ProductLike {
  id: string;
  name: string;
  color?: string | null;
}

export interface ProductGroup {
  /** id do produto representante (base, não renovação) */
  id: string;
  /** nome exibido (do produto base) */
  name: string;
  color?: string | null;
  /** todos os ids de produto que compõem o grupo */
  memberIds: string[];
}

/** Normaliza o nome do produto para uma chave de agrupamento. */
export function productGroupKey(rawName: string): string {
  let name = (rawName || "").trim();

  // remove prefixo de renovação: "REN. EM l ..." / "Ren. Rykas ..."
  name = name.replace(/^ren\.?\s+/i, "");

  // remove sufixos numéricos como "(1)"
  name = name.replace(/\s*\(\d+\)\s*$/, "");

  // usa o rótulo após o separador de sigla ("EM l Eternum Mentoring" -> "Eternum Mentoring")
  const parts = name.split(/\s+[l|]\s+/i);
  if (parts.length > 1) name = parts[parts.length - 1];

  name = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  // rebranding Rykas -> Eternum
  if (name === "rykas mentoring") name = "eternum mentoring";
  if (name === "rykas pass") name = "eternum pass";

  return name;
}

/**
 * Agrupa a lista de produtos. O representante de cada grupo é o primeiro
 * produto não-renovação (fallback: o primeiro da lista).
 */
export function buildProductGroups<T extends ProductLike>(products: T[]): ProductGroup[] {
  const groups = new Map<string, { members: T[] }>();

  for (const p of products) {
    const key = productGroupKey(p.name);
    if (!groups.has(key)) groups.set(key, { members: [] });
    groups.get(key)!.members.push(p);
  }

  const isRenewal = (p: T) => /^ren\.?\s/i.test((p.name || "").trim());

  return Array.from(groups.values())
    .map(({ members }) => {
      const base = members.find((m) => !isRenewal(m)) ?? members[0];
      return {
        id: base.id,
        name: base.name,
        color: base.color ?? null,
        memberIds: members.map((m) => m.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Ids do grupo cujo representante é `groupId`. */
export function groupMemberIds(groups: ProductGroup[], groupId: string): string[] {
  return groups.find((g) => g.id === groupId)?.memberIds ?? [groupId];
}

/** Verifica se um cliente possui algum produto do grupo. */
export function clientInGroup(productIds: string[] | undefined | null, memberIds: string[]): boolean {
  if (!productIds || productIds.length === 0) return false;
  return productIds.some((id) => memberIds.includes(id));
}
