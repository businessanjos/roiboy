const MAX_CONCURRENT_VISUAL_QUERIES = 4;

let activeQueries = 0;
const queue: Array<() => void> = [];

function release() {
  activeQueries = Math.max(0, activeQueries - 1);
  queue.shift()?.();
}

export async function scheduleVisualQuery<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (activeQueries >= MAX_CONCURRENT_VISUAL_QUERIES) {
    await new Promise<void>((resolve, reject) => {
      const start = () => {
        signal?.removeEventListener("abort", cancel);
        resolve();
      };
      const cancel = () => {
        const index = queue.indexOf(start);
        if (index >= 0) queue.splice(index, 1);
        reject(new DOMException("Consulta cancelada", "AbortError"));
      };

      queue.push(start);
      signal?.addEventListener("abort", cancel, { once: true });
    });
  }

  if (signal?.aborted) throw new DOMException("Consulta cancelada", "AbortError");
  activeQueries += 1;

  try {
    return await operation();
  } finally {
    release();
  }
}