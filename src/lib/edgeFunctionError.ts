/**
 * Extracts a human-readable error message from a Supabase edge function error.
 *
 * `FunctionsHttpError.context` is a `Response` object in supabase-js v2 —
 * not a plain object with `.body`. We need to await `.json()` / `.text()`
 * to read the body that the edge function returned.
 */
export async function extractEdgeFunctionError(
  error: any,
  fallback = "Erro ao executar operação"
): Promise<string> {
  if (!error) return fallback;

  const ctx: any = error.context;

  // Case 1: context is a Response (current supabase-js behavior)
  if (ctx && typeof ctx.clone === "function") {
    try {
      const cloned = ctx.clone();
      const text = await cloned.text();
      if (text) {
        try {
          const body = JSON.parse(text);
          if (body?.error) return String(body.error);
          if (body?.message) return String(body.message);
        } catch {
          if (text.length < 500) return text;
        }
      }
    } catch {
      // ignore — fall through
    }
  }

  // Case 2: legacy shape where context.body is a string
  if (ctx && typeof ctx.body === "string") {
    try {
      const body = JSON.parse(ctx.body);
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      // ignore
    }
  }

  // Case 3: a plain message that isn't the generic "non-2xx" string
  if (error.message && !String(error.message).includes("non-2xx")) {
    return String(error.message);
  }

  return fallback;
}
