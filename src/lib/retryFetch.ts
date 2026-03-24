/**
 * Retry wrapper for async operations that may fail due to network issues.
 * Automatically retries on "Failed to fetch" / TypeError errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isNetworkError =
        error instanceof TypeError &&
        (error.message?.includes("Failed to fetch") ||
          error.message?.includes("NetworkError") ||
          error.message?.includes("fetch"));
      
      if (!isNetworkError || attempt === maxRetries) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Wraps a Supabase mutation (insert/update/delete) with automatic retry on network errors.
 * Usage: await supabaseMutate(() => supabase.from("table").update(data).eq("id", id));
 */
export async function supabaseMutate<T>(
  fn: () => PromiseLike<{ data: T; error: any }>
): Promise<{ data: T; error: null }> {
  return withRetry(async () => {
    const result = await fn();
    if (result.error) throw result.error;
    return { data: result.data, error: null };
  });
}
