/**
 * Mapeia um telefone E.164 (+DDI...) para país (emoji bandeira + nome PT-BR).
 *
 * Estratégia:
 *  - Tenta casar pelos primeiros 1-3 dígitos do DDI (longest-match).
 *  - Se nada casar, retorna null (UI deve esconder a bandeira).
 *  - Brasil (+55) é tratado normalmente, deixe a UI decidir se mostra ou não.
 */

type CountryInfo = { code: string; name: string; flag: string };

// DDI -> país. Cobertura focada em DDIs frequentes do CRM.
// Ordenado por comprimento (3 dígitos primeiro) para longest-prefix match.
const DDI_MAP: Record<string, CountryInfo> = {
  // 3 dígitos
  "351": { code: "PT", name: "Portugal", flag: "🇵🇹" },
  "352": { code: "LU", name: "Luxemburgo", flag: "🇱🇺" },
  "353": { code: "IE", name: "Irlanda", flag: "🇮🇪" },
  "354": { code: "IS", name: "Islândia", flag: "🇮🇸" },
  "356": { code: "MT", name: "Malta", flag: "🇲🇹" },
  "358": { code: "FI", name: "Finlândia", flag: "🇫🇮" },
  "359": { code: "BG", name: "Bulgária", flag: "🇧🇬" },
  "370": { code: "LT", name: "Lituânia", flag: "🇱🇹" },
  "371": { code: "LV", name: "Letônia", flag: "🇱🇻" },
  "372": { code: "EE", name: "Estônia", flag: "🇪🇪" },
  "373": { code: "MD", name: "Moldávia", flag: "🇲🇩" },
  "375": { code: "BY", name: "Belarus", flag: "🇧🇾" },
  "376": { code: "AD", name: "Andorra", flag: "🇦🇩" },
  "377": { code: "MC", name: "Mônaco", flag: "🇲🇨" },
  "380": { code: "UA", name: "Ucrânia", flag: "🇺🇦" },
  "381": { code: "RS", name: "Sérvia", flag: "🇷🇸" },
  "385": { code: "HR", name: "Croácia", flag: "🇭🇷" },
  "386": { code: "SI", name: "Eslovênia", flag: "🇸🇮" },
  "387": { code: "BA", name: "Bósnia", flag: "🇧🇦" },
  "389": { code: "MK", name: "Macedônia do Norte", flag: "🇲🇰" },
  "420": { code: "CZ", name: "República Tcheca", flag: "🇨🇿" },
  "421": { code: "SK", name: "Eslováquia", flag: "🇸🇰" },
  "423": { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
  "501": { code: "BZ", name: "Belize", flag: "🇧🇿" },
  "502": { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  "503": { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  "504": { code: "HN", name: "Honduras", flag: "🇭🇳" },
  "505": { code: "NI", name: "Nicarágua", flag: "🇳🇮" },
  "506": { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  "507": { code: "PA", name: "Panamá", flag: "🇵🇦" },
  "509": { code: "HT", name: "Haiti", flag: "🇭🇹" },
  "591": { code: "BO", name: "Bolívia", flag: "🇧🇴" },
  "592": { code: "GY", name: "Guiana", flag: "🇬🇾" },
  "593": { code: "EC", name: "Equador", flag: "🇪🇨" },
  "595": { code: "PY", name: "Paraguai", flag: "🇵🇾" },
  "597": { code: "SR", name: "Suriname", flag: "🇸🇷" },
  "598": { code: "UY", name: "Uruguai", flag: "🇺🇾" },
  "852": { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  "853": { code: "MO", name: "Macau", flag: "🇲🇴" },
  "855": { code: "KH", name: "Camboja", flag: "🇰🇭" },
  "856": { code: "LA", name: "Laos", flag: "🇱🇦" },
  "880": { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  "886": { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  "960": { code: "MV", name: "Maldivas", flag: "🇲🇻" },
  "961": { code: "LB", name: "Líbano", flag: "🇱🇧" },
  "962": { code: "JO", name: "Jordânia", flag: "🇯🇴" },
  "963": { code: "SY", name: "Síria", flag: "🇸🇾" },
  "964": { code: "IQ", name: "Iraque", flag: "🇮🇶" },
  "965": { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  "966": { code: "SA", name: "Arábia Saudita", flag: "🇸🇦" },
  "967": { code: "YE", name: "Iêmen", flag: "🇾🇪" },
  "968": { code: "OM", name: "Omã", flag: "🇴🇲" },
  "970": { code: "PS", name: "Palestina", flag: "🇵🇸" },
  "971": { code: "AE", name: "Emirados Árabes", flag: "🇦🇪" },
  "972": { code: "IL", name: "Israel", flag: "🇮🇱" },
  "973": { code: "BH", name: "Bahrein", flag: "🇧🇭" },
  "974": { code: "QA", name: "Catar", flag: "🇶🇦" },
  "975": { code: "BT", name: "Butão", flag: "🇧🇹" },
  "976": { code: "MN", name: "Mongólia", flag: "🇲🇳" },
  "977": { code: "NP", name: "Nepal", flag: "🇳🇵" },
  // 2 dígitos
  "20": { code: "EG", name: "Egito", flag: "🇪🇬" },
  "27": { code: "ZA", name: "África do Sul", flag: "🇿🇦" },
  "30": { code: "GR", name: "Grécia", flag: "🇬🇷" },
  "31": { code: "NL", name: "Holanda", flag: "🇳🇱" },
  "32": { code: "BE", name: "Bélgica", flag: "🇧🇪" },
  "33": { code: "FR", name: "França", flag: "🇫🇷" },
  "34": { code: "ES", name: "Espanha", flag: "🇪🇸" },
  "36": { code: "HU", name: "Hungria", flag: "🇭🇺" },
  "39": { code: "IT", name: "Itália", flag: "🇮🇹" },
  "40": { code: "RO", name: "Romênia", flag: "🇷🇴" },
  "41": { code: "CH", name: "Suíça", flag: "🇨🇭" },
  "43": { code: "AT", name: "Áustria", flag: "🇦🇹" },
  "44": { code: "GB", name: "Reino Unido", flag: "🇬🇧" },
  "45": { code: "DK", name: "Dinamarca", flag: "🇩🇰" },
  "46": { code: "SE", name: "Suécia", flag: "🇸🇪" },
  "47": { code: "NO", name: "Noruega", flag: "🇳🇴" },
  "48": { code: "PL", name: "Polônia", flag: "🇵🇱" },
  "49": { code: "DE", name: "Alemanha", flag: "🇩🇪" },
  "51": { code: "PE", name: "Peru", flag: "🇵🇪" },
  "52": { code: "MX", name: "México", flag: "🇲🇽" },
  "53": { code: "CU", name: "Cuba", flag: "🇨🇺" },
  "54": { code: "AR", name: "Argentina", flag: "🇦🇷" },
  "55": { code: "BR", name: "Brasil", flag: "🇧🇷" },
  "56": { code: "CL", name: "Chile", flag: "🇨🇱" },
  "57": { code: "CO", name: "Colômbia", flag: "🇨🇴" },
  "58": { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  "60": { code: "MY", name: "Malásia", flag: "🇲🇾" },
  "61": { code: "AU", name: "Austrália", flag: "🇦🇺" },
  "62": { code: "ID", name: "Indonésia", flag: "🇮🇩" },
  "63": { code: "PH", name: "Filipinas", flag: "🇵🇭" },
  "64": { code: "NZ", name: "Nova Zelândia", flag: "🇳🇿" },
  "65": { code: "SG", name: "Singapura", flag: "🇸🇬" },
  "66": { code: "TH", name: "Tailândia", flag: "🇹🇭" },
  "81": { code: "JP", name: "Japão", flag: "🇯🇵" },
  "82": { code: "KR", name: "Coreia do Sul", flag: "🇰🇷" },
  "84": { code: "VN", name: "Vietnã", flag: "🇻🇳" },
  "86": { code: "CN", name: "China", flag: "🇨🇳" },
  "90": { code: "TR", name: "Turquia", flag: "🇹🇷" },
  "91": { code: "IN", name: "Índia", flag: "🇮🇳" },
  "92": { code: "PK", name: "Paquistão", flag: "🇵🇰" },
  "93": { code: "AF", name: "Afeganistão", flag: "🇦🇫" },
  "94": { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  "95": { code: "MM", name: "Mianmar", flag: "🇲🇲" },
  "98": { code: "IR", name: "Irã", flag: "🇮🇷" },
  // 1 dígito
  "1": { code: "US", name: "EUA/Canadá", flag: "🇺🇸" },
  "7": { code: "RU", name: "Rússia", flag: "🇷🇺" },
};

/**
 * Recebe um telefone (idealmente em E.164: "+DDI...") e devolve o país, ou null.
 */
export function getCountryFromPhone(
  phone: string | null | undefined,
): CountryInfo | null {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (!raw.startsWith("+")) return null; // Sem '+' não dá para inferir DDI com segurança
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null;
  // Longest-prefix match: tenta 3, depois 2, depois 1 dígito
  for (const len of [3, 2, 1]) {
    const prefix = digits.slice(0, len);
    if (DDI_MAP[prefix]) return DDI_MAP[prefix];
  }
  return null;
}
