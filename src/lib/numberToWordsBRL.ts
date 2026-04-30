// Converts a numeric BRL value to Portuguese (Brazil) extenso form.
// Examples:
//   1 -> "um real"
//   2 -> "dois reais"
//   1.5 -> "um real e cinquenta centavos"
//   1234.56 -> "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

const upTo999 = (n: number): string => {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 20) {
      parts.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (u === 0) parts.push(DEZENAS[d]);
      else parts.push(`${DEZENAS[d]} e ${UNIDADES[u]}`);
    }
  }
  return parts.join(" e ");
};

const intToWords = (n: number): string => {
  if (n === 0) return "zero";
  if (n < 0) return `menos ${intToWords(-n)}`;

  const bilhoes = Math.floor(n / 1_000_000_000);
  const milhoes = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const parts: string[] = [];

  if (bilhoes > 0) {
    parts.push(bilhoes === 1 ? "um bilhão" : `${upTo999(bilhoes)} bilhões`);
  }
  if (milhoes > 0) {
    parts.push(milhoes === 1 ? "um milhão" : `${upTo999(milhoes)} milhões`);
  }
  if (milhares > 0) {
    if (milhares === 1) parts.push("mil");
    else parts.push(`${upTo999(milhares)} mil`);
  }
  if (resto > 0) parts.push(upTo999(resto));

  if (parts.length <= 1) return parts.join(" ");

  const last = parts[parts.length - 1];
  const head = parts.slice(0, -1);

  const useE = resto > 0 ? resto < 100 || resto % 100 === 0 : false;
  return useE ? `${head.join(", ")} e ${last}` : `${head.join(", ")} ${last}`.replace(/\s+/g, " ");
};

export const numberToBRLExtenso = (input: number | string | null | undefined): string => {
  if (input === null || input === undefined || input === "") return "";
  const num = typeof input === "number" ? input : Number(String(input).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return "";

  const cents = Math.round(Math.abs(num) * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  const sign = num < 0 ? "menos " : "";

  if (reais === 0 && centavos === 0) return "zero real";

  const parts: string[] = [];
  if (reais > 0) {
    // Use "de reais/real" when value is an exact multiple of milhão/bilhão (e.g. "um milhão de reais")
    const isExactBigUnit = reais >= 1_000_000 && reais % 1_000_000 === 0;
    const moeda = reais === 1 ? "real" : "reais";
    const conector = isExactBigUnit ? " de " : " ";
    parts.push(`${intToWords(reais)}${conector}${moeda}`);
  }
  if (centavos > 0) {
    parts.push(`${intToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }

  return sign + parts.join(" e ");
};
