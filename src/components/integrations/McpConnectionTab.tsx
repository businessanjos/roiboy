import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bot, CheckCircle2, Copy, Info } from "lucide-react";

export function McpConnectionTab() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const mcpUrl = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mcp` : "";

  const copyLink = () => {
    if (!mcpUrl) return;
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    toast({ title: "Link MCP copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Assistente IA no Claude</CardTitle>
                <CardDescription>
                  Conecte o Claude Desktop ao ROY para consultar vendas, ligações, metas e RoyZapp com IA.
                </CardDescription>
              </div>
            </div>
            <Badge variant="default" className="gap-1 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              Pronto
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm font-medium">Link do servidor MCP</p>
                <Input value={mcpUrl || "Publicar o app para gerar o link"} readOnly className="font-mono text-sm" />
              </div>
              <Button
                variant="outline"
                onClick={copyLink}
                disabled={!mcpUrl}
                className="shrink-0"
              >
                {copied ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Copiado</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copiar link</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Esse link é único do app. Cole ele no Claude Desktop.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Passo a passo</p>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                <span>Clique em <strong>Copiar link</strong> acima.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                <span>No Claude Desktop, vá em <strong>Settings → Developer → Edit config</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                <span>Cole o link dentro de <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">mcpServers</code>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>
                <span>Feche e abra o Claude Desktop.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">5</span>
                <span>Faça login com sua conta do ROY e clique em <strong>Autorizar</strong>.</span>
              </li>
            </ol>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Info className="h-5 w-5 shrink-0 text-primary" />
            <p>
              Cada gestor conecta com sua própria conta. O Claude enxerga apenas os dados que você já tem permissão no ROY: vendas, ligações da 3C Plus, metas/comissões e RoyZapp.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
