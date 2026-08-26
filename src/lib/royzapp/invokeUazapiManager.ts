import type { FunctionsHttpError, FunctionInvokeOptions } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type InvokeResult<T> = {
  data: T | null;
  error: FunctionsHttpError | Error | null;
};

const isUnauthorized = async (error: unknown): Promise<boolean> => {
  if (!error || typeof error !== "object") return false;
  const context = "context" in error ? (error as { context?: Response }).context : undefined;
  if (context?.status === 401) return true;
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return /401|invalid token|jwt expired|unauthorized/i.test(message);
};

export async function invokeUazapiManager<T = unknown>(
  options: FunctionInvokeOptions,
): Promise<InvokeResult<T>> {
  const first = await supabase.functions.invoke<T>("uazapi-manager", options);
  if (!(await isUnauthorized(first.error))) return first;

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !data.session?.access_token) {
    return { data: null, error: refreshError || first.error };
  }

  return supabase.functions.invoke<T>("uazapi-manager", {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
}