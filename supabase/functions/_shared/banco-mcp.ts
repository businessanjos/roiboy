// Helper para chamar o MCP server do banco.mcp.ai (Open Finance Brasil)
// Usa JSON-RPC 2.0 via Streamable HTTP

export interface McpToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
  structuredContent?: unknown;
}

export async function callMcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const url = Deno.env.get("BANCO_MCP_URL");
  const token = Deno.env.get("BANCO_MCP_TOKEN");
  if (!url) throw new Error("BANCO_MCP_URL não configurado");
  if (!token) throw new Error("BANCO_MCP_TOKEN não configurado");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  const ct = res.headers.get("content-type") ?? "";
  let payload: any;
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    // Parse última linha "data: ..." como JSON
    const dataLine = text.split("\n").reverse().find((l) => l.startsWith("data:"));
    payload = dataLine ? JSON.parse(dataLine.slice(5).trim()) : {};
  } else {
    payload = await res.json();
  }

  if (!res.ok || payload.error) {
    throw new Error(
      `banco.mcp.ai erro [${res.status}]: ${JSON.stringify(payload.error ?? payload)}`
    );
  }

  const result: McpToolCallResult = payload.result ?? {};
  if (result.isError) {
    throw new Error(`Tool ${toolName} retornou erro: ${JSON.stringify(result.content)}`);
  }

  // Preferir structuredContent, fallback para parsing do primeiro content text
  if (result.structuredContent !== undefined) return result.structuredContent as T;
  const firstText = result.content?.find((c) => c.type === "text")?.text;
  if (firstText) {
    try {
      return JSON.parse(firstText) as T;
    } catch {
      return firstText as unknown as T;
    }
  }
  return result as unknown as T;
}
