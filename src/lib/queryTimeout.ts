const DEFAULT_QUERY_TIMEOUT_MS = 20_000;

export class QueryTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`A consulta excedeu ${Math.round(timeoutMs / 1000)} segundos`);
    this.name = "QueryTimeoutError";
  }
}

export async function withQueryTimeout<T>(
  operation: PromiseLike<T> | (() => Promise<T>),
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new DOMException("Consulta cancelada", "AbortError");

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new QueryTimeoutError(timeoutMs)), timeoutMs);
    if (signal) {
      abortHandler = () => reject(new DOMException("Consulta cancelada", "AbortError"));
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  });

  try {
    const request = typeof operation === "function" ? operation() : Promise.resolve(operation);
    return await Promise.race([request, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
  }
}