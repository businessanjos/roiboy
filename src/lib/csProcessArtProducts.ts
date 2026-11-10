import type { Action, StepInfo } from "@/lib/csProcessActions";

/** Etiquetas de arte que existem nos processos (EM = Eternum Mentoring, EC = Eternum Club). */
export type ArtTag = "EM" | "EC";

/** Cada arte do Canva pertence a uma família de produto do Eternum. */
const ART_PRODUCT: Record<ArtTag, RegExp> = {
  EM: /eternum\s+mentoring/i,
  EC: /eternum\s+club/i,
};

/** A etiqueta "(EM)" / "(EC)" que aparece no rótulo de um link de arte. */
export function artTagOf(label: string): ArtTag | null {
  const m = label.match(/\((EM|EC)\)/i);
  return m ? (m[1].toUpperCase() as ArtTag) : null;
}

/** Quais artes a cliente tem direito, pelos produtos que ela já tem. */
export function clientArtTags(productNames: string[]): Set<ArtTag> {
  const owned = new Set<ArtTag>();
  for (const tag of Object.keys(ART_PRODUCT) as ArtTag[]) {
    if (productNames.some((n) => ART_PRODUCT[tag].test(n ?? ""))) owned.add(tag);
  }
  return owned;
}

/**
 * Esconde a arte de um produto que a cliente não tem.
 * Sem cliente, sem produto conhecido, ou com os dois produtos, nada muda: as duas artes aparecem.
 * A ação escondida continua na lista, para não mudar a numeração dos passos nem as esperas.
 */
export function applyArtVisibility(info: StepInfo, productNames: string[]): StepInfo {
  const owned = clientArtTags(productNames);
  if (!owned.size) return info;
  const actions = info.actions.map((a) => {
    if (a.kind !== "link") return a;
    const tag = artTagOf(a.label);
    if (!tag || owned.has(tag)) return a;
    return { ...a, hidden: true };
  });
  return { ...info, actions };
}
