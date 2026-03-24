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
      // Wait before retrying
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
