/**
 * Detecção e tradução de falhas temporárias (servidor de arquivos/WhatsApp
 * oscilando, respostas HTML de 502/503/504) para envios de mídia do RoyZapp.
 */

const TRANSIENT_PATTERNS = [
  /unexpected token\s*'?</i,
  /is not valid json/i,
  /<html/i,
  /gateway time-?out/i,
  /bad gateway/i,
  /service unavailable/i,
  /temporarily unavailable/i,
  /failed to fetch/i,
  /network ?error/i,
  /load failed/i,
  /timed? ?out/i,
  /\b50[234]\b/,
  /resposta inválida do whatsapp/i,
];

export function isTransientZappError(err: unknown): boolean {
  const e = err as { message?: string; status?: number; statusCode?: string | number } | null;
  const status = Number(e?.status ?? e?.statusCode);
  if ([502, 503, 504].includes(status)) return true;
  const msg = String(e?.message ?? err ?? "");
  return TRANSIENT_PATTERNS.some((re) => re.test(msg));
}

export const ZAPP_TRANSIENT_MESSAGE =
  "O servidor de arquivos oscilou e o envio não foi concluído. Tente novamente em alguns segundos.";

/** Converte erros técnicos em uma frase legível para a equipe. */
export function friendlyZappError(err: unknown, fallback: string): string {
  if (isTransientZappError(err)) return ZAPP_TRANSIENT_MESSAGE;
  const msg = String((err as { message?: string })?.message ?? "").trim();
  return msg || fallback;
}

/** Repete a operação em falhas temporárias (padrão: 3 tentativas, 1s e 2.5s). */
export async function withZappRetry<T>(
  op: () => Promise<T>,
  delaysMs: number[] = [1000, 2500],
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isTransientZappError(err) || attempt === delaysMs.length) throw err;
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
  throw lastErr;
}
