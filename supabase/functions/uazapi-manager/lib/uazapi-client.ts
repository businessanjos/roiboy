// UAZAPI client helper functions
const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

// Request helper for admin endpoints (using admintoken header - UAZAPI standard)
export async function uazapiAdminRequest(endpoint: string, method: string, body?: unknown) {
  const url = `${UAZAPI_URL}${endpoint}`;
  console.log(`UAZAPI Admin Request: ${method} ${url}`);
  
  if (!UAZAPI_URL) {
    throw new Error("UAZAPI_URL não configurada. Adicione a secret nas configurações.");
  }
  
  if (!UAZAPI_ADMIN_TOKEN) {
    throw new Error("UAZAPI_ADMIN_TOKEN não configurado. Adicione a secret nas configurações.");
  }
  
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "admintoken": UAZAPI_ADMIN_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.log(`UAZAPI Response (${response.status}):`, responseText);
  
  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`UAZAPI retornou resposta inválida: ${responseText.slice(0, 200)}`);
  }
  
  if (!response.ok) {
    const errorMsg = (data as { message?: string })?.message || 
                     (data as { error?: string })?.error || 
                     `UAZAPI error: ${response.status}`;
    throw new Error(errorMsg);
  }
  
  return data;
}

// Request helper for instance endpoints (using token header)
export async function uazapiInstanceRequest(endpoint: string, method: string, instanceToken: string, body?: unknown) {
  const url = `${UAZAPI_URL}${endpoint}`;
  console.log(`UAZAPI Instance Request: ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "token": instanceToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.log(`UAZAPI Response (${response.status}):`, responseText);
  
  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`UAZAPI retornou resposta inválida: ${responseText.slice(0, 200)}`);
  }
  
  // Handle 503 specifically for WhatsApp disconnected state
  if (response.status === 503) {
    const errorMsg = (data as { message?: string })?.message || "";
    const isDisconnected = errorMsg.toLowerCase().includes("disconnected") || 
                           errorMsg.toLowerCase().includes("desconectado") ||
                           errorMsg.toLowerCase().includes("not connected");
    
    if (isDisconnected) {
      console.error(`[UAZAPI ERROR] Endpoint: ${endpoint}, Status: 503, Token: ${instanceToken?.slice(0,8)}..., Error: WHATSAPP_DISCONNECTED`);
      throw new Error("WHATSAPP_DISCONNECTED: WhatsApp desconectado. Reconecte sua integração nas configurações.");
    }
  }
  
  if (!response.ok) {
    const errorMsg = (data as { message?: string })?.message || 
                     (data as { error?: string })?.error || 
                     `UAZAPI error: ${response.status}`;
    console.error(`[UAZAPI ERROR] Endpoint: ${endpoint}, Status: ${response.status}, Token: ${instanceToken?.slice(0,8)}..., Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  return data;
}

// Helper function with retry logic and exponential backoff for transient errors
export async function uazapiInstanceRequestWithRetry(
  endpoint: string, 
  method: string, 
  instanceToken: string, 
  body?: unknown,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<unknown> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uazapiInstanceRequest(endpoint, method, instanceToken, body);
    } catch (error) {
      lastError = error as Error;
      const errorMsg = lastError.message || "";
      
      // Don't retry for client errors (4xx) or known permanent failures
      const isPermanentError = 
        errorMsg.includes("WHATSAPP_DISCONNECTED") ||
        errorMsg.includes("Invalid phone") ||
        errorMsg.includes("formato inválido") ||
        errorMsg.includes("não encontrado") ||
        errorMsg.includes("not found") ||
        errorMsg.includes("no LID found") ||
        errorMsg.includes("Could not parse") ||
        errorMsg.includes("not valid") ||
        errorMsg.includes("número inválido");
      
      if (isPermanentError) {
        console.log(`[RETRY] Permanent error on attempt ${attempt}, not retrying: ${errorMsg}`);
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[RETRY] Attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms: ${errorMsg}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.log(`[RETRY] All ${maxRetries} attempts failed for ${endpoint}: ${errorMsg}`);
      }
    }
  }
  
  throw lastError || new Error("Unknown error after retries");
}
