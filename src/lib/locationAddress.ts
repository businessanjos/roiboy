export interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  city_district?: string;
  municipality?: string;
  state?: string;
  country?: string;
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

/** Cidade do resultado: no mapa, cidades do interior vêm como town/village, não como city. */
export const cityOfAddress = (address?: NominatimAddress): string | undefined =>
  address?.city || address?.town || address?.village || address?.municipality || address?.city_district || address?.hamlet;

export const formatSimpleAddress = (result: NominatimResult): string => {
  if (!result.address) return result.display_name;

  const { road, neighbourhood, suburb, state, country } = result.address;
  const parts: string[] = [];

  // Localização específica (rua ou bairro)
  if (road) parts.push(road);
  else if (neighbourhood) parts.push(neighbourhood);
  else if (suburb) parts.push(suburb);

  const cityName = cityOfAddress(result.address);
  if (cityName && !parts.includes(cityName)) parts.push(cityName);
  if (state && !parts.includes(state)) parts.push(state);
  if (country && !parts.includes(country)) parts.push(country);

  return parts.length > 0 ? parts.join(", ") : result.display_name;
};

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Remove opções repetidas e traz primeiro as que contêm tudo o que foi digitado. */
export const rankLocationResults = (results: NominatimResult[], query: string, max = 5): NominatimResult[] => {
  const tokens = normalize(query).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const label = formatSimpleAddress(r);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  const matches = (r: NominatimResult) => {
    const label = normalize(formatSimpleAddress(r));
    return tokens.length > 0 && tokens.every((t) => label.includes(t));
  };
  return [...unique.filter(matches), ...unique.filter((r) => !matches(r))].slice(0, max);
};
